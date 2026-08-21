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

const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const OPENAI_REALTIME_MODEL = 'gpt-realtime-2.1';
const GROK_VOICE_MODEL = 'grok-voice-latest';

const voiceHost = (): string =>
  (process.env.VOICE_AGENT_HOST || process.env.VITE_VOICE_AGENT_HOST || '').replace(/\/$/, '');

const envKey = (...names: string[]): string => {
  for (const name of names) {
    const v = (process.env[name] || '').trim();
    if (v) return v;
  }
  return '';
};

const available = (): VoiceProvider[] => {
  const out: VoiceProvider[] = [];
  if (voiceHost()) out.push('cloudflare');
  if (envKey('GEMINI_API_KEY', 'API_KEY')) out.push('gemini');
  if (envKey('OPENAI_API_KEY')) out.push('openai');
  if (envKey('XAI_API_KEY')) out.push('grok');
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

const errorText = (err: unknown): string => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err ?? 'Unknown error');
  }
};

const explainVoiceError = (err: unknown): string => {
  const raw = errorText(err);
  const s = raw.toLowerCase();
  if (/api[_ ]key not valid|api_key_invalid|pass a valid api key/.test(s)) {
    return 'Gemini API key is invalid or revoked. Create a new key at aistudio.google.com/apikey, put it in GitHub secret GEMINI_API_KEY, then run Sync Cloudflare env to Vercel and Deploy Production.';
  }
  if (/used all available credits|monthly spending limit|insufficient.?credits/.test(s)) {
    return 'xAI/Grok is out of credits or at its spending limit. Add credits at console.x.ai, then retry.';
  }
  if (/incorrect api key provided|invalid_api_key/.test(s)) {
    return 'OpenAI API key is invalid or revoked. Update GitHub secret OPENAI_API_KEY, sync env, redeploy.';
  }
  if (raw.length > 280) return raw.slice(0, 280);
  return raw;
};

const mintGemini = async (systemInstruction?: string, voiceName?: string) => {
  const apiKey = envKey('GEMINI_API_KEY', 'API_KEY');
  if (!apiKey) throw new Error(missingMessage('gemini'));
  const attempts: { apiVersion: string; model: string }[] = [
    { apiVersion: 'v1beta', model: GEMINI_LIVE_MODEL },
    { apiVersion: 'v1alpha', model: GEMINI_LIVE_MODEL },
    { apiVersion: 'v1alpha', model: 'gemini-2.5-flash-native-audio-preview-09-2025' },
  ];
  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: attempt.apiVersion } });
      const now = Date.now();
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
          expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
          liveConnectConstraints: {
            model: attempt.model,
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
      return { provider: 'gemini' as const, token: token.name, model: attempt.model, apiVersion: attempt.apiVersion };
    } catch (err) {
      lastErr = err;
      if (/api[_ ]key not valid|api_key_invalid/i.test(errorText(err))) throw err;
    }
  }
  throw lastErr;
};

const openAiSessionConfig = (systemInstruction?: string, voiceName?: string) =>
  JSON.stringify({
    type: 'realtime',
    model: OPENAI_REALTIME_MODEL,
    output_modalities: ['audio'],
    instructions: systemInstruction || 'You are on a live phone call. Stay in character. Answer in one or two spoken sentences.',
    audio: {
      input: { turn_detection: { type: 'semantic_vad' } },
      output: { voice: voiceName || 'marin' },
    },
  });

// Browser WebRTC cannot POST SDP to api.openai.com (CORS). We exchange SDP
// here with the real key, then return the answer SDP to the client.
const mintOpenAiSdp = async (sdp: string, systemInstruction?: string, voiceName?: string) => {
  const apiKey = envKey('OPENAI_API_KEY');
  if (!apiKey) throw new Error(missingMessage('openai'));
  const fd = new FormData();
  fd.set('sdp', sdp);
  fd.set('session', openAiSessionConfig(systemInstruction, voiceName));
  const resp = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  const answer = await resp.text();
  if (!resp.ok) {
    throw new Error(answer.slice(0, 400) || `OpenAI realtime HTTP ${resp.status}`);
  }
  return { provider: 'openai' as const, sdp: answer, model: OPENAI_REALTIME_MODEL };
};

const mintGrok = async () => {
  const apiKey = envKey('XAI_API_KEY');
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
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
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
      const sdp = typeof body.sdp === 'string' ? body.sdp : '';
      if (!sdp) {
        return res.status(400).json({ error: 'OpenAI voice needs an SDP offer from the browser.', available: live });
      }
      return res.status(200).json({ ...(await mintOpenAiSdp(sdp, systemInstruction, voiceName)), available: live });
    }
    return res.status(200).json({ ...(await mintGrok()), available: live });
  } catch (error) {
    console.error('Error starting voice session:', error);
    return res.status(500).json({
      error: explainVoiceError(error),
      available: available(),
    });
  }
}
