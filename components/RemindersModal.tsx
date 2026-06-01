import React, { useEffect, useState } from 'react';
import { XMarkIcon, ClockIcon, TrashIcon } from './icons';
import Avatar from './Avatar';
import { usePush } from '../hooks/usePush';
import { Persona, ChatRoom, Reminder, ReminderRepeat } from '../types';

interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: Reminder[];
  personasMap: { [id: string]: Persona };
  chatRooms: ChatRoom[];
  onCancel: (id: string) => Promise<void>;
}

const REPEAT_LABEL: Record<ReminderRepeat, string> = {
  none: 'One-off',
  hourly: 'Every hour',
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
};

const formatWhen = (ms: number): string => {
  try {
    return new Date(ms).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toISOString();
  }
};

const RemindersModal: React.FC<RemindersModalProps> = ({ isOpen, onClose, reminders, personasMap, chatRooms, onCancel }) => {
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());
  const push = usePush();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCancel = async (id: string) => {
    setCancelling((prev) => new Set(prev).add(id));
    try {
      await onCancel(id);
    } catch (err) {
      console.error('Failed to cancel reminder:', err);
    } finally {
      setCancelling((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Soonest first.
  const sorted = [...reminders].sort((a, b) => a.nextRunAt - b.nextRunAt);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-panel-bg rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-item-hover-bg flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <ClockIcon className="h-5 w-5" /> Reminders
          </h2>
          <button onClick={onClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {push.available && (
          <div className="px-4 pt-3">
            <div className="flex items-center justify-between gap-3 bg-item-active-bg rounded-lg p-3">
              <div className="min-w-0">
                <p className="text-sm text-text-primary">Push notifications</p>
                <p className="text-xs text-text-secondary">
                  {push.subscribed
                    ? 'On — reminders alert you even when the app is closed.'
                    : 'Get alerted even when the app is closed.'}
                </p>
                {push.error && <p className="text-xs text-red-400 mt-1">{push.error}</p>}
              </div>
              <button
                onClick={() => (push.subscribed ? push.disable() : push.enable())}
                disabled={push.busy}
                className={`text-sm px-3 py-1.5 rounded-md flex-shrink-0 disabled:opacity-50 ${
                  push.subscribed
                    ? 'bg-item-hover-bg text-text-secondary hover:text-text-primary'
                    : 'bg-accent-green text-white hover:bg-opacity-90'
                }`}
              >
                {push.busy ? '…' : push.subscribed ? 'Turn off' : 'Enable'}
              </button>
            </div>
          </div>
        )}

        <div className="p-4 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">
              No reminders scheduled. Ask a persona to remind you of something — e.g.
              <span className="text-text-primary"> "remind me to stretch every hour"</span>.
            </p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((r) => {
                const persona = personasMap[r.personaId];
                const chat = chatRooms.find((c) => c.id === r.chatId);
                return (
                  <li key={r.id} className="flex items-center gap-3 bg-item-active-bg rounded-lg p-3">
                    <Avatar src={persona?.avatar} name={persona?.name || '?'} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{r.text}</p>
                      <p className="text-xs text-text-secondary truncate">
                        {formatWhen(r.nextRunAt)} · {REPEAT_LABEL[r.repeat]}
                        {chat ? ` · ${chat.topic}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancel(r.id)}
                      disabled={cancelling.has(r.id)}
                      className="text-icon-default hover:text-red-500 p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0 disabled:opacity-40"
                      title="Cancel reminder"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default RemindersModal;
