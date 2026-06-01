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

type SpeakHandlers = { onend?: () => void; onerror?: () => void };

// Web Speech fallback (free, no backend). Used directly when cloud TTS is
// unavailable or fails.
const speakWeb = (text: string, seed: string, handlers?: SpeakHandlers): void => {
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

// Cloud TTS playback state. `playToken` invalidates in-flight requests when a
// new utterance starts or playback is stopped.
let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let playToken = 0;

const cleanupAudio = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
};

// Speak `text` for persona `seed`. Tries cloud TTS first (consistent voices),
// falling back to Web Speech on any error so playback is never lost.
export const speak = (text: string, seed: string, handlers?: SpeakHandlers): void => {
  if (!text.trim()) {
    handlers?.onerror?.();
    return;
  }
  stopSpeaking();
  const myToken = ++playToken;

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, seed }),
  })
    .then(async (resp) => {
      if (myToken !== playToken) return; // superseded by stop/new utterance
      if (!resp.ok) throw new Error(`tts ${resp.status}`);
      const blob = await resp.blob();
      if (myToken !== playToken) return;
      if (!blob.size) throw new Error('empty audio');
      const url = URL.createObjectURL(blob);
      currentUrl = url;
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onended = () => { if (myToken === playToken) { cleanupAudio(); handlers?.onend?.(); } };
      audio.onerror = () => { if (myToken === playToken) { cleanupAudio(); speakWeb(text, seed, handlers); } };
      await audio.play();
    })
    .catch(() => {
      if (myToken === playToken) speakWeb(text, seed, handlers);
    });
};

export const stopSpeaking = (): void => {
  playToken++; // invalidate any in-flight cloud request
  if (ttsSupported()) window.speechSynthesis.cancel();
  cleanupAudio();
};
