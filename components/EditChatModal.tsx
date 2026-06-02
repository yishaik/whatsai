import React, { useState, useEffect } from 'react';
import { ChatRoom, Persona } from '../types';
import { XMarkIcon, ArrowPathIcon } from './icons';
import Avatar from './Avatar';
import { useModels } from '../hooks/useModels';
import { exportChatMarkdown, downloadText, slugify } from '../services/exportChat';

interface EditChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatRoom: ChatRoom | null;
  personas: Persona[];
  updateChatRoom: (id: string, updates: Partial<ChatRoom>) => void;
  generateChatAvatar: (chatId: string) => Promise<void>;
  onCreateShareLink: (chatId: string) => Promise<string>;
  onRevokeShareLink: (chatId: string) => Promise<void>;
}

const EditChatModal: React.FC<EditChatModalProps> = ({ 
  isOpen, 
  onClose, 
  chatRoom, 
  personas, 
  updateChatRoom,
  generateChatAvatar,
  onCreateShareLink,
  onRevokeShareLink,
}) => {
  const [topic, setTopic] = useState('');
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(new Set());
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  // Per-chat settings. "" model = use app/persona default; 0 responders = all.
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.9);
  const [maxResponders, setMaxResponders] = useState(0);
  const [riffRounds, setRiffRounds] = useState(0);
  // Share link state (kept local since the modal holds a snapshot of chatRoom).
  const [shareId, setShareId] = useState<string | undefined>(undefined);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const models = useModels();

  useEffect(() => {
    if (chatRoom) {
      setTopic(chatRoom.topic);
      setSelectedPersonaIds(new Set(chatRoom.personaIds));
      setModel(chatRoom.model ?? '');
      setTemperature(chatRoom.temperature ?? 0.9);
      setMaxResponders(chatRoom.maxResponders ?? 0);
      setRiffRounds(chatRoom.riffRounds ?? 0);
      setShareId(chatRoom.shareId);
      setCopied(false);
    }
  }, [chatRoom]);

  const shareUrl = shareId ? `${window.location.origin}/?share=${shareId}` : '';

  const handleExport = () => {
    if (!chatRoom) return;
    const nameFor = (id: string) => personas.find((p) => p.id === id)?.name || 'Unknown';
    const md = exportChatMarkdown(chatRoom.topic, chatRoom.messages, nameFor);
    downloadText(`${slugify(chatRoom.topic)}.md`, md);
  };

  const handleCreateShare = async () => {
    if (!chatRoom) return;
    setSharing(true);
    try {
      setShareId(await onCreateShareLink(chatRoom.id));
    } catch (err) {
      console.error('Failed to create share link:', err);
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!chatRoom) return;
    setSharing(true);
    try {
      await onRevokeShareLink(chatRoom.id);
      setShareId(undefined);
    } catch (err) {
      console.error('Failed to revoke share link:', err);
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !chatRoom) return null;

  const handleTogglePersona = (id: string) => {
    setSelectedPersonaIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic && selectedPersonaIds.size > 0) {
      updateChatRoom(chatRoom.id, {
        topic: topic.trim(),
        personaIds: Array.from(selectedPersonaIds),
        model,
        temperature,
        maxResponders,
        riffRounds,
      });
      onClose();
    }
  };

  const handleGenerateAvatar = async () => {
    if (isGeneratingAvatar) return;
    setIsGeneratingAvatar(true);
    try {
      await generateChatAvatar(chatRoom.id);
    } catch (error) {
      console.error('Failed to generate avatar:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate avatar');
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-panel-bg rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-item-hover-bg flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">Edit Chat</h2>
          <button onClick={onClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <Avatar 
                src={chatRoom.avatar} 
                seed={chatRoom.topic} 
                size={64} 
              />
              <button
                type="button"
                onClick={handleGenerateAvatar}
                disabled={isGeneratingAvatar}
                className="flex items-center gap-2 bg-item-active-bg hover:bg-item-hover-bg text-text-primary font-medium py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className={`h-5 w-5 ${isGeneratingAvatar ? 'animate-spin' : ''}`} />
                {isGeneratingAvatar ? 'Generating...' : 'Generate Avatar'}
              </button>
            </div>
            
            <div>
              <label htmlFor="chat-topic" className="block text-sm font-medium text-text-secondary mb-1">Chat Topic</label>
              <input
                id="chat-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Planning a space mission"
                className="w-full bg-item-active-bg border-gray-600 text-text-primary rounded-md p-2 focus:ring-accent-green focus:border-accent-green"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Participants (at least 1)</label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {personas.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleTogglePersona(p.id)}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition ${
                      selectedPersonaIds.has(p.id) ? 'bg-accent-green' : 'bg-item-active-bg hover:bg-item-hover-bg'
                    }`}
                  >
                    <Avatar src={p.avatar} name={p.name} />
                    <span className={`font-medium flex-1 min-w-0 truncate ${selectedPersonaIds.has(p.id) ? 'text-white' : 'text-text-primary'}`}>
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-item-hover-bg pt-5 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Chat settings</h3>

              <div>
                <label htmlFor="chat-model" className="block text-sm font-medium text-text-secondary mb-1">Model</label>
                <select
                  id="chat-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-item-active-bg border border-item-hover-bg text-text-primary rounded-md p-2 focus:ring-accent-green focus:border-accent-green"
                >
                  <option value="">Default (my setting / per-persona)</option>
                  {models.filter((m) => m.provider === 'gemini').length > 0 && (
                    <optgroup label="Gemini">
                      {models.filter((m) => m.provider === 'gemini').map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {models.filter((m) => m.provider === 'openai').length > 0 && (
                    <optgroup label="OpenAI">
                      {models.filter((m) => m.provider === 'openai').map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {model && !models.some((m) => m.id === model) && (
                    <option value={model}>{model}</option>
                  )}
                </select>
                <p className="text-xs text-text-secondary mt-1">A persona's own model override still wins over this.</p>
              </div>

              <div>
                <label htmlFor="chat-temp" className="block text-sm font-medium text-text-secondary mb-1">
                  Temperature <span className="text-text-primary">{temperature.toFixed(1)}</span>
                </label>
                <input
                  id="chat-temp"
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-accent-green"
                />
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Focused</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <label htmlFor="chat-responders" className="block text-sm font-medium text-text-secondary mb-1">Who replies</label>
                <select
                  id="chat-responders"
                  value={maxResponders}
                  onChange={(e) => setMaxResponders(parseInt(e.target.value, 10))}
                  className="w-full bg-item-active-bg border border-item-hover-bg text-text-primary rounded-md p-2 focus:ring-accent-green focus:border-accent-green"
                >
                  <option value={0}>All participants</option>
                  {Array.from({ length: selectedPersonaIds.size }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n === 1 ? 'First 1 participant' : `First ${n} participants`}</option>
                  ))}
                </select>
                <p className="text-xs text-text-secondary mt-1">Cap how many personas reply to each message (reduces noise & cost).</p>
              </div>

              <div>
                <label htmlFor="chat-riff" className="block text-sm font-medium text-text-secondary mb-1">Auto-conversation</label>
                <select
                  id="chat-riff"
                  value={riffRounds}
                  onChange={(e) => setRiffRounds(parseInt(e.target.value, 10))}
                  className="w-full bg-item-active-bg border border-item-hover-bg text-text-primary rounded-md p-2 focus:ring-accent-green focus:border-accent-green"
                >
                  <option value={0}>Off</option>
                  <option value={1}>1 extra round</option>
                  <option value={2}>2 extra rounds</option>
                  <option value={3}>3 extra rounds</option>
                </select>
                <p className="text-xs text-text-secondary mt-1">After your message, let the personas keep talking among themselves for N rounds (uses more tokens). Tap Stop to end early.</p>
              </div>
            </div>

            <div className="border-t border-item-hover-bg pt-5 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Share &amp; export</h3>

              <button
                type="button"
                onClick={handleExport}
                className="text-sm bg-item-active-bg hover:bg-item-hover-bg text-text-primary py-2 px-3 rounded-md transition"
              >
                Export as Markdown
              </button>

              {shareId ? (
                <div className="space-y-2">
                  <p className="text-xs text-text-secondary">Anyone with this link can read this chat (read-only):</p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 bg-item-active-bg border border-item-hover-bg text-text-primary rounded-md p-2 text-xs"
                    />
                    <button type="button" onClick={handleCopy} className="text-sm bg-accent-green text-white px-3 rounded-md hover:bg-opacity-90">
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleRevokeShare}
                    disabled={sharing}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Stop sharing
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateShare}
                  disabled={sharing}
                  className="block text-sm bg-item-active-bg hover:bg-item-hover-bg text-text-primary py-2 px-3 rounded-md transition disabled:opacity-50"
                >
                  {sharing ? 'Creating…' : 'Create read-only share link'}
                </button>
              )}
            </div>
          </div>

          <div className="p-4 bg-panel-header-bg rounded-b-lg flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-item-active-bg hover:bg-item-hover-bg text-text-primary font-bold py-2 px-4 rounded-md transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!topic || selectedPersonaIds.size === 0}
              className="bg-accent-green text-white font-bold py-2 px-4 rounded-md transition disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-opacity-90"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditChatModal; 