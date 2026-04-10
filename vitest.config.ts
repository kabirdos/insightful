import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: false,
    // Skip git worktrees and node_modules. Worktrees can hold stale
    // versions of test files from sibling branches and were polluting
    // the test run with false-positive failures.
    exclude: ["**/node_modules/**", "**/dist/**", ".worktrees/**"],
  },
});
