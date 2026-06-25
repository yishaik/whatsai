// The READ half of the memory loop: progressive disclosure under a token budget.
//
// Before a persona replies we don't paste the whole vault into the prompt — that
// defeats the purpose. Instead we walk napkin's disclosure levels and stop early:
//
//   L1 overview()            — always; cheap map of every note (no bodies)
//   L2 search(query)         — rank notes against what the user just said
//   L3 read(top hits)        — pull full bodies, newest/most-relevant first,
//                              only until a token budget is spent
//
// The assembled block is injected into the system prompt right next to the
// existing rolling-summary block in api/persona-response.ts. Pure orchestration
// over a MemoryEngine — no storage assumptions, fully unit-testable.

import type { MemoryEngine } from "./types";

export interface RecallOptions {
  /** Soft cap on tokens spent on recalled memory. Default ~500. */
  tokenBudget?: number;
  /** Hardest cap on how many notes to read in full. Default 4. */
  maxNotes?: number;
  /** How many search hits to consider before reading. Default 6. */
  searchLimit?: number;
}

export interface RecalledMemory {
  /** Memory context for the system prompt — empty string if nothing relevant. */
  block: string;
  /** Which notes were read in full, with their estimated token cost. */
  usedNotes: { id: string; title: string; estTokens: number }[];
  /** Total estimated tokens of `block`. */
  estTokens: number;
  /** Disclosure levels actually exercised — useful for tests/telemetry. */
  levels: ("overview" | "search" | "read")[];
}

/** Coarse token estimate (~4 chars/token), matching common rules of thumb. */
export const estimateTokens = (s: string): number => Math.ceil(s.length / 4);

const HEADER = "Relevant long-term memory about the user (retrieved for this turn):";

const EMPTY: RecalledMemory = { block: "", usedNotes: [], estTokens: 0, levels: [] };

export async function recallMemory(
  engine: MemoryEngine,
  query: string,
  opts: RecallOptions = {},
): Promise<RecalledMemory> {
  const tokenBudget = opts.tokenBudget ?? 500;
  const maxNotes = opts.maxNotes ?? 4;
  const searchLimit = opts.searchLimit ?? 6;

  // L1 — overview. If the vault is empty there is nothing to recall.
  const overview = await engine.overview();
  if (overview.noteCount === 0 || !query.trim()) return { ...EMPTY };

  // L2 — search.
  const hits = await engine.search(query, { limit: searchLimit });
  const levels: RecalledMemory["levels"] = ["overview", "search"];
  if (hits.length === 0) return { ...EMPTY, levels };

  // L3 — read top hits in full, greedily, until the budget is spent.
  const usedNotes: RecalledMemory["usedNotes"] = [];
  const sections: string[] = [];
  let spent = estimateTokens(HEADER);
  let didRead = false;

  for (const hit of hits) {
    if (usedNotes.length >= maxNotes) break;
    const note = await engine.read(hit.id);
    if (!note || !note.content.trim()) continue;
    didRead = true;

    let body = note.content.trim();
    const remaining = tokenBudget - spent;
    if (remaining <= 0) break;
    const cost = estimateTokens(body);
    if (cost > remaining) {
      if (usedNotes.length === 0) {
        // Always surface at least the top hit, truncated to fit the budget.
        body = `${body.slice(0, remaining * 4).trim()}…`;
      } else {
        continue; // a later, smaller note might still fit
      }
    }

    const section = `## ${note.title}\n${body}`;
    sections.push(section);
    const sectionTokens = estimateTokens(section);
    spent += sectionTokens;
    usedNotes.push({ id: note.id, title: note.title, estTokens: sectionTokens });
  }

  if (didRead) levels.push("read");
  if (sections.length === 0) return { ...EMPTY, levels };

  const block = `${HEADER}\n\n${sections.join("\n\n")}`;
  return { block, usedNotes, estTokens: estimateTokens(block), levels };
}
