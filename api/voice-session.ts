import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

// Per-IP rate limit backed by Convex (see api/persona-response.ts). Inlined to
// avoid cross-dir imports in the ESM serverless runtime; fails open.
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

const voiceHost = (): string =>
  (process.env.VOICE_AGENT_HOST || process.env.VITE_VOICE_AGENT_HOST || '').replace(/\/$/, '');

// Hands the browser the Cloudflare Voice Worker host. The Worker holds the
// Workers AI binding; this function only rate-limits and returns a public URL.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!(await ipLimitOk(req, 'voice'))) {
      return res.status(429).json({ error: 'Too many requests — please slow down and try again shortly.' });
    }

    const host = voiceHost();
    if (!host) {
      return res.status(503).json({
        error: 'Voice worker is not configured. Set VOICE_AGENT_HOST to the wrangler workers.dev URL.',
      });
    }

    return res.status(200).json({ host, agent: 'PersonaVoiceAgent' });
  } catch (error) {
    console.error('Error starting voice session:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start voice session.',
    });
  }
}
