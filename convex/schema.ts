import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // פרסונות (דמויות AI)
  personas: defineTable({
    name: v.string(),
    avatar: v.string(), // base64 compressed
    prompt: v.string(),
    canSearch: v.boolean(),
    createdAt: v.number(),
  }),

  // חדרי צ'אט
  chatRooms: defineTable({
    topic: v.string(),
    avatar: v.optional(v.string()), // base64 compressed group avatar
    personaIds: v.array(v.id("personas")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // הודעות
  messages: defineTable({
    chatRoomId: v.id("chatRooms"),
    authorId: v.string(), // 'user' or persona ID
    text: v.string(),
    timestamp: v.number(),
    sources: v.optional(
      v.array(
        v.object({
          title: v.string(),
          uri: v.string(),
        })
      ),
    ),
  }).index("by_chat_room", ["chatRoomId"]),
});
