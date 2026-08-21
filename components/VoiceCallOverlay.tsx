import React, { useEffect, useMemo, useState } from 'react';
import { useVoiceAgent } from '@cloudflare/voice/react';
import { Persona } from '../types';
import Avatar from './Avatar';
import { PhoneIcon, MicrophoneIcon, XMarkIcon } from './icons';
import { pickAuraSpeaker } from '../services/voice';

interface VoiceCallOverlayProps {
  // All personas in the chat, so the user can switch who they're talking to
  // mid-call. `initialPersona` is who the call starts with.
  personas: Persona[];
  initialPersona: Persona;
  chatTopic: string;
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

const personaInstruction = (persona: Persona, chatTopic: string, personas: Persona[]) => {
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

const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = ({
  personas,
  initialPersona,
  chatTopic,
  onClose,
}) => {
  const [persona, setPersona] = useState<Persona>(initialPersona);
  const [host, setHost] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [callName] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `call-${Date.now()}`,
  );

  const systemInstruction = useMemo(
    () => personaInstruction(persona, chatTopic, personas),
    [persona, chatTopic, personas],
  );
  const speaker = useMemo(() => pickAuraSpeaker(persona.id), [persona.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/voice-session', { method: 'POST' });
        let detail = `${resp.status}`;
        let body: { host?: string; error?: string } = {};
        try {
          body = await resp.json();
          detail = body.error ?? detail;
        } catch {
          /* noop */
        }
        if (!resp.ok) throw new Error(detail);
        if (!body.host) throw new Error('Voice worker host missing from session response.');
        if (!cancelled) setHost(body.host);
      } catch (error) {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : 'Failed to start voice session.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    status,
    interimTranscript,
    audioLevel,
    isMuted,
    connected,
    error,
    startCall,
    endCall,
    toggleMute,
    sendJSON,
  } = useVoiceAgent({
    agent: 'PersonaVoiceAgent',
    name: callName,
    host: host ?? undefined,
    enabled: !!host,
  });

  useEffect(() => {
    if (!connected) return;
    sendJSON({
      type: 'set_persona',
      systemInstruction,
      speaker,
      personaName: persona.name,
    });
  }, [connected, systemInstruction, speaker, persona.name, sendJSON]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      try {
        await startCall();
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : 'Failed to open the microphone.');
        }
      }
    })();
    return () => {
      cancelled = true;
      endCall();
    };
  }, [connected, startCall, endCall]);

  const overlayStatus: OverlayStatus = bootError
    ? 'error'
    : !connected || status === 'idle'
      ? 'connecting'
      : status === 'listening' || status === 'thinking' || status === 'speaking'
        ? status
        : 'connecting';

  const statusText =
    bootError || (error && overlayStatus === 'error')
      ? bootError || error
      : STATUS_LABEL[overlayStatus];

  const speakingRing = overlayStatus === 'speaking' || audioLevel > 0.08;

  return (
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
      </div>

      {personas.length > 1 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-text-secondary">Tap to talk to someone else</p>
          <div className="flex items-center gap-3 flex-wrap justify-center max-w-md">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  if (p.id !== persona.id) setPersona(p);
                }}
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
          onClick={toggleMute}
          disabled={overlayStatus === 'error' || !connected}
          title={isMuted ? 'Unmute' : 'Mute'}
          className={`p-4 rounded-full transition-colors disabled:opacity-40 ${
            isMuted ? 'bg-item-active-bg text-red-400' : 'bg-item-active-bg text-text-primary hover:bg-item-hover-bg'
          }`}
        >
          <MicrophoneIcon className="h-7 w-7" />
        </button>
        <button
          onClick={() => {
            endCall();
            onClose();
          }}
          title="End call"
          className="p-5 rounded-full bg-red-600 text-white hover:bg-red-500 transition-colors"
        >
          {overlayStatus === 'error' ? <XMarkIcon className="h-7 w-7" /> : <PhoneIcon className="h-7 w-7 rotate-[135deg]" />}
        </button>
      </div>
    </div>
  );
};

export default VoiceCallOverlay;
