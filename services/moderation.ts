// Client wrapper around /api/moderate. Always fails OPEN — moderation is a
// safety net, never a gate that can break sending or replies.

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
}

// Human-friendly labels for the OpenAI moderation category keys.
const CATEGORY_LABELS: Record<string, string> = {
  harassment: 'harassment',
  'harassment/threatening': 'threats',
  hate: 'hate',
  'hate/threatening': 'hateful threats',
  'self-harm': 'self-harm',
  'self-harm/intent': 'self-harm',
  'self-harm/instructions': 'self-harm',
  sexual: 'sexual content',
  'sexual/minors': 'sexual content involving minors',
  violence: 'violence',
  'violence/graphic': 'graphic violence',
  illicit: 'illicit activity',
  'illicit/violent': 'violent illicit activity',
};

export const describeCategories = (categories: string[]): string => {
  const labels = categories.map((c) => CATEGORY_LABELS[c] || c);
  const unique = Array.from(new Set(labels));
  return unique.slice(0, 3).join(', ');
};

export const moderateText = async (text: string): Promise<ModerationResult> => {
  if (!text.trim()) return { flagged: false, categories: [] };
  try {
    const resp = await fetch('/api/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) return { flagged: false, categories: [] };
    const data = await resp.json();
    return { flagged: !!data.flagged, categories: Array.isArray(data.categories) ? data.categories : [] };
  } catch {
    return { flagged: false, categories: [] };
  }
};
