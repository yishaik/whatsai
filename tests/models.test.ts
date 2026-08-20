import { describe, it, expect } from 'vitest';
import { providerForModel } from '../services/models';

describe('providerForModel', () => {
  it('detects Cloudflare Workers AI ids', () => {
    expect(providerForModel('@cf/meta/llama-3.1-8b-instruct-fast')).toBe('cloudflare');
    expect(providerForModel('@cf/openai/gpt-oss-20b')).toBe('cloudflare');
  });

  it('detects OpenAI ids', () => {
    expect(providerForModel('gpt-4o-mini')).toBe('openai');
  });

  it('defaults other ids to Gemini', () => {
    expect(providerForModel('gemini-3.1-flash-lite-preview')).toBe('gemini');
  });
});
