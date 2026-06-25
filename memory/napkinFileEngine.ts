// MemoryEngine bound to a REAL napkin file vault, via the published `napkin-ai`
// SDK. This is the local / CLI / dev / self-hosted-with-a-volume path: anywhere
// there's a durable filesystem, a persona's memory can live as plain markdown a
// human can open in Obsidian. It is the same interface the serverless Convex
// path implements, so nothing above the engine changes when you swap substrates.
//
// NOT for the browser, a Vercel function, or a Convex isolate — it touches the
// filesystem. Keep it out of those import graphs (it is imported only by
// node-side tooling and the standalone demo). napkin's `findVault` walks UP from
// the given dir, so each user's vault must be its OWN directory that is not
// nested inside another vault, e.g. `<dataRoot>/memory-vaults/<userId>/`.

import * as fs from "node:fs";
import * as path from "node:path";
import { Napkin } from "napkin-ai";
import { extractKeywords } from "./miniSearchEngine";
import type {
  MemoryEngine,
  MemoryHit,
  MemoryNote,
  MemoryOverview,
  MemoryOverviewEntry,
} from "./types";

const titleOf = (file: string): string => path.basename(file, ".md");

export class NapkinFileEngine implements MemoryEngine {
  private readonly n: Napkin;
  private readonly contentPath: string;

  /** @param vaultDir an isolated directory for this user's vault (auto-created). */
  constructor(vaultDir: string) {
    fs.mkdirSync(vaultDir, { recursive: true });
    // Force an isolated vault rooted exactly at `vaultDir`. Without this, napkin's
    // findVault() walks UP and could bind to an ancestor's `.napkin`, leaking one
    // user's memory into another's. Seeding `.napkin/config.json` (napkin's own
    // bare-vault format) pins content to this directory.
    const napkinDir = path.join(vaultDir, ".napkin");
    if (!fs.existsSync(napkinDir)) {
      fs.mkdirSync(napkinDir, { recursive: true });
      fs.writeFileSync(
        path.join(napkinDir, "config.json"),
        JSON.stringify(
          {
            overview: { depth: 3, keywords: 8 },
            search: { limit: 30, snippetLines: 0 },
            daily: { folder: "daily", format: "YYYY-MM-DD" },
            vault: { root: "..", obsidian: "../.obsidian" },
          },
          null,
          2,
        ),
      );
    }
    this.n = new Napkin(vaultDir);
    this.contentPath = this.n.vault.contentPath;
  }

  private mtimeMs(file: string): number {
    try {
      return fs.statSync(path.join(this.contentPath, file)).mtimeMs;
    } catch {
      return 0;
    }
  }

  async overview(): Promise<MemoryOverview> {
    // napkin's own overview() is folder-level; we synthesize a note-level map so
    // the shape matches the Convex engine. Cheap: titles + keywords, no bodies.
    const files = this.n.fileList({ ext: "md" }).filter((f) => titleOf(f) !== "NAPKIN");
    const entries: MemoryOverviewEntry[] = files.map((file) => {
      let content = "";
      try {
        content = this.n.read(file).content;
      } catch {
        content = "";
      }
      return {
        id: file,
        title: titleOf(file),
        keywords: extractKeywords(`${titleOf(file)}\n${content}`),
        chars: content.length,
        updatedAt: this.mtimeMs(file),
      };
    });
    entries.sort((a, b) => b.updatedAt - a.updatedAt);
    return { noteCount: entries.length, entries };
  }

  async search(query: string, opts?: { limit?: number }): Promise<MemoryHit[]> {
    const results = this.n.search(query, { limit: opts?.limit, snippets: true });
    return results.map((r) => ({
      id: r.file,
      title: titleOf(r.file),
      score: r.score,
      snippets: r.snippets.map((s) => s.text.trim()).filter(Boolean).slice(0, 3),
    }));
  }

  async read(id: string): Promise<MemoryNote | null> {
    try {
      const res = this.n.read(id);
      return {
        id: res.path,
        title: titleOf(res.path),
        content: res.content,
        updatedAt: this.mtimeMs(res.path),
      };
    } catch {
      return null; // file not found
    }
  }

  async append(title: string, content: string): Promise<string> {
    // napkin's append() throws if the note is missing, so create-then-append.
    let ref: string;
    try {
      ref = this.n.read(title).path;
    } catch {
      ref = this.n.create({ name: title, content: `# ${title}` }).path;
    }
    return this.n.append(ref, content);
  }
}
