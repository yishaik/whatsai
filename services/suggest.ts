// Client wrapper for /api/suggest. Fails soft (empty array).
export const fetchSuggestions = async (
  chatTopic: string,
  personaNames: string[],
  history: { author: string; text: string }[],
  signal?: AbortSignal,
): Promise<string[]> => {
  try {
    const resp = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatTopic, personaNames, history }),
      signal,
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.suggestions) ? data.suggestions.filter((s: unknown) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};
