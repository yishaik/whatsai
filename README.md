# AI Persona Chat

Build characters with distinct personalities and talk to them — one on one, or in a group chat where they also talk to each other.

**Live:** https://whatsai.yishaik.com

Most persona-chat demos are a system prompt and a text box. The interesting problems start right after that: what happens when five characters share a room, what one of them should still know about you next week, and what all of it costs. This is an attempt at those.

## What it does

- **Personas** — name, avatar, system prompt, optional web search, per-persona model override, and capability toggles (`services/skills.ts`).
- **Group chats** — several personas in one room. `maxResponders` caps how many reply to a given message; `riffRounds` lets them talk to *each other* for N rounds before handing back to you.
- **Long-term memory** — opt-in per persona. The character recalls durable facts about you before replying and distills new ones afterwards via a `[[MEMORY]]` token, over a MiniSearch index with its own recall, distillation and hygiene passes. It's the most tested part of the codebase (`memory/`, `tests/`).
- **Rolling summaries** — long chats get compacted so older context stays reachable without resending it every turn.
- **Voice** — live voice calls, transcription, and speech output.
- **Reminders** — parsed out of a persona's reply, persisted, and delivered by web push. Repeats hourly, daily, weekly or monthly.
- **Attachments, link previews, and full-text search** across chat history.
- **Sharing** — publish any chat as a read-only public link.
- **Usage dashboard** — input/output tokens and cost per model, because multi-persona rooms multiply requests fast.
- Installable **PWA** with push notifications.

## Stack

React 19 · Vite 6 · Tailwind on the front. **Convex** for database, auth, scheduling and realtime. Model calls go through serverless routes in `api/` against Google Gemini and OpenAI, so no provider key ever reaches the browser; moderation runs server-side on `api/moderate`.

## Run locally

**Prerequisites:** Node 20+, a Convex deployment, and at least one provider key.

```bash
npm install
cp .env.example .env.local      # fill in the values
npx convex dev                  # terminal 1
npm run dev:vercel              # terminal 2 — serves the app *and* the /api routes
```

`npm run dev` starts the Vite frontend alone. The `api/` routes won't be running, so persona replies will fail — use `dev:vercel`.

```bash
npm test          # vitest
npm run typecheck
```

Architecture notes are in [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md); shipping it is [DEPLOYMENT.md](./DEPLOYMENT.md).

## About the bundled personas

The defaults in `data/defaultPersonas.ts` include public figures, some of them living politicians. They exist to exercise tone, disagreement and turn-taking in group chats — they are prompt-driven caricatures, not endorsements, and not accurate representations of any real person. Delete or replace them if you'd rather start clean.

## License

MIT.
