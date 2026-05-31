import OpenAI from 'openai';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

// Per-IP rate limit (inlined — cross-dir imports break the ESM serverless
// runtime; fails OPEN if Convex is unreachable).
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

const MAX_LEN = 4000;

// Content moderation via OpenAI's (free) omni-moderation model. Fails OPEN:
// any error, a missing key, or empty text returns { flagged: false } so this
// can never block the app — it's a safety net, not a hard dependency.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await ipLimitOk(req, 'moderate'))) {
    return res.status(429).json({ error: 'Too many requests — please slow down.' });
  }

  const text = String(req.body?.text || '').slice(0, MAX_LEN);
  if (!text.trim()) {
    return res.status(200).json({ flagged: false, categories: [] });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Moderation not configured — allow.
    return res.status(200).json({ flagged: false, categories: [] });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const result = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: text,
    });
    const r: any = result.results?.[0];
    const flagged = !!r?.flagged;
    const categories = r?.categories
      ? Object.entries(r.categories)
          .filter(([, v]) => v === true)
          .map(([k]) => k)
      : [];
    return res.status(200).json({ flagged, categories });
  } catch (error) {
    console.error('Moderation failed (allowing):', error);
    return res.status(200).json({ flagged: false, categories: [] });
  }
}
