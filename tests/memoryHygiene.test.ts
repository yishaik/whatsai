import { describe, it, expect } from "vitest";
import {
  normalizeFactLine,
  mergeNoteContent,
  MAX_FACTS_PER_NOTE,
} from "../memory/hygiene";
import { factToNoteLine } from "../memory/distill";

describe("normalizeFactLine", () => {
  it("ignores bullet marker, dated suffix, case and spacing", () => {
    const a = normalizeFactLine("- The user's dog is Rex. _(learned 2026-06-25T00:00:00Z)_");
    const b = normalizeFactLine("*   the user's   dog is rex.   _(learned 2026-07-01T09:00:00Z)_");
    expect(a).toBe(b); // same fact, learned at different times → same key
  });
});

describe("mergeNoteContent", () => {
  it("appends genuinely new facts under the header", () => {
    const { content, added } = mergeNoteContent("# user", [
      factToNoteLine("The user's dog is Rex", "2026-06-25T00:00:00Z"),
    ]);
    expect(added).toBe(1);
    expect(content.startsWith("# user")).toBe(true);
    expect(content).toContain("Rex");
  });

  it("drops a duplicate fact even when re-learned at a later time", () => {
    const existing = `# user\n${factToNoteLine("The user's dog is Rex", "2026-06-25T00:00:00Z")}`;
    const { content, added } = mergeNoteContent(existing, [
      factToNoteLine("the user's dog is rex", "2026-07-01T12:00:00Z"),
    ]);
    expect(added).toBe(0); // recognised as the same fact
    // Only one Rex bullet remains.
    expect(content.match(/rex/gi)?.length).toBe(1);
  });

  it("de-duplicates within a single batch of additions", () => {
    const { content, added } = mergeNoteContent("# user", [
      factToNoteLine("Lives in Haifa", "2026-06-25T00:00:00Z"),
      factToNoteLine("lives in haifa", "2026-06-25T00:00:01Z"),
    ]);
    expect(added).toBe(1);
    expect(content.match(/haifa/gi)?.length).toBe(1);
  });

  it("caps a note at maxFacts, evicting the oldest bullets (recency eviction)", () => {
    // Seed a note already at the cap, oldest = fact-0, newest = fact-(cap-1).
    const seeded = [
      "# user",
      ...Array.from({ length: MAX_FACTS_PER_NOTE }, (_, i) =>
        factToNoteLine(`fact number ${i}`, "2026-06-25T00:00:00Z"),
      ),
    ].join("\n");
    const { content, added } = mergeNoteContent(seeded, [
      factToNoteLine("a brand new fact", "2026-06-26T00:00:00Z"),
    ]);
    expect(added).toBe(1);
    const bulletCount = content.split("\n").filter((l) => l.trim().startsWith("-")).length;
    expect(bulletCount).toBe(MAX_FACTS_PER_NOTE); // still capped
    expect(content).toContain("a brand new fact"); // newest kept
    expect(content).not.toContain("fact number 0"); // oldest evicted
  });

  it("preserves the most recent facts under a custom small cap", () => {
    const { content } = mergeNoteContent(
      "# user",
      [
        factToNoteLine("oldest", "2026-06-25T00:00:00Z"),
        factToNoteLine("middle", "2026-06-25T00:00:01Z"),
        factToNoteLine("newest", "2026-06-25T00:00:02Z"),
      ],
      2,
    );
    expect(content).toContain("middle");
    expect(content).toContain("newest");
    expect(content).not.toContain("oldest");
  });
});
