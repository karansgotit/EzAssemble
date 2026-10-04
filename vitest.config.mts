import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // `import "server-only"` throws outside Next's server build; tests of pipeline/ get the no-op.
      { find: /^server-only$/, replacement: `${root}node_modules/server-only/empty.js` },
      { find: /^@\//, replacement: root },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "reference/**", ".next/**"],
  },
});
