export const VOICE_PROVIDERS = ['cloudflare', 'gemini', 'openai', 'grok'] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];

export const DEFAULT_VOICE_PROVIDER: VoiceProvider = 'cloudflare';

export const VOICE_PROVIDER_META: { id: VoiceProvider; label: string; hint: string }[] = [
  { id: 'cloudflare', label: 'Cloudflare', hint: 'Flux STT + Aura TTS + Llama on a Worker' },
  { id: 'gemini', label: 'Gemini', hint: 'Gemini Live native audio' },
  { id: 'openai', label: 'OpenAI', hint: 'Realtime API over WebRTC' },
  { id: 'grok', label: 'Grok', hint: 'xAI speech-to-speech' },
];

export const isVoiceProvider = (v: unknown): v is VoiceProvider =>
  typeof v === 'string' && (VOICE_PROVIDERS as readonly string[]).includes(v);

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const pick = (list: readonly string[], seed: string): string => list[hashString(seed) % list.length];

export const AURA_SPEAKERS = [
  'asteria', 'luna', 'stella', 'athena', 'hera', 'orion',
  'arcas', 'perseus', 'angus', 'orpheus', 'helios', 'zeus',
] as const;
export type AuraSpeaker = (typeof AURA_SPEAKERS)[number];
export const pickAuraSpeaker = (seed: string): AuraSpeaker =>
  pick(AURA_SPEAKERS, seed) as AuraSpeaker;

export const GEMINI_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'] as const;
export const pickGeminiVoice = (seed: string): string => pick(GEMINI_VOICES, seed);

export const OPENAI_VOICES = ['marin', 'cedar', 'alloy', 'echo', 'shimmer', 'ash', 'ballad', 'coral', 'sage', 'verse'] as const;
export const pickOpenAiVoice = (seed: string): string => pick(OPENAI_VOICES, seed);

export const GROK_VOICES = ['eve', 'ara', 'rex', 'sal', 'leo', 'val', 'mia', 'knox'] as const;
export const pickGrokVoice = (seed: string): string => pick(GROK_VOICES, seed);

export const pickVoiceForProvider = (provider: VoiceProvider, seed: string): string => {
  if (provider === 'gemini') return pickGeminiVoice(seed);
  if (provider === 'openai') return pickOpenAiVoice(seed);
  if (provider === 'grok') return pickGrokVoice(seed);
  return pickAuraSpeaker(seed);
};
