export type VoiceStatus = 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';

export interface LiveVoiceHandlers {
  onStatus?: (status: VoiceStatus) => void;
  onError?: (message: string) => void;
}

const SAMPLE_RATE = 24000;

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

// xAI Grok speech-to-speech over WebSocket, authenticated with an ephemeral token.
export class GrokLiveSession {
  private ws: WebSocket | null = null;
  private captureCtx: AudioContext | null = null;
  private playbackCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private playCursor = 0;
  private scheduled: AudioBufferSourceNode[] = [];
  private muted = false;
  private stopped = false;
  private opened = false;

  constructor(private handlers: LiveVoiceHandlers = {}) {}

  private setStatus(s: VoiceStatus) {
    this.handlers.onStatus?.(s);
  }

  async start(clientSecret: string, wsUrl: string, systemInstruction: string, voiceName: string): Promise<void> {
    this.setStatus('connecting');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ws = new WebSocket(wsUrl, [`xai-client-secret.${clientSecret}`]);
      this.ws = ws;
      ws.onopen = () => {
        this.opened = true;
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            voice: voiceName,
            instructions: systemInstruction,
            turn_detection: { type: 'server_vad' },
            audio: {
              input: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
              output: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
            },
          },
        }));
        if (!this.stopped) this.setStatus('listening');
        this.startCapture();
      };
      ws.onmessage = (ev) => this.handleMessage(ev.data);
      ws.onerror = () => {
        this.handlers.onError?.('Grok voice connection error');
        this.setStatus('error');
      };
      ws.onclose = (e) => {
        if (this.stopped) return;
        const reason = e.reason || `code ${e.code}`;
        if (!this.opened) {
          this.handlers.onError?.(`Closed before connecting: ${reason}`);
          this.setStatus('error');
        } else {
          this.setStatus('ended');
        }
      };
    } catch (error) {
      this.handlers.onError?.(error instanceof Error ? error.message : 'Failed to start Grok voice');
      this.setStatus('error');
      this.stop();
    }
  }

  updatePersona(systemInstruction: string, voiceName: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'session.update',
        session: { voice: voiceName, instructions: systemInstruction },
      }));
    }
  }

  private handleMessage(raw: unknown) {
    if (typeof raw !== 'string') return;
    let event: any;
    try { event = JSON.parse(raw); } catch { return; }
    const type = event?.type as string | undefined;
    if (type === 'response.output_audio.delta' || type === 'response.audio.delta') {
      const delta = event.delta || event.audio;
      if (typeof delta === 'string') this.enqueuePlayback(delta);
    }
    if (type === 'response.done') {
      if (!this.stopped && this.scheduled.length === 0) this.setStatus('listening');
    }
    if (type === 'error') {
      this.handlers.onError?.(event.error?.message || event.message || 'Grok realtime error');
      this.setStatus('error');
    }
  }

  private startCapture() {
    const Ctor = getAudioContextCtor();
    this.captureCtx = new Ctor();
    const ctx = this.captureCtx;
    this.sourceNode = ctx.createMediaStreamSource(this.stream!);
    this.processor = ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (this.stopped || this.muted || this.ws?.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const down = downsample(input, ctx.sampleRate, SAMPLE_RATE);
      const audio = floatToPcm16Base64(down);
      try {
        this.ws!.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
      } catch { /* closing */ }
    };
    this.sourceNode.connect(this.processor);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    this.processor.connect(sink);
    sink.connect(ctx.destination);
  }

  private enqueuePlayback(base64Pcm: string) {
    if (this.stopped) return;
    const Ctor = getAudioContextCtor();
    if (!this.playbackCtx) this.playbackCtx = new Ctor();
    const ctx = this.playbackCtx;
    const float = base64Pcm16ToFloat32(base64Pcm);
    const buffer = ctx.createBuffer(1, float.length, SAMPLE_RATE);
    buffer.copyToChannel(float, 0);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, this.playCursor);
    node.start(startAt);
    this.playCursor = startAt + buffer.duration;
    this.setStatus('speaking');
    this.scheduled.push(node);
    node.onended = () => {
      this.scheduled = this.scheduled.filter((n) => n !== node);
      if (!this.stopped && this.scheduled.length === 0) this.setStatus('listening');
    };
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted() {
    return this.muted;
  }

  stop() {
    this.stopped = true;
    for (const node of this.scheduled) {
      try { node.stop(); } catch { /* noop */ }
    }
    this.scheduled = [];
    try { this.ws?.close(); } catch { /* noop */ }
    this.ws = null;
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
