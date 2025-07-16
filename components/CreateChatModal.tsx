
import React, { useState } from 'react';
import { Persona } from '../types';
import { XMarkIcon } from './icons';
import Avatar from './Avatar';

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: Persona[];
  createChat: (topic: string, personaIds: string[]) => void;
}

const CreateChatModal: React.FC<CreateChatModalProps> = ({ isOpen, onClose, personas, createChat }) => {
  const [topic, setTopic] = useState('');
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

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
      createChat(topic, Array.from(selectedPersonaIds));
      setTopic('');
      setSelectedPersonaIds(new Set());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-panel-bg rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b border-item-hover-bg flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">Create New Chat</h2>
          <button onClick={onClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
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
              <label className="block text-sm font-medium text-text-secondary mb-2">Select Personas (at least 1)</label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {personas.length === 0 ? (
                  <p className="text-text-secondary">You need to create a persona first.</p>
                ) : (
                  personas.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleTogglePersona(p.id)}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition ${selectedPersonaIds.has(p.id) ? 'bg-accent-green' : 'bg-item-active-bg hover:bg-item-hover-bg'}`}
                    >
                      <Avatar src={p.avatar} name={p.name} />
                      <span className={`font-medium ${selectedPersonaIds.has(p.id) ? 'text-white' : 'text-text-primary'}`}>{p.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="p-4 bg-panel-header-bg rounded-b-lg flex justify-end">
            <button
              type="submit"
              disabled={!topic || selectedPersonaIds.size === 0}
              className="bg-accent-green text-white font-bold py-2 px-4 rounded-md transition disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-opacity-90"
            >
              Create Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChatModal;
