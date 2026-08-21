import OpenAI from 'openai';
import { CF_CHAT_MODELS, CF_DEFAULT_CHAT, cfOpenAI, cfReady } from './cloudflareAi.js';

// OpenAI-compatible chat providers. Model ids are prefixed so routing is
// unambiguous (`groq/llama-…`, `openrouter/google/gemma-…:free`). The prefix
// is stripped before the request.

export const CF_DEFAULT_CHAT_ID = CF_DEFAULT_CHAT;

export const COMPAT = {
  groq: {
    label: 'Groq',
    env: 'GROQ_API_KEY',
    baseURL: 'https://api.groq.com/openai/v1',
    prefix: 'groq/',
  },
  cerebras: {
    label: 'Cerebras',
    env: 'CEREBRAS_API_KEY',
    baseURL: 'https://api.cerebras.ai/v1',
    prefix: 'cerebras/',
  },
  openrouter: {
    label: 'OpenRouter',
    env: 'OPENROUTER_API_KEY',
    baseURL: 'https://openrouter.ai/api/v1',
    prefix: 'openrouter/',
    headers: {
      'HTTP-Referer': 'https://whatsai.yishaik.com',
      'X-Title': 'WhatsAI',
    },
  },
  nvidia: {
    label: 'NVIDIA',
    env: 'NVIDIA_API_KEY',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    prefix: 'nvidia/',
  },
  openai: {
    label: 'OpenAI',
    env: 'OPENAI_API_KEY',
    baseURL: undefined,
    prefix: '',
  },
};

const prefixed = (provider, id, label) => ({
  id: `${COMPAT[provider].prefix}${id}`,
  label,
  provider,
});

export const GROQ_CHAT_MODELS = [
  prefixed('groq', 'openai/gpt-oss-20b', 'GPT-OSS 20B'),
  prefixed('groq', 'openai/gpt-oss-120b', 'GPT-OSS 120B'),
  prefixed('groq', 'qwen/qwen3.6-27b', 'Qwen3.6 27B'),
  prefixed('groq', 'meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout'),
];

export const CEREBRAS_CHAT_MODELS = [
  prefixed('cerebras', 'gpt-oss-120b', 'GPT-OSS 120B'),
  prefixed('cerebras', 'gemma-4-31b', 'Gemma 4 31B'),
];

export const OPENROUTER_CHAT_MODELS = [
  prefixed('openrouter', 'google/gemma-4-31b-it:free', 'Gemma 4 31B'),
  prefixed('openrouter', 'google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B'),
  prefixed('openrouter', 'nvidia/nemotron-3-super-120b-a12b:free', 'Nemotron 3 Super'),
  prefixed('openrouter', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'Nemotron 3 Ultra'),
  prefixed('openrouter', 'openai/gpt-oss-20b:free', 'GPT-OSS 20B'),
  prefixed('openrouter', 'z-ai/glm-5.2:free', 'GLM 5.2'),
  prefixed('openrouter', 'poolside/laguna-s-2.1:free', 'Laguna S 2.1'),
  prefixed('openrouter', 'stealth/ox-alpha', 'Ox Alpha'),
];

export const NVIDIA_CHAT_MODELS = [
  prefixed('nvidia', 'meta/llama-3.1-8b-instruct', 'Llama 3.1 8B'),
  prefixed('nvidia', 'meta/llama-3.3-70b-instruct', 'Llama 3.3 70B'),
  prefixed('nvidia', 'meta/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout'),
  prefixed('nvidia', 'google/gemma-3-27b-it', 'Gemma 3 27B'),
  prefixed('nvidia', 'nvidia/llama-3.1-nemotron-70b-instruct', 'Nemotron 70B'),
];

export const STATIC_CHAT_MODELS = [
  ...CF_CHAT_MODELS,
  ...GROQ_CHAT_MODELS,
  ...CEREBRAS_CHAT_MODELS,
  ...OPENROUTER_CHAT_MODELS,
  ...NVIDIA_CHAT_MODELS,
];

export const providerForModel = (id) => {
  if (!id) return 'cloudflare';
  if (id.startsWith('@cf/') || id.startsWith('workers-ai/')) return 'cloudflare';
  if (id.startsWith('groq/')) return 'groq';
  if (id.startsWith('cerebras/')) return 'cerebras';
  if (id.startsWith('openrouter/')) return 'openrouter';
  if (id.startsWith('nvidia/')) return 'nvidia';
  if (/^(gpt-|o\d|chatgpt-)/i.test(id)) return 'openai';
  return 'gemini';
};

export const isOpenAiCompat = (provider) =>
  provider === 'openai' ||
  provider === 'cloudflare' ||
  provider === 'groq' ||
  provider === 'cerebras' ||
  provider === 'openrouter' ||
  provider === 'nvidia';

export const toApiModelId = (id, provider) => {
  const cfg = COMPAT[provider];
  if (cfg?.prefix && id.startsWith(cfg.prefix)) return id.slice(cfg.prefix.length);
  return id;
};

export const providerReady = (provider) => {
  if (provider === 'cloudflare') return cfReady();
  if (provider === 'gemini') return !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
  const cfg = COMPAT[provider];
  return !!(cfg && process.env[cfg.env]);
};

export const openaiCompatClient = (provider) => {
  if (provider === 'cloudflare') return cfOpenAI();
  const cfg = COMPAT[provider];
  if (!cfg) throw new Error(`Unknown chat provider: ${provider}`);
  const key = process.env[cfg.env];
  if (!key) {
    throw new Error(`Set ${cfg.env} in Vercel to use ${cfg.label}.`);
  }
  return new OpenAI({
    apiKey: key,
    baseURL: cfg.baseURL,
    defaultHeaders: cfg.headers,
  });
};
