// Turn provider/SDK blobs into a short message a human can act on.
// Used on the client (and mirrored in api/persona-response.ts — Vercel
// functions cannot import across directories).

export const explainAiError = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const s = raw.toLowerCase();

  if (/cloudflare workers ai is not configured|cloudflare_account_id|cloudflare_api_token/.test(s)) {
    return 'Cloudflare Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Vercel.';
  }
  if (/groq_api_key/.test(s)) return 'Set GROQ_API_KEY in Vercel to use Groq.';
  if (/cerebras_api_key/.test(s)) return 'Set CEREBRAS_API_KEY in Vercel to use Cerebras.';
  if (/openrouter_api_key/.test(s)) return 'Set OPENROUTER_API_KEY in Vercel to use OpenRouter.';
  if (/nvidia_api_key/.test(s)) return 'Set NVIDIA_API_KEY in Vercel to use NVIDIA NIM.';
  if (/workers free plan|code"?\s*:\s*5035/.test(s)) {
    return 'This model needs the Cloudflare Workers Paid plan. Upgrade at dash.cloudflare.com → Workers → Plans, then retry.';
  }
  if (/gemini_api_key environment variable is not set|api_key is not set/.test(s)) {
    return 'GEMINI_API_KEY is not set on the server. Add it in Vercel project settings.';
  }
  if (/api[_ ]key not valid|api_key_invalid|pass a valid api key/.test(s)) {
    return 'Gemini API key is invalid or revoked. Update GEMINI_API_KEY in Vercel project settings.';
  }
  if (/openai_api_key is not configured|openai_api_key environment/.test(s)) {
    return 'OPENAI_API_KEY is not set on the server. Add it in Vercel to use GPT, TTS, or transcription.';
  }
  if (/incorrect api key provided|invalid_api_key|invalid_api_key/.test(s)) {
    return 'OpenAI API key is invalid or revoked. Update OPENAI_API_KEY in Vercel project settings.';
  }
  if (/too many requests|429|resource.?exhausted|rate.?limit/.test(s)) {
    return 'Too many requests. Wait a few seconds and try again.';
  }
  if (/timed out/.test(s)) {
    return 'The model request timed out. Try again.';
  }
  if (/not found|404/.test(s) && /model/.test(s)) {
    return 'That model is not available with the configured API key. Pick another in Settings.';
  }
  // Provider errors often dump a JSON blob. Don't show that in the chat.
  if (raw.length > 220 || /"error"\s*:/.test(raw)) {
    return 'The model request failed. Check Vercel function logs for the provider error.';
  }
  return raw;
};

export const isUnrecoverableAiError = (err: unknown): boolean => {
  const s = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /api[_ ]key|invalid_api_key|not set on the server|not configured|gemini api key|openai api key/.test(s)
    || /api[_ ]key not valid|pass a valid api key|incorrect api key/.test(s)
    || /workers free plan|code"?\s*:\s*5035/.test(s)
    || /groq_api_key|cerebras_api_key|openrouter_api_key|nvidia_api_key/.test(s);
};
