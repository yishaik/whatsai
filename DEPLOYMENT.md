# Deployment Guide

WhatsAI deploys to **Vercel** (frontend + `api/*` serverless functions) with a
**Convex** backend for data and a **Cloudflare Worker** for the default live-voice
path. CI/CD is GitHub Actions. Git auto-deploys on Vercel are off (`vercel.json`
`git.deploymentEnabled: false`); Actions is the deployer.

Graphs of the live system: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Architecture

- **Frontend** — Vite/React build served as static assets on Vercel.
- **API** — `api/*.ts` run as Vercel serverless functions. They hold provider
  keys. Shared helpers live in `lib/*.js` (plain JS so Vercel ESM can load them).
- **Backend** — Convex for personas, rooms, messages, auth, memory, reminders.
- **Live voice** — four providers, picked in Settings:
  - **Cloudflare** (default) — Worker + Durable Object (`worker/`, `wrangler.jsonc`)
    using `@cloudflare/voice` (Flux STT, Aura TTS, Llama 3.1 8B Fast). Turn-based pipeline.
  - **Gemini Live** — ephemeral token from `GEMINI_API_KEY`.
  - **OpenAI Realtime** — SDP exchanged server-side (`OPENAI_API_KEY`); browser WebRTC.
  - **Grok** — ephemeral `XAI_API_KEY` client secret; browser WebSocket PCM.

Chat, images, STT, and TTS use **Cloudflare Workers AI** when
`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` are set. Groq, Cerebras,
OpenRouter, and NVIDIA are optional OpenAI-compatible extras.

## CI/CD pipelines

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push/PR to `main` | `npm ci` → type-check → Vite build |
| `.github/workflows/pr-preview.yml` | PR with the `preview` label | Vercel preview URL on the PR |
| `.github/workflows/cd.yml` | push to `main` (non-docs), or **workflow_dispatch** | Type-check → `wrangler deploy` → `convex deploy` → Vercel production |
| `.github/workflows/sync-cloudflare-env.yml` | **workflow_dispatch** | Copies AI GitHub secrets onto the Vercel project |

Node version is pinned by `.nvmrc` (**22** — Wrangler will not deploy on 20).

**Before pushing to `main`:**

```bash
npm run verify          # typecheck + test + build
npx convex dev          # backend (local)
npm run dev:vercel      # UI + /api/*
npm run dev:voice       # voice Worker on :8787
```

## Live voice — what you still need to do

Cloudflare voice is **already deployed**:
`https://whatsai-voice.yishai-k.workers.dev`

GitHub already has `VOICE_AGENT_HOST` and a Workers-deploy API token. After adding any extra keys below, run **Actions → Sync Cloudflare env to Vercel**, then **Deploy Production**.

### 1. Cloudflare (done)

No action. Worker is live. Default voice provider in the app is Cloudflare.

### 2. Gemini (optional)

1. Open [Google AI Studio → API keys](https://aistudio.google.com/apikey).
2. Create a key.
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `GEMINI_API_KEY`
   - Value: the key
4. Run **Sync Cloudflare env to Vercel**, then **Deploy Production**.
5. In the app: **Settings → Live voice provider → Gemini**.

### 3. OpenAI (optional)

1. Open [OpenAI API keys](https://platform.openai.com/api-keys).
2. Create a key. Realtime billing must be enabled on the account.
3. GitHub secret name: `OPENAI_API_KEY`
4. Sync env to Vercel, then Deploy Production.
5. In the app: **Settings → Live voice provider → OpenAI**.

### 4. Grok / xAI (optional)

1. Open [xAI console API keys](https://console.x.ai/team/default/api-keys).
2. Create a key.
3. GitHub secret name: `XAI_API_KEY` (not `GROK_API_KEY` — that name is Groq chat).
4. Sync env to Vercel, then Deploy Production.
5. In the app: **Settings → Live voice provider → Grok**.

Local `.env.local` uses the same names. Restart `npm run dev:vercel` after changing it.

## Required GitHub secrets

**Settings → Secrets and variables → Actions:**

| Secret | Used by | Where to get it |
| --- | --- | --- |
| `VERCEL_TOKEN` | CD, preview, env sync | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | CD / env sync | Vercel project settings |
| `VERCEL_PROJECT_ID` | CD / env sync | Vercel project settings |
| `CONVEX_DEPLOY_KEY` | CD | Convex → Project → Settings → Deploy Keys (production) |
| `CLOUDFLARE_ACCOUNT_ID` | env sync → Vercel | Cloudflare dashboard account ID |
| `CLOUDFLARE_API_TOKEN` | env sync + CD (`wrangler deploy`) | API token with Account → Workers AI → Read **and** Account → Cloudflare Workers → Edit ([Workers template](https://dash.cloudflare.com/profile/api-tokens) plus Workers AI Read). A Read-only AI token will 10000 on `wrangler deploy`. |
| `VOICE_AGENT_HOST` | env sync → Vercel | Public `https://whatsai-voice.<subdomain>.workers.dev` URL |
| `GROQ_API_KEY` | env sync → Vercel (optional) | [console.groq.com](https://console.groq.com) |
| `CEREBRAS_API_KEY` | env sync → Vercel (optional) | [inference.cerebras.ai](https://inference.cerebras.ai) |
| `OPENROUTER_API_KEY` | env sync → Vercel (optional) | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `NVIDIA_API_KEY` | env sync → Vercel (optional) | [build.nvidia.com](https://build.nvidia.com) |
| `GEMINI_API_KEY` | env sync → Vercel (optional, Gemini Live + leftover Gemini chat) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | env sync → Vercel (optional, Realtime voice + leftover GPT chat) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `XAI_API_KEY` | env sync → Vercel (optional, Grok voice) | [console.x.ai](https://console.x.ai) — not `GROQ_API_KEY` |

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
| `VOICE_AGENT_HOST` | Cloudflare Voice Worker URL (`https://whatsai-voice.yishai-k.workers.dev`) |
| `GEMINI_API_KEY` | Optional — Gemini Live (and leftover Gemini chat) |
| `OPENAI_API_KEY` | Optional — OpenAI Realtime and leftover GPT chat |
| `XAI_API_KEY` | Optional — Grok speech-to-speech (not Groq) |
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
- **Live voice fails** — Worker not deployed, or `VOICE_AGENT_HOST` missing on Vercel. Run `npx wrangler deploy`, then set `VOICE_AGENT_HOST` to the printed `workers.dev` URL and re-run env sync + CD. The token needs Workers Scripts Edit, not just Workers AI Read.
- **CD fails at Convex** — `CONVEX_DEPLOY_KEY` missing or wrong deployment.

## Security

1. Never commit API keys — `.env.local` is gitignored.
2. Provider keys stay server-side (Vercel functions only). Do not use `VITE_*` for secrets.
3. Rotate any key that was pasted into chat or logs.
