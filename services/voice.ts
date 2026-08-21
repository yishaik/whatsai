// Deepgram Aura-1 speakers hosted on Workers AI.
// https://developers.cloudflare.com/workers-ai/models/aura-1/
export const AURA_SPEAKERS = [
  'asteria',
  'luna',
  'stella',
  'athena',
  'hera',
  'orion',
  'arcas',
  'perseus',
  'angus',
  'orpheus',
  'helios',
  'zeus',
] as const;

export type AuraSpeaker = (typeof AURA_SPEAKERS)[number];

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const pickAuraSpeaker = (seed: string): AuraSpeaker =>
  AURA_SPEAKERS[hashString(seed) % AURA_SPEAKERS.length];
