import { describe, it, expect } from "vitest";
import { InMemoryMemoryEngine } from "../memory/miniSearchEngine";
import { estimateTokens, recallMemory } from "../memory/recall";
import type { MemoryNote } from "../memory/types";

const note = (id: string, title: string, content: string, updatedAt: number): MemoryNote => ({
  id,
  title,
  content,
  updatedAt,
});

describe("recallMemory", () => {
  it("returns empty for an empty vault (no levels used)", async () => {
    const r = await recallMemory(new InMemoryMemoryEngine([]), "anything");
    expect(r.block).toBe("");
    expect(r.usedNotes).toEqual([]);
    expect(r.levels).toEqual([]);
  });

  it("returns empty for a blank query", async () => {
    const engine = new InMemoryMemoryEngine([note("a", "user", "Rex the dog", 1)]);
    const r = await recallMemory(engine, "   ");
    expect(r.block).toBe("");
  });

  it("returns empty (overview+search, no read) when nothing matches", async () => {
    const engine = new InMemoryMemoryEngine([note("a", "user", "Rex the dog", 1)]);
    const r = await recallMemory(engine, "quantum chromodynamics");
    expect(r.block).toBe("");
    expect(r.levels).toEqual(["overview", "search"]);
  });

  it("reads multiple matching notes within budget", async () => {
    const engine = new InMemoryMemoryEngine([
      note("u", "user", "The user's dog is named Rex.", 2),
      note("p", "preferences", "The user loves hiking and dogs.", 3),
    ]);
    const r = await recallMemory(engine, "dog", { tokenBudget: 500, maxNotes: 4 });
    expect(r.usedNotes.length).toBe(2);
    expect(r.block).toContain("Rex");
    expect(r.block).toContain("hiking");
    expect(r.levels).toEqual(["overview", "search", "read"]);
  });

  it("always surfaces the top hit, truncated to fit a tiny budget", async () => {
    const big = "dogs ".repeat(500); // ~2500 chars, far over budget
    const engine = new InMemoryMemoryEngine([note("a", "pets", big, 1)]);
    const r = await recallMemory(engine, "dogs", { tokenBudget: 100 });
    expect(r.usedNotes.length).toBe(1);
    expect(r.block.endsWith("…")).toBe(true);
    // Budget is a soft cap: header + one truncated note stays well under 2x.
    expect(r.estTokens).toBeLessThanOrEqual(160);
  });

  it("caps the number of notes read at maxNotes", async () => {
    const engine = new InMemoryMemoryEngine([
      note("a", "n1", "dog one", 1),
      note("b", "n2", "dog two", 2),
      note("c", "n3", "dog three", 3),
      note("d", "n4", "dog four", 4),
    ]);
    const r = await recallMemory(engine, "dog", { tokenBudget: 10000, maxNotes: 2 });
    expect(r.usedNotes.length).toBe(2);
  });
});

describe("estimateTokens", () => {
  it("approximates ~4 chars per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
