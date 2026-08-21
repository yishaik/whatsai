# Deployment Guide

WhatsAI deploys to **Vercel** (frontend + `api/*` serverless functions) with a
**Convex** backend for data. CI/CD is GitHub Actions. Git auto-deploys on Vercel
are off (`vercel.json` `git.deploymentEnabled: false`); Actions is the deployer.

## Architecture

- **Frontend** — Vite/React build served as static assets on Vercel.
- **API** — `api/*.ts` run as Vercel serverless functions. They hold provider
  keys. Shared helpers live in `lib/*.js` (plain JS so Vercel ESM can load them).
- **Backend** — Convex for personas, rooms, messages, auth, memory, reminders.

Chat, images, STT, and TTS use **Cloudflare Workers AI** when
`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` are set. Groq, Cerebras,
OpenRouter, and NVIDIA are optional OpenAI-compatible extras. Gemini is only
required for **live voice**.

## CI/CD pipelines

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push/PR to `main` | `npm ci` → type-check → Vite build |
| `.github/workflows/pr-preview.yml` | PR with the `preview` label | Vercel preview URL on the PR |
| `.github/workflows/cd.yml` | push to `main` (non-docs), or **workflow_dispatch** | Type-check → `convex deploy` → Vercel production |
| `.github/workflows/sync-cloudflare-env.yml` | **workflow_dispatch** | Copies AI GitHub secrets onto the Vercel project |

Node version is pinned by `.nvmrc`.

**Before pushing to `main`:**

```bash
npm run verify          # typecheck + test + build
npx convex dev          # backend (local)
npm run dev:vercel      # UI + /api/*
```

## Required GitHub secrets

**Settings → Secrets and variables → Actions:**

| Secret | Used by | Where to get it |
| --- | --- | --- |
| `VERCEL_TOKEN` | CD, preview, env sync | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | CD / env sync | Vercel project settings |
| `VERCEL_PROJECT_ID` | CD / env sync | Vercel project settings |
| `CONVEX_DEPLOY_KEY` | CD | Convex → Project → Settings → Deploy Keys (production) |
| `CLOUDFLARE_ACCOUNT_ID` | env sync → Vercel | Cloudflare dashboard account ID |
| `CLOUDFLARE_API_TOKEN` | env sync → Vercel | API token with Account → Workers AI → Read |
| `GROQ_API_KEY` | env sync → Vercel (optional) | [console.groq.com](https://console.groq.com) |
| `CEREBRAS_API_KEY` | env sync → Vercel (optional) | [inference.cerebras.ai](https://inference.cerebras.ai) |
| `OPENROUTER_API_KEY` | env sync → Vercel (optional) | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `NVIDIA_API_KEY` | env sync → Vercel (optional) | [build.nvidia.com](https://build.nvidia.com) |

After changing AI secrets, run **Actions → Sync Cloudflare env to Vercel**, then
**Deploy Production** so functions pick up the new env.

## Required environment variables (Vercel)

| Variable | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Workers AI account |
| `CLOUDFLARE_API_TOKEN` | Workers AI token |
| `VITE_CONVEX_URL` | Convex deployment the frontend connects to |
| `GROQ_API_KEY` | Optional Groq chat |
| `CEREBRAS_API_KEY` | Optional Cerebras chat |
| `OPENROUTER_API_KEY` | Optional OpenRouter (free `:free` models) |
| `NVIDIA_API_KEY` | Optional NVIDIA NIM |
| `GEMINI_API_KEY` | Optional — live voice only |
| `OPENAI_API_KEY` | Optional leftover GPT path if Cloudflare is unset |
| `VITE_CONVEX_SITE_URL` | Optional Convex HTTP actions URL |

## Manual deploy (fallback)

```bash
CONVEX_DEPLOY_KEY=... npx convex deploy -y
vercel pull --yes --environment=production --token=$VERCEL_TOKEN
vercel build --prod --token=$VERCEL_TOKEN
vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

## Local development

```bash
npm install
# .env.local: see env.example
npx convex dev
npm run dev:vercel
```

## Troubleshooting

- **Frontend can't reach Convex** — `VITE_CONVEX_URL` in Vercel, and `convex deploy` in CD logs.
- **Chat 500 / missing module** — Vercel ESM functions cannot import sibling `.ts`. Helpers must be `lib/*.js` with `includeFiles: "lib/**"` in `vercel.json`.
- **Cloudflare 403 / error 5035** — that model needs Workers Paid (e.g. DeepSeek V4 Pro/Flash).
- **Groq/Cerebras/OpenRouter/NVIDIA fail** — key missing on Vercel; re-run env sync then CD.
- **Live voice fails** — still Gemini Live; set `GEMINI_API_KEY`.
- **CD fails at Convex** — `CONVEX_DEPLOY_KEY` missing or wrong deployment.

## Security

1. Never commit API keys — `.env.local` is gitignored.
2. Provider keys stay server-side (Vercel functions only). Do not use `VITE_*` for secrets.
3. Rotate any key that was pasted into chat or logs.
