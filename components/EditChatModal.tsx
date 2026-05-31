import React, { useState, useEffect } from 'react';
import { ChatRoom, Persona } from '../types';
import { XMarkIcon, ArrowPathIcon } from './icons';
import Avatar from './Avatar';
import { useModels } from '../hooks/useModels';

interface EditChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatRoom: ChatRoom | null;
  personas: Persona[];
  updateChatRoom: (id: string, updates: Partial<ChatRoom>) => void;
  generateChatAvatar: (chatId: string) => Promise<void>;
}

const EditChatModal: React.FC<EditChatModalProps> = ({ 
  isOpen, 
  onClose, 
  chatRoom, 
  personas, 
  updateChatRoom,
  generateChatAvatar 
}) => {
  const [topic, setTopic] = useState('');
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(new Set());
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  // Per-chat settings. "" model = use app/persona default; 0 responders = all.
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.9);
  const [maxResponders, setMaxResponders] = useState(0);
  const models = useModels();

  useEffect(() => {
    if (chatRoom) {
      setTopic(chatRoom.topic);
      setSelectedPersonaIds(new Set(chatRoom.personaIds));
      setModel(chatRoom.model ?? '');
      setTemperature(chatRoom.temperature ?? 0.9);
      setMaxResponders(chatRoom.maxResponders ?? 0);
    }
  }, [chatRoom]);

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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-panel-bg rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b border-item-hover-bg flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">Edit Chat</h2>
          <button onClick={onClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
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
                    <span className={`font-medium ${selectedPersonaIds.has(p.id) ? 'text-white' : 'text-text-primary'}`}>
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
            </div>
          </div>

          <div className="p-4 bg-panel-header-bg rounded-b-lg flex justify-end gap-3">
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