import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

// Returns the relevant text/chat models available on the configured keys,
// fetched live from each provider and filtered. Self-updating. NOTE: no
// cross-directory imports — this runs as an ESM serverless function and would
// fail with ERR_MODULE_NOT_FOUND, so everything is inlined.

type Option = { id: string; label: string; provider: 'gemini' | 'openai' };

// Fallback if both providers fail / no keys.
const FALLBACK: Option[] = [
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', provider: 'gemini' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', provider: 'openai' },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
];

// OpenAI text/chat models: gpt-*, o-series, chatgpt-*; exclude non-chat variants.
const isOpenAiTextModel = (id: string): boolean =>
  /^(gpt-|o\d|chatgpt-)/i.test(id) &&
  !/(audio|realtime|transcribe|tts|image|embedding|moderation|search|whisper|dall-e|babbage|davinci|instruct|vision-preview)/i.test(id);

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
      // Drop non-text variants (embeddings, tts, live/native-audio, image).
      if (/(embedding|tts|aqa|audio|live|realtime|imagen|image|vision)/i.test(name)) continue;
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
    let models = [...gemini, ...openai];
    if (models.length === 0) models = FALLBACK;

    // Gemini group first, then OpenAI; alphabetical within each.
    models.sort((a, b) =>
      a.provider === b.provider
        ? a.id.localeCompare(b.id)
        : a.provider === 'gemini' ? -1 : 1,
    );

    cache = { at: Date.now(), models };
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({ models });
  } catch (error) {
    console.error('Error listing models:', error);
    return res.status(200).json({ models: FALLBACK });
  }
}
