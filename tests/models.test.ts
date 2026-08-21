import { describe, it, expect } from 'vitest';
import { providerForModel } from '../services/models';

describe('providerForModel', () => {
  it('detects Cloudflare Workers AI ids', () => {
    expect(providerForModel('@cf/meta/llama-3.1-8b-instruct-fast')).toBe('cloudflare');
    expect(providerForModel('@cf/openai/gpt-oss-20b')).toBe('cloudflare');
    expect(providerForModel('@cf/deepseek-ai/deepseek-v4-pro-0813')).toBe('cloudflare');
    expect(providerForModel('groq/openai/gpt-oss-20b')).toBe('groq');
    expect(providerForModel('cerebras/gpt-oss-120b')).toBe('cerebras');
    expect(providerForModel('openrouter/google/gemma-4-31b-it:free')).toBe('openrouter');
    expect(providerForModel('nvidia/meta/llama-3.1-8b-instruct')).toBe('nvidia');
  });

  it('detects OpenAI ids', () => {
    expect(providerForModel('gpt-4o-mini')).toBe('openai');
  });

  it('defaults other ids to Gemini', () => {
    expect(providerForModel('gemini-3.1-flash-lite-preview')).toBe('gemini');
  });
});
