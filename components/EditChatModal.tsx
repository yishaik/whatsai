import React, { useState, useEffect } from 'react';
import { ChatRoom, Persona } from '../types';
import { XMarkIcon, ArrowPathIcon } from './icons';
import Avatar from './Avatar';

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

  useEffect(() => {
    if (chatRoom) {
      setTopic(chatRoom.topic);
      setSelectedPersonaIds(new Set(chatRoom.personaIds));
    }
  }, [chatRoom]);

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
        personaIds: Array.from(selectedPersonaIds)
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