import OpenAI from 'openai';

// Plain JS so Vercel Node ESM functions can load it (they do not compile
// sibling .ts files). API routes must import this with a .js extension.
// Auth: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (Workers AI Read).
// Docs: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/

export const CF_DEFAULT_CHAT = '@cf/meta/llama-3.1-8b-instruct-fast';
export const CF_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const CF_WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';
export const CF_TTS_MODEL = '@cf/myshell-ai/melotts';

/** @type {{ id: string, label: string, provider: 'cloudflare' }[]} */
export const CF_CHAT_MODELS = [
  { id: '@cf/meta/llama-3.1-8b-instruct-fast', label: 'Llama 3.1 8B Fast', provider: 'cloudflare' },
  { id: '@cf/meta/llama-3.2-3b-instruct', label: 'Llama 3.2 3B', provider: 'cloudflare' },
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B Fast', provider: 'cloudflare' },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', provider: 'cloudflare' },
  { id: '@cf/google/gemma-4-26b-a4b-it', label: 'Gemma 4 26B', provider: 'cloudflare' },
  { id: '@cf/ibm-granite/granite-4.0-h-micro', label: 'Granite 4 Micro', provider: 'cloudflare' },
  { id: '@cf/openai/gpt-oss-20b', label: 'GPT-OSS 20B', provider: 'cloudflare' },
  { id: '@cf/openai/gpt-oss-120b', label: 'GPT-OSS 120B', provider: 'cloudflare' },
  { id: '@cf/qwen/qwen3-30b-a3b-fp8', label: 'Qwen3 30B', provider: 'cloudflare' },
  { id: '@cf/qwen/qwen3.8-27b', label: 'Qwen3.8 27B', provider: 'cloudflare' },
  { id: '@cf/mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1', provider: 'cloudflare' },
  { id: '@cf/nvidia/nemotron-3-120b-a12b', label: 'Nemotron 3 Super', provider: 'cloudflare' },
  { id: '@cf/zai-org/glm-4.7-flash', label: 'GLM 4.7 Flash', provider: 'cloudflare' },
  { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill 32B', provider: 'cloudflare' },
  { id: '@cf/deepseek-ai/deepseek-v4-flash-0731', label: 'DeepSeek V4 Flash', provider: 'cloudflare' },
  { id: '@cf/deepseek-ai/deepseek-v4-pro-0813', label: 'DeepSeek V4 Pro', provider: 'cloudflare' },
];

export const cfReady = () =>
  !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);

export const cfOpenAI = () => {
  if (!cfReady()) {
    throw new Error('Cloudflare Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Vercel.');
  }
  return new OpenAI({
    apiKey: process.env.CLOUDFLARE_API_TOKEN,
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
  });
};

export const cfRun = async (model, input) => {
  if (!cfReady()) {
    throw new Error('Cloudflare Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Vercel.');
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = json?.errors?.[0]?.message || json?.error || json?.message || `Cloudflare AI HTTP ${resp.status}`;
    throw new Error(String(msg));
  }
  return json.result ?? json;
};

export const cfImageDataUri = (result) => {
  const b64 = result?.image || result?.images?.[0] || result;
  if (typeof b64 !== 'string' || b64.length < 32) {
    throw new Error('Cloudflare image generation returned no image.');
  }
  return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
};
