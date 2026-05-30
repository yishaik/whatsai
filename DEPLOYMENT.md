# Deployment Guide

WhatsAI deploys to **Vercel** (frontend + `api/*` serverless functions) with a
**Convex** backend for data. CI/CD is automated through GitHub Actions.

## Architecture

- **Frontend** — Vite/React build served as static assets on Vercel.
- **API** — `api/*.ts` run as Vercel serverless functions and hold the
  `GEMINI_API_KEY` server-side.
- **Backend** — Convex (`convex/schema.ts`, `convex/chat.ts`) for persistent data,
  reached from the browser via `VITE_CONVEX_URL`.

## CI/CD pipelines

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push to `main`, PRs to `main` | `npm ci` → type-check → build (validation gate) |
| `.github/workflows/pr-preview.yml` | PR opened/updated | Deploys a Vercel preview and comments the URL |
| `.github/workflows/cd.yml` | push to `main` | Type-check → `convex deploy` → Vercel production deploy |

Node version is pinned by `.nvmrc` (single source of truth for all workflows).

## Required GitHub secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret | Used by | Where to get it |
| --- | --- | --- |
| `VERCEL_TOKEN` | `cd.yml`, `pr-preview.yml` | Vercel → Account Settings → Tokens |
| `CONVEX_DEPLOY_KEY` | `cd.yml` | Convex dashboard → Project → Settings → Deploy Keys (production) |

## Required environment variables

These live in the **Vercel project** (Settings → Environment Variables), pulled at
build time by `vercel pull`:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Server (API functions) | Gemini calls; never exposed to the browser |
| `VITE_CONVEX_URL` | Build (client) | Convex deployment URL the frontend connects to |
| `VITE_CONVEX_SITE_URL` | Build (client) | Convex HTTP actions site URL (if used) |

## Manual deploy (fallback)

```bash
# Backend
CONVEX_DEPLOY_KEY=... npx convex deploy -y

# Frontend + API
vercel pull --yes --environment=production --token=$VERCEL_TOKEN
vercel build --prod --token=$VERCEL_TOKEN
vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

## Local development

```bash
npm install
# .env.local needs GEMINI_API_KEY, CONVEX_DEPLOYMENT, VITE_CONVEX_URL
npm run dev:vercel   # frontend + API functions together
npx convex dev       # run Convex backend locally (separate terminal)
```

## Troubleshooting

- **Frontend can't reach Convex** — confirm `VITE_CONVEX_URL` is set in Vercel and
  that `convex deploy` ran (check the `cd.yml` run logs).
- **API 500s** — verify `GEMINI_API_KEY` is set in the Vercel project (Server scope).
- **CD fails at Convex step** — `CONVEX_DEPLOY_KEY` is missing or scoped to the wrong
  deployment.

## Security

1. Never commit API keys — `.env.local` is gitignored.
2. `GEMINI_API_KEY` stays server-side (Vercel functions only).
3. Rotate `VERCEL_TOKEN` / `CONVEX_DEPLOY_KEY` if exposed.
