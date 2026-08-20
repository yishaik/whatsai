import { describe, it, expect } from 'vitest';
import { explainAiError, isUnrecoverableAiError } from '../services/aiErrors';

describe('explainAiError', () => {
  it('maps an invalid Gemini key blob to a short action', () => {
    const blob = 'ApiError: {"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}';
    expect(explainAiError(new Error(blob))).toMatch(/Gemini API key is invalid/);
  });

  it('maps a missing Gemini key', () => {
    expect(explainAiError(new Error('GEMINI_API_KEY environment variable is not set.'))).toMatch(/not set on the server/);
  });

  it('maps an invalid OpenAI key', () => {
    expect(explainAiError(new Error('401 Incorrect API key provided: sk-proj-abc. invalid_api_key'))).toMatch(/OpenAI API key is invalid/);
  });

  it('does not dump a giant JSON blob', () => {
    const blob = `{"error":{"message":"${'x'.repeat(400)}"}}`;
    const out = explainAiError(new Error(blob));
    expect(out.length).toBeLessThan(200);
    expect(out).not.toContain('xxxx');
  });

  it('passes through a short unknown error', () => {
    expect(explainAiError(new Error('Persona prompt is required.'))).toBe('Persona prompt is required.');
  });
});

describe('isUnrecoverableAiError', () => {
  it('treats invalid API keys as unrecoverable (no silent retry)', () => {
    expect(isUnrecoverableAiError(new Error('API key not valid. Please pass a valid API key.'))).toBe(true);
    expect(isUnrecoverableAiError(new Error('network timeout'))).toBe(false);
  });
});
