// @vitest-environment edge-runtime
//
// Integration test for the REAL Convex memory functions (convex/personaMemory.ts)
// running through convex-test: the in-memory Convex runtime with our actual
// schema, search index, and auth. This is the closest faithful proof of the
// end-to-end acceptance — "tell a persona a fact in one session, recall it in a
// fresh session" — exercised through the production server functions rather than
// the engine in isolation.

import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

// convex-test needs every Convex module, including the generated ones; Vite's
// import.meta.glob supplies them (the canonical `*.*s` catches .ts and .js).
const modules = import.meta.glob("../convex/**/*.*s");

// Convex Auth derives the user id from `identity.subject` as the part before "|"
// (TOKEN_SUB_CLAIM_DIVIDER). A fresh "session" is the same user id with a
// different session suffix — exactly what getAuthUserId() collapses back to one
// user, which is why memory persists across sessions.
const sessionSubject = (userId: Id<"users">, session: string) => `${userId}|${session}`;

const seedUser = async (t: ReturnType<typeof convexTest>): Promise<Id<"users">> =>
  await t.run(async (ctx) => await ctx.db.insert("users", {}));

describe("personaMemory — Convex integration (convex-test)", () => {
  it("remembers a fact in one session and recalls it in a fresh session", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);

    // ── Session 1: the persona learns a durable fact. ──
    const s1 = t.withIdentity({ subject: sessionSubject(userId, "session-1") });
    const wrote = await s1.mutation(api.personaMemory.remember, {
      facts: [{ fact: "The user's dog is named Rex", topic: "user" }],
      scope: "user",
    });
    expect(wrote.written).toBe(1);

    // ── Session 2: a brand-new session (same user) recalls it. ──
    const s2 = t.withIdentity({ subject: sessionSubject(userId, "session-2") });
    const recalled = await s2.query(api.personaMemory.recall, { query: "dog" });
    expect(recalled.block).toContain("Rex");
    expect(recalled.estTokens).toBeGreaterThan(0);
  });

  it("de-duplicates: re-remembering the same fact writes nothing the second time", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: sessionSubject(userId, "s") });

    const first = await asUser.mutation(api.personaMemory.remember, {
      facts: [{ fact: "Lives in Haifa", topic: "user" }],
    });
    expect(first.written).toBe(1);

    const second = await asUser.mutation(api.personaMemory.remember, {
      facts: [{ fact: "lives in haifa", topic: "user" }], // same fact, different case
    });
    expect(second.written).toBe(0);

    // The vault holds exactly one "user" note with a single Haifa bullet.
    const notes = await t.run(async (ctx) =>
      ctx.db
        .query("personaMemories")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect(),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].content.match(/haifa/gi)?.length).toBe(1);
  });

  it("returns an empty block for a signed-out caller and refuses to write", async () => {
    const t = convexTest(schema, modules);
    const recalled = await t.query(api.personaMemory.recall, { query: "anything" });
    expect(recalled.block).toBe("");
    await expect(
      t.mutation(api.personaMemory.remember, { facts: [{ fact: "x", topic: "user" }] }),
    ).rejects.toThrow();
  });

  it("scopes persona-namespaced notes: a persona only sees user notes + its own", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: sessionSubject(userId, "s") });

    // A shared user fact, plus a persona-scoped fact for persona "A".
    await asUser.mutation(api.personaMemory.remember, {
      facts: [{ fact: "The user is a doctor", topic: "user" }],
      scope: "user",
    });
    await asUser.mutation(api.personaMemory.remember, {
      facts: [{ fact: "Persona A nicknamed the user Captain", topic: "nicknames" }],
      personaId: "personaA",
      scope: "persona",
    });

    // Persona A sees both the shared and its own note.
    const aRecall = await asUser.query(api.personaMemory.recall, {
      query: "captain doctor",
      personaId: "personaA",
    });
    expect(aRecall.block).toContain("Captain");
    expect(aRecall.block).toContain("doctor");

    // Persona B sees the shared user note but NOT persona A's namespaced note.
    const bRecall = await asUser.query(api.personaMemory.recall, {
      query: "captain doctor",
      personaId: "personaB",
    });
    expect(bRecall.block).toContain("doctor");
    expect(bRecall.block).not.toContain("Captain");
  });
});
