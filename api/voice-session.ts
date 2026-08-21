import { GoogleGenAI, Modality } from '@google/genai';
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

const PROVIDERS = ['cloudflare', 'gemini', 'openai', 'grok'] as const;
type VoiceProvider = (typeof PROVIDERS)[number];

const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const OPENAI_REALTIME_MODEL = 'gpt-realtime';
const GROK_VOICE_MODEL = 'grok-voice-latest';

const voiceHost = (): string =>
  (process.env.VOICE_AGENT_HOST || process.env.VITE_VOICE_AGENT_HOST || '').replace(/\/$/, '');

const available = (): VoiceProvider[] => {
  const out: VoiceProvider[] = [];
  if (voiceHost()) out.push('cloudflare');
  if (process.env.GEMINI_API_KEY || process.env.API_KEY) out.push('gemini');
  if (process.env.OPENAI_API_KEY) out.push('openai');
  if (process.env.XAI_API_KEY) out.push('grok');
  return out;
};

const missingMessage = (provider: VoiceProvider): string => {
  if (provider === 'cloudflare') {
    return 'Cloudflare voice is not configured. Set VOICE_AGENT_HOST to the Worker URL (https://whatsai-voice.yishai-k.workers.dev).';
  }
  if (provider === 'gemini') return 'Gemini voice needs GEMINI_API_KEY on the server.';
  if (provider === 'openai') return 'OpenAI voice needs OPENAI_API_KEY on the server.';
  return 'Grok voice needs XAI_API_KEY on the server (console.x.ai).';
};

const mintGemini = async (systemInstruction?: string, voiceName?: string) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error(missingMessage('gemini'));
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
  const now = Date.now();
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: GEMINI_LIVE_MODEL,
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
  if (!token.name) throw new Error('Failed to mint Gemini live token.');
  return { provider: 'gemini' as const, token: token.name, model: GEMINI_LIVE_MODEL };
};

const mintOpenAi = async (systemInstruction?: string, voiceName?: string) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(missingMessage('openai'));
  const resp = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: OPENAI_REALTIME_MODEL,
        instructions: systemInstruction || 'You are on a live voice call. Stay in character and keep replies short.',
        audio: { output: { voice: voiceName || 'marin' } },
      },
    }),
  });
  const data = await resp.json().catch(() => ({}));
  const clientSecret = data.value || data.client_secret?.value;
  if (!resp.ok || !clientSecret) {
    const msg = data.error?.message || data.error || `OpenAI client secret HTTP ${resp.status}`;
    throw new Error(String(msg));
  }
  return { provider: 'openai' as const, clientSecret, model: OPENAI_REALTIME_MODEL };
};

const mintGrok = async () => {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error(missingMessage('grok'));
  const resp = await fetch('https://api.x.ai/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expires_after: { seconds: 300 } }),
  });
  const data = await resp.json().catch(() => ({}));
  const clientSecret = data.value || data.client_secret?.value || data.token;
  if (!resp.ok || !clientSecret) {
    const msg = data.error?.message || data.error || data.message || `xAI client secret HTTP ${resp.status}`;
    throw new Error(String(msg));
  }
  return {
    provider: 'grok' as const,
    clientSecret,
    model: GROK_VOICE_MODEL,
    wsUrl: `wss://api.x.ai/v1/realtime?model=${GROK_VOICE_MODEL}`,
  };
};

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({ available: available(), defaultProvider: 'cloudflare' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!(await ipLimitOk(req, 'voice'))) {
      return res.status(429).json({ error: 'Too many requests — please slow down and try again shortly.' });
    }

    const body = req.body || {};
    const requested = typeof body.provider === 'string' ? body.provider : 'cloudflare';
    if (!(PROVIDERS as readonly string[]).includes(requested)) {
      return res.status(400).json({ error: `Unknown voice provider "${requested}".`, available: available() });
    }
    const provider = requested as VoiceProvider;
    const live = available();
    if (!live.includes(provider)) {
      return res.status(503).json({ error: missingMessage(provider), available: live });
    }

    const systemInstruction = typeof body.systemInstruction === 'string' ? body.systemInstruction : undefined;
    const voiceName = typeof body.voiceName === 'string' ? body.voiceName : undefined;

    if (provider === 'cloudflare') {
      return res.status(200).json({
        provider,
        host: voiceHost(),
        agent: 'PersonaVoiceAgent',
        available: live,
      });
    }
    if (provider === 'gemini') {
      return res.status(200).json({ ...(await mintGemini(systemInstruction, voiceName)), available: live });
    }
    if (provider === 'openai') {
      return res.status(200).json({ ...(await mintOpenAi(systemInstruction, voiceName)), available: live });
    }
    return res.status(200).json({ ...(await mintGrok()), available: live });
  } catch (error) {
    console.error('Error starting voice session:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start voice session.',
      available: available(),
    });
  }
}
