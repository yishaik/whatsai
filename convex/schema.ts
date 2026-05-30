import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth tables (users, authAccounts, authSessions, ...).
  ...authTables,

  // פרסונות (דמויות AI)
  personas: defineTable({
    name: v.string(),
    // Legacy inline avatar (base64 data URI). New avatars live in file storage
    // (avatarStorageId); kept optional for the small SVG default and old rows.
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    prompt: v.string(),
    canSearch: v.boolean(),
    createdAt: v.number(),
  }),

  // חדרי צ'אט
  chatRooms: defineTable({
    topic: v.string(),
    avatar: v.optional(v.string()), // legacy inline base64 group avatar
    avatarStorageId: v.optional(v.id("_storage")),
    personaIds: v.array(v.id("personas")),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Owner of the room. Optional for back-compat: legacy rows predate auth and
    // have no owner — they are treated as public, unowned rooms.
    ownerId: v.optional(v.id("users")),
    // Absent visibility is treated as "public" so existing rooms keep working
    // with no data migration.
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
  }).index("by_owner", ["ownerId"]),

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
    // User-uploaded files attached to the message (bounded — capped client-side).
    // Bytes live in file storage; only a reference is stored here.
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          mimeType: v.string(),
          size: v.number(),
        }),
      ),
    ),
  }).index("by_chat_room", ["chatRoomId"]),

  // Atomic claims so only one client generates a given persona's reply to a
  // given user message (chats are shared/public — multiple clients observe the
  // same message and would otherwise each generate a duplicate response).
  responseClaims: defineTable({
    chatRoomId: v.id("chatRooms"),
    triggerMessageId: v.string(), // the user message that triggered responses
    personaId: v.string(),
    claimedAt: v.number(),
  })
    .index("by_trigger_persona", ["triggerMessageId", "personaId"])
    .index("by_chat_room", ["chatRoomId"]),
});
