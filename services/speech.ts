// Text-to-speech via the browser's Web Speech API (no backend, no API cost).
// Each persona gets a deterministic voice, biased to the language of the text.

export const ttsSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

let cachedVoices: SpeechSynthesisVoice[] = [];

const refreshVoices = () => {
  if (ttsSupported()) cachedVoices = window.speechSynthesis.getVoices();
};

if (ttsSupported()) {
  refreshVoices();
  // Voices often load asynchronously; keep the cache fresh.
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

const isHebrew = (text: string): boolean => /[\u0590-\u05FF]/.test(text);

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// Pick a stable voice for `seed` (persona id), preferring voices matching the
// text's language so Hebrew isn't read by an English voice and vice versa.
const pickVoice = (seed: string, text: string): SpeechSynthesisVoice | undefined => {
  const voices = cachedVoices.length ? cachedVoices : (ttsSupported() ? window.speechSynthesis.getVoices() : []);
  if (!voices.length) return undefined;
  const prefix = isHebrew(text) ? 'he' : 'en';
  const pool = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  const list = pool.length ? pool : voices;
  return list[hashString(seed) % list.length];
};

export const speak = (
  text: string,
  seed: string,
  handlers?: { onend?: () => void; onerror?: () => void },
): void => {
  if (!ttsSupported() || !text.trim()) {
    handlers?.onerror?.();
    return;
  }
  window.speechSynthesis.cancel(); // only one utterance at a time
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(seed, text);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.rate = 1;
  utterance.pitch = 1;
  if (handlers?.onend) utterance.onend = () => handlers.onend!();
  if (handlers?.onerror) utterance.onerror = () => handlers.onerror!();
  window.speechSynthesis.speak(utterance);
};

export const stopSpeaking = (): void => {
  if (ttsSupported()) window.speechSynthesis.cancel();
};
