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

export interface Message {
  id: string;
  authorId: string; // 'user' or persona.id
  text: string;
  timestamp: number;
  sources?: Source[];
}

export interface ChatRoom {
  id:string;
  topic: string;
  avatar?: string; // base64 data URL of the chat avatar
  personaIds: string[];
  messages: Message[];
}