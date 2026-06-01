import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { ConvexClientProvider } from './ConvexClientProvider';
import App from './App';
import SharedChatView from './components/SharedChatView';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// A ?share=<token> link opens the read-only shared view (no auth bootstrap).
const shareId = new URLSearchParams(window.location.search).get('share');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConvexClientProvider>
        {shareId ? <SharedChatView shareId={shareId} /> : <App />}
      </ConvexClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
