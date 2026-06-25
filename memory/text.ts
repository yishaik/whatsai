// Pure text helpers shared by every MemoryEngine binding (in-memory MiniSearch,
// the napkin file vault, and the Convex native-search engine). Kept dependency-
// free — no minisearch, no node, no Convex — so it imports cleanly into the
// browser bundle, a Vercel function, and a Convex isolate alike.

export const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "it", "as", "be", "was", "are", "this", "that",
  "not", "has", "have", "had", "will", "you", "your", "i", "me", "my", "we",
  "they", "he", "she", "his", "her", "their", "our", "so", "if", "then", "than",
  "about", "into", "out", "up", "down", "over", "user", "users",
]);

/** Top-N keywords for a note: word frequency minus stopwords (napkin-style). */
export const extractKeywords = (text: string, limit = 6): string[] => {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) ?? []) {
    if (STOP_WORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
};

/** Lines of `content` that contain any query term — napkin's snippet behavior. */
export const matchedSnippets = (content: string, query: string, max = 3): string[] => {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return [];
  const out: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (terms.some((t) => lower.includes(t))) {
      out.push(trimmed);
      if (out.length >= max) break;
    }
  }
  return out;
};
