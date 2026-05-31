import { useEffect, useState } from 'react';
import { ModelOption, FALLBACK_MODELS } from '../services/models';

// Module-level cache so the model list is fetched once and shared across all
// pickers; falls back to the static list on any failure.
let cache: ModelOption[] | null = null;
let inflight: Promise<ModelOption[]> | null = null;

const load = (): Promise<ModelOption[]> => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch('/api/models')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`models ${r.status}`))))
      .then((d) => {
        const models: ModelOption[] =
          Array.isArray(d?.models) && d.models.length ? d.models : FALLBACK_MODELS;
        cache = models;
        return models;
      })
      .catch((e) => {
        console.error('Failed to load model list, using fallback:', e);
        cache = FALLBACK_MODELS;
        return FALLBACK_MODELS;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

// The selectable model list (live from /api/models, cached, with fallback).
export function useModels(): ModelOption[] {
  const [models, setModels] = useState<ModelOption[]>(cache ?? FALLBACK_MODELS);
  useEffect(() => {
    let cancelled = false;
    load().then((m) => {
      if (!cancelled) setModels(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return models;
}
