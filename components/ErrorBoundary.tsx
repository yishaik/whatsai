import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// App-wide safety net. Without this, any error thrown during render (e.g. a
// failed Convex query) unmounts the whole tree and leaves a blank white screen.
// Here we catch it, keep something on screen, and show what went wrong.
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="h-[100dvh] w-screen bg-chat-bg text-text-primary flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-light">Something went wrong</h1>
        <p className="text-text-secondary max-w-md">
          The app hit an unexpected error and couldn’t continue. Reloading usually fixes it.
        </p>
        <pre className="max-w-full overflow-auto text-xs text-red-400 bg-black/30 rounded-md p-3 whitespace-pre-wrap break-words">
          {this.state.error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-accent-green text-white px-5 py-2 hover:bg-opacity-90 transition"
        >
          Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
