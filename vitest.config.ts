import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const fileEnvironment = loadEnv("test", process.cwd(), "");
for (const [name, value] of Object.entries(fileEnvironment)) {
  if (process.env[name] === undefined) {
    process.env[name] = value;
  }
}

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
    setupFiles: ["./vitest.setup.ts"],
  },
});
