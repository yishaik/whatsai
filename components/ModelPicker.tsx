import React from 'react';
import { groupedModels, ModelOption, PROVIDER_LABEL, providerForModel } from '../services/models';

interface ModelPickerProps {
  models: ModelOption[];
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
  disabled?: boolean;
  idPrefix?: string;
}

const selectClass =
  'w-full bg-item-active-bg border border-item-hover-bg text-text-primary rounded-md p-2 focus:ring-accent-green focus:border-accent-green disabled:opacity-50';

const ModelPicker: React.FC<ModelPickerProps> = ({
  models,
  value,
  onChange,
  emptyLabel,
  disabled,
  idPrefix = 'model',
}) => {
  const groups = groupedModels(models);
  const selected = models.find((m) => m.id === value);
  const provider = selected?.provider || (value ? providerForModel(value) : '');
  const providerModels = provider ? models.filter((m) => m.provider === provider) : [];

  const onProvider = (next: string) => {
    if (!next) {
      onChange('');
      return;
    }
    if (provider === next && value) return;
    const first = models.find((m) => m.provider === next);
    if (first) onChange(first.id);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${idPrefix}-provider`} className="block text-sm font-medium text-text-secondary mb-1">
          Provider
        </label>
        <select
          id={`${idPrefix}-provider`}
          value={provider}
          onChange={(e) => onProvider(e.target.value)}
          disabled={disabled}
          className={selectClass}
        >
          {emptyLabel ? <option value="">Default</option> : null}
          {groups.map((g) => (
            <option key={g.provider} value={g.provider}>
              {g.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-model`} className="block text-sm font-medium text-text-secondary mb-1">
          Model
        </label>
        <select
          id={`${idPrefix}-model`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || (!!emptyLabel && !provider)}
          className={selectClass}
        >
          {emptyLabel && !provider ? <option value="">{emptyLabel}</option> : null}
          {providerModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          {value && !models.some((m) => m.id === value) ? (
            <option value={value}>
              {PROVIDER_LABEL[providerForModel(value)]}: {value}
            </option>
          ) : null}
        </select>
      </div>
    </div>
  );
};

export default ModelPicker;
