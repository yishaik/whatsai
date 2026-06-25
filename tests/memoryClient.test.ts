import { describe, it, expect } from "vitest";
import { finalizeReply, stripForDisplay } from "../services/geminiService";

// The client's half of the memory loop: after a reply lands, finalizeReply must
// pull out the [[MEMORY]] facts AND hide every token from the displayed text —
// alongside the existing [[REMINDER]] handling. During streaming, stripForDisplay
// must never let a (partial) token flash on screen.

describe("finalizeReply — memory tokens", () => {
  it("extracts a memory fact and strips the token from the display text", () => {
    const raw = `Aww, Rex sounds adorable!\n[[MEMORY]]{"fact":"The user's dog is named Rex","topic":"user"}`;
    const { text, facts, reminders } = finalizeReply(raw);
    expect(text).toBe("Aww, Rex sounds adorable!");
    expect(facts).toEqual([{ fact: "The user's dog is named Rex", topic: "user" }]);
    expect(reminders).toEqual([]);
  });

  it("handles reminder and memory tokens together in one reply", () => {
    const raw = [
      "Sure, I'll remind you and I'll remember that.",
      `[[REMINDER]]{"text":"call mom","when":"2026-07-01T09:00:00Z","repeat":"none"}`,
      `[[MEMORY]]{"fact":"The user's mother is named Dana","topic":"people"}`,
    ].join("\n");
    const { text, facts, reminders } = finalizeReply(raw);
    expect(text).toBe("Sure, I'll remind you and I'll remember that.");
    expect(reminders).toHaveLength(1);
    expect(reminders[0].text).toBe("call mom");
    expect(facts).toEqual([{ fact: "The user's mother is named Dana", topic: "people" }]);
  });

  it("leaves a token-free reply unchanged with no facts", () => {
    const { text, facts } = finalizeReply("Just a normal reply.");
    expect(text).toBe("Just a normal reply.");
    expect(facts).toEqual([]);
  });

  it("never throws on a malformed memory token (drops it)", () => {
    const raw = `Noted.\n[[MEMORY]]{not valid json}`;
    const { text, facts } = finalizeReply(raw);
    expect(facts).toEqual([]);
    expect(text).not.toContain("[[MEMORY]]");
  });
});

describe("stripForDisplay — streaming hides tokens", () => {
  it("hides a complete memory token mid-stream", () => {
    const s = `Got it!\n[[MEMORY]]{"fact":"x","topic":"user"}`;
    expect(stripForDisplay(s)).toBe("Got it!");
  });

  it("hides a partial memory marker forming at the end of a chunk", () => {
    expect(stripForDisplay("Hello there [[MEM")).toBe("Hello there");
    expect(stripForDisplay("Hello there [[")).toBe("Hello there");
  });

  it("cuts at the earliest of multiple trailing tokens", () => {
    const s = `Done.\n[[REMINDER]]{"text":"x","when":"y"}\n[[MEMORY]]{"fact":"z","topic":"user"}`;
    expect(stripForDisplay(s)).toBe("Done.");
  });

  it("passes token-free text through untouched", () => {
    expect(stripForDisplay("a normal partial reply")).toBe("a normal partial reply");
  });
});
