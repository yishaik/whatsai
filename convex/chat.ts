import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ==================== PERSONAS ====================

// Get all personas
export const getAllPersonas = query({
  handler: async (ctx) => {
    return await ctx.db.query("personas").order("desc").collect();
  },
});

// Create a new persona
export const createPersona = mutation({
  args: {
    name: v.string(),
    avatar: v.string(),
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
    prompt: v.optional(v.string()),
    canSearch: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Delete a persona
export const deletePersona = mutation({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ==================== CHAT ROOMS ====================

// Get all chat rooms
export const getAllChatRooms = query({
  handler: async (ctx) => {
    return await ctx.db.query("chatRooms").order("desc").collect();
  },
});

// Get a single chat room
export const getChatRoom = query({
  args: { id: v.id("chatRooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new chat room
export const createChatRoom = mutation({
  args: {
    topic: v.string(),
    avatar: v.optional(v.string()),
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
    personaIds: v.optional(v.array(v.id("personas"))),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
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

    // Delete the chat room
    await ctx.db.delete(args.id);
  },
});

// ==================== MESSAGES ====================

// Get messages for a chat room
export const getMessages = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) =>
        q.eq("chatRoomId", args.chatRoomId),
      )
      .order("asc")
      .collect();
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
