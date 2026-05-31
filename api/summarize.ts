import { GoogleGenAI } from '@google/genai';
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

const SUMMARY_MODEL = 'gemini-3.1-flash-lite-preview';

// Summarize an older chat excerpt into a compact running memory. Used by the
// Convex memory action for long chats. Returns { summary } (empty on failure).
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await ipLimitOk(req, 'summarize'))) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const transcript = String(req.body?.transcript || '').slice(0, 60_000);
  const existing = String(req.body?.existingSummary || '').slice(0, 4000);
  if (!transcript.trim()) return res.status(200).json({ summary: '' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return res.status(200).json({ summary: '' });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${existing ? `Existing running summary of earlier parts of the conversation:\n${existing}\n\n` : ''}Conversation excerpt to fold into the summary:\n${transcript}\n\nWrite an updated, concise running summary (under 180 words) capturing the key facts, decisions, preferences, names, and open threads a participant would need to remember. Use short bullet points. Do not add commentary.`;
    const response = await ai.models.generateContent({
      model: SUMMARY_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.3 },
    });
    return res.status(200).json({ summary: response.text?.trim() ?? '' });
  } catch (error) {
    console.error('Summarize failed:', error);
    return res.status(200).json({ summary: '' });
  }
}
