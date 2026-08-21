export type VoiceStatus = 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';

export interface LiveVoiceHandlers {
  onStatus?: (status: VoiceStatus) => void;
  onError?: (message: string) => void;
}

// Browser WebRTC session against OpenAI Realtime using an ephemeral client secret.
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

  async start(clientSecret: string, systemInstruction: string): Promise<void> {
    this.setStatus('connecting');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const pc = new RTCPeerConnection();
      this.pc = pc;

      this.audioEl = document.createElement('audio');
      this.audioEl.autoplay = true;
      pc.ontrack = (e) => {
        if (this.audioEl) this.audioEl.srcObject = e.streams[0];
        this.setStatus('speaking');
      };

      this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream!));

      const dc = pc.createDataChannel('oai-events');
      this.dc = dc;
      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
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
          session: { instructions: systemInstruction },
        }));
        if (!this.stopped) this.setStatus('listening');
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      });
      if (!sdpResponse.ok) {
        const detail = await sdpResponse.text().catch(() => `${sdpResponse.status}`);
        throw new Error(`OpenAI realtime connect failed: ${detail.slice(0, 280)}`);
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdpResponse.text() });
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
        session: { instructions: systemInstruction },
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
