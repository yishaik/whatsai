import { GoogleGenAI, Modality } from '@google/genai';

// The Gemini Live model used for real-time voice. If this id isn't available on
// the API key's tier, swap it here — the client uses whatever this returns.
const LIVE_MODEL = 'gemini-2.0-flash-live-001';

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
    const body = req.body || {};
    const systemInstruction: string | undefined =
      typeof body.systemInstruction === 'string' ? body.systemInstruction : undefined;
    const voiceName: string | undefined =
      typeof body.voiceName === 'string' ? body.voiceName : undefined;

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
          model: LIVE_MODEL,
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

    return res.status(200).json({ token: token.name, model: LIVE_MODEL });
  } catch (error) {
    console.error('Error minting live token:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to mint live token.',
    });
  }
}
