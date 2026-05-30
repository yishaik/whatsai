import React, { useState } from 'react';
import { useConvexAuth, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../convex/_generated/api';
import Avatar from './Avatar';

// Small multicolor Google "G".
const GoogleGlyph: React.FC = () => (
  <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

// Sign-in / account control. Anonymous visitors see a prompt to sign in with
// Google (so chats persist across devices and private rooms become possible);
// signed-in users see their account with a sign-out button.
const AuthControl: React.FC = () => {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const user = useQuery(api.chat.getCurrentUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn('google');
    } catch (e) {
      // Google is wired but inert until OAuth credentials are configured on the
      // deployment; surface a friendly note rather than a raw error.
      console.error('Google sign-in failed:', e);
      setError('Google sign-in isn’t available yet.');
      setBusy(false);
    }
  };

  if (isLoading || !isAuthenticated || user === undefined) {
    return <div className="p-3 text-xs text-text-secondary border-t border-item-hover-bg">Connecting…</div>;
  }

  if (user && !user.isAnonymous) {
    return (
      <div className="p-3 flex items-center gap-3 border-t border-item-hover-bg">
        <Avatar src={user.image ?? undefined} name={user.name ?? user.email ?? 'You'} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate">{user.name ?? 'Signed in'}</p>
          {user.email && <p className="text-xs text-text-secondary truncate">{user.email}</p>}
        </div>
        <button
          onClick={() => signOut()}
          className="text-xs text-text-secondary hover:text-text-primary flex-shrink-0"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-item-hover-bg space-y-2">
      <p className="text-xs text-text-secondary">Sign in to save your chats and create private rooms.</p>
      <button
        onClick={handleGoogle}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-white text-gray-800 font-medium text-sm py-2 px-3 rounded-md hover:bg-gray-100 disabled:opacity-60"
      >
        <GoogleGlyph />
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};

export default AuthControl;
