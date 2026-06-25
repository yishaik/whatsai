// A storage-free MemoryEngine backed by MiniSearch — the *same* BM25 engine
// napkin uses internally (see napkin's src/core/search.ts). Because it holds
// notes in memory and has zero filesystem dependency, it runs anywhere: a test,
// the browser, a Vercel function, or a Convex query's V8 isolate. That last one
// is the point — it lets the serverless production path (convex/personaMemory.ts)
// reproduce napkin's retrieval faithfully without a file vault: fetch the user's
// notes from Convex, hand them to this engine, run progressive disclosure.

import MiniSearch from "minisearch";
import { extractKeywords, matchedSnippets } from "./text";
import type {
  MemoryEngine,
  MemoryHit,
  MemoryNote,
  MemoryOverview,
  MemoryOverviewEntry,
} from "./types";

// Re-export so existing importers of these helpers from this module keep working.
export { extractKeywords, matchedSnippets } from "./text";

const MINISEARCH_OPTS = {
  fields: ["title", "content"],
  storeFields: ["title"],
  searchOptions: { boost: { title: 2 }, fuzzy: 0.2, prefix: true },
};

export class InMemoryMemoryEngine implements MemoryEngine {
  private notes = new Map<string, MemoryNote>();
  private readonly now: () => number;

  /**
   * @param seed  initial notes (e.g. rows fetched from Convex).
   * @param now   clock injection — keeps `append` deterministic in tests.
   */
  constructor(seed: MemoryNote[] = [], now: () => number = () => Date.now()) {
    for (const n of seed) this.notes.set(n.id, { ...n });
    this.now = now;
  }

  /** Current notes (e.g. to persist back to Convex after an append). */
  snapshot(): MemoryNote[] {
    return [...this.notes.values()].map((n) => ({ ...n }));
  }

  async overview(): Promise<MemoryOverview> {
    const entries: MemoryOverviewEntry[] = [...this.notes.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((n) => ({
        id: n.id,
        title: n.title,
        keywords: extractKeywords(`${n.title}\n${n.content}`),
        chars: n.content.length,
        updatedAt: n.updatedAt,
      }));
    return { noteCount: entries.length, entries };
  }

  async search(query: string, opts?: { limit?: number }): Promise<MemoryHit[]> {
    const all = [...this.notes.values()];
    if (all.length === 0 || !query.trim()) return [];

    const index = new MiniSearch(MINISEARCH_OPTS);
    index.addAll(all.map((n) => ({ id: n.id, title: n.title, content: n.content })));

    // Normalize recency to 0..1 across the vault, blended into the BM25 score
    // exactly like napkin (which adds recency * 1.0 to the bm25 score).
    const times = all.map((n) => n.updatedAt);
    const minT = Math.min(...times);
    const range = Math.max(...times) - minT || 1;

    const hits: MemoryHit[] = index.search(query).map((r) => {
      const note = this.notes.get(String(r.id))!;
      const recency = (note.updatedAt - minT) / range;
      return {
        id: note.id,
        title: note.title,
        score: Math.round((r.score + recency) * 100) / 100,
        snippets: matchedSnippets(note.content, query),
      };
    });

    hits.sort((a, b) => b.score - a.score);
    const limit = opts?.limit ?? 10;
    return hits.slice(0, limit);
  }

  async read(id: string): Promise<MemoryNote | null> {
    const note = this.notes.get(id);
    return note ? { ...note } : null;
  }

  async append(title: string, content: string): Promise<string> {
    // napkin appends by note *name*; match case-insensitively on title, else
    // create a fresh note (create-then-append, like napkin's CRUD).
    const existing = [...this.notes.values()].find(
      (n) => n.title.toLowerCase() === title.toLowerCase(),
    );
    const at = this.now();
    if (existing) {
      existing.content = `${existing.content}\n${content}`.trim();
      existing.updatedAt = at;
      return existing.id;
    }
    const id = title;
    this.notes.set(id, { id, title, content: content.trim(), updatedAt: at });
    return id;
  }
}
