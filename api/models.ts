import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { CF_CHAT_MODELS, cfReady } from '../lib/cloudflareAi.js';

// Returns the relevant text/chat models available on the configured keys,
// fetched live from each provider and filtered. Self-updating.

type Option = { id: string; label: string; provider: 'cloudflare' | 'gemini' | 'openai' };

// Fallback if no provider is configured / all listings fail.
const FALLBACK: Option[] = [...CF_CHAT_MODELS];

// Dated snapshot suffix, e.g. -2024-08-06, -0613, -0125, -1106 (keep base alias).
const DATED_SUFFIX = /-(\d{4}-\d{2}-\d{2}|\d{3,4})$/;

// OpenAI text/chat models: gpt-*, o-series, chatgpt-*; keep base aliases only,
// dropping dated snapshots and specialized/non-chat variants.
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
      // Drop non-chat variants and dated snapshots (keep base aliases).
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

export default async function handler(_req: any, res: any) {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
      return res.status(200).json({ models: cache.models });
    }

    const [gemini, openai] = await Promise.all([geminiModels(), openaiModels()]);
    const cloudflare = cfReady() ? [...CF_CHAT_MODELS] : [];
    let models = [...cloudflare, ...gemini, ...openai];
    if (models.length === 0) models = FALLBACK;

    const order: Record<Option['provider'], number> = { cloudflare: 0, gemini: 1, openai: 2 };
    models.sort((a, b) =>
      a.provider === b.provider ? a.id.localeCompare(b.id) : order[a.provider] - order[b.provider],
    );

    cache = { at: Date.now(), models };
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({ models });
  } catch (error) {
    console.error('Error listing models:', error);
    return res.status(200).json({ models: FALLBACK });
  }
}
