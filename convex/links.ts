import { v } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Extract up to a few unique http(s) URLs from a block of text. Trailing
// punctuation is trimmed. Exported so addMessage can schedule preview fetches.
export const extractUrls = (text: string): string[] => {
  const matches = text.match(/\bhttps?:\/\/[^\s<>"')]+/gi) ?? [];
  const cleaned = matches.map((u) => u.replace(/[.,;:!?)]+$/, ""));
  return Array.from(new Set(cleaned)).slice(0, 3);
};

// Reactive: the cached preview row for a URL, or null if none yet.
export const getLinkPreview = query({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("linkPreviews")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();
  },
});

// Internal: write the fetched metadata (or an error status) onto the row.
export const _saveLinkPreview = internalMutation({
  args: {
    url: v.string(),
    status: v.union(v.literal("done"), v.literal("error")),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    siteName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("linkPreviews")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();
    const fields = {
      status: args.status,
      title: args.title,
      description: args.description,
      imageUrl: args.imageUrl,
      siteName: args.siteName,
      fetchedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("linkPreviews", { url: args.url, ...fields });
    }
  },
});

// --- OpenGraph parsing helpers (regex-based; no DOM in the Convex runtime) ---

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

const metaContent = (html: string, key: string): string | undefined => {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*?content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${k}["']`, "i");
  const m = html.match(re1)?.[1] ?? html.match(re2)?.[1];
  return m ? decodeEntities(m) : undefined;
};

const isBlockedHost = (host: string): boolean => {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
};

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;

// Internal action: fetch the URL, parse OpenGraph/meta tags, and save a preview.
// Defends against SSRF (scheme + private-host checks), bounds time and size.
export const fetchLinkPreview = internalAction({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<null> => {
    const save = (
      status: "done" | "error",
      meta: { title?: string; description?: string; imageUrl?: string; siteName?: string } = {},
    ) => ctx.runMutation(internal.links._saveLinkPreview, { url: args.url, status, ...meta });

    let parsed: URL;
    try {
      parsed = new URL(args.url);
    } catch {
      await save("error");
      return null;
    }
    if (!["http:", "https:"].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) {
      await save("error");
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(args.url, {
        signal: controller.signal,
        headers: { "User-Agent": "WhatsAIBot/1.0 (+link-preview)", Accept: "text/html,*/*" },
        redirect: "follow",
      });
      const contentType = resp.headers.get("content-type") ?? "";
      const contentLength = Number(resp.headers.get("content-length") ?? "0");
      if (!resp.ok || !contentType.includes("text/html") || contentLength > MAX_HTML_BYTES) {
        await save("error");
        return null;
      }

      const html = (await resp.text()).slice(0, 300_000); // head is early; cap parsing work

      const title =
        metaContent(html, "og:title") ??
        metaContent(html, "twitter:title") ??
        (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : undefined);
      const description =
        metaContent(html, "og:description") ??
        metaContent(html, "twitter:description") ??
        metaContent(html, "description");
      const siteName = metaContent(html, "og:site_name");
      let imageUrl = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
      if (imageUrl) {
        try {
          imageUrl = new URL(imageUrl, parsed).toString(); // resolve relative
        } catch {
          imageUrl = undefined;
        }
      }

      if (!title && !description && !imageUrl) {
        await save("error");
        return null;
      }
      await save("done", { title, description, imageUrl, siteName });
      return null;
    } catch (error) {
      console.error("Link preview fetch failed for", args.url, error);
      await save("error");
      return null;
    } finally {
      clearTimeout(timeout);
    }
  },
});
