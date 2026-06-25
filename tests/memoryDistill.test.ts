import { describe, it, expect } from "vitest";
import {
  extractMemoryFacts,
  factToNoteLine,
  factsByTopic,
  sanitizeTopic,
  stripMemoryTokens,
} from "../memory/distill";

describe("extractMemoryFacts", () => {
  it("parses a single well-formed token", () => {
    const text = `Got it!\n[[MEMORY]]{"fact":"The user's dog is named Rex","topic":"user"}`;
    expect(extractMemoryFacts(text)).toEqual([
      { fact: "The user's dog is named Rex", topic: "user" },
    ]);
  });

  it("parses multiple tokens and de-duplicates within a turn", () => {
    const text = [
      "sure",
      `[[MEMORY]]{"fact":"Lives in Haifa","topic":"user"}`,
      `[[MEMORY]]{"fact":"Lives in Haifa","topic":"user"}`,
      `[[MEMORY]]{"fact":"Prefers GPT-4","topic":"Preferences"}`,
    ].join("\n");
    expect(extractMemoryFacts(text)).toEqual([
      { fact: "Lives in Haifa", topic: "user" },
      { fact: "Prefers GPT-4", topic: "preferences" },
    ]);
  });

  it("skips malformed JSON and empty facts without throwing", () => {
    const text = [
      `[[MEMORY]]{not json}`,
      `[[MEMORY]]{"fact":"","topic":"user"}`,
      `[[MEMORY]]{"topic":"user"}`,
      `[[MEMORY]]{"fact":"Real fact","topic":"user"}`,
    ].join("\n");
    expect(extractMemoryFacts(text)).toEqual([{ fact: "Real fact", topic: "user" }]);
  });

  it("defaults a missing topic to 'user'", () => {
    const text = `[[MEMORY]]{"fact":"Has two kids"}`;
    expect(extractMemoryFacts(text)).toEqual([{ fact: "Has two kids", topic: "user" }]);
  });

  it("returns [] for text with no tokens", () => {
    expect(extractMemoryFacts("just a normal reply")).toEqual([]);
    expect(extractMemoryFacts("")).toEqual([]);
  });
});

describe("stripMemoryTokens", () => {
  it("removes tokens and tidies whitespace for display", () => {
    const text = `Nice, Rex sounds adorable!\n[[MEMORY]]{"fact":"Dog is Rex","topic":"user"}`;
    expect(stripMemoryTokens(text)).toBe("Nice, Rex sounds adorable!");
  });

  it("leaves token-free text unchanged (trimmed)", () => {
    expect(stripMemoryTokens("hello there")).toBe("hello there");
  });
});

describe("sanitizeTopic", () => {
  it("slugifies and lowercases", () => {
    expect(sanitizeTopic("Work Stuff")).toBe("work-stuff");
    expect(sanitizeTopic("  Preferences!  ")).toBe("preferences");
  });
  it("falls back to 'user' for empty/garbage", () => {
    expect(sanitizeTopic("")).toBe("user");
    expect(sanitizeTopic("!!!")).toBe("user");
    expect(sanitizeTopic(undefined)).toBe("user");
  });
});

describe("factToNoteLine + factsByTopic", () => {
  it("renders a dated bullet", () => {
    expect(factToNoteLine("Dog is Rex", "2026-06-25T00:00:00Z")).toBe(
      "- Dog is Rex _(learned 2026-06-25T00:00:00Z)_",
    );
  });

  it("groups facts by topic preserving order", () => {
    const grouped = factsByTopic([
      { fact: "a", topic: "user" },
      { fact: "b", topic: "work" },
      { fact: "c", topic: "user" },
    ]);
    expect(grouped.get("user")).toEqual(["a", "c"]);
    expect(grouped.get("work")).toEqual(["b"]);
  });
});
