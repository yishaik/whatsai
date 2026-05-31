import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Reminders / recurring messages.
//
// Created from chat: a persona, when the user asks, emits a [[REMINDER]] token
// that the client parses and persists here. At `nextRunAt` the reminder is
// delivered by posting its text into the chat as the persona; recurring ones
// re-schedule themselves. Auth lives on the client mutation call — the Vercel
// AI endpoint never needs Convex credentials.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const REPEAT = v.union(
  v.literal("none"),
  v.literal("hourly"),
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
);

type Repeat = "none" | "hourly" | "daily" | "weekly" | "monthly";

// Advance a timestamp by one repeat interval.
const addInterval = (t: number, repeat: Repeat): number => {
  switch (repeat) {
    case "hourly":
      return t + HOUR;
    case "daily":
      return t + DAY;
    case "weekly":
      return t + 7 * DAY;
    case "monthly": {
      const d = new Date(t);
      d.setMonth(d.getMonth() + 1);
      return d.getTime();
    }
    default:
      return t;
  }
};

// The next occurrence strictly after `now`, advancing past any missed windows
// (e.g. if the deployment was idle). Bounded so a bad anchor can't spin.
const nextFutureOccurrence = (anchor: number, repeat: Repeat, now: number): number => {
  let t = addInterval(anchor, repeat);
  let guard = 0;
  while (t <= now && guard++ < 10000) t = addInterval(t, repeat);
  return t;
};

// Persist a reminder and schedule its first firing. Called by the client after
// a persona emits a reminder token, so auth is the caller's. Deduped per chat
// so the multi-persona reply loop can't create N copies of one reminder.
export const scheduleReminder = mutation({
  args: {
    chatId: v.id("chatRooms"),
    personaId: v.string(),
    text: v.string(),
    when: v.string(), // ISO 8601
    repeat: REPEAT,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const room = await ctx.db.get(args.chatId);
    if (!room) throw new Error("Chat room not found");
    // Private rooms are owner-only; public rooms accept any authed identity.
    if (room.visibility === "private" && room.ownerId !== userId) {
      throw new Error("Unauthorized");
    }

    const text = args.text.trim();
    if (!text) throw new Error("Reminder text is empty");

    const parsed = Date.parse(args.when);
    if (Number.isNaN(parsed)) throw new Error("Invalid reminder time");

    const now = Date.now();
    let when = parsed;
    if (when <= now) {
      // Model misjudged the time. For recurring, jump to the next real
      // occurrence; for one-off, fire shortly rather than dropping it.
      when = args.repeat === "none" ? now + 5000 : nextFutureOccurrence(when, args.repeat, now);
    }

    // Dedup: an active reminder in this chat with the same text + repeat firing
    // within a minute is treated as the same one (the reply loop runs every
    // persona, each of which may emit the token).
    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .take(200);
    const dup = existing.find(
      (r) =>
        r.active &&
        r.userId === userId &&
        r.repeat === args.repeat &&
        r.text.trim().toLowerCase() === text.toLowerCase() &&
        Math.abs(r.nextRunAt - when) < 60_000,
    );
    if (dup) return dup._id;

    const reminderId = await ctx.db.insert("reminders", {
      userId,
      chatId: args.chatId,
      personaId: args.personaId,
      text,
      nextRunAt: when,
      repeat: args.repeat,
      active: true,
      createdAt: now,
    });

    const scheduledFnId = await ctx.scheduler.runAt(when, internal.reminders.fire, { reminderId });
    await ctx.db.patch(reminderId, { scheduledFnId });
    return reminderId;
  },
});

// Deliver a reminder: post its text into the chat as the persona, then either
// re-schedule (recurring) or deactivate (one-off). Internal — only the
// scheduler calls this.
export const fire = internalMutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || !reminder.active) return;

    const room = await ctx.db.get(reminder.chatId);
    // Chat gone — stop the reminder so it doesn't keep firing into nothing.
    if (!room) {
      await ctx.db.patch(args.reminderId, { active: false, scheduledFnId: undefined });
      return;
    }

    await ctx.db.insert("messages", {
      chatRoomId: reminder.chatId,
      authorId: reminder.personaId,
      text: `⏰ ${reminder.text}`,
      timestamp: Date.now(),
    });
    await ctx.db.patch(reminder.chatId, { updatedAt: Date.now() });

    if (reminder.repeat === "none") {
      await ctx.db.patch(args.reminderId, { active: false, scheduledFnId: undefined });
      return;
    }

    const next = nextFutureOccurrence(reminder.nextRunAt, reminder.repeat, Date.now());
    const scheduledFnId = await ctx.scheduler.runAt(next, internal.reminders.fire, {
      reminderId: args.reminderId,
    });
    await ctx.db.patch(args.reminderId, { nextRunAt: next, scheduledFnId });
  },
});

// The caller's active reminders (most recent first). Names/topics are resolved
// client-side from data it already holds.
export const listMyReminders = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("reminders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    return rows
      .filter((r) => r.active)
      .map((r) => ({
        id: r._id,
        chatId: r.chatId,
        personaId: r.personaId,
        text: r.text,
        nextRunAt: r.nextRunAt,
        repeat: r.repeat,
      }));
  },
});

// Cancel (and remove) one of the caller's reminders, cancelling its pending fire.
export const cancelReminder = mutation({
  args: { id: v.id("reminders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const reminder = await ctx.db.get(args.id);
    if (!reminder) return;
    if (reminder.userId !== userId) throw new Error("Unauthorized");
    if (reminder.scheduledFnId) {
      await ctx.scheduler.cancel(reminder.scheduledFnId);
    }
    await ctx.db.delete(args.id);
  },
});
