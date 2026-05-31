import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Public read-only sharing of a chat via an opaque token. The viewer needs no
// account; getSharedChat gates purely on a valid shareId.

const genToken = (): string => crypto.randomUUID().replace(/-/g, "");

const resolveAvatar = async (
  ctx: QueryCtx | MutationCtx,
  doc: { avatar?: string; avatarStorageId?: Id<"_storage"> },
): Promise<string> => {
  if (doc.avatarStorageId) {
    const url = await ctx.storage.getUrl(doc.avatarStorageId);
    if (url) return url;
  }
  return doc.avatar ?? "";
};

// Owner-only: an owned room requires the owner; a legacy unowned public room is
// open to any authed identity; private rooms need the owner.
const assertCanShare = (
  room: { ownerId?: Id<"users">; visibility?: "public" | "private" },
  userId: Id<"users"> | null,
) => {
  if (room.ownerId) {
    if (room.ownerId !== userId) throw new Error("Unauthorized");
  } else if (room.visibility === "private") {
    throw new Error("Unauthorized");
  } else if (!userId) {
    throw new Error("Not authenticated");
  }
};

// Create (or return the existing) share token for a chat.
export const createShareLink = mutation({
  args: { chatId: v.id("chatRooms") },
  handler: async (ctx, args): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    const room = await ctx.db.get(args.chatId);
    if (!room) throw new Error("Chat room not found");
    assertCanShare(room, userId);
    if (room.shareId) return room.shareId;
    const shareId = genToken();
    await ctx.db.patch(args.chatId, { shareId });
    return shareId;
  },
});

// Stop sharing: clears the token so the link 404s.
export const revokeShareLink = mutation({
  args: { chatId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const room = await ctx.db.get(args.chatId);
    if (!room) return;
    assertCanShare(room, userId);
    await ctx.db.patch(args.chatId, { shareId: undefined });
  },
});

// Public, unauthenticated read-only view of a shared chat.
export const getSharedChat = query({
  args: { shareId: v.string() },
  handler: async (ctx, args) => {
    if (!args.shareId) return null;
    const room = await ctx.db
      .query("chatRooms")
      .withIndex("by_share", (q) => q.eq("shareId", args.shareId))
      .first();
    if (!room || !room.shareId) return null;

    const personas = await ctx.db.query("personas").take(200);
    const pmap: Record<string, { name: string; avatar: string }> = {};
    for (const p of personas) {
      pmap[p._id] = { name: p.name, avatar: await resolveAvatar(ctx, p) };
    }

    const recent = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", room._id))
      .order("desc")
      .take(200);
    const ordered = recent.reverse();

    const messages = await Promise.all(
      ordered.map(async (m) => ({
        id: m._id,
        authorId: m.authorId,
        authorName: m.authorId === "user" ? "User" : pmap[m.authorId]?.name ?? "Unknown",
        authorAvatar: m.authorId === "user" ? "" : pmap[m.authorId]?.avatar ?? "",
        text: m.text,
        timestamp: m.timestamp,
        sources: m.sources ?? [],
        attachments: m.attachments
          ? await Promise.all(
              m.attachments.map(async (a) => ({
                name: a.name,
                mimeType: a.mimeType,
                url: await ctx.storage.getUrl(a.storageId),
              })),
            )
          : [],
      })),
    );

    return {
      topic: room.topic,
      avatar: await resolveAvatar(ctx, room),
      messages,
    };
  },
});
