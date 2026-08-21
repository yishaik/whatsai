export type VoiceStatus = 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';

export interface LiveVoiceHandlers {
  onStatus?: (status: VoiceStatus) => void;
  onError?: (message: string) => void;
}

const SAMPLE_RATE = 24000;

const floatToPcm16 = (input: Float32Array): Int16Array => {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

const pcm16ToFloat = (bytes: ArrayBuffer): Float32Array => {
  const pcm = new Int16Array(bytes);
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
};

const getAudioContextCtor = (): typeof AudioContext =>
  window.AudioContext || (window as any).webkitAudioContext;

// Native speech-to-speech over xAI Realtime. Binary PCM + server VAD so it
// behaves like a phone call (barge-in, no "press to talk").
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
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const ws = new WebSocket(wsUrl, [`xai-client-secret.${clientSecret}`]);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.onopen = () => {
        this.opened = true;
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            voice: voiceName,
            instructions: systemInstruction,
            reasoning: { effort: 'none' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.4,
              silence_duration_ms: 450,
              prefix_padding_ms: 250,
            },
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: SAMPLE_RATE },
                transport: 'binary',
              },
              output: {
                format: { type: 'audio/pcm', rate: SAMPLE_RATE },
                transport: 'binary',
              },
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
        session: { voice: voiceName, instructions: systemInstruction, reasoning: { effort: 'none' } },
      }));
    }
  }

  private handleMessage(raw: unknown) {
    if (raw instanceof ArrayBuffer) {
      this.enqueuePlayback(pcm16ToFloat(raw));
      return;
    }
    if (typeof raw !== 'string') return;
    let event: any;
    try { event = JSON.parse(raw); } catch { return; }
    const type = event?.type as string | undefined;
    if (type === 'input_audio_buffer.speech_started') {
      this.flushPlayback();
      if (!this.stopped) this.setStatus('listening');
    }
    if (type === 'response.output_audio.delta' || type === 'response.audio.delta') {
      const delta = event.delta || event.audio;
      if (typeof delta === 'string') {
        const binary = atob(delta);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        this.enqueuePlayback(pcm16ToFloat(bytes.buffer));
      }
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
    this.captureCtx = new Ctor({ sampleRate: SAMPLE_RATE });
    void this.captureCtx.resume();
    const ctx = this.captureCtx;
    this.sourceNode = ctx.createMediaStreamSource(this.stream!);
    this.processor = ctx.createScriptProcessor(2048, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (this.stopped || this.muted || this.ws?.readyState !== WebSocket.OPEN) return;
      const pcm = floatToPcm16(e.inputBuffer.getChannelData(0));
      try {
        this.ws!.send(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
      } catch { /* closing */ }
    };
    this.sourceNode.connect(this.processor);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    this.processor.connect(sink);
    sink.connect(ctx.destination);
  }

  private enqueuePlayback(float: Float32Array) {
    if (this.stopped || float.length === 0) return;
    const Ctor = getAudioContextCtor();
    if (!this.playbackCtx) this.playbackCtx = new Ctor({ sampleRate: SAMPLE_RATE });
    void this.playbackCtx.resume();
    const ctx = this.playbackCtx;
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

  private flushPlayback() {
    for (const node of this.scheduled) {
      try { node.stop(); } catch { /* noop */ }
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
