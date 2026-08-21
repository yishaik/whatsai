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
    // Optional per-persona model override (id from the shared model registry).
    // When unset, the user's default model is used.
    model: v.optional(v.string()),
    // Enabled capability ids (e.g. "web_search", "fetch_url", "calculate").
    // `canSearch` is kept for back-compat and mirrors the "web_search" skill.
    skills: v.optional(v.array(v.string())),
    // Long-term memory opt-in (napkin-style). Optional + absent = OFF, so every
    // existing persona keeps today's behavior with no migration. See
    // convex/personaMemory.ts and memory/.
    memoryEnabled: v.optional(v.boolean()),
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
    // Per-chat reply settings (all optional; absent = app defaults). `model` is
    // a chat-level default in the fallback chain persona.model → chat.model →
    // user default. `temperature` overrides the sampling temperature.
    // `maxResponders` caps how many participants reply to each user message.
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxResponders: v.optional(v.number()),
    // Persona-to-persona auto-conversation rounds after a user message (0 = off).
    riffRounds: v.optional(v.number()),
    // Opaque token for a public read-only share link. Absent = not shared.
    shareId: v.optional(v.string()),
    // Rolling memory for long chats: a running summary of older messages,
    // injected as background context. `summaryUntil` is the timestamp of the
    // newest message covered; `summaryAt` is when it was last refreshed.
    summary: v.optional(v.string()),
    summaryUntil: v.optional(v.number()),
    summaryAt: v.optional(v.number()),
    // Denormalized message counter (cheap trigger for summarization on long chats).
    messageCount: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_share", ["shareId"]),

  // Per-user preferences (e.g. the default model for persona replies).
  userSettings: defineTable({
    userId: v.id("users"),
    defaultModel: v.string(),
    voiceProvider: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Fixed-window rate-limit counters, keyed by `${userId}:${action}`.
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStart: v.number(),
  }).index("by_key", ["key"]),

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
  })
    .index("by_chat_room", ["chatRoomId"])
    .searchIndex("search_text", { searchField: "text", filterFields: ["chatRoomId"] }),

  // Cached link previews (OpenGraph metadata), keyed by URL. Populated by a
  // scheduled action when a message containing a URL is posted; messages render
  // a card by reactively querying this table.
  linkPreviews: defineTable({
    url: v.string(),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("error")),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    siteName: v.optional(v.string()),
    fetchedAt: v.number(),
  }).index("by_url", ["url"]),

  // User-scheduled reminders / recurring messages. A reminder is delivered by
  // posting `text` into `chatId` as `personaId` at `nextRunAt`; recurring ones
  // re-schedule themselves after each fire. `scheduledFnId` is the pending
  // Convex scheduled-function id so it can be cancelled.
  reminders: defineTable({
    userId: v.id("users"),
    chatId: v.id("chatRooms"),
    personaId: v.string(), // delivering persona (authorId on the posted message)
    text: v.string(),
    nextRunAt: v.number(), // epoch ms of the next (or only) firing
    repeat: v.union(
      v.literal("none"),
      v.literal("hourly"),
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
    ),
    active: v.boolean(),
    scheduledFnId: v.optional(v.id("_scheduled_functions")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_chat", ["chatId"]),

  // Napkin-style long-term memory for personas. One logical vault per user:
  // durable facts a persona learns ("the user's dog is Rex") live as markdown
  // notes here and are recalled via progressive disclosure (see
  // convex/personaMemory.ts + memory/). `scope: "user"` notes are shared across
  // all of a user's personas; `scope: "persona"` notes are namespaced to one
  // persona via `personaId`. `title` is the topic/note name; `content` is its
  // markdown body, appended to as new facts arrive.
  personaMemories: defineTable({
    ownerId: v.id("users"),
    scope: v.union(v.literal("user"), v.literal("persona")),
    personaId: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_scope", ["ownerId", "scope"])
    // Native full-text search over note bodies, scoped per owner. Recall queries
    // the index directly instead of loading the whole vault into an in-memory
    // MiniSearch index each call (see convex/personaMemoryEngine.ts).
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["ownerId", "scope", "personaId"],
    }),

  // Per-user, per-model token usage (running totals), for the usage dashboard.
  // One row per (userId, model); incremented after each reply.
  usage: defineTable({
    userId: v.id("users"),
    model: v.string(),
    provider: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    requests: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_model", ["userId", "model"]),

  // Web Push subscriptions, so reminders can alert the user when the app is
  // closed. One row per browser/device endpoint; keys are the standard
  // PushSubscription fields. Pruned on 404/410 from the push service.
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

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
