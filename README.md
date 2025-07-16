# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Developer Guide

### Project Overview

This project is a React-based web application that allows users to chat with an AI persona. It utilizes the Gemini API for its AI capabilities.

### Getting Started

1.  **Prerequisites**: Ensure you have Node.js installed on your system.
2.  **Installation**:
    - Clone the repository.
    - Install the dependencies by running `npm install` in the project's root directory.
3.  **Configuration**:
    - Create a `.env.local` file in the root directory.
    - Add your Gemini API key to the `.env.local` file as follows:
      ```
      GEMINI_API_KEY=your_api_key
      ```
4.  **Running the Application**:
    - Start the development server by running `npm run dev`.
    - Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

### Available Scripts

-   `npm run dev`: Starts the development server with hot module replacement.
-   `npm run build`: Builds the application for production.
-   `npm run preview`: Serves the production build locally for previewing.

### Project Structure

```
.
├── .env.local
├── .gitignore
├── App.tsx
├── components
│   ├── Avatar.tsx
│   ├── ChatList.tsx
│   ├── ChatView.tsx
│   ├── CreateChatModal.tsx
│   ├── icons.tsx
│   ├── MessageBubble.tsx
│   └── PersonaManager.tsx
├── constants.ts
├── hooks
│   └── useLocalStorage.ts
├── index.html
├── index.tsx
├── metadata.json
├── package.json
├── README.md
├── services
│   └── geminiService.ts
├── tsconfig.json
├── types.ts
└── vite.config.ts
```

### Dependencies

-   **@google/genai**: The official Google AI generative-core SDK for Node.js.
-   **react**: A JavaScript library for building user interfaces.
-   **react-dom**: Serves as the entry point to the DOM and server renderers for React.

### Dev Dependencies

-   **@types/node**: TypeScript definitions for Node.js.
-   **typescript**: A typed superset of JavaScript that compiles to plain JavaScript.
-   **vite**: A build tool that aims to provide a faster and leaner development experience for modern web projects.
