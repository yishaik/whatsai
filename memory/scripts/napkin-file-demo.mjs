// Standalone proof that the SAME progressive-disclosure flow runs over a REAL
// napkin file vault (the local/CLI/dev binding of MemoryEngine). It mirrors,
// call-for-call, what memory/napkinFileEngine.ts does — create-then-append on
// write, overview → search → read on recall — but in plain ESM so it runs with
// `node` directly (no TS toolchain). Kept OUT of the vitest suite so `npm test`
// stays hermetic and fast.
//
//   node memory/scripts/napkin-file-demo.mjs
//
// Expected: turn 1 stores "Rex"; turn 2 recalls it from the file vault.

import { Napkin } from "napkin-ai";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// An isolated vault dir (pin content here so findVault can't bind to an ancestor).
const dir = mkdtempSync(join(tmpdir(), "whatsai-memory-"));
mkdirSync(join(dir, ".napkin"), { recursive: true });
writeFileSync(
  join(dir, ".napkin", "config.json"),
  JSON.stringify({
    overview: { depth: 3, keywords: 8 },
    search: { limit: 30, snippetLines: 0 },
    daily: { folder: "daily", format: "YYYY-MM-DD" },
    vault: { root: "..", obsidian: "../.obsidian" },
  }),
);

const n = new Napkin(dir);
const ok = (label, cond) => console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);

// ── Turn 1: persona learns a durable fact and writes it (create-then-append) ──
const title = "user";
let ref;
try {
  ref = n.read(title).path;
} catch {
  ref = n.create({ name: title, content: `# ${title}` }).path;
}
n.append(ref, "- The user's dog is named Rex. _(learned 2026-06-25)_");
console.log(`Turn 1: stored a fact in file vault at ${dir}`);

// ── Turn 2: recall via progressive disclosure ──
const overview = n.overview(); // L1
const hits = n.search("dog name", { snippets: true }); // L2
const top = hits[0];
const full = top ? n.read(top.file) : null; // L3

console.log("L1 overview folders:", JSON.stringify(overview.overview?.map((f) => f.path)));
console.log("L2 search top hit:", top ? `${top.file} (score ${top.score})` : "(none)");
console.log("L3 read excerpt:", full ? full.content.replace(/\n/g, " ").slice(0, 80) : "(none)");

ok("turn 2 found a hit", !!top);
ok("recalled content contains 'Rex'", !!full && full.content.includes("Rex"));
console.log("\nDemo complete — real napkin file vault stored a fact and recalled it across two turns.");
