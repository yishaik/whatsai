// Napkin-style long-term memory for WhatsAI personas.
//
// The whole point of napkin is *progressive disclosure*: never dump the vault
// into the prompt — reveal it in widening levels (overview → search → read) so a
// persona spends tokens only on what's relevant to the current turn. We model
// that contract as a storage-agnostic `MemoryEngine` interface so the exact same
// retrieval/recall code runs over either substrate:
//
//   • a real napkin file vault (local/CLI/dev)            → NapkinFileEngine
//   • Convex documents (serverless production)            → InMemoryMemoryEngine,
//                                                            driven by convex/personaMemory.ts
//
// Convex functions run in an fs-less V8 isolate and Vercel's filesystem is
// ephemeral, so the durable production store is Convex — but the *engine*
// (MiniSearch BM25, no embeddings) is identical to napkin's, only the bytes move
// from files to rows. See results.html (Round 3) for the full design.

/** A single durable memory note — the unit napkin stores as one markdown file. */
export interface MemoryNote {
  /** Stable reference: a file path in a file vault, or a Convex doc id. */
  id: string;
  /** Human title (note name / basename without extension). */
  title: string;
  /** Full markdown body. */
  content: string;
  /** Last-updated epoch ms — drives recency weighting and overview ordering. */
  updatedAt: number;
}

/** One line of the cheap Level-1 vault map (title + keywords + size). */
export interface MemoryOverviewEntry {
  id: string;
  title: string;
  /** Top extracted keywords for the note (TF-style), like napkin's overview. */
  keywords: string[];
  /** Note size in characters — a coarse cost signal before reading it. */
  chars: number;
  updatedAt: number;
}

/** Level 1: the whole vault at a glance, without reading any note in full. */
export interface MemoryOverview {
  noteCount: number;
  entries: MemoryOverviewEntry[];
}

/** Level 2: a ranked search hit with napkin-style matched snippets. */
export interface MemoryHit {
  id: string;
  title: string;
  /** Composite relevance score (BM25 + recency), higher is better. */
  score: number;
  /** Short matched lines, for the agent to judge relevance before reading. */
  snippets: string[];
}

/** A durable fact a persona chose to remember after a turn. */
export interface MemoryFact {
  /** The fact itself, e.g. "The user's dog is named Rex." */
  fact: string;
  /** Topic / note bucket this fact belongs to, e.g. "user" or "preferences". */
  topic: string;
}

/** Where a fact is written — the user's shared vault, or a persona namespace. */
export type MemoryScope = "user" | "persona";

/**
 * The napkin progressive-disclosure contract, decoupled from storage. All
 * methods are async so a single implementation shape covers the synchronous
 * file vault and the asynchronous Convex store alike.
 */
export interface MemoryEngine {
  /** Level 1 — cheap map of the whole vault. */
  overview(): Promise<MemoryOverview>;
  /** Level 2 — ranked, snippet-bearing search. */
  search(query: string, opts?: { limit?: number }): Promise<MemoryHit[]>;
  /** Level 3 — read one note in full (null if it doesn't exist). */
  read(id: string): Promise<MemoryNote | null>;
  /**
   * Append `content` to the note titled `title`, creating it if missing.
   * Returns the note id. This is napkin's create-then-append write path.
   */
  append(title: string, content: string): Promise<string>;
}
