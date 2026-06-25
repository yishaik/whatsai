import { describe, it, expect } from "vitest";
import { InMemoryMemoryEngine, extractKeywords } from "../memory/miniSearchEngine";
import {
  extractMemoryFacts,
  factToNoteLine,
  factsByTopic,
  sanitizeTopic,
} from "../memory/distill";
import { recallMemory } from "../memory/recall";
import type { MemoryEngine, MemoryNote } from "../memory/types";

const note = (id: string, title: string, content: string, updatedAt: number): MemoryNote => ({
  id,
  title,
  content,
  updatedAt,
});

/**
 * The exact production write path, factored into a helper: distill a reply's
 * `[[MEMORY]]` tokens and append each to its topic note. This is what the client
 * + convex/personaMemory.remember do; here we run it straight against an engine.
 */
async function rememberFromReply(
  engine: MemoryEngine,
  reply: string,
  atIso: string,
): Promise<number> {
  const facts = extractMemoryFacts(reply);
  for (const [rawTopic, list] of factsByTopic(facts)) {
    const title = sanitizeTopic(rawTopic);
    const addition = list.map((f) => factToNoteLine(f, atIso)).join("\n");
    await engine.append(title, addition);
  }
  return facts.length;
}

describe("extractKeywords", () => {
  it("drops stopwords and ranks by frequency", () => {
    const kw = extractKeywords("The dog and the cat. Dog hiking hiking hiking.");
    expect(kw[0]).toBe("hiking"); // 3x vs dog 2x
    expect(kw).toContain("dog");
    expect(kw).not.toContain("the");
  });
});

describe("InMemoryMemoryEngine", () => {
  it("overview lists notes newest-first with keywords and sizes", async () => {
    const engine = new InMemoryMemoryEngine([
      note("a", "user", "The user's dog is named Rex.", 10),
      note("b", "work", "Building a chat app called WhatsAI.", 20),
    ]);
    const ov = await engine.overview();
    expect(ov.noteCount).toBe(2);
    expect(ov.entries[0].title).toBe("work"); // newest first
    expect(ov.entries[0].chars).toBeGreaterThan(0);
    expect(ov.entries.map((e) => e.title)).toEqual(["work", "user"]);
  });

  it("search ranks relevant notes and returns snippets", async () => {
    const engine = new InMemoryMemoryEngine([
      note("a", "user", "The user's dog is named Rex.", 10),
      note("b", "work", "Building a chat app called WhatsAI.", 20),
    ]);
    const hits = await engine.search("dog");
    expect(hits.length).toBe(1);
    expect(hits[0].id).toBe("a");
    expect(hits[0].snippets.join(" ")).toContain("Rex");
  });

  it("search respects the limit and returns [] for an empty vault", async () => {
    expect(await new InMemoryMemoryEngine([]).search("anything")).toEqual([]);
    const engine = new InMemoryMemoryEngine([
      note("a", "n1", "dog one", 1),
      note("b", "n2", "dog two", 2),
      note("c", "n3", "dog three", 3),
    ]);
    expect((await engine.search("dog", { limit: 2 })).length).toBe(2);
  });

  it("read returns a note or null", async () => {
    const engine = new InMemoryMemoryEngine([note("a", "user", "hi", 1)]);
    expect((await engine.read("a"))?.content).toBe("hi");
    expect(await engine.read("missing")).toBeNull();
  });

  it("append creates a note, then appends case-insensitively to it", async () => {
    let clock = 100;
    const engine = new InMemoryMemoryEngine([], () => clock++);
    const id1 = await engine.append("User", "- first");
    const id2 = await engine.append("user", "- second"); // same note, different case
    expect(id1).toBe(id2);
    const read = await engine.read(id1);
    expect(read?.content).toContain("first");
    expect(read?.content).toContain("second");
  });
});

describe("end-to-end: store a fact and recall it across two turns", () => {
  it("remembers in turn 1 and recalls in turn 2", async () => {
    let clock = 1000;
    const engine = new InMemoryMemoryEngine([], () => clock++);

    // ── Turn 1 ── user mentions their dog; the persona's reply carries a
    // [[MEMORY]] token, which we distill and persist.
    const reply1 = `Aww, Rex sounds like a good boy!\n[[MEMORY]]{"fact":"The user's dog is named Rex","topic":"user"}`;
    const written = await rememberFromReply(engine, reply1, "2026-06-25T12:00:00Z");
    expect(written).toBe(1);

    // ── Turn 2 ── a later turn asks about the dog. Progressive-disclosure recall
    // surfaces the stored fact within budget.
    const recalled = await recallMemory(engine, "what's my dog's name again?", {
      tokenBudget: 300,
    });
    expect(recalled.block).toContain("Rex");
    expect(recalled.levels).toEqual(["overview", "search", "read"]);
    expect(recalled.usedNotes.length).toBe(1);
    expect(recalled.usedNotes[0].title).toBe("user");
  });
});
