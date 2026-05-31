export interface Persona {
  id: string;
  name: string;
  avatar: string; // base64 data URL of the avatar image
  prompt: string;
  canSearch?: boolean;
  model?: string; // optional per-persona model override (registry id)
  skills?: string[]; // enabled capability ids (see services/skills.ts)
}

export interface Source {
  title: string;
  uri: string;
}

// Token usage reported by the persona-response endpoint for a single reply.
export interface UsageInfo {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// Aggregated per-model usage row for the usage dashboard.
export interface UsageRow {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export type ReminderRepeat = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly';

// A reminder parsed from a persona reply, before it's persisted. `when` is an
// absolute ISO 8601 datetime; the Convex mutation resolves it to an epoch.
export interface ReminderInput {
  text: string;
  when: string;
  repeat: ReminderRepeat;
}

// A persisted, active reminder as listed for management.
export interface Reminder {
  id: string;
  chatId: string;
  personaId: string;
  text: string;
  nextRunAt: number;
  repeat: ReminderRepeat;
}

export interface Attachment {
  storageId: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string | null; // resolved fetchable URL (added by the server on read)
}

export interface Message {
  id: string;
  authorId: string; // 'user' or persona.id
  text: string;
  timestamp: number;
  sources?: Source[];
  attachments?: Attachment[];
}

export interface ChatRoom {
  id:string;
  topic: string;
  avatar?: string; // base64 data URL of the chat avatar
  personaIds: string[];
  messages: Message[];
  visibility?: 'public' | 'private';
  lastMessageText?: string;
  lastMessageTime?: number;
  // Per-chat reply settings (optional; absent = app defaults).
  model?: string; // chat-level default model (fallback between persona + user default)
  temperature?: number;
  maxResponders?: number; // cap on participants replying per user message
  riffRounds?: number; // persona-to-persona auto-conversation rounds (0 = off)
  shareId?: string; // public read-only share token (absent = not shared)
  summary?: string; // rolling memory of older messages (long chats)
}