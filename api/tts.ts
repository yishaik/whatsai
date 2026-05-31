import OpenAI from 'openai';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const clientIp = (req: any): string =>
  String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  String(req.headers['x-real-ip'] || '') ||
  'unknown';

const ipLimitOk = async (req: any, action: string): Promise<boolean> => {
  const url = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) return true;
  try {
    const client = new ConvexHttpClient(url);
    const ref = makeFunctionReference<'mutation'>('chat:consumeIpLimit');
    return await client.mutation(ref, { ip: clientIp(req), action });
  } catch (error) {
    console.error('IP rate-limit check failed (allowing):', error);
    return true;
  }
};

// OpenAI TTS voices; a persona's seed maps to a stable one.
const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// Cloud text-to-speech (OpenAI tts-1) for consistent per-persona voices.
// Returns audio/mpeg bytes. The client falls back to Web Speech on any failure.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await ipLimitOk(req, 'tts'))) return res.status(429).json({ error: 'Too many requests.' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });

  const text = String(req.body?.text || '').slice(0, 4000);
  const seed = String(req.body?.seed || 'default');
  if (!text.trim()) return res.status(400).json({ error: 'No text provided.' });

  const voice = VOICES[hashString(seed) % VOICES.length];

  try {
    const openai = new OpenAI({ apiKey });
    const speech = await openai.audio.speech.create({ model: 'tts-1', voice: voice as any, input: text });
    const buf = Buffer.from(await speech.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (error) {
    console.error('TTS failed:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'TTS failed.' });
  }
}
