// Model registry helpers for the client. The actual selectable list is fetched
// live from /api/models (see hooks/useModels); this provides the fallback list
// and id-based helpers that work for any model id without the full list.

export type ModelProvider = 'cloudflare' | 'gemini' | 'openai';

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
}

export const PROVIDER_LABEL: Record<ModelProvider, string> = {
  cloudflare: 'Cloudflare',
  gemini: 'Gemini',
  openai: 'OpenAI',
};

export const PROVIDER_ORDER: ModelProvider[] = ['cloudflare', 'gemini', 'openai'];

// Used before /api/models responds, or if it fails / a key is missing.
export const FALLBACK_MODELS: ModelOption[] = [
  { id: '@cf/deepseek-ai/deepseek-v4-pro-0813', label: 'DeepSeek V4 Pro', provider: 'cloudflare' },
  { id: '@cf/deepseek-ai/deepseek-v4-flash-0731', label: 'DeepSeek V4 Flash', provider: 'cloudflare' },
  { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill 32B', provider: 'cloudflare' },
  { id: '@cf/meta/llama-3.1-8b-instruct-fast', label: 'Llama 3.1 8B Fast', provider: 'cloudflare' },
  { id: '@cf/openai/gpt-oss-20b', label: 'GPT-OSS 20B', provider: 'cloudflare' },
];

// The fallback default before a user has chosen one.
export const DEFAULT_MODEL_ID = '@cf/meta/llama-3.1-8b-instruct-fast';

// Provider from the id alone.
export const providerForModel = (id: string): ModelProvider => {
  if (id.startsWith('@cf/') || id.startsWith('workers-ai/')) return 'cloudflare';
  if (/^(gpt-|o\d|chatgpt-)/i.test(id)) return 'openai';
  return 'gemini';
};

export const groupedModels = (models: ModelOption[]): { provider: ModelProvider; label: string; models: ModelOption[] }[] =>
  PROVIDER_ORDER
    .map((p) => ({ provider: p, label: PROVIDER_LABEL[p], models: models.filter((m) => m.provider === p) }))
    .filter((g) => g.models.length > 0);

// Friendly label for an id, looked up in a (fetched) list, else the id itself.
export const findModelLabel = (models: ModelOption[], id: string): string =>
  models.find((m) => m.id === id)?.label ?? id;
