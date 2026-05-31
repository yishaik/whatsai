import { GoogleGenAI, Modality } from '@google/genai';
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

// The Gemini Live model for real-time voice. This native-audio model is the one
// available on our key's tier for the constrained ephemeral-token connection
// (verified: opens + returns audio). The client uses whatever this returns.
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

const getApiKey = (): string => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }
  return apiKey;
};

// Mints a single-use, short-lived ephemeral token so the browser can open a
// Gemini Live session directly without ever seeing GEMINI_API_KEY.
//
// Ephemeral tokens connect via the *constrained* Live method, which takes the
// model + config from the token's liveConnectConstraints (NOT from the client's
// connect call). So the model, response modality, persona system prompt and
// voice are all locked in here at mint time.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!(await ipLimitOk(req, 'voice'))) {
      return res.status(429).json({ error: 'Too many requests — please slow down and try again shortly.' });
    }

    const body = req.body || {};
    const systemInstruction: string | undefined =
      typeof body.systemInstruction === 'string' ? body.systemInstruction : undefined;
    const voiceName: string | undefined =
      typeof body.voiceName === 'string' ? body.voiceName : undefined;
    const model = LIVE_MODEL;

    const ai = new GoogleGenAI({
      apiKey: getApiKey(),
      httpOptions: { apiVersion: 'v1alpha' },
    });

    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            ...(systemInstruction ? { systemInstruction } : {}),
            ...(voiceName
              ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } }
              : {}),
          },
        },
      },
    });

    if (!token.name) {
      throw new Error('Failed to mint ephemeral token.');
    }

    return res.status(200).json({ token: token.name, model });
  } catch (error) {
    console.error('Error minting live token:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to mint live token.',
    });
  }
}
