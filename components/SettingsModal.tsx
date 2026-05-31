import React, { useEffect } from 'react';
import { XMarkIcon } from './icons';
import { useModels } from '../hooks/useModels';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModel: string;
  onSetDefaultModel: (model: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultModel, onSetDefaultModel }) => {
  const models = useModels();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const gemini = models.filter((m) => m.provider === 'gemini');
  const openai = models.filter((m) => m.provider === 'openai');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-panel-bg rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b border-item-hover-bg flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">Settings</h2>
          <button onClick={onClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-text-primary mb-1">Default reply model</h3>
            <p className="text-xs text-text-secondary mb-3">
              Used for personas that don't pick their own model. Per-persona overrides live in Manage Personas.
            </p>
            <select
              value={defaultModel}
              onChange={(e) => onSetDefaultModel(e.target.value)}
              className="w-full bg-item-active-bg border border-item-hover-bg text-text-primary rounded-md p-2 focus:ring-accent-green focus:border-accent-green"
            >
              {gemini.length > 0 && (
                <optgroup label="Gemini">
                  {gemini.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </optgroup>
              )}
              {openai.length > 0 && (
                <optgroup label="OpenAI">
                  {openai.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </optgroup>
              )}
              {/* Ensure the saved value is selectable even if it's not in the live list. */}
              {!models.some((m) => m.id === defaultModel) && (
                <option value={defaultModel}>{defaultModel}</option>
              )}
            </select>
            <p className="text-xs text-text-secondary mt-2">
              The list updates automatically from the models available on the server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
