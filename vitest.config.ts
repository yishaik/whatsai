import { defineConfig } from "vitest/config";

// Pure-logic unit tests run in a Node environment (no DOM, no filesystem). The
// memory engine under test is the same one the serverless Convex path uses, so
// these exercise the production retrieval code. The Convex integration test
// (tests/personaMemory.convex.test.ts) opts into the edge-runtime environment
// per-file via a `// @vitest-environment edge-runtime` docblock and runs the
// real Convex memory functions through convex-test.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // convex-test ships untranspiled ESM that Vite must inline to load.
    server: { deps: { inline: ["convex-test"] } },
  },
});
