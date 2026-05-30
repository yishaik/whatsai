import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Cap how many of a chat's most recent messages load at once. Bounds payload
// for long chats; older messages are not fetched.
const MESSAGE_LIMIT = 200;
// Cap list queries so a growing public app doesn't ship the whole table.
const CHAT_ROOM_LIMIT = 200;
const PERSONA_LIMIT = 200;

// Minimal structural type for the parts of ctx.storage we read (works for both
// query and mutation contexts).
type AvatarStorage = { getUrl: (id: Id<"_storage">) => Promise<string | null> };

// Resolve the renderable avatar string for a doc: prefer a file-storage URL,
// fall back to any legacy inline avatar. Returned as `avatar` so clients are
// unaware of where the image is stored.
const resolveAvatar = async (
  storage: AvatarStorage,
  doc: { avatar?: string; avatarStorageId?: Id<"_storage"> },
): Promise<string> => {
  if (doc.avatarStorageId) {
    const url = await storage.getUrl(doc.avatarStorageId);
    if (url) return url;
  }
  return doc.avatar ?? "";
};

// Generate a short-lived URL the client can POST an avatar image to.
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// ==================== PERSONAS ====================

// Get all personas
export const getAllPersonas = query({
  handler: async (ctx) => {
    const personas = await ctx.db
      .query("personas")
      .order("desc")
      .take(PERSONA_LIMIT);
    return await Promise.all(
      personas.map(async (p) => ({
        ...p,
        avatar: await resolveAvatar(ctx.storage, p),
      })),
    );
  },
});

// Create a new persona
export const createPersona = mutation({
  args: {
    name: v.string(),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    prompt: v.string(),
    canSearch: v.boolean(),
  },
  handler: async (ctx, args) => {
    const personaId = await ctx.db.insert("personas", {
      ...args,
      createdAt: Date.now(),
    });
    return personaId;
  },
});

// Update a persona
export const updatePersona = mutation({
  args: {
    id: v.id("personas"),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    prompt: v.optional(v.string()),
    canSearch: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    // When a new stored avatar is set, drop any stale inline avatar and delete
    // the previous stored image so it doesn't leak.
    if (updates.avatarStorageId) {
      const existing = await ctx.db.get(id);
      if (existing?.avatarStorageId && existing.avatarStorageId !== updates.avatarStorageId) {
        await ctx.storage.delete(existing.avatarStorageId);
      }
      updates.avatar = undefined;
    }
    await ctx.db.patch(id, updates);
  },
});

// Delete a persona
export const deletePersona = mutation({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    const persona = await ctx.db.get(args.id);
    if (persona?.avatarStorageId) {
      await ctx.storage.delete(persona.avatarStorageId);
    }
    await ctx.db.delete(args.id);
  },
});

// ==================== CHAT ROOMS ====================

// Get all chat rooms
export const getAllChatRooms = query({
  handler: async (ctx) => {
    const rooms = await ctx.db
      .query("chatRooms")
      .order("desc")
      .take(CHAT_ROOM_LIMIT);
    return await Promise.all(
      rooms.map(async (r) => ({
        ...r,
        avatar: await resolveAvatar(ctx.storage, r),
      })),
    );
  },
});

// Get a single chat room
export const getChatRoom = query({
  args: { id: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id);
    if (!room) return null;
    return { ...room, avatar: await resolveAvatar(ctx.storage, room) };
  },
});

// Create a new chat room
export const createChatRoom = mutation({
  args: {
    topic: v.string(),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    personaIds: v.array(v.id("personas")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const chatRoomId = await ctx.db.insert("chatRooms", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return chatRoomId;
  },
});

// Update a chat room
export const updateChatRoom = mutation({
  args: {
    id: v.id("chatRooms"),
    topic: v.optional(v.string()),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    personaIds: v.optional(v.array(v.id("personas"))),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    if (updates.avatarStorageId) {
      const existing = await ctx.db.get(id);
      if (existing?.avatarStorageId && existing.avatarStorageId !== updates.avatarStorageId) {
        await ctx.storage.delete(existing.avatarStorageId);
      }
      updates.avatar = undefined;
    }
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Delete a chat room and its messages
export const deleteChatRoom = mutation({
  args: { id: v.id("chatRooms") },
  handler: async (ctx, args) => {
    // Delete all messages in this chat room
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete any response claims for this chat room
    const claims = await ctx.db
      .query("responseClaims")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.id))
      .collect();

    for (const claim of claims) {
      await ctx.db.delete(claim._id);
    }

    // Delete the chat room (and its stored avatar, if any)
    const room = await ctx.db.get(args.id);
    if (room?.avatarStorageId) {
      await ctx.storage.delete(room.avatarStorageId);
    }
    await ctx.db.delete(args.id);
  },
});

// ==================== MESSAGES ====================

// Get the most recent messages for a chat room (capped to MESSAGE_LIMIT).
export const getMessages = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) =>
        q.eq("chatRoomId", args.chatRoomId),
      )
      .order("desc")
      .take(MESSAGE_LIMIT);
    // Return in chronological (ascending) order for display.
    return recent.reverse();
  },
});

// Add a message to a chat room
export const addMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    authorId: v.string(),
    text: v.string(),
    sources: v.optional(
      v.array(
        v.object({
          title: v.string(),
          uri: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      ...args,
      timestamp: Date.now(),
    });

    // Update chat room's updatedAt
    await ctx.db.patch(args.chatRoomId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

// Delete a message
export const deleteMessage = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ==================== RESPONSE CLAIMS ====================

// How long a claim is honored before it can be re-claimed. Covers the case
// where the client that won a claim closed/crashed before posting its reply.
const CLAIM_STALE_MS = 90_000;

// Atomically claim the right to generate one persona's reply to one user
// message. Returns true if this caller won the claim and should generate the
// response; false if another client already owns it. Convex mutations run with
// serializable isolation, so concurrent callers cannot both win.
export const claimResponseSlot = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    triggerMessageId: v.string(),
    personaId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("responseClaims")
      .withIndex("by_trigger_persona", (q) =>
        q.eq("triggerMessageId", args.triggerMessageId).eq("personaId", args.personaId),
      )
      .first();

    if (existing) {
      // Fresh claim owned by another client — caller should skip.
      if (now - existing.claimedAt < CLAIM_STALE_MS) {
        return false;
      }
      // Stale claim (likely a dropped client) — take it over.
      await ctx.db.patch(existing._id, { claimedAt: now });
      return true;
    }

    await ctx.db.insert("responseClaims", {
      chatRoomId: args.chatRoomId,
      triggerMessageId: args.triggerMessageId,
      personaId: args.personaId,
      claimedAt: now,
    });
    return true;
  },
});

// ==================== AVATAR MIGRATION ====================
// One-off migration of existing inline base64 avatars into file storage.
// Run with: npx convex run chat:migrateAvatarsToStorage
// Safe to re-run — only rows with an inline raster avatar and no storage id are
// touched. The small SVG default avatar is left inline.

const isMigratableAvatar = (avatar?: string): avatar is string =>
  !!avatar && avatar.startsWith("data:image/") && !avatar.startsWith("data:image/svg");

export const _avatarsToMigrate = internalQuery({
  handler: async (ctx) => {
    const personas = await ctx.db.query("personas").collect();
    const chatRooms = await ctx.db.query("chatRooms").collect();
    return {
      personas: personas
        .filter((p) => !p.avatarStorageId && isMigratableAvatar(p.avatar))
        .map((p) => ({ id: p._id, avatar: p.avatar as string })),
      chatRooms: chatRooms
        .filter((r) => !r.avatarStorageId && isMigratableAvatar(r.avatar))
        .map((r) => ({ id: r._id, avatar: r.avatar as string })),
    };
  },
});

export const _setPersonaAvatarStorage = internalMutation({
  args: { id: v.id("personas"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    await ctx.db.patch(id, { avatarStorageId: storageId, avatar: undefined });
  },
});

export const _setChatRoomAvatarStorage = internalMutation({
  args: { id: v.id("chatRooms"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    await ctx.db.patch(id, { avatarStorageId: storageId, avatar: undefined });
  },
});

const dataUriToBlob = (dataUri: string): Blob => {
  const [meta, base64] = dataUri.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
};

export const migrateAvatarsToStorage = action({
  handler: async (ctx): Promise<{ personas: number; chatRooms: number }> => {
    const { personas, chatRooms } = await ctx.runQuery(internal.chat._avatarsToMigrate);

    let personaCount = 0;
    for (const p of personas) {
      const storageId = await ctx.storage.store(dataUriToBlob(p.avatar));
      await ctx.runMutation(internal.chat._setPersonaAvatarStorage, { id: p.id, storageId });
      personaCount++;
    }

    let chatRoomCount = 0;
    for (const r of chatRooms) {
      const storageId = await ctx.storage.store(dataUriToBlob(r.avatar));
      await ctx.runMutation(internal.chat._setChatRoomAvatarStorage, { id: r.id, storageId });
      chatRoomCount++;
    }

    return { personas: personaCount, chatRooms: chatRoomCount };
  },
});
