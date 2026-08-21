# WhatsAI — Developer Guide

## Overview

WhatsAI is a Vite + React + TypeScript app: a WhatsApp-style **multi-persona group chat**. Personas, rooms, messages, auth, and memory live in **Convex**. AI inference runs in **Vercel serverless functions** so provider keys never reach the browser.

## Architecture

```text
Browser UI (React 19)
  ├── Convex subscriptions (rooms, messages, personas)
  ├── Provider + model pickers (Settings, chat, persona)
  └── services/geminiService.ts  →  fetch('/api/*')
           │
           ├── /api/persona-response   chat (stream)
           ├── /api/models             live model list
           ├── /api/avatar, /group-avatar, /generate-image
           ├── /api/transcribe, /tts, /suggest, /summarize
           └── /api/live-token         Gemini Live only
                    │
                    ├── Cloudflare Workers AI (default)
                    ├── Groq / Cerebras / OpenRouter / NVIDIA (optional)
                    └── Gemini Live (voice calls)
```

Persistence is Convex, not `localStorage`. Clearing the browser does not wipe the account.

## Tech stack

- React 19, TypeScript 5, Vite 6, Tailwind
- Convex + Convex Auth
- Vercel Functions (`api/*.ts`)
- `lib/cloudflareAi.js`, `lib/providers.js` — plain JS so Vercel ESM can import them
- `@google/genai` only for live voice (and leftover Gemini chat if Cloudflare is unset)
- `openai` SDK against OpenAI-compatible bases (Cloudflare, Groq, Cerebras, OpenRouter, NVIDIA)

## How model routing works

Model ids encode the provider:

| Prefix | Provider |
| --- | --- |
| `@cf/…` | Cloudflare Workers AI |
| `groq/…` | Groq |
| `cerebras/…` | Cerebras |
| `openrouter/…` | OpenRouter |
| `nvidia/…` | NVIDIA NIM |
| `gpt-…` / `o1…` | OpenAI |
| other | Gemini |

The UI stores a single `model` string (chat / persona / app default). Two dropdowns (provider, then model) write that id. `/api/persona-response` strips the prefix before calling the vendor.

Leftover Gemini/GPT ids remap onto the Cloudflare default when those keys are missing. Groq/Cerebras/OpenRouter/NVIDIA are never remapped.

## Local development

Need Node 20+ (`.nvmrc`).

```bash
npm install
cp env.example .env.local
# fill CLOUDFLARE_* and Convex; optional GROQ_ / CEREBRAS_ / OPENROUTER_ / NVIDIA_
npx convex dev
npm run dev:vercel
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite UI only (`/api/*` 404s) |
| `npm run dev:vercel` | UI + serverless AI routes |
| `npm run verify` | typecheck + test + build — run before `main` |
| `npm test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |

## Secrets

Never inject provider keys through `VITE_*`. Server functions read `process.env`.

See [env.example](env.example) and [DEPLOYMENT.md](DEPLOYMENT.md).

## Implementation notes

- Vercel treats every `api/*.ts` as a function (Hobby cap 12). Do not put helpers in `api/`.
- Cross-directory `.ts` imports from `api/` fail at runtime (`ERR_MODULE_NOT_FOUND`). Use `lib/*.js` + `vercel.json` `includeFiles: "lib/**"`.
- Web search (Google grounding) is Gemini-only. Cloudflare/Groq/etc. should use the Read URLs skill.
- Live voice is Gemini Live only.
- DeepSeek V4 Pro/Flash on Cloudflare need Workers Paid; Free-plan 403s map to an upgrade message.

## Troubleshooting

- **Persona replies fail locally** — use `npm run dev:vercel`, not `npm run dev`.
- **Missing Cloudflare helper** — confirm `lib/cloudflareAi.js` and `lib/providers.js` are deployed (`includeFiles`).
- **Provider 401/missing key** — set the matching env var on Vercel, sync secrets, redeploy.
- **`npm run preview`** — static `dist/` only; no functions.
