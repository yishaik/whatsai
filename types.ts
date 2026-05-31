export interface Persona {
  id: string;
  name: string;
  avatar: string; // base64 data URL of the avatar image
  prompt: string;
  canSearch?: boolean;
  model?: string; // optional per-persona model override (registry id)
}

export interface Source {
  title: string;
  uri: string;
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
}