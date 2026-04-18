# Run and deploy your AI Studio app

This project is a Vite + React web application that allows users to chat with AI personas. It now uses server-side API routes for Gemini calls so secrets stay on the server during local development and on Vercel.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create a `.env.local` file in the project root with:
   `GEMINI_API_KEY=your_api_key`
3. Start the full app with Vercel's local dev server:
   `npm run dev:vercel`

This runs the frontend and the `/api/*` serverless endpoints together.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Set the project environment variable:
   `GEMINI_API_KEY=your_api_key`
3. Deploy.

Vercel should detect the project as a Vite application and build it with:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

## Available scripts

- `npm run dev`: Runs the Vite frontend only.
- `npm run dev:vercel`: Runs the full app locally through `vercel dev` so both the frontend and API routes are available.
- `npm run build`: Builds the frontend for production into `dist`.
- `npm run preview`: Serves the built frontend locally for static preview only.
- `npm run start`: Serves the built frontend with Express.

## Project structure

```text
.
├── api
│   ├── avatar.ts
│   ├── group-avatar.ts
│   └── persona-response.ts
├── .env.local
├── .gitignore
├── App.tsx
├── components
│   ├── Avatar.tsx
│   ├── ChatList.tsx
│   ├── ChatView.tsx
│   ├── CreateChatModal.tsx
│   ├── EditChatModal.tsx
│   ├── MessageBubble.tsx
│   ├── PersonaManager.tsx
│   ├── SourceViewerModal.tsx
│   └── StorageManager.tsx
├── constants.ts
├── data
│   └── defaultPersonas.ts
├── hooks
│   └── useLocalStorage.ts
├── index.html
├── index.tsx
├── package.json
├── README.md
├── server.js
├── services
│   └── geminiService.ts
├── tsconfig.json
├── types.ts
└── vite.config.ts
```

## Architecture

- The React frontend calls `/api/persona-response`, `/api/avatar`, and `/api/group-avatar`.
- Those API routes run server-side and use `GEMINI_API_KEY`.
- This keeps the Gemini key out of the browser bundle.

## Notes

- `GEMINI_API_KEY` is the only environment variable you need for Gemini.
- `npm run preview` and `npm run start` do not emulate Vercel Functions. Use `npm run dev:vercel` for full local functionality.
