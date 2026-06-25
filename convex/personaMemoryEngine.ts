// ConvexSearchEngine — the production read binding of the MemoryEngine contract,
// backed by Convex's NATIVE full-text search index instead of an in-memory
// MiniSearch index rebuilt on every call.
//
// Why this exists: the Round-3 path loaded the user's entire vault with
// `.collect()` and built a MiniSearch BM25 index per recall — O(vault) work and
// memory every turn. This engine pushes ranking into the database: `search()`
// hits the `search_content` index (owner-scoped via a filter field), `read()`
// is a single `db.get`, and `overview()` only scans note METADATA (bounded by
// topic count, never note bodies). Recall therefore no longer loads the whole
// vault. The MemoryEngine interface is unchanged, so the storage-agnostic
// `recallMemory()` orchestrator — and the napkin file-vault + in-memory engines
// used by tests/local-dev — keep working untouched.

import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { extractKeywords, matchedSnippets } from "../memory/text";
import type {
  MemoryEngine,
  MemoryHit,
  MemoryNote,
  MemoryOverview,
} from "../memory/types";

// How many note-metadata rows the overview existence-check scans. Note COUNT is
// small (≈ one per topic), so this stays O(topics) — it never reads the vault's
// full content the way the old per-call MiniSearch index did.
const OVERVIEW_SCAN = 128;

export class ConvexSearchEngine implements MemoryEngine {
  constructor(
    private readonly ctx: QueryCtx,
    private readonly ownerId: Id<"users">,
    private readonly personaId?: string,
  ) {}

  /** A row is visible if it's a shared user note, or this persona's own note. */
  private visible(scope: string, personaId?: string): boolean {
    return scope === "user" || (!!this.personaId && personaId === this.personaId);
  }

  async overview(): Promise<MemoryOverview> {
    const rows = await this.ctx.db
      .query("personaMemories")
      .withIndex("by_owner", (q) => q.eq("ownerId", this.ownerId))
      .take(OVERVIEW_SCAN);
    const entries = rows
      .filter((r) => this.visible(r.scope, r.personaId))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((r) => ({
        id: r._id as string,
        title: r.title,
        keywords: extractKeywords(`${r.title}\n${r.content}`),
        chars: r.content.length,
        updatedAt: r.updatedAt,
      }));
    return { noteCount: entries.length, entries };
  }

  async search(query: string, opts?: { limit?: number }): Promise<MemoryHit[]> {
    const limit = opts?.limit ?? 10;
    if (!query.trim()) return [];
    // Database-native relevance ranking, owner-scoped by the index filter field.
    // No whole-vault load, no in-memory index. Over-fetch a little so dropping
    // other-personas' namespaced notes still leaves enough visible hits.
    const rows = await this.ctx.db
      .query("personaMemories")
      .withSearchIndex("search_content", (q) =>
        q.search("content", query).eq("ownerId", this.ownerId),
      )
      .take(limit * 3);
    const visible = rows.filter((r) => this.visible(r.scope, r.personaId)).slice(0, limit);
    // Convex returns rows already ordered by relevance; project a descending
    // score from rank so any downstream ordering stays stable.
    return visible.map((r, i) => ({
      id: r._id as string,
      title: r.title,
      score: visible.length - i,
      snippets: matchedSnippets(r.content, query),
    }));
  }

  async read(id: string): Promise<MemoryNote | null> {
    const doc = await this.ctx.db.get(id as Id<"personaMemories">);
    // Defense in depth: never surface another owner's note even if an id leaks.
    if (!doc || doc.ownerId !== this.ownerId) return null;
    return { id: doc._id as string, title: doc.title, content: doc.content, updatedAt: doc.updatedAt };
  }

  async append(): Promise<string> {
    // A query ctx can't write; persistence goes through the `remember` mutation.
    throw new Error("ConvexSearchEngine is read-only; use personaMemory.remember to write.");
  }
}
