import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
// Google is wired but disabled until OAuth credentials are configured. To
// enable it, register a Google OAuth app and set AUTH_GOOGLE_ID /
// AUTH_GOOGLE_SECRET on the Convex deployment, then uncomment the two lines
// below (the import and the `Google` entry in `providers`).
// import Google from "@auth/core/providers/google";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Anonymous gives every visitor an identity with zero friction, preserving
  // the "just land and chat" experience. Signing in with Google later links to
  // and upgrades the same account.
  providers: [
    Anonymous,
    // Google,
  ],
});
