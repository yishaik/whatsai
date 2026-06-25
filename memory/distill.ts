// The WRITE half of the memory loop: turn a persona's reply into durable facts.
//
// We reuse WhatsAI's existing in-band token convention. The reminder feature
// already teaches the model to emit `[[REMINDER]]{...}` on its own line, which
// the client parses and strips before display. Memory works exactly the same
// way: a memory-enabled persona appends `[[MEMORY]]{"fact": "...", "topic":
// "..."}` when it learns something worth keeping. That keeps the mechanism
// uniform across providers (Gemini/OpenAI) and streaming, with no extra model
// call — distillation is free.
//
// These are pure functions (no I/O, no clock) so they are trivially testable and
// safe to run in the browser, a Vercel function, or a Convex action.

import type { MemoryFact } from "./types";

// `[[MEMORY]]` followed by a JSON object, to end of line. Tolerant of spaces.
const MEMORY_TOKEN_RE = /\[\[MEMORY\]\]\s*(\{.*?\})\s*$/gim;

/** Collapse whitespace + lowercase for dedup comparison only. */
const normalizeForDedup = (s: string): string => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Turn a free-text topic into a safe, stable note title. Topics map 1:1 to
 * notes ("user" → the user-facts note), so they must be filesystem- and
 * Convex-safe. Empty/garbage topics fall back to "user".
 */
export const sanitizeTopic = (topic: unknown): string => {
  const slug = String(topic ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "user";
};

/**
 * Extract every well-formed `[[MEMORY]]{...}` fact from a model reply. Malformed
 * tokens (bad JSON, missing/empty `fact`) are skipped rather than thrown — a
 * stray token must never break a reply. Facts are de-duplicated within the turn
 * by (topic, normalized fact).
 */
export const extractMemoryFacts = (text: string): MemoryFact[] => {
  if (!text) return [];
  const out: MemoryFact[] = [];
  const seen = new Set<string>();
  // `matchAll` with a global regex; reset lastIndex defensively.
  MEMORY_TOKEN_RE.lastIndex = 0;
  for (const m of text.matchAll(MEMORY_TOKEN_RE)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;
    const rec = parsed as Record<string, unknown>;
    const fact = typeof rec.fact === "string" ? rec.fact.trim() : "";
    if (!fact) continue;
    const topic = sanitizeTopic(rec.topic);
    const key = `${topic} ${normalizeForDedup(fact)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ fact, topic });
  }
  return out;
};

/**
 * Remove every `[[MEMORY]]` token from a reply so the user never sees it, and
 * tidy up the blank lines the removal leaves behind. Mirrors how the client
 * already strips `[[REMINDER]]` tokens.
 */
export const stripMemoryTokens = (text: string): string => {
  if (!text) return text;
  return text
    .replace(MEMORY_TOKEN_RE, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Render a fact as a single dated markdown bullet for appending to its note.
 * The timestamp is passed in (never read from the clock here) so the function
 * stays pure and deterministic for tests.
 */
export const factToNoteLine = (fact: string, atIso: string): string =>
  `- ${fact} _(learned ${atIso})_`;

/** Group facts by their target note title, preserving order. */
export const factsByTopic = (facts: MemoryFact[]): Map<string, string[]> => {
  const byTopic = new Map<string, string[]>();
  for (const f of facts) {
    const list = byTopic.get(f.topic) ?? [];
    list.push(f.fact);
    byTopic.set(f.topic, list);
  }
  return byTopic;
};
