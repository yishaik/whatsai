import React, { useEffect, useRef, useState } from 'react';
import { Persona } from '../types';
import Avatar from './Avatar';
import { PhoneIcon, MicrophoneIcon, XMarkIcon } from './icons';
import { LiveVoiceSession, pickLiveVoice, VoiceStatus } from '../services/liveVoice';

interface VoiceCallOverlayProps {
  persona: Persona;
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

const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = ({ persona, chatTopic, onClose }) => {
  const [status, setStatus] = useState<VoiceStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const sessionRef = useRef<LiveVoiceSession | null>(null);

  useEffect(() => {
    const systemInstruction =
      `You are "${persona.name}", on a live voice call with the user about "${chatTopic}". ` +
      `Your personality: "${persona.prompt}". Stay fully in character. Speak naturally and ` +
      `concisely, like a real phone conversation. Reply in the user's language.`;

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
