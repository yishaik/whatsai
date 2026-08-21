// Model registry helpers for the client. The actual selectable list is fetched
// live from /api/models (see hooks/useModels); this provides the fallback list
// and id-based helpers that work for any model id without the full list.

export type ModelProvider =
  | 'cloudflare'
  | 'groq'
  | 'cerebras'
  | 'openrouter'
  | 'nvidia'
  | 'gemini'
  | 'openai';

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
}

export const PROVIDER_LABEL: Record<ModelProvider, string> = {
  cloudflare: 'Cloudflare',
  groq: 'Groq',
  cerebras: 'Cerebras',
  openrouter: 'OpenRouter',
  nvidia: 'NVIDIA',
  gemini: 'Gemini',
  openai: 'OpenAI',
};

export const PROVIDER_ORDER: ModelProvider[] = [
  'cloudflare',
  'groq',
  'cerebras',
  'openrouter',
  'nvidia',
  'gemini',
  'openai',
];

export const FALLBACK_MODELS: ModelOption[] = [
  { id: '@cf/meta/llama-3.1-8b-instruct-fast', label: 'Llama 3.1 8B Fast', provider: 'cloudflare' },
  { id: '@cf/google/gemma-4-26b-a4b-it', label: 'Gemma 4 26B', provider: 'cloudflare' },
  { id: '@cf/openai/gpt-oss-20b', label: 'GPT-OSS 20B', provider: 'cloudflare' },
  { id: 'groq/openai/gpt-oss-20b', label: 'GPT-OSS 20B', provider: 'groq' },
  { id: 'groq/openai/gpt-oss-120b', label: 'GPT-OSS 120B', provider: 'groq' },
  { id: 'cerebras/gpt-oss-120b', label: 'GPT-OSS 120B', provider: 'cerebras' },
  { id: 'cerebras/gemma-4-31b', label: 'Gemma 4 31B', provider: 'cerebras' },
  { id: 'openrouter/google/gemma-4-31b-it:free', label: 'Gemma 4 31B', provider: 'openrouter' },
  { id: 'openrouter/openai/gpt-oss-20b:free', label: 'GPT-OSS 20B', provider: 'openrouter' },
  { id: 'nvidia/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B', provider: 'nvidia' },
];

export const DEFAULT_MODEL_ID = '@cf/meta/llama-3.1-8b-instruct-fast';

export const providerForModel = (id: string): ModelProvider => {
  if (id.startsWith('@cf/') || id.startsWith('workers-ai/')) return 'cloudflare';
  if (id.startsWith('groq/')) return 'groq';
  if (id.startsWith('cerebras/')) return 'cerebras';
  if (id.startsWith('openrouter/')) return 'openrouter';
  if (id.startsWith('nvidia/')) return 'nvidia';
  if (/^(gpt-|o\d|chatgpt-)/i.test(id)) return 'openai';
  return 'gemini';
};

export const groupedModels = (models: ModelOption[]): { provider: ModelProvider; label: string; models: ModelOption[] }[] =>
  PROVIDER_ORDER
    .map((p) => ({ provider: p, label: PROVIDER_LABEL[p], models: models.filter((m) => m.provider === p) }))
    .filter((g) => g.models.length > 0);

export const findModelLabel = (models: ModelOption[], id: string): string =>
  models.find((m) => m.id === id)?.label ?? id;
