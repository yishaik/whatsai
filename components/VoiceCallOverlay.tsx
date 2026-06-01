import React, { useEffect, useRef, useState } from 'react';
import { Persona } from '../types';
import Avatar from './Avatar';
import { PhoneIcon, MicrophoneIcon, XMarkIcon } from './icons';
import { LiveVoiceSession, pickLiveVoice, VoiceStatus } from '../services/liveVoice';

interface VoiceCallOverlayProps {
  // All personas in the chat, so the user can switch who they're talking to
  // mid-call (each reconnects with its own voice). `initialPersona` is who the
  // call starts with.
  personas: Persona[];
  initialPersona: Persona;
  chatTopic: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<VoiceStatus, string> = {
  connecting: 'Connecting…',
  listening: 'Listening…',
  speaking: 'Speaking…',
  ended: 'Call ended',
  error: 'Connection problem',
};

const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = ({ personas, initialPersona, chatTopic, onClose }) => {
  const [status, setStatus] = useState<VoiceStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  // The persona currently on the line. Switching reconnects the Live session
  // (one model/voice per session), so it's turn-based: talk to one at a time.
  const [persona, setPersona] = useState<Persona>(initialPersona);
  const sessionRef = useRef<LiveVoiceSession | null>(null);

  useEffect(() => {
    setError(null);
    setMuted(false); // each reconnected session starts unmuted
    const others = personas.filter((p) => p.id !== persona.id).map((p) => p.name);
    const groupNote = others.length
      ? ` Other people also on this group call (the user can switch to them): ${others.join(', ')}.`
      : '';
    const systemInstruction =
      `You are "${persona.name}", on a live voice call with the user about "${chatTopic}". ` +
      `Your personality: "${persona.prompt}". Stay fully in character. Speak naturally and ` +
      `concisely, like a real phone conversation. Reply in the user's language.${groupNote}`;

    const session = new LiveVoiceSession({
      onStatus: setStatus,
      onError: (msg) => setError(msg),
    });
    sessionRef.current = session;
    session.start(systemInstruction, pickLiveVoice(persona.id));

    return () => {
      session.stop();
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.id]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setMuted(next);
  };

  const statusText = error && status === 'error' ? error : STATUS_LABEL[status];

  return (
    <div className="fixed inset-0 z-[60] bg-gray-900/95 flex flex-col items-center justify-between py-16 px-6">
      <div className="flex flex-col items-center gap-5 mt-10">
        <div className={`rounded-full ${status === 'speaking' ? 'ring-4 ring-accent-green animate-pulse' : 'ring-2 ring-item-hover-bg'}`}>
          <Avatar src={persona.avatar} name={persona.name} size={128} />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary">{persona.name}</h2>
        <p className={`text-sm ${status === 'error' ? 'text-red-400' : 'text-text-secondary'}`}>{statusText}</p>
      </div>

      {personas.length > 1 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-text-secondary">Tap to talk to someone else</p>
          <div className="flex items-center gap-3 flex-wrap justify-center max-w-md">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => { if (p.id !== persona.id) setPersona(p); }}
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
          disabled={status === 'error' || status === 'ended'}
          title={muted ? 'Unmute' : 'Mute'}
          className={`p-4 rounded-full transition-colors disabled:opacity-40 ${
            muted ? 'bg-item-active-bg text-red-400' : 'bg-item-active-bg text-text-primary hover:bg-item-hover-bg'
          }`}
        >
          <MicrophoneIcon className="h-7 w-7" />
        </button>
        <button
          onClick={onClose}
          title="End call"
          className="p-5 rounded-full bg-red-600 text-white hover:bg-red-500 transition-colors"
        >
          {status === 'error' ? <XMarkIcon className="h-7 w-7" /> : <PhoneIcon className="h-7 w-7 rotate-[135deg]" />}
        </button>
      </div>
    </div>
  );
};

export default VoiceCallOverlay;
