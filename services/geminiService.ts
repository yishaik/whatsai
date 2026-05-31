import type { Persona, Message, Source } from '../types';

type PersonaResponsePayload = {
  text: string;
  sources: Source[];
};

type AvatarPayload = {
  image: string;
};

// Strip avatar from persona to reduce request size
const stripAvatar = (persona: Persona): Omit<Persona, 'avatar'> => {
  const { avatar, ...rest } = persona;
  return rest;
};

// Matches the Vercel function `maxDuration` in vercel.json.
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 1;

const postJson = async <T>(url: string, body: unknown, externalSignal?: AbortSignal): Promise<T> => {
  let lastError: Error = new Error('Request failed.');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (externalSignal?.aborted) {
      throw new DOMException('The request was aborted.', 'AbortError');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const error = new Error(payload?.error || `Request failed with status ${response.status}`);
        // Retry only transient server errors; surface 4xx immediately.
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = error;
          continue;
        }
        throw error;
      }

      return payload as T;
    } catch (error) {
      // A caller-initiated abort (e.g. chat switch) must propagate, not retry.
      if (externalSignal?.aborted) {
        throw new DOMException('The request was aborted.', 'AbortError');
      }

      // AbortError (timeout) and TypeError (network failure) are transient — retry.
      const isTransient =
        error instanceof DOMException && error.name === 'AbortError' || error instanceof TypeError;

      if (isTransient && attempt < MAX_RETRIES) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('The request timed out. Please try again.');
      }
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }

  throw lastError;
};

export const generatePersonaResponse = async (
  persona: Persona,
  chatTopic: string,
  history: Message[],
  allPersonasInChat: Persona[],
  personasMap: { [id: string]: Persona },
  model: string,
  // Image attachments on the triggering user message, passed to the model as
  // vision input. The server fetches the bytes from these URLs.
  images: { url: string; mimeType: string }[] = [],
  signal?: AbortSignal
): Promise<PersonaResponsePayload> => {
  // Strip avatar fields to reduce payload size (avoids 413 errors)
  const strippedPersonasMap: { [id: string]: Omit<Persona, 'avatar'> } = {};
  for (const [id, p] of Object.entries(personasMap)) {
    strippedPersonasMap[id] = stripAvatar(p);
  }

  return postJson<PersonaResponsePayload>('/api/persona-response', {
    persona: stripAvatar(persona),
    chatTopic,
    history,
    allPersonasInChat: allPersonasInChat.map(stripAvatar),
    personasMap: strippedPersonasMap,
    model,
    images,
  }, signal);
};

// Streaming variant: posts with `stream: true`, reads Server-Sent Events, and
// invokes `onDelta` with the accumulated text as it grows. Resolves with the
// final text + sources. Throws on stream error or non-2xx (callers can fall
// back to the non-streaming generatePersonaResponse).
export const streamPersonaResponse = async (
  persona: Persona,
  chatTopic: string,
  history: Message[],
  allPersonasInChat: Persona[],
  personasMap: { [id: string]: Persona },
  model: string,
  images: { url: string; mimeType: string }[],
  onDelta: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<PersonaResponsePayload> => {
  const strippedPersonasMap: { [id: string]: Omit<Persona, 'avatar'> } = {};
  for (const [id, p] of Object.entries(personasMap)) {
    strippedPersonasMap[id] = stripAvatar(p);
  }

  const resp = await fetch('/api/persona-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      persona: stripAvatar(persona),
      chatTopic,
      history,
      allPersonasInChat: allPersonasInChat.map(stripAvatar),
      personasMap: strippedPersonasMap,
      model,
      images,
      stream: true,
    }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`Stream request failed with status ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let sources: Source[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const evt of events) {
      const dataLine = evt.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (!json) continue;
      let payload: any;
      try {
        payload = JSON.parse(json);
      } catch {
        continue;
      }
      if (payload.error) throw new Error(payload.error);
      if (typeof payload.delta === 'string') {
        fullText += payload.delta;
        onDelta(fullText);
      }
      if (payload.done) sources = payload.sources ?? [];
    }
  }

  return { text: fullText.trim(), sources };
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
