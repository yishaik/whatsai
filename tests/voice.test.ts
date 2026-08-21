import { describe, expect, it } from 'vitest';
import { AURA_SPEAKERS, pickAuraSpeaker } from '../services/voice';

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
