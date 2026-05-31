// Shared model registry — imported by the client (pickers, routing the model to
// the API) and the server (api/persona-response.ts picks the provider). Keep it
// dependency-free so both sides can import it.

export type ModelProvider = 'gemini' | 'openai';

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
}

export const MODELS: ModelOption[] = [
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', provider: 'gemini' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', provider: 'openai' },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
];

// The fallback default for personas that don't specify a model and before a
// user has chosen one.
export const DEFAULT_MODEL_ID = 'gemini-3.1-flash-lite-preview';

export const isValidModel = (id: string | undefined | null): id is string =>
  !!id && MODELS.some((m) => m.id === id);

// Resolve the provider for a model id. Falls back to gemini for unknown ids so a
// stale/typo'd value never routes to the wrong API unexpectedly.
export const providerForModel = (id: string): ModelProvider =>
  MODELS.find((m) => m.id === id)?.provider ?? 'gemini';

export const labelForModel = (id: string): string =>
  MODELS.find((m) => m.id === id)?.label ?? id;
