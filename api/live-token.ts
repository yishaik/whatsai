import { GoogleGenAI } from '@google/genai';

// The Gemini Live model used for real-time voice. If this id isn't available on
// the API key's tier, swap it here (e.g. a 2.5 native-audio model) — the client
// uses whatever this endpoint returns.
const LIVE_MODEL = 'gemini-2.0-flash-live-001';

const getApiKey = (): string => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }
  return apiKey;
};

// Mints a short-lived, single-use ephemeral token so the browser can open a
// Gemini Live session directly without ever seeing GEMINI_API_KEY.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: getApiKey(),
      httpOptions: { apiVersion: 'v1alpha' },
    });

    const now = Date.now();
    // Plain single-use, short-lived token. The client supplies the model + live
    // config at connect time (kept unconstrained to avoid lock/mismatch errors).
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // Token usable to OPEN a session for 2 minutes; the session itself may
        // run up to 30 minutes.
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      },
    });

    if (!token.name) {
      throw new Error('Failed to mint ephemeral token.');
    }

    return res.status(200).json({ token: token.name, model: LIVE_MODEL });
  } catch (error) {
    console.error('Error minting live token:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to mint live token.',
    });
  }
}
