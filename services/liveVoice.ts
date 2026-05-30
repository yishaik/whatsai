import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai';

// 1:1 real-time voice with a persona via the Gemini Live API. The browser
// connects directly using a short-lived ephemeral token minted by
// /api/live-token, so GEMINI_API_KEY never reaches the client.

export type VoiceStatus = 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';

const INPUT_SAMPLE_RATE = 16000; // Gemini Live expects 16kHz PCM16 input
const OUTPUT_SAMPLE_RATE = 24000; // Gemini Live emits 24kHz PCM16 output

// Gemini Live prebuilt voices; assign one per persona deterministically.
const LIVE_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const pickLiveVoice = (seed: string): string => LIVE_VOICES[hashString(seed) % LIVE_VOICES.length];

// --- PCM helpers ---------------------------------------------------------

const downsample = (input: Float32Array, inRate: number, outRate: number): Float32Array => {
  if (outRate >= inRate) return input;
  const ratio = inRate / outRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) out[i] = input[Math.floor(i * ratio)];
  return out;
};

const floatToPcm16Base64 = (input: Float32Array): string => {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const base64Pcm16ToFloat32 = (b64: string): Float32Array => {
  const binary = atob(b64);
  const len = binary.length / 2;
  const out = new Float32Array(len);
  const view = new DataView(new ArrayBuffer(2));
  for (let i = 0; i < len; i++) {
    view.setUint8(0, binary.charCodeAt(i * 2));
    view.setUint8(1, binary.charCodeAt(i * 2 + 1));
    out[i] = view.getInt16(0, true) / 0x8000;
  }
  return out;
};

const getAudioContextCtor = (): typeof AudioContext =>
  window.AudioContext || (window as any).webkitAudioContext;

export interface LiveVoiceHandlers {
  onStatus?: (status: VoiceStatus) => void;
  onError?: (message: string) => void;
}

export class LiveVoiceSession {
  private session: Session | null = null;
  private captureCtx: AudioContext | null = null;
  private playbackCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private playCursor = 0; // next scheduled playback time (in playbackCtx time)
  private scheduled: AudioBufferSourceNode[] = [];
  private muted = false;
  private stopped = false;

  constructor(private handlers: LiveVoiceHandlers = {}) {}

  private setStatus(s: VoiceStatus) {
    this.handlers.onStatus?.(s);
  }

  async start(systemInstruction: string, voiceName: string): Promise<void> {
    this.setStatus('connecting');
    try {
      // 1) Mint an ephemeral token.
      const resp = await fetch('/api/live-token', { method: 'POST' });
      if (!resp.ok) {
        throw new Error(`Token request failed (${resp.status})`);
      }
      const { token, model } = (await resp.json()) as { token: string; model: string };

      // 2) Acquire the microphone before connecting.
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 3) Connect to Gemini Live with the ephemeral token.
      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
      this.session = await ai.live.connect({
        model,
        callbacks: {
          onopen: () => {
            if (!this.stopped) this.setStatus('listening');
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onerror: (e: any) => {
            console.error('Live session error:', e);
            this.handlers.onError?.(e?.message ?? 'Voice connection error');
            this.setStatus('error');
          },
          onclose: () => {
            if (!this.stopped) this.setStatus('ended');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      });

      // 4) Start streaming mic audio.
      this.startCapture();
    } catch (error) {
      console.error('Failed to start live voice:', error);
      this.handlers.onError?.(error instanceof Error ? error.message : 'Failed to start voice');
      this.setStatus('error');
      this.stop();
    }
  }

  private startCapture() {
    const Ctor = getAudioContextCtor();
    this.captureCtx = new Ctor();
    const ctx = this.captureCtx;
    this.sourceNode = ctx.createMediaStreamSource(this.stream!);
    // ScriptProcessor is deprecated but avoids shipping a separate AudioWorklet
    // module; fine for a v1 voice feature.
    this.processor = ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (this.stopped || this.muted || !this.session) return;
      const input = e.inputBuffer.getChannelData(0);
      const down = downsample(input, ctx.sampleRate, INPUT_SAMPLE_RATE);
      const data = floatToPcm16Base64(down);
      try {
        this.session.sendRealtimeInput({ audio: { data, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` } });
      } catch {
        /* session may be closing */
      }
    };
    this.sourceNode.connect(this.processor);
    // Route through a muted gain so onaudioprocess fires without echoing the mic.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    this.processor.connect(sink);
    sink.connect(ctx.destination);
  }

  private handleMessage(msg: LiveServerMessage) {
    const content = msg.serverContent;
    if (!content) return;

    if (content.interrupted) {
      this.flushPlayback();
      this.setStatus('listening');
      return;
    }

    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data && (inline.mimeType ?? '').includes('audio')) {
        this.enqueuePlayback(inline.data);
      }
    }
    if (content.turnComplete) {
      // Playback may still be draining; status flips back to listening once done.
    }
  }

  private enqueuePlayback(base64Pcm: string) {
    if (this.stopped) return;
    const Ctor = getAudioContextCtor();
    if (!this.playbackCtx) this.playbackCtx = new Ctor();
    const ctx = this.playbackCtx;
    const float = base64Pcm16ToFloat32(base64Pcm);
    const buffer = ctx.createBuffer(1, float.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float, 0);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, this.playCursor);
    node.start(startAt);
    this.playCursor = startAt + buffer.duration;
    this.setStatus('speaking');
    this.scheduled.push(node);
    node.onended = () => {
      this.scheduled = this.scheduled.filter((n) => n !== node);
      if (!this.stopped && this.scheduled.length === 0) this.setStatus('listening');
    };
  }

  private flushPlayback() {
    for (const node of this.scheduled) {
      try { node.stop(); } catch { /* already stopped */ }
    }
    this.scheduled = [];
    this.playCursor = this.playbackCtx?.currentTime ?? 0;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted() {
    return this.muted;
  }

  stop() {
    this.stopped = true;
    this.flushPlayback();
    try { this.session?.close(); } catch { /* noop */ }
    this.session = null;
    if (this.processor) { this.processor.onaudioprocess = null; try { this.processor.disconnect(); } catch {} }
    try { this.sourceNode?.disconnect(); } catch {}
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    try { this.captureCtx?.close(); } catch {}
    try { this.playbackCtx?.close(); } catch {}
    this.captureCtx = null;
    this.playbackCtx = null;
    this.setStatus('ended');
  }
}
