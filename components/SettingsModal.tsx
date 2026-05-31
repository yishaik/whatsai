import React, { useEffect } from 'react';
import { XMarkIcon } from './icons';
import { useModels } from '../hooks/useModels';
import { UsageRow } from '../types';
import { estimateCostUsd, formatUsd } from '../services/pricing';
import { findModelLabel } from '../services/models';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModel: string;
  onSetDefaultModel: (model: string) => void;
  usage: UsageRow[];
}

const fmtTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultModel, onSetDefaultModel, usage }) => {
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

          <div>
            <h3 className="text-base font-semibold text-text-primary mb-1">Usage</h3>
            <p className="text-xs text-text-secondary mb-3">Token usage and estimated cost (prices approximate and may drift).</p>
            {usage.length === 0 ? (
              <p className="text-sm text-text-secondary">No usage recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary text-xs">
                      <th className="py-1 pr-2">Model</th>
                      <th className="py-1 px-2 text-right">Reqs</th>
                      <th className="py-1 px-2 text-right">In</th>
                      <th className="py-1 px-2 text-right">Out</th>
                      <th className="py-1 pl-2 text-right">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((row) => {
                      const cost = estimateCostUsd(row.model, row.inputTokens, row.outputTokens);
                      return (
                        <tr key={row.model} className="border-t border-item-hover-bg text-text-primary">
                          <td className="py-1.5 pr-2 truncate max-w-[12rem]" title={row.model}>{findModelLabel(models, row.model)}</td>
                          <td className="py-1.5 px-2 text-right">{row.requests}</td>
                          <td className="py-1.5 px-2 text-right">{fmtTokens(row.inputTokens)}</td>
                          <td className="py-1.5 px-2 text-right">{fmtTokens(row.outputTokens)}</td>
                          <td className="py-1.5 pl-2 text-right">{cost === null ? '—' : formatUsd(cost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-item-hover-bg text-text-primary font-semibold">
                      <td className="py-1.5 pr-2">Total</td>
                      <td className="py-1.5 px-2 text-right">{usage.reduce((s, r) => s + r.requests, 0)}</td>
                      <td className="py-1.5 px-2 text-right">{fmtTokens(usage.reduce((s, r) => s + r.inputTokens, 0))}</td>
                      <td className="py-1.5 px-2 text-right">{fmtTokens(usage.reduce((s, r) => s + r.outputTokens, 0))}</td>
                      <td className="py-1.5 pl-2 text-right">
                        {formatUsd(usage.reduce((s, r) => s + (estimateCostUsd(r.model, r.inputTokens, r.outputTokens) ?? 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
