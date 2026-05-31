import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Token-usage tracking. The persona-response endpoint reports usage in its
// response; the client records it here (auth stays on the client). Stored as
// running per-(user, model) totals so the dashboard query stays cheap.

export const recordUsage = mutation({
  args: {
    model: v.string(),
    provider: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return; // anonymous-but-unauthed: skip silently
    // Guard against bad/negative numbers.
    const inputTokens = Math.max(0, Math.floor(args.inputTokens || 0));
    const outputTokens = Math.max(0, Math.floor(args.outputTokens || 0));
    if (inputTokens === 0 && outputTokens === 0) return;

    const existing = await ctx.db
      .query("usage")
      .withIndex("by_user_and_model", (q) => q.eq("userId", userId).eq("model", args.model))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        inputTokens: existing.inputTokens + inputTokens,
        outputTokens: existing.outputTokens + outputTokens,
        requests: existing.requests + 1,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("usage", {
      userId,
      model: args.model,
      provider: args.provider,
      inputTokens,
      outputTokens,
      requests: 1,
      updatedAt: Date.now(),
    });
  },
});

// The caller's usage broken down by model (most-used first).
export const getMyUsage = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("usage")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);
    return rows
      .map((r) => ({
        model: r.model,
        provider: r.provider,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        requests: r.requests,
      }))
      .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));
  },
});
