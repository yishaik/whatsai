// Memory hygiene: keep a user's vault from growing without bound. Two levers,
// both pure + deterministic so they're unit-testable and substrate-agnostic:
//
//   • de-duplication — never store the same fact twice (the model tends to
//     re-emit "the user's dog is Rex" every turn it's relevant),
//   • recency eviction — cap the bullets per note, dropping the OLDEST first,
//     so a long-lived note can't grow indefinitely.
//
// Note COUNT is naturally bounded by topics, but we also cap it (evict the
// least-recently-updated note) for defense in depth. See convex/personaMemory.ts.

/** Most recent fact bullets kept per note (older ones are evicted). */
export const MAX_FACTS_PER_NOTE = 50;
/** Distinct topic-notes kept per user vault (least-recently-updated evicted). */
export const MAX_NOTES_PER_VAULT = 64;

const BULLET_RE = /^\s*[-*]\s+/;

/**
 * Reduce a fact bullet to a comparison key: drop the bullet marker and the
 * dated "_(learned …)_" suffix, collapse whitespace, lowercase. Two bullets
 * with the same key are considered the same fact regardless of when learned.
 */
export const normalizeFactLine = (line: string): string =>
  line
    .replace(/_\(learned[^)]*\)_\s*$/i, "")
    .replace(BULLET_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Split a note body into its optional leading `# title` header and bullet lines. */
const splitNote = (content: string): { header: string | null; bullets: string[] } => {
  const lines = content.split("\n");
  let header: string | null = null;
  if (lines.length > 0 && lines[0].startsWith("#")) header = lines.shift() as string;
  const bullets = lines.map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim().length > 0);
  return { header, bullets };
};

/**
 * Merge new dated fact bullets into an existing note body, applying hygiene:
 *  - skip additions already present (normalized dedup, vs existing AND each other),
 *  - cap the note at `maxFacts` bullets, evicting the oldest (recency eviction).
 *
 * Returns the rebuilt content and how many genuinely-new facts were kept — so a
 * caller can avoid an empty write when every fact was a duplicate.
 */
export const mergeNoteContent = (
  existingContent: string,
  additions: string[],
  maxFacts: number = MAX_FACTS_PER_NOTE,
): { content: string; added: number } => {
  const { header, bullets } = splitNote(existingContent);
  const seen = new Set(bullets.map(normalizeFactLine));
  let added = 0;
  for (const line of additions) {
    const key = normalizeFactLine(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    bullets.push(line.replace(/\s+$/, ""));
    added++;
  }
  // Recency eviction: newest bullets are appended last, so keep the tail.
  const kept = bullets.length > maxFacts ? bullets.slice(bullets.length - maxFacts) : bullets;
  const parts = header !== null ? [header, ...kept] : kept;
  return { content: parts.join("\n").trim(), added };
};
