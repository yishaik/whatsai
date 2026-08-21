import { describe, expect, it } from 'vitest';
import {
  AURA_SPEAKERS,
  isVoiceProvider,
  pickAuraSpeaker,
  pickVoiceForProvider,
} from '../services/voice';

describe('pickAuraSpeaker', () => {
  it('is stable for a given persona id', () => {
    expect(pickAuraSpeaker('jules')).toBe(pickAuraSpeaker('jules'));
    expect(AURA_SPEAKERS).toContain(pickAuraSpeaker('jules'));
  });

  it('spreads across the Aura roster', () => {
    const picks = new Set(
      ['jules', 'mira', 'elena', 'kai', 'alex', 'sam', 'rio', 'nova'].map(pickAuraSpeaker),
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('voice providers', () => {
  it('accepts the four live-call providers', () => {
    expect(isVoiceProvider('cloudflare')).toBe(true);
    expect(isVoiceProvider('gemini')).toBe(true);
    expect(isVoiceProvider('openai')).toBe(true);
    expect(isVoiceProvider('grok')).toBe(true);
    expect(isVoiceProvider('groq')).toBe(false);
  });

  it('picks a stable voice per provider', () => {
    expect(pickVoiceForProvider('gemini', 'jules')).toBe(pickVoiceForProvider('gemini', 'jules'));
    expect(pickVoiceForProvider('openai', 'jules')).toBe(pickVoiceForProvider('openai', 'jules'));
    expect(pickVoiceForProvider('grok', 'jules')).toBe(pickVoiceForProvider('grok', 'jules'));
  });
});
