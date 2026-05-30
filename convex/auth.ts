import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import Google from "@auth/core/providers/google";

// Google reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the Convex deployment
// environment — these must be set (on each deployment) before this is deployed,
// or Google sign-in will fail at runtime.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Anonymous gives every visitor an identity with zero friction, preserving
  // the "just land and chat" experience. Signing in with Google links to and
  // upgrades the same account.
  providers: [Anonymous, Google],
});
