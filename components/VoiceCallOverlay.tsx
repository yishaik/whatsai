import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVoiceAgent } from '@cloudflare/voice/react';
import { Persona } from '../types';
import Avatar from './Avatar';
import { PhoneIcon, MicrophoneIcon, XMarkIcon } from './icons';
import {
  VoiceProvider,
  VOICE_PROVIDER_META,
  pickVoiceForProvider,
} from '../services/voice';
import { LiveVoiceSession } from '../services/geminiLive';
import { OpenAiLiveSession } from '../services/openaiLive';
import { GrokLiveSession } from '../services/grokLive';

interface VoiceCallOverlayProps {
  personas: Persona[];
  initialPersona: Persona;
  chatTopic: string;
  voiceProvider: VoiceProvider;
  onVoiceProviderChange: (provider: VoiceProvider) => void;
  onClose: () => void;
}

type OverlayStatus = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

const STATUS_LABEL: Record<OverlayStatus, string> = {
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  error: 'Connection problem',
};

export const personaInstruction = (persona: Persona, chatTopic: string, personas: Persona[]) => {
  const others = personas.filter((p) => p.id !== persona.id).map((p) => p.name);
  const groupNote = others.length
    ? ` Other people also on this group call (the user can switch to them): ${others.join(', ')}.`
    : '';
  return (
    `You are "${persona.name}", on a live voice call with the user about "${chatTopic}". ` +
    `Your personality: "${persona.prompt}". Stay fully in character. Speak naturally and ` +
    `concisely, like a real phone conversation. Reply in the user's language.${groupNote}`
  );
};

const Shell: React.FC<{
  persona: Persona;
  personas: Persona[];
  overlayStatus: OverlayStatus;
  statusText: string;
  speakingRing: boolean;
  interimTranscript?: string | null;
  muted: boolean;
  muteDisabled: boolean;
  onToggleMute: () => void;
  onSelectPersona: (p: Persona) => void;
  onEnd: () => void;
  voiceProvider: VoiceProvider;
  onVoiceProviderChange: (provider: VoiceProvider) => void;
}> = ({
  persona, personas, overlayStatus, statusText, speakingRing, interimTranscript,
  muted, muteDisabled, onToggleMute, onSelectPersona, onEnd, voiceProvider, onVoiceProviderChange,
}) => (
  <div className="fixed inset-0 z-[60] bg-gray-900/95 flex flex-col items-center justify-between py-16 px-6">
    <div className="flex flex-col items-center gap-5 mt-10">
      <div className={`rounded-full ${speakingRing ? 'ring-4 ring-accent-green animate-pulse' : 'ring-2 ring-item-hover-bg'}`}>
        <Avatar src={persona.avatar} name={persona.name} size={128} />
      </div>
      <h2 className="text-2xl font-semibold text-text-primary">{persona.name}</h2>
      <p className={`text-sm ${overlayStatus === 'error' ? 'text-red-400' : 'text-text-secondary'}`}>{statusText}</p>
      {interimTranscript && overlayStatus !== 'error' && (
        <p className="text-xs text-text-secondary max-w-sm text-center italic">{interimTranscript}</p>
      )}
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        Voice
        <select
          value={voiceProvider}
          onChange={(e) => onVoiceProviderChange(e.target.value as VoiceProvider)}
          className="bg-item-active-bg text-text-primary rounded px-2 py-1"
        >
          {VOICE_PROVIDER_META.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>
    </div>

    {personas.length > 1 && (
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs text-text-secondary">Tap to talk to someone else</p>
        <div className="flex items-center gap-3 flex-wrap justify-center max-w-md">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => { if (p.id !== persona.id) onSelectPersona(p); }}
              title={p.name}
              className={`rounded-full transition ${p.id === persona.id ? 'ring-2 ring-accent-green' : 'opacity-70 hover:opacity-100'}`}
            >
              <Avatar src={p.avatar} name={p.name} size={48} />
            </button>
          ))}
        </div>
      </div>
    )}

    <div className="flex items-center gap-6">
      <button
        onClick={onToggleMute}
        disabled={muteDisabled}
        title={muted ? 'Unmute' : 'Mute'}
        className={`p-4 rounded-full transition-colors disabled:opacity-40 ${
          muted ? 'bg-item-active-bg text-red-400' : 'bg-item-active-bg text-text-primary hover:bg-item-hover-bg'
        }`}
      >
        <MicrophoneIcon className="h-7 w-7" />
      </button>
      <button
        onClick={onEnd}
        title="End call"
        className="p-5 rounded-full bg-red-600 text-white hover:bg-red-500 transition-colors"
      >
        {overlayStatus === 'error' ? <XMarkIcon className="h-7 w-7" /> : <PhoneIcon className="h-7 w-7 rotate-[135deg]" />}
      </button>
    </div>
  </div>
);

const CloudflareCall: React.FC<VoiceCallOverlayProps> = ({
  personas, initialPersona, chatTopic, voiceProvider, onVoiceProviderChange, onClose,
}) => {
  const [persona, setPersona] = useState<Persona>(initialPersona);
  const [host, setHost] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [callName] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `call-${Date.now()}`,
  );
  const systemInstruction = useMemo(() => personaInstruction(persona, chatTopic, personas), [persona, chatTopic, personas]);
  const speaker = useMemo(() => pickVoiceForProvider('cloudflare', persona.id), [persona.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/voice-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'cloudflare' }),
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(body.error || `${resp.status}`);
        if (!body.host) throw new Error('Voice worker host missing from session response.');
        if (!cancelled) setHost(body.host);
      } catch (error) {
        if (!cancelled) setBootError(error instanceof Error ? error.message : 'Failed to start voice session.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const { status, interimTranscript, audioLevel, isMuted, connected, error, startCall, endCall, toggleMute, sendJSON } =
    useVoiceAgent({
      agent: 'PersonaVoiceAgent',
      name: callName,
      host: host ?? undefined,
      enabled: !!host,
    });

  useEffect(() => {
    if (!connected) return;
    sendJSON({ type: 'set_persona', systemInstruction, speaker, personaName: persona.name });
  }, [connected, systemInstruction, speaker, persona.name, sendJSON]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      try { await startCall(); } catch (err) {
        if (!cancelled) setBootError(err instanceof Error ? err.message : 'Failed to open the microphone.');
      }
    })();
    return () => { cancelled = true; endCall(); };
  }, [connected, startCall, endCall]);

  const overlayStatus: OverlayStatus = bootError
    ? 'error'
    : !connected || status === 'idle'
      ? 'connecting'
      : status === 'listening' || status === 'thinking' || status === 'speaking'
        ? status
        : 'connecting';

  return (
    <Shell
      persona={persona}
      personas={personas}
      overlayStatus={overlayStatus}
      statusText={bootError || (error && overlayStatus === 'error' ? error : STATUS_LABEL[overlayStatus]) || STATUS_LABEL[overlayStatus]}
      speakingRing={overlayStatus === 'speaking' || audioLevel > 0.08}
      interimTranscript={interimTranscript}
      muted={isMuted}
      muteDisabled={overlayStatus === 'error' || !connected}
      onToggleMute={toggleMute}
      onSelectPersona={setPersona}
      onEnd={() => { endCall(); onClose(); }}
      voiceProvider={voiceProvider}
      onVoiceProviderChange={onVoiceProviderChange}
    />
  );
};

const DirectLiveCall: React.FC<VoiceCallOverlayProps> = ({
  personas, initialPersona, chatTopic, voiceProvider, onVoiceProviderChange, onClose,
}) => {
  const [persona, setPersona] = useState<Persona>(initialPersona);
  const [status, setStatus] = useState<OverlayStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const sessionRef = useRef<{ setMuted: (m: boolean) => void; stop: () => void; update?: (i: string, v: string) => void } | null>(null);
  const systemInstruction = useMemo(() => personaInstruction(persona, chatTopic, personas), [persona, chatTopic, personas]);
  const voiceName = useMemo(() => pickVoiceForProvider(voiceProvider, persona.id), [voiceProvider, persona.id]);
  const reconnectKey = voiceProvider === 'gemini' ? persona.id : 'stable';

  useEffect(() => {
    setError(null);
    setMuted(false);
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/voice-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: voiceProvider, systemInstruction, voiceName }),
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(body.error || `${resp.status}`);
        if (cancelled) return;

        if (voiceProvider === 'gemini') {
          const session = new LiveVoiceSession({
            onStatus: (s) => { if (s === 'listening' || s === 'speaking' || s === 'connecting') setStatus(s); if (s === 'error') setStatus('error'); },
            onError: setError,
          });
          sessionRef.current = session;
          await session.start(body.token, body.model);
        } else if (voiceProvider === 'openai') {
          const session = new OpenAiLiveSession({
            onStatus: (s) => { if (s === 'listening' || s === 'speaking' || s === 'connecting') setStatus(s); if (s === 'error') setStatus('error'); },
            onError: setError,
          });
          sessionRef.current = {
            setMuted: (m) => session.setMuted(m),
            stop: () => session.stop(),
            update: (instruction) => session.updateInstructions(instruction),
          };
          await session.start(body.clientSecret, systemInstruction);
        } else {
          const session = new GrokLiveSession({
            onStatus: (s) => { if (s === 'listening' || s === 'speaking' || s === 'connecting') setStatus(s); if (s === 'error') setStatus('error'); },
            onError: setError,
          });
          sessionRef.current = {
            setMuted: (m) => session.setMuted(m),
            stop: () => session.stop(),
            update: (instruction, voice) => session.updatePersona(instruction, voice),
          };
          await session.start(body.clientSecret, body.wsUrl, systemInstruction, voiceName);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to start voice');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
    // Gemini tokens bake persona+voice in, so reconnect on persona change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceProvider, reconnectKey]);

  useEffect(() => {
    if (voiceProvider === 'gemini') return;
    sessionRef.current?.update?.(systemInstruction, voiceName);
  }, [systemInstruction, voiceName, voiceProvider]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setMuted(next);
  };

  const overlayStatus: OverlayStatus = error ? 'error' : status;

  return (
    <Shell
      persona={persona}
      personas={personas}
      overlayStatus={overlayStatus}
      statusText={error && overlayStatus === 'error' ? error : STATUS_LABEL[overlayStatus]}
      speakingRing={overlayStatus === 'speaking'}
      muted={muted}
      muteDisabled={overlayStatus === 'error'}
      onToggleMute={toggleMute}
      onSelectPersona={setPersona}
      onEnd={() => { sessionRef.current?.stop(); onClose(); }}
      voiceProvider={voiceProvider}
      onVoiceProviderChange={onVoiceProviderChange}
    />
  );
};

const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = (props) =>
  props.voiceProvider === 'cloudflare'
    ? <CloudflareCall {...props} />
    : <DirectLiveCall {...props} />;

export default VoiceCallOverlay;
