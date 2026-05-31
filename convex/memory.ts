import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Rolling chat memory: summarize older messages of a long chat into a compact
// running summary stored on the chat room, injected as background context so
// personas retain history beyond the loaded window. The LLM call goes through
// the Vercel /api/summarize endpoint (which holds the Gemini key), so no key is
// needed in Convex env. Best-effort: any failure is a silent no-op.

const KEEP_RECENT = 150; // recent messages kept verbatim (client also loads them)
const FETCH_WINDOW = 400; // newest messages scanned per summarization
const MIN_OLDER = 30; // don't bother summarizing fewer than this many older msgs

export const getSummarizationInput = internalQuery({
  args: { chatId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatId))
      .order("desc")
      .take(FETCH_WINDOW);
    if (recent.length <= KEEP_RECENT + MIN_OLDER) return { needed: false as const };

    const asc = recent.reverse();
    const older = asc.slice(0, asc.length - KEEP_RECENT);
    if (older.length < MIN_OLDER) return { needed: false as const };

    const room = await ctx.db.get(args.chatId);

    // Author-name map for a readable transcript.
    const personas = await ctx.db.query("personas").take(200);
    const names: Record<string, string> = {};
    for (const p of personas) names[p._id] = p.name;

    const transcript = older
      .map((m) => `${m.authorId === "user" ? "User" : names[m.authorId] ?? "Unknown"}: ${m.text}`)
      .join("\n");

    return {
      needed: true as const,
      transcript,
      existingSummary: room?.summary ?? "",
      summaryUntil: older[older.length - 1].timestamp,
    };
  },
});

export const saveSummary = internalMutation({
  args: { chatId: v.id("chatRooms"), summary: v.string(), summaryUntil: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, {
      summary: args.summary,
      summaryUntil: args.summaryUntil,
      summaryAt: Date.now(),
    });
  },
});

export const maybeSummarize = internalAction({
  args: { chatId: v.id("chatRooms") },
  handler: async (ctx, args): Promise<void> => {
    try {
      const input = await ctx.runQuery(internal.memory.getSummarizationInput, { chatId: args.chatId });
      if (!input.needed) return;
      const base = process.env.SITE_URL || "https://whatsai.yishaik.com";
      const resp = await fetch(`${base}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: input.transcript, existingSummary: input.existingSummary }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
      if (summary) {
        await ctx.runMutation(internal.memory.saveSummary, {
          chatId: args.chatId,
          summary,
          summaryUntil: input.summaryUntil,
        });
      }
    } catch (error) {
      console.error("maybeSummarize failed (no-op):", error);
    }
  },
});
