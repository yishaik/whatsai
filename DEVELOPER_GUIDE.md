# AI Persona Chat - Developer Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [Core Components](#core-components)
6. [Services](#services)
7. [State Management](#state-management)
8. [API Integration](#api-integration)
9. [Development Workflow](#development-workflow)
10. [Testing](#testing)
11. [Building and Deployment](#building-and-deployment)
12. [Common Tasks](#common-tasks)
13. [Troubleshooting](#troubleshooting)
14. [Contributing](#contributing)

## Project Overview

AI Persona Chat is a web application that enables users to have AI-powered conversations with multiple personas in a group chat environment. Built with React, TypeScript, and Vite, it leverages Google's Gemini AI API to generate contextual responses from different AI personalities.

### Key Features
- **Multiple AI Personas**: Create and manage AI personas with unique personalities
- **Group Chat**: Engage multiple personas in a single conversation
- **AI Avatar Generation**: Automatically generate avatars for personas using Imagen
- **Web Search**: Certain personas can search the web for real-time information
- **Local Storage**: All data persists locally in the browser
- **WhatsApp-like UI**: Familiar and intuitive chat interface

### Technology Stack
- **Frontend Framework**: React 19.1.0
- **Language**: TypeScript 5.7.2
- **Build Tool**: Vite 6.2.0
- **Styling**: Tailwind CSS (via CDN)
- **AI Services**: Google Gemini API (@google/genai)
- **State Management**: React hooks with local storage

## Architecture

### High-Level Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser UI    │────▶│  React App       │────▶│  Gemini API     │
│  (Components)   │     │  (State/Logic)   │     │  (AI Service)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────────┐
         └─────────────▶│  Local Storage   │
                        │  (Persistence)   │
                        └──────────────────┘
```

### Data Flow
1. User sends a message in the chat
2. Message is stored in local state and persisted to localStorage
3. AI personas in the chat receive the message history
4. Each persona generates a response using Gemini API
5. Responses are displayed with typing indicators
6. All messages are persisted locally

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd whatsai
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Note: The Vite configuration automatically loads this environment variable and makes it available as `process.env.API_KEY` in the application.

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Quick Start Example

Here's a quick example of how to add a new feature to the chat:

1. **Add a new message type** (e.g., system messages):
```typescript
// In types.ts
export interface Message {
  // ... existing fields
  type?: 'user' | 'ai' | 'system';
}
```

2. **Update the message display**:
```typescript
// In MessageBubble.tsx
if (message.type === 'system') {
  return <SystemMessage text={message.text} />;
}
```

3. **Add the functionality**:
```typescript
// In App.tsx
const addSystemMessage = (chatId: string, text: string) => {
  addMessageToChat(chatId, {
    authorId: 'system',
    text,
    type: 'system',
    sources: []
  });
};
```

## Project Structure

```
whatsai/
├── components/           # React components
│   ├── Avatar.tsx       # Avatar display component
│   ├── ChatList.tsx     # Chat room list sidebar
│   ├── ChatView.tsx     # Main chat interface
│   ├── CreateChatModal.tsx  # Modal for creating new chats
│   ├── icons.tsx        # SVG icon components
│   ├── MessageBubble.tsx    # Individual message display
│   ├── PersonaManager.tsx   # Persona CRUD interface
│   └── SourceViewerModal.tsx # Modal for viewing web sources
├── data/
│   └── defaultPersonas.ts   # Pre-configured personas
├── hooks/
│   └── useLocalStorage.ts   # Custom hook for localStorage
├── services/
│   └── geminiService.ts     # Gemini API integration
├── App.tsx              # Main application component
├── constants.ts         # Application constants
├── index.tsx           # Application entry point
├── types.ts            # TypeScript type definitions
├── vite.config.ts      # Vite configuration
└── tsconfig.json       # TypeScript configuration
```

## Core Components

### App.tsx
The main application component that:
- Manages global state for personas and chat rooms
- Handles routing between different views
- Coordinates data flow between components

### ChatView.tsx
The primary chat interface component that:
- Displays messages in a conversation
- Handles user input and message sending
- Triggers AI responses from personas
- Shows typing indicators
- Manages source viewing for web search results

Key features:
```typescript
// Automatic AI responses after user messages
const triggerAIResponses = useCallback(async (lastMessage: Message) => {
  if (lastMessage.authorId !== USER_ID) return;
  // Each persona responds sequentially with delays
});
```

### PersonaManager.tsx
Manages AI persona creation and editing:
- Create new personas with name, personality prompt
- Enable/disable web search capability
- Edit existing personas
- Handle avatar generation errors gracefully

### ChatList.tsx
Sidebar component showing:
- List of all chat rooms
- Last message preview
- Active chat highlighting
- Navigation between chats

### MessageBubble.tsx
Individual message display with:
- Different styling for user/AI messages
- Avatar display for AI personas
- Source cards for web search results
- Timestamp formatting

## Services

### geminiService.ts
Handles all Gemini API interactions:

#### generatePersonaResponse()
Generates AI responses based on persona personality:
```typescript
export const generatePersonaResponse = async (
  persona: Persona,
  chatTopic: string,
  history: Message[],
  allPersonasInChat: Persona[],
  personasMap: { [id: string]: Persona }
): Promise<{ text: string; sources: Source[] }>
```

Features:
- Formats chat history for context
- Applies persona-specific system instructions
- Handles web search when enabled
- Extracts and formats sources from responses
- Error handling with fallback messages

#### generateAvatar()
Creates AI-generated avatars for personas:
```typescript
export const generateAvatar = async (
  name: string, 
  prompt: string
): Promise<string>
```

Features:
- Uses Imagen API for avatar generation
- Returns base64-encoded PNG images
- Comprehensive error handling for safety blocks
- Fallback to default avatar on failure

## State Management

### Local State
The application uses React's built-in state management:
- `useState` for component-level state
- `useMemo` for computed values
- `useCallback` for memoized functions

### Persistent Storage
Custom `useLocalStorage` hook provides:
- Automatic persistence to localStorage
- Type-safe storage with TypeScript generics
- Initial value support
- Synchronization across tabs
- Error handling for JSON parsing

Implementation:
```typescript
export const useLocalStorage = <T,>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(() => {
    return getStorageValue(key, defaultValue);
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};
```

Usage example:
```typescript
const [personas, setPersonas] = useLocalStorage<Persona[]>('personas', defaultPersonas);
```

### Data Models

#### Persona
```typescript
interface Persona {
  id: string;
  name: string;
  avatar: string;  // base64 data URL
  prompt: string;  // personality description
  canSearch?: boolean;  // web search capability
}
```

#### Message
```typescript
interface Message {
  id: string;
  authorId: string;  // 'user' or persona.id
  text: string;
  timestamp: number;
  sources?: Source[];  // web search results
}
```

#### ChatRoom
```typescript
interface ChatRoom {
  id: string;
  topic: string;
  personaIds: string[];
  messages: Message[];
}
```

## API Integration

### Environment Setup
The application uses Vite's environment variable handling:

1. **Vite Configuration** (`vite.config.ts`):
```typescript
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    }
  };
});
```

2. **API Initialization**:
```typescript
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
```

3. **Environment Variables**:
- Development: `.env.local`
- Production: Set in hosting platform
- Never commit `.env` files to version control

### Model Configuration
```typescript
const config = {
  model: "gemini-2.5-flash",
  systemInstruction: systemInstruction,
  temperature: 0.9,
  topP: 1,
  topK: 1,
  tools: persona.canSearch ? [{googleSearch: {}}] : undefined
};
```

### Error Handling
The service implements comprehensive error handling:
- Safety policy violations
- Network errors
- API rate limits
- Invalid responses

## Development Workflow

### Running Locally
```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Style
- Use TypeScript for all new code
- Follow React best practices (hooks, functional components)
- Implement proper error boundaries
- Use semantic HTML elements
- Follow accessibility guidelines

### Component Development
1. Create new components in `components/` directory
2. Define TypeScript interfaces for props
3. Use Tailwind classes for styling
4. Implement proper error handling
5. Add loading states where appropriate

Example component structure:
```typescript
interface MyComponentProps {
  // Define props
}

const MyComponent: React.FC<MyComponentProps> = ({ props }) => {
  // Component logic
  return (
    // JSX
  );
};

export default MyComponent;
```

## Testing

Currently, the project doesn't include a testing framework. To add testing:

1. Install testing dependencies:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

2. Add test script to package.json:
```json
"scripts": {
  "test": "vitest"
}
```

3. Create test files alongside components:
```typescript
// ChatView.test.tsx
import { render, screen } from '@testing-library/react';
import ChatView from './ChatView';

describe('ChatView', () => {
  it('renders welcome message when no chat is selected', () => {
    render(<ChatView chatRoom={null} ... />);
    expect(screen.getByText(/Welcome to AI Persona Chat/i)).toBeInTheDocument();
  });
});
```

## Building and Deployment

### Production Build
```bash
npm run build
```

This creates an optimized build in the `dist/` directory.

### Deployment Options

#### Static Hosting (Recommended)
Deploy to any static hosting service:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

#### Environment Variables
For production, set environment variables:
- `GEMINI_API_KEY`: Your production API key

#### Security Considerations
- Never commit API keys to version control
- Use environment variables for sensitive data
- Implement rate limiting for API calls
- Consider adding authentication for multi-user scenarios

## Common Tasks

### Default Personas
The application comes with several pre-configured personas:
- **Albert Einstein**: Physics and philosophy discussions
- **Elon Musk**: Technology and future vision (with web search)
- **Benjamin Netanyahu**: Israeli politics and security (with web search)
- **Yair Golan**: Israeli politics from center-left perspective (with web search)
- **The God of the Old Testament**: Biblical and theological discussions
- **Rambam (Maimonides)**: Jewish philosophy and law
- **Yahya Sinwar**: Palestinian perspective (with web search)
- **Woke College Student**: Social justice activism (with web search)
- **Donald Trump**: American politics (with web search)

### Adding a New Persona Type
1. Update the `Persona` interface if needed
2. Add default personas in `data/defaultPersonas.ts`
3. Implement any special behavior in `generatePersonaResponse()`

Example:
```typescript
const newPersona: Persona = {
  id: 'default-shakespeare',
  name: 'William Shakespeare',
  avatar: DEFAULT_AVATAR,
  prompt: "You are William Shakespeare. Speak in iambic pentameter when possible...",
  canSearch: false
};
```

### Customizing the UI Theme
Edit the Tailwind configuration in `index.html`:
```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        // Add or modify colors
      }
    }
  }
}
```

### Adding New Features
1. Plan the feature and its data requirements
2. Update TypeScript types if needed
3. Create new components or modify existing ones
4. Update state management logic
5. Test thoroughly with different scenarios

### Implementing Message Features
Examples of features you could add:
- Message editing
- Message deletion
- Reactions/emojis
- File attachments
- Voice messages

## Troubleshooting

### Common Issues

#### API Key Not Working
- Verify the key is correctly set in `.env.local`
- Check API key permissions in Google Cloud Console
- Ensure the key has access to Gemini and Imagen APIs

#### Avatar Generation Fails
- Check for content policy violations in persona names/prompts
- Verify Imagen API is enabled for your project
- Default avatar will be used as fallback

#### Messages Not Persisting
- Check browser's localStorage limits
- Verify localStorage is not disabled
- Clear localStorage if corrupted: `localStorage.clear()`

#### Build Errors
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npx tsc --noEmit`
- Verify all imports are correct

### Debug Mode
Add debug logging by setting in browser console:
```javascript
localStorage.setItem('debug', 'true');
```

## Contributing

### Code Contribution Guidelines

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/ai-persona-chat.git
   cd ai-persona-chat
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow existing code style
   - Add TypeScript types for new features
   - Update documentation as needed
   - Test your changes thoroughly

4. **Commit with Descriptive Messages**
   ```bash
   git commit -m "feat: add message editing capability"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format
Follow conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Build process or auxiliary tool changes

### Code Review Process
1. All code must be reviewed before merging
2. Address all feedback constructively
3. Ensure CI checks pass
4. Update documentation for new features

### Future Enhancements
Potential areas for contribution:
- Multi-language support
- Message search functionality
- Export chat history
- Custom theme support
- Mobile app version
- Real-time collaboration
- Backend integration for data persistence

---

For questions or support, please open an issue on GitHub or contact the maintainers. 