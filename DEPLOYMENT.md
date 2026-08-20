# Deployment Guide

WhatsAI deploys to **Vercel** (frontend + `api/*` serverless functions) with a
**Convex** backend. GitHub Actions is the only deployer — Vercel Git deploys
are disabled in `vercel.json` so a push does not double-deploy.

```text
local                    GitHub                         prod
──────                   ──────                         ────
npm run verify    →      CI (PR + main)                 —
                         typecheck + test + build

npx convex dev    →      CD (push to main, not docs)    Convex
npm run dev:vercel       typecheck + test               Vercel
                         convex deploy
                         vercel pull / build / deploy
```

## Before you push

CI and CD now run the same checks. Run them locally so a red main is your
fault, not a surprise:

```bash
npm install
cp env.example .env.local   # then fill keys (see below)
npm run verify              # typecheck + test + production Vite build
```

`verify` does **not** need live API keys. It is the gate CI uses.

To exercise the running app (replies, avatars, voice):

```bash
npx convex dev              # terminal 1 — local Convex, prints VITE_CONVEX_URL
npm run dev:vercel          # terminal 2 — Vite + /api/* with .env.local
```

`npm run dev` is the Vite UI only. Persona replies 404 without `dev:vercel`.

Node is pinned by `.nvmrc` (currently 22). Use that version locally.

## Pipelines

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push/PR to `main` | `npm ci` → typecheck → **test** → Vite build |
| `.github/workflows/cd.yml` | push to `main` (skips `*.md` / `docs/**`), or **Actions → Deploy Production → Run workflow** | typecheck → **test** → `convex deploy` → Vercel production |
| `.github/workflows/pr-preview.yml` | PR with the `preview` label (or `workflow_dispatch`) | Vercel preview URL, commented on the PR |

Every PR still gets CI. Preview deploys are opt-in so Vercel Hobby rate limits
don't get burned on every push.

Preview frontends talk to the Convex URL set on the Vercel **preview**
environment (typically production Convex). Test Convex schema changes locally
with `npx convex dev` before merging.

## GitHub secrets

**Settings → Secrets and variables → Actions** (repo secrets, not only the
`production` environment):

| Secret | Used by | Where to get it |
| --- | --- | --- |
| `VERCEL_TOKEN` | CD, PR preview | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | CD, PR preview | Vercel project → Settings → General |
| `VERCEL_PROJECT_ID` | CD, PR preview | same |
| `CONVEX_DEPLOY_KEY` | CD | Convex dashboard → Project → Settings → Deploy Keys (production) |

These four are already set on this repo.

## Environment variables

### Vercel project (pulled by `vercel pull`)

| Variable | Scope | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Server | Gemini replies, avatars, live voice; never `VITE_*` |
| `OPENAI_API_KEY` | Server | Optional. GPT models, Whisper, TTS |
| `VITE_CONVEX_URL` | Build | Convex `.convex.cloud` URL baked into the client |
| `VITE_CONVEX_SITE_URL` | Build | Convex `.convex.site` URL (auth HTTP) |

### Convex dashboard (production deployment)

| Variable | Purpose |
| --- | --- |
| `CONVEX_SITE_URL` | Convex Auth provider domain |
| `SITE_URL` | Absolute links (defaults to https://whatsai.yishaik.com) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push for reminders |

### Local `.env.local`

See `env.example`. Minimum to chat: `GEMINI_API_KEY`, `CONVEX_DEPLOYMENT`,
`VITE_CONVEX_URL`.

## Manual deploy (fallback)

```bash
CONVEX_DEPLOY_KEY=... npx convex deploy -y

vercel pull --yes --environment=production --token=$VERCEL_TOKEN
vercel build --prod --token=$VERCEL_TOKEN
vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

Or **Actions → Deploy Production → Run workflow** (`workflow_dispatch`).

## Troubleshooting

- **`npm run verify` fails locally** — same command CI runs. Fix it before push.
- **Frontend can't reach Convex** — `VITE_CONVEX_URL` missing in Vercel **build**
  env, or `convex deploy` didn't run (check the CD log).
- **API 500s** — `GEMINI_API_KEY` not set on the Vercel project (server env).
- **CD fails at Convex** — `CONVEX_DEPLOY_KEY` missing or scoped to the wrong
  deployment.
- **CD fails at `vercel pull`** — `VERCEL_TOKEN` / `VERCEL_ORG_ID` /
  `VERCEL_PROJECT_ID` missing as Actions secrets.
- **Preview URL 404 / old Convex** — preview does not deploy a separate Convex
  instance. Backend changes need a production Convex deploy (or local `convex dev`).
- **Two deploys on one push** — `vercel.json` sets `git.deploymentEnabled: false`.
  If Vercel starts auto-deploying again, that flag was overwritten in the dashboard.

## Security

1. Never commit API keys — `.env.local` is gitignored.
2. `GEMINI_API_KEY` / `OPENAI_API_KEY` stay server-side (Vercel functions only).
3. Rotate `VERCEL_TOKEN` / `CONVEX_DEPLOY_KEY` if exposed.
4. Additive Convex schema first, then frontend — CD deploys Convex **before**
   Vercel, so a breaking schema change can take production down until the
   frontend catches up.
