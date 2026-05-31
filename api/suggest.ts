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

const SUGGEST_MODEL = 'gemini-3.1-flash-lite-preview';

// Suggest 3 short things the User could say next. Returns { suggestions: [] }.
// Fails soft (empty array) so the UI just shows no chips.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await ipLimitOk(req, 'suggest'))) return res.status(429).json({ suggestions: [] });

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return res.status(200).json({ suggestions: [] });

  const chatTopic = String(req.body?.chatTopic || 'a chat');
  const personaNames: string[] = Array.isArray(req.body?.personaNames) ? req.body.personaNames.slice(0, 10) : [];
  const history: { author: string; text: string }[] = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];

  const transcript = history.map((m) => `${m.author}: ${m.text}`).join('\n').slice(0, 6000);
  const participants = personaNames.length ? personaNames.join(', ') : 'some AI personas';

  const prompt = transcript
    ? `This is a group chat titled "${chatTopic}" with the User and: ${participants}.\n\nRecent conversation:\n${transcript}\n\nSuggest 3 short, natural things the User could say next (a question or reply), each under 12 words and distinct. Return ONLY a JSON array of 3 strings.`
    : `The User is starting a new group chat titled "${chatTopic}" with: ${participants}.\n\nSuggest 3 short, engaging opening messages the User could send, each under 12 words and distinct. Return ONLY a JSON array of 3 strings.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: SUGGEST_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.9, responseMimeType: 'application/json' },
    });
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(response.text ?? '[]');
      if (Array.isArray(parsed)) suggestions = parsed.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 3);
    } catch {
      suggestions = [];
    }
    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error('Suggest failed:', error);
    return res.status(200).json({ suggestions: [] });
  }
}
