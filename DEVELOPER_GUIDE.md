# AI Persona Chat — Developer Guide

## Overview

AI Persona Chat is a Vite + React + TypeScript application for running multi-persona conversations in a WhatsApp-style interface.

The app stores personas, chat rooms, and message history in `localStorage`. AI responses and avatar generation are handled server-side through Vercel Functions so the Gemini API key never needs to be shipped to the browser.

## Current Architecture

```text
Browser UI (React)
  ├── App state and localStorage
  ├── Chat UI and persona management
  └── services/geminiService.ts
           │
           └── fetch('/api/*')
                  │
                  ├── /api/persona-response
                  ├── /api/avatar
                  └── /api/group-avatar
                           │
                           └── Google Gemini / Imagen
```

## Tech Stack

- React 19
- TypeScript 5
- Vite 6
- Google GenAI SDK (`@google/genai`)
- Vercel Functions for server-side AI access
- Browser `localStorage` for persistence

## Key Directories

```text
api/                    Vercel serverless functions
components/             UI components
hooks/                  Reusable hooks
services/               Browser-side service wrappers
data/                   Default personas
App.tsx                 Main stateful application shell
types.ts                Core types
constants.ts            Shared constants
vite.config.ts          Frontend build configuration
```

## How AI Calls Work

### Browser layer
`services/geminiService.ts` no longer initializes Gemini directly. It now sends `POST` requests to:

- `/api/persona-response`
- `/api/avatar`
- `/api/group-avatar`

This keeps the browser bundle free of API secrets.

### Server layer
The `api/` directory contains the Gemini integrations:

- `api/persona-response.ts` generates in-character persona replies
- `api/avatar.ts` generates persona avatars
- `api/group-avatar.ts` generates group chat avatars

Each function reads:

```env
GEMINI_API_KEY=your_key_here
```

## Local Development

### Prerequisites

- Node.js
- npm
- Gemini API key

### Setup

```bash
npm install
```

Create `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Available scripts

```bash
npm run dev          # Vite frontend only
npm run dev:vercel   # Full app: frontend + /api routes
npm run build        # Production frontend build
npm run preview      # Static preview of dist/
npm run start        # Static Express server for dist/
```

Use `npm run dev:vercel` when testing persona replies or avatar generation locally, because the AI routes live in `api/`.

## Deployment

### Recommended target

Deploy to Vercel.

### Required environment variable

```env
GEMINI_API_KEY=your_production_key
```

### Expected Vercel settings

- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

## Data Model

### Persona

```ts
interface Persona {
  id: string;
  name: string;
  avatar: string;
  prompt: string;
  canSearch?: boolean;
}
```

### Message

```ts
interface Message {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
  sources?: Source[];
}
```

### ChatRoom

```ts
interface ChatRoom {
  id: string;
  topic: string;
  avatar?: string;
  personaIds: string[];
  messages: Message[];
}
```

## Important Implementation Notes

### 1. Secrets
Never expose `GEMINI_API_KEY` through Vite env injection or `VITE_*` variables for this app.

### 2. Browser persistence
All chats and personas are stored locally in the browser. Clearing browser storage removes user data.

### 3. Preview mode
`npm run preview` and `npm run start` serve static assets only. They do not emulate Vercel Functions.

### 4. Error handling
Avatar generation can fail due to safety filters or API errors. The UI already falls back to default avatars when needed.

## Suggested Next Improvements

- Add rate limiting for `/api/*`
- Add structured logging around AI calls
- Add request validation for function payloads
- Add automated tests for browser service wrappers and API routes
- Add export / import for local chat data
- Add optional backend persistence for cross-device sync

## Troubleshooting

### Persona replies fail locally
Use `npm run dev:vercel`, not `npm run dev`.

### API key errors
Check that `.env.local` contains `GEMINI_API_KEY` and that the key has Gemini / Imagen access.

### Build issues
The frontend build is handled by Vite. The previous browser-side Gemini env injection has been removed, so frontend builds should no longer depend on secret substitution.
