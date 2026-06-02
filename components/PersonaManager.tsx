import React, { useState } from 'react';
import { Persona } from '../types';
import { XMarkIcon, PencilIcon, MagnifyingGlassIcon, ArrowPathIcon, TrashIcon } from './icons';
import Avatar from './Avatar';
import { findModelLabel, providerForModel } from '../services/models';
import { useModels } from '../hooks/useModels';
import { SKILLS } from '../services/skills';
import { PERSONA_TEMPLATES } from '../services/personaTemplates';
import { downloadText } from '../services/exportChat';

interface PersonaManagerProps {
  isOpen: boolean;
  onClose: () => void;
  personas: Persona[];
  addPersona: (persona: Omit<Persona, 'id' | 'avatar'>) => Promise<Error | null>;
  updatePersona: (id: string, data: Omit<Persona, 'id' | 'avatar'>) => void;
  regenerateAvatar: (personaId: string) => Promise<void>;
  deletePersona: (id: string) => void;
  defaultModel: string;
}

const PersonaManager: React.FC<PersonaManagerProps> = ({ isOpen, onClose, personas, addPersona, updatePersona, regenerateAvatar, deletePersona, defaultModel }) => {
  const models = useModels();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [skills, setSkills] = useState<Set<string>>(new Set());
  const [model, setModel] = useState(''); // '' = use the default model
  const toggleSkill = (id: string) =>
    setSkills((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const [isCreating, setIsCreating] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [regeneratingAvatars, setRegeneratingAvatars] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const applyTemplate = (t: { name: string; prompt: string; skills: string[] }) => {
    setEditingPersonaId(null);
    setName(t.name);
    setPrompt(t.prompt);
    setSkills(new Set(t.skills));
    setModel('');
  };

  const handleExportPersonas = () => {
    const data = personas.map((p) => ({
      name: p.name,
      prompt: p.prompt,
      canSearch: !!(p.skills?.includes('web_search') || p.canSearch),
      skills: p.skills ?? [],
      model: p.model,
    }));
    downloadText('whatsai-personas.json', JSON.stringify(data, null, 2), 'application/json');
  };

  const handleImportPersonas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportMsg(null);
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      let count = 0;
      for (const item of list) {
        if (!item || typeof item.name !== 'string' || typeof item.prompt !== 'string') continue;
        const itemSkills: string[] = Array.isArray(item.skills) ? item.skills.filter((s: unknown) => typeof s === 'string') : [];
        await addPersona({
          name: item.name.trim().slice(0, 80),
          prompt: item.prompt.trim().slice(0, 4000),
          canSearch: !!(item.canSearch || itemSkills.includes('web_search')),
          skills: itemSkills,
          model: typeof item.model === 'string' ? item.model : undefined,
        });
        count++;
      }
      setImportMsg(count > 0 ? `Imported ${count} persona${count > 1 ? 's' : ''}.` : 'No valid personas found in file.');
    } catch (err) {
      console.error('Import failed:', err);
      setImportMsg('Could not read that file (expected JSON).');
    } finally {
      setImporting(false);
    }
  };

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEditClick = (persona: Persona) => {
    setEditingPersonaId(persona.id);
    setName(persona.name);
    setPrompt(persona.prompt);
    // Back-compat: a legacy canSearch persona maps to the web_search skill.
    setSkills(new Set(persona.skills ?? (persona.canSearch ? ['web_search'] : [])));
    setModel(persona.model || '');
  };

  const handleCancelEdit = () => {
    setEditingPersonaId(null);
    setName('');
    setPrompt('');
    setSkills(new Set());
    setModel('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && prompt.trim()) {
      const skillList = Array.from(skills);
      const personaData = {
        name: name.trim(),
        prompt: prompt.trim(),
        canSearch: skills.has('web_search'), // mirror for back-compat
        skills: skillList,
        model: model || undefined,
      };
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
          setSkills(new Set());
          setModel('');
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-panel-bg rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-item-hover-bg flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">Manage Personas</h2>
          <button onClick={handleClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              {editingPersonaId ? 'Edit Persona' : 'Create New Persona'}
            </h3>
            {!editingPersonaId && (
              <div className="mb-4">
                <p className="text-sm font-medium text-text-secondary mb-2">Start from a template</p>
                <div className="flex flex-wrap gap-2">
                  {PERSONA_TEMPLATES.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      disabled={isCreating}
                      className="text-sm bg-item-active-bg hover:bg-item-hover-bg text-text-primary rounded-full px-3 py-1 border border-item-hover-bg disabled:opacity-50"
                      title={t.prompt}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Skills</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SKILLS.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-start gap-2 p-2 rounded-md cursor-pointer border ${
                        skills.has(s.id) ? 'border-accent-green bg-accent-green/10' : 'border-item-hover-bg bg-item-active-bg'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={skills.has(s.id)}
                        onChange={() => toggleSkill(s.id)}
                        disabled={isCreating}
                        className="mt-0.5 h-4 w-4 rounded border-item-hover-bg bg-item-active-bg text-accent-green focus:ring-accent-green"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-text-primary">{s.label}</span>
                        <span className="block text-xs text-text-secondary">{s.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="persona-model" className="block text-sm font-medium text-text-secondary mb-1">Model</label>
                <select
                  id="persona-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isCreating}
                  className="w-full bg-item-active-bg border-gray-600 text-text-primary rounded-md p-2 focus:ring-accent-green focus:border-accent-green disabled:opacity-50"
                >
                  <option value="">Default ({findModelLabel(models, defaultModel)})</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                {skills.has('web_search') && model && providerForModel(model) === 'openai' && (
                  <p className="text-xs text-yellow-500/80 mt-1">Note: web search only works on Gemini models; it'll be ignored on GPT.</p>
                )}
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
             <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-text-primary">Existing Personas</h3>
                <div className="flex items-center gap-2">
                  <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImportPersonas} className="hidden" />
                  <button
                    onClick={() => importInputRef.current?.click()}
                    disabled={importing}
                    className="text-sm bg-item-active-bg hover:bg-item-hover-bg text-text-primary px-3 py-1 rounded-md disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                  <button
                    onClick={handleExportPersonas}
                    disabled={personas.length === 0}
                    className="text-sm bg-item-active-bg hover:bg-item-hover-bg text-text-primary px-3 py-1 rounded-md disabled:opacity-50"
                  >
                    Export
                  </button>
                </div>
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
            {importMsg && <p className="text-xs text-text-secondary mb-3">{importMsg}</p>}
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
                                      {(p.skills?.includes('web_search') || p.canSearch) && <MagnifyingGlassIcon className="h-4 w-4 text-accent-blue flex-shrink-0" aria-label="Web search enabled" />}
                                      {(p.skills?.filter((s) => s !== 'web_search').length ?? 0) > 0 && (
                                        <span className="text-[10px] uppercase tracking-wide bg-panel-bg text-text-secondary px-1.5 py-0.5 rounded flex-shrink-0">
                                          {p.skills!.filter((s) => s !== 'web_search').length} skill{p.skills!.filter((s) => s !== 'web_search').length > 1 ? 's' : ''}
                                        </span>
                                      )}
                                      {p.model && (
                                        <span className="text-[10px] uppercase tracking-wide bg-panel-bg text-text-secondary px-1.5 py-0.5 rounded flex-shrink-0">
                                          {findModelLabel(models, p.model)}
                                        </span>
                                      )}
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
                                <button onClick={() => handleEditClick(p)} className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0" title="Edit">
                                    <PencilIcon className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => { if (confirm(`Delete "${p.name}"?`)) deletePersona(p.id); }}
                                    className="text-icon-default hover:text-red-500 p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0 transition-colors"
                                    title="Delete persona"
                                >
                                    <TrashIcon className="h-5 w-5" />
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