import OpenAI, { toFile } from 'openai';
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

// Cap decoded audio at ~8MB to stay within serverless body limits.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

// Speech-to-text for voice messages, via OpenAI whisper-1. Returns { text }.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await ipLimitOk(req, 'transcribe'))) {
    return res.status(429).json({ error: 'Too many requests — please slow down.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });

  const audioBase64 = String(req.body?.audioBase64 || '');
  const mimeType = String(req.body?.mimeType || 'audio/webm');
  if (!audioBase64) return res.status(400).json({ error: 'No audio provided.' });

  let buffer: Buffer;
  try {
    buffer = Buffer.from(audioBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid audio encoding.' });
  }
  if (buffer.length === 0) return res.status(400).json({ error: 'Empty audio.' });
  if (buffer.length > MAX_AUDIO_BYTES) return res.status(413).json({ error: 'Recording too long.' });

  // Pick a sensible filename extension so Whisper infers the container.
  const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'mp4'
    : mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('wav') ? 'wav'
    : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3'
    : 'webm';

  try {
    const openai = new OpenAI({ apiKey });
    const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });
    const result = await openai.audio.transcriptions.create({ file, model: 'whisper-1' });
    return res.status(200).json({ text: (result.text || '').trim() });
  } catch (error) {
    console.error('Transcription failed:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Transcription failed.' });
  }
}
