import type { Persona, Message, Source } from '../types';

type PersonaResponsePayload = {
  text: string;
  sources: Source[];
};

type AvatarPayload = {
  image: string;
};

const postJson = async <T>(url: string, body: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let payload: any = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload as T;
};

export const generatePersonaResponse = async (
  persona: Persona,
  chatTopic: string,
  history: Message[],
  allPersonasInChat: Persona[],
  personasMap: { [id: string]: Persona }
): Promise<PersonaResponsePayload> => {
  return postJson<PersonaResponsePayload>('/api/persona-response', {
    persona,
    chatTopic,
    history,
    allPersonasInChat,
    personasMap,
  });
};

export const generateAvatar = async (name: string, prompt: string): Promise<string> => {
  const { image } = await postJson<AvatarPayload>('/api/avatar', {
    name,
    prompt,
  });

  return image;
};

export const generateGroupChatAvatar = async (topic: string, personaNames: string[]): Promise<string> => {
  const { image } = await postJson<AvatarPayload>('/api/group-avatar', {
    topic,
    personaNames,
  });

  return image;
};
