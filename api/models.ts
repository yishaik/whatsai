import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { CF_CHAT_MODELS, cfReady } from '../lib/cloudflareAi.js';
import {
  CEREBRAS_CHAT_MODELS,
  GROQ_CHAT_MODELS,
  NVIDIA_CHAT_MODELS,
  OPENROUTER_CHAT_MODELS,
  providerReady,
} from '../lib/providers.js';

type Option = {
  id: string;
  label: string;
  provider: 'cloudflare' | 'groq' | 'cerebras' | 'openrouter' | 'nvidia' | 'gemini' | 'openai';
};

const FALLBACK: Option[] = [...CF_CHAT_MODELS];

const DATED_SUFFIX = /-(\d{4}-\d{2}-\d{2}|\d{3,4})$/;

const isOpenAiTextModel = (id: string): boolean =>
  /^(gpt-|o\d|chatgpt-)/i.test(id) &&
  !DATED_SUFFIX.test(id) &&
  !/(audio|realtime|transcribe|tts|image|embedding|moderation|search|whisper|dall-e|babbage|davinci|instruct|codex|16k|vision-preview)/i.test(id);

let cache: { at: number; models: Option[] } | null = null;
const CACHE_MS = 10 * 60 * 1000;

const geminiModels = async (): Promise<Option[]> => {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key) return [];
  const out: Option[] = [];
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const pager = await ai.models.list({ config: { pageSize: 200 } });
    for await (const m of pager) {
      const name = (m.name || '').replace(/^models\//, '');
      if (!name.startsWith('gemini')) continue;
      if (/(embedding|tts|aqa|audio|live|realtime|imagen|image|vision|computer-use|robotics|customtools)/i.test(name)) continue;
      if (DATED_SUFFIX.test(name)) continue;
      const actions = m.supportedActions || [];
      if (actions.length && !actions.includes('generateContent')) continue;
      out.push({ id: name, label: m.displayName || name, provider: 'gemini' });
    }
  } catch (error) {
    console.error('Gemini models.list failed:', error);
  }
  return out;
};

const openaiModels = async (): Promise<Option[]> => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];
  const out: Option[] = [];
  try {
    const openai = new OpenAI({ apiKey: key });
    const page = await openai.models.list();
    for (const m of page.data) {
      if (!isOpenAiTextModel(m.id)) continue;
      out.push({ id: m.id, label: m.id, provider: 'openai' });
    }
  } catch (error) {
    console.error('OpenAI models.list failed:', error);
  }
  return out;
};

const openrouterLive = async (): Promise<Option[]> => {
  if (!providerReady('openrouter')) return [...OPENROUTER_CHAT_MODELS];
  try {
    const key = process.env.OPENROUTER_API_KEY as string;
    const resp = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json: any = await resp.json().catch(() => ({}));
    const rows: any[] = Array.isArray(json?.data) ? json.data : [];
    const free = rows.filter((m) => String(m?.pricing?.prompt) === '0' && String(m?.pricing?.completion) === '0');
    const out: Option[] = [];
    for (const m of free) {
      const id = String(m.id || '');
      if (!id || id.startsWith('~') || id.includes(':batch') || /lyria|content-safety|rerank/i.test(id)) continue;
      const label = String(m.name || id).replace(/\s*\(free\)\s*$/i, '').trim();
      out.push({ id: `openrouter/${id}`, label, provider: 'openrouter' });
    }
    return out.length ? out : [...OPENROUTER_CHAT_MODELS];
  } catch (error) {
    console.error('OpenRouter models.list failed:', error);
    return [...OPENROUTER_CHAT_MODELS];
  }
};

export default async function handler(_req: any, res: any) {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
      return res.status(200).json({ models: cache.models });
    }

    const [gemini, openai, openrouter] = await Promise.all([geminiModels(), openaiModels(), openrouterLive()]);
    const cloudflare = cfReady() ? [...CF_CHAT_MODELS] : [];
    const groq = [...GROQ_CHAT_MODELS];
    const cerebras = [...CEREBRAS_CHAT_MODELS];
    const nvidia = [...NVIDIA_CHAT_MODELS];
    let models: Option[] = [...cloudflare, ...groq, ...cerebras, ...openrouter, ...nvidia, ...gemini, ...openai];
    if (models.length === 0) models = FALLBACK;

    const order: Record<Option['provider'], number> = {
      cloudflare: 0,
      groq: 1,
      cerebras: 2,
      openrouter: 3,
      nvidia: 4,
      gemini: 5,
      openai: 6,
    };
    models.sort((a, b) =>
      a.provider === b.provider ? a.label.localeCompare(b.label) : order[a.provider] - order[b.provider],
    );

    cache = { at: Date.now(), models };
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({ models });
  } catch (error) {
    console.error('Error listing models:', error);
    return res.status(200).json({ models: FALLBACK });
  }
};
