import React, { useState } from 'react';
import { Persona } from '../types';
import { XMarkIcon, PencilIcon, MagnifyingGlassIcon, ArrowPathIcon } from './icons';
import Avatar from './Avatar';

interface PersonaManagerProps {
  isOpen: boolean;
  onClose: () => void;
  personas: Persona[];
  addPersona: (persona: Omit<Persona, 'id' | 'avatar'>) => Promise<Error | null>;
  updatePersona: (id: string, data: Omit<Persona, 'id' | 'avatar'>) => void;
  regenerateAvatar: (personaId: string) => Promise<void>;
}

const PersonaManager: React.FC<PersonaManagerProps> = ({ isOpen, onClose, personas, addPersona, updatePersona, regenerateAvatar }) => {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [canSearch, setCanSearch] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [regeneratingAvatars, setRegeneratingAvatars] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleEditClick = (persona: Persona) => {
    setEditingPersonaId(persona.id);
    setName(persona.name);
    setPrompt(persona.prompt);
    setCanSearch(persona.canSearch || false);
  };

  const handleCancelEdit = () => {
    setEditingPersonaId(null);
    setName('');
    setPrompt('');
    setCanSearch(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && prompt.trim()) {
      const personaData = { name: name.trim(), prompt: prompt.trim(), canSearch };
      if (editingPersonaId) {
        updatePersona(editingPersonaId, personaData);
        handleCancelEdit();
      } else {
        if (isCreating) return;
        setIsCreating(true);
        try {
          const error = await addPersona(personaData);
          if (error) {
            alert(`${error.message} A default avatar has been assigned.`);
          }
          setName('');
          setPrompt('');
          setCanSearch(false);
        } catch (criticalError) {
          console.error("A critical error occurred while adding a persona:", criticalError);
          alert("An unexpected critical error occurred. Please check the console.");
        } finally {
          setIsCreating(false);
        }
      }
    }
  };

  const handleClose = () => {
    handleCancelEdit();
    onClose();
  };

  const handleRegenerateAvatar = async (personaId: string) => {
    setRegeneratingAvatars(prev => new Set(prev).add(personaId));
    try {
      await regenerateAvatar(personaId);
    } catch (error) {
      console.error('Failed to regenerate avatar:', error);
      alert(error instanceof Error ? error.message : 'Failed to regenerate avatar');
    } finally {
      setRegeneratingAvatars(prev => {
        const newSet = new Set(prev);
        newSet.delete(personaId);
        return newSet;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-panel-bg rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-item-hover-bg flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">Manage Personas</h2>
          <button onClick={handleClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              {editingPersonaId ? 'Edit Persona' : 'Create New Persona'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="persona-name" className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                <input
                  id="persona-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Captain Jack"
                  className="w-full bg-item-active-bg border-gray-600 text-text-primary rounded-md p-2 focus:ring-accent-green focus:border-accent-green disabled:opacity-50"
                  required
                  disabled={isCreating}
                />
              </div>
              <div>
                <label htmlFor="persona-prompt" className="block text-sm font-medium text-text-secondary mb-1">Personality Prompt</label>
                <textarea
                  id="persona-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., A sarcastic pirate who loves treasure and talks in riddles."
                  rows={4}
                  className="w-full bg-item-active-bg border-gray-600 text-text-primary rounded-md p-2 focus:ring-accent-green focus:border-accent-green disabled:opacity-50"
                  required
                  disabled={isCreating}
                />
              </div>
              <div className="flex items-center gap-3">
                 <input
                    id="persona-search"
                    type="checkbox"
                    checked={canSearch}
                    onChange={(e) => setCanSearch(e.target.checked)}
                    disabled={isCreating}
                    className="h-4 w-4 rounded border-item-hover-bg bg-item-active-bg text-accent-blue focus:ring-accent-blue"
                  />
                  <label htmlFor="persona-search" className="text-sm text-text-secondary">
                    Enable Internet Search (provides access to real-time information)
                  </label>
              </div>
              <div className="flex justify-end gap-2">
                 {editingPersonaId && (
                  <button 
                    type="button" 
                    onClick={handleCancelEdit}
                    className="bg-item-active-bg hover:bg-item-hover-bg text-text-primary font-bold py-2 px-4 rounded-md transition"
                  >
                    Cancel
                  </button>
                )}
                <button 
                  type="submit" 
                  className="bg-accent-green hover:bg-opacity-90 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-gray-500 disabled:cursor-wait"
                  disabled={(isCreating && !editingPersonaId) || !name.trim() || !prompt.trim()}
                >
                  {editingPersonaId ? 'Update Persona' : (isCreating ? 'Generating Avatar...' : 'Create Persona')}
                </button>
              </div>
            </form>
          </div>
          
          <div className="border-t border-item-hover-bg pt-6">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-text-primary">Existing Personas</h3>
                {personas.some(p => p.avatar.includes('PHN2ZyB4bWxucz0iaHR0')) && (
                  <button
                    onClick={async () => {
                      if (confirm('Generate avatars for all personas with default avatars?')) {
                        for (const persona of personas) {
                          if (persona.avatar.includes('PHN2ZyB4bWxucz0iaHR0')) {
                            await handleRegenerateAvatar(persona.id);
                          }
                        }
                      }
                    }}
                    className="text-sm bg-accent-green text-white px-3 py-1 rounded-md hover:bg-opacity-90"
                  >
                    Generate Missing Avatars
                  </button>
                )}
             </div>
            {personas.length === 0 ? (
                <p className="text-text-secondary">No personas created yet.</p>
            ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {personas.map(p => (
                        <div key={p.id} className="bg-item-active-bg p-3 rounded-lg flex items-center gap-4 justify-between">
                            <div className="flex items-start gap-4 flex-grow min-w-0">
                                <Avatar src={p.avatar} name={p.name} />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-text-primary truncate">{p.name}</p>
                                      {p.canSearch && <MagnifyingGlassIcon className="h-4 w-4 text-accent-blue flex-shrink-0" aria-label="Internet search enabled" />}
                                    </div>
                                    <p className="text-sm text-text-secondary italic truncate">"{p.prompt}"</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => handleRegenerateAvatar(p.id)} 
                                    disabled={regeneratingAvatars.has(p.id)}
                                    className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0 disabled:opacity-50"
                                    title="Regenerate avatar"
                                >
                                    <ArrowPathIcon className={`h-5 w-5 ${regeneratingAvatars.has(p.id) ? 'animate-spin' : ''}`} />
                                </button>
                                <button onClick={() => handleEditClick(p)} className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0">
                                    <PencilIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonaManager;