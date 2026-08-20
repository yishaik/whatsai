import OpenAI from 'openai';

// Workers AI via the OpenAI-compatible REST API.
// Docs: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
// Auth: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (Workers AI Read).

export const CF_DEFAULT_CHAT = '@cf/meta/llama-3.1-8b-instruct-fast';
export const CF_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const CF_WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';
export const CF_TTS_MODEL = '@cf/myshell-ai/melotts';

export const CF_CHAT_MODELS: { id: string; label: string; provider: 'cloudflare' }[] = [
  { id: '@cf/meta/llama-3.1-8b-instruct-fast', label: 'Llama 3.1 8B Fast', provider: 'cloudflare' },
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B Fast', provider: 'cloudflare' },
  { id: '@cf/openai/gpt-oss-20b', label: 'GPT-OSS 20B', provider: 'cloudflare' },
  { id: '@cf/openai/gpt-oss-120b', label: 'GPT-OSS 120B', provider: 'cloudflare' },
  { id: '@cf/zai-org/glm-4.7-flash', label: 'GLM 4.7 Flash', provider: 'cloudflare' },
];

export const cfReady = (): boolean =>
  !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);

export const cfOpenAI = (): OpenAI => {
  if (!cfReady()) {
    throw new Error('Cloudflare Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Vercel.');
  }
  return new OpenAI({
    apiKey: process.env.CLOUDFLARE_API_TOKEN,
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
  });
};

export const cfRun = async (model: string, input: unknown): Promise<any> => {
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
  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = json?.errors?.[0]?.message || json?.error || json?.message || `Cloudflare AI HTTP ${resp.status}`;
    throw new Error(String(msg));
  }
  return json.result ?? json;
};

export const cfImageDataUri = (result: any): string => {
  const b64 = result?.image || result?.images?.[0] || result;
  if (typeof b64 !== 'string' || b64.length < 32) {
    throw new Error('Cloudflare image generation returned no image.');
  }
  const payload = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  return payload;
};
