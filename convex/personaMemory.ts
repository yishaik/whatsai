import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexSearchEngine } from "./personaMemoryEngine";
import { recallMemory } from "../memory/recall";
import { factToNoteLine, factsByTopic, sanitizeTopic } from "../memory/distill";
import { mergeNoteContent, MAX_FACTS_PER_NOTE, MAX_NOTES_PER_VAULT } from "../memory/hygiene";

// ── Napkin-style persona memory, serverless edition ──────────────────────────
//
// Production binding of the MemoryEngine contract. napkin's file vault can't
// live here — Convex functions run in an fs-less V8 isolate and Vercel's disk is
// ephemeral — so durable memory lives in the `personaMemories` table, ONE logical
// vault per user (facts about the user are shared across all personas they talk
// to), with optional per-persona namespacing.
//
// Recall ranks via Convex's NATIVE full-text search index (ConvexSearchEngine),
// not a per-call in-memory MiniSearch index, so it no longer loads the whole
// vault each turn. Writes go through `remember`, which applies hygiene (dedup +
// recency/count eviction) so the vault can't grow without bound.

const factArg = v.object({ fact: v.string(), topic: v.string() });

/**
 * Recall the user's memory for the current turn. Returns a budgeted memory block
 * the client passes to /api/persona-response as `memory` (injected next to the
 * rolling summary). Empty for signed-out users or an empty vault.
 */
export const recall = query({
  args: {
    query: v.string(),
    personaId: v.optional(v.string()),
    tokenBudget: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { block: "", estTokens: 0, usedNotes: [] };

    // The engine reads the database-native search index directly — progressive
    // disclosure (overview → search → read) without loading the whole vault.
    const engine = new ConvexSearchEngine(ctx, userId, args.personaId);
    const recalled = await recallMemory(engine, args.query, {
      tokenBudget: args.tokenBudget,
    });
    return {
      block: recalled.block,
      estTokens: recalled.estTokens,
      usedNotes: recalled.usedNotes,
    };
  },
});

// Evict the least-recently-updated notes until the vault is back within the
// per-user note cap. Bounds the number of distinct topic-notes for defense in
// depth (per-note bullets are capped separately by mergeNoteContent).
const evictOldestNotes = async (ctx: MutationCtx, ownerId: Id<"users">): Promise<void> => {
  const all = await ctx.db
    .query("personaMemories")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  if (all.length <= MAX_NOTES_PER_VAULT) return;
  const oldestFirst = [...all].sort((a, b) => a.updatedAt - b.updatedAt);
  for (const doc of oldestFirst.slice(0, all.length - MAX_NOTES_PER_VAULT)) {
    await ctx.db.delete(doc._id);
  }
};

/**
 * Persist durable facts a persona distilled from a turn (the parsed
 * `[[MEMORY]]` tokens). Facts are grouped into topic notes and merged with
 * hygiene applied: duplicates are dropped and each note is capped to its most
 * recent facts (napkin's create-then-append, over Convex, kept tidy).
 */
export const remember = mutation({
  args: {
    facts: v.array(factArg),
    personaId: v.optional(v.string()),
    scope: v.optional(v.union(v.literal("user"), v.literal("persona"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.facts.length === 0) return { written: 0 };

    const scope = args.scope ?? "user";
    const personaId = scope === "persona" ? args.personaId : undefined;
    const atIso = new Date(Date.now()).toISOString();

    const existing = await ctx.db
      .query("personaMemories")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    let written = 0;
    let insertedAny = false;
    for (const [rawTopic, facts] of factsByTopic(args.facts)) {
      const title = sanitizeTopic(rawTopic);
      const additions = facts.map((f) => factToNoteLine(f, atIso));
      const match = existing.find(
        (r) => r.scope === scope && r.title === title && r.personaId === personaId,
      );
      if (match) {
        // Merge into the existing note: dedup vs what's there, cap to recent.
        const { content, added } = mergeNoteContent(match.content, additions, MAX_FACTS_PER_NOTE);
        if (added > 0) {
          await ctx.db.patch(match._id, { content, updatedAt: Date.now() });
          written += added;
        }
      } else {
        // New note: dedup within this turn's additions, then create it.
        const { content, added } = mergeNoteContent(`# ${title}`, additions, MAX_FACTS_PER_NOTE);
        if (added > 0) {
          await ctx.db.insert("personaMemories", {
            ownerId: userId,
            scope,
            personaId,
            title,
            content,
            updatedAt: Date.now(),
          });
          written += added;
          insertedAny = true;
        }
      }
    }

    // Only the note-count can grow on a write, and only when a note was created.
    if (insertedAny) await evictOldestNotes(ctx, userId);

    return { written };
  },
});
