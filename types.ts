export interface Persona {
  id: string;
  name: string;
  avatar: string; // base64 data URL of the avatar image
  prompt: string;
  canSearch?: boolean;
}

export interface Source {
  title: string;
  uri: string;
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
}