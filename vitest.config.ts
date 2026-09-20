import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: [
      "tests/**/*.spec.ts",
      "tests/**/*.test.ts",
      "tests/**/*.spec.tsx",
      "tests/**/*.test.tsx",
    ],
    environment: "node",
  },
});
