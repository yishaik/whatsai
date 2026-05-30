import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ReactNode } from "react";

const convexUrl = (import.meta as any).env?.VITE_CONVEX_URL || "";

if (!convexUrl) {
  console.error("Missing VITE_CONVEX_URL environment variable");
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // ConvexAuthProvider wires the auth token into every Convex request and
  // exposes useAuthActions()/useConvexAuth() to the tree.
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
