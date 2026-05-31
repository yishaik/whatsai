// Model registry helpers for the client. The actual selectable list is fetched
// live from /api/models (see hooks/useModels); this provides the fallback list
// and id-based helpers that work for any model id without the full list.

export type ModelProvider = 'gemini' | 'openai';

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
}

// Used before /api/models responds, or if it fails / a key is missing.
export const FALLBACK_MODELS: ModelOption[] = [
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', provider: 'gemini' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', provider: 'openai' },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
];

// The fallback default before a user has chosen one.
export const DEFAULT_MODEL_ID = 'gemini-3.1-flash-lite-preview';

// Provider from the id alone (OpenAI ids start with gpt/o-series/chatgpt).
export const providerForModel = (id: string): ModelProvider =>
  /^(gpt|o\d|chatgpt)/i.test(id) ? 'openai' : 'gemini';

// Friendly label for an id, looked up in a (fetched) list, else the id itself.
export const findModelLabel = (models: ModelOption[], id: string): string =>
  models.find((m) => m.id === id)?.label ?? id;
