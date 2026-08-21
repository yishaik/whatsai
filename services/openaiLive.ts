export type VoiceStatus = 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';

export interface LiveVoiceHandlers {
  onStatus?: (status: VoiceStatus) => void;
  onError?: (message: string) => void;
}

const waitForIce = (pc: RTCPeerConnection): Promise<void> => {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    const t = window.setTimeout(done, 2500);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(t);
        done();
      }
    });
  });
};

export class OpenAiLiveSession {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private stopped = false;
  private muted = false;

  constructor(private handlers: LiveVoiceHandlers = {}) {}

  private setStatus(s: VoiceStatus) {
    this.handlers.onStatus?.(s);
  }

  async start(systemInstruction: string, voiceName: string): Promise<void> {
    this.setStatus('connecting');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const pc = new RTCPeerConnection();
      this.pc = pc;

      this.audioEl = document.createElement('audio');
      this.audioEl.autoplay = true;
      this.audioEl.setAttribute('playsinline', 'true');
      pc.ontrack = (e) => {
        if (!this.audioEl) return;
        this.audioEl.srcObject = e.streams[0];
        void this.audioEl.play().catch(() => { /* autoplay — user already clicked Call */ });
        this.setStatus('speaking');
      };

      pc.addTransceiver('audio', { direction: 'sendrecv' });
      this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream!));

      const dc = pc.createDataChannel('oai-events');
      this.dc = dc;
      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'input_audio_buffer.speech_started') {
            if (!this.stopped) this.setStatus('listening');
          }
          if (event.type === 'response.created' || event.type === 'output_audio_buffer.started') {
            this.setStatus('speaking');
          }
          if (event.type === 'response.done' || event.type === 'output_audio_buffer.stopped') {
            if (!this.stopped) this.setStatus('listening');
          }
          if (event.type === 'error') {
            this.handlers.onError?.(event.error?.message || 'OpenAI realtime error');
            this.setStatus('error');
          }
        } catch {
          /* ignore */
        }
      };
      dc.onopen = () => {
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            output_modalities: ['audio'],
            instructions: systemInstruction,
            audio: {
              input: { turn_detection: { type: 'semantic_vad' } },
              output: { voice: voiceName || 'marin' },
            },
          },
        }));
        if (!this.stopped) this.setStatus('listening');
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIce(pc);
      const sdp = pc.localDescription?.sdp || offer.sdp;
      const resp = await fetch('/api/voice-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          sdp,
          systemInstruction,
          voiceName,
        }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body.sdp) {
        throw new Error(body.error || `OpenAI realtime connect failed (${resp.status})`);
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: body.sdp });
    } catch (error) {
      this.handlers.onError?.(error instanceof Error ? error.message : 'Failed to start OpenAI voice');
      this.setStatus('error');
      this.stop();
    }
  }

  updateInstructions(systemInstruction: string) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify({
        type: 'session.update',
        session: { type: 'realtime', instructions: systemInstruction, output_modalities: ['audio'] },
      }));
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }

  isMuted() {
    return this.muted;
  }

  stop() {
    this.stopped = true;
    try { this.dc?.close(); } catch { /* noop */ }
    this.pc?.getSenders().forEach((s) => { try { s.track?.stop(); } catch { /* noop */ } });
    try { this.pc?.close(); } catch { /* noop */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.pc = null;
    this.dc = null;
    if (this.audioEl) {
      this.audioEl.srcObject = null;
      this.audioEl = null;
    }
    this.setStatus('ended');
  }
}
