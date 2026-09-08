import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate test database (TEST_DATABASE_URL in .env) — never the dev DB. Migrations run once
// via globalSetup before any test file executes; env vars below are injected into every test
// worker process so importing src/config/env.ts (and everything downstream) picks up the test
// DB/Redis-db-index instead of dev values. See tests/global-setup.ts and CLAUDE.md's decision
// to keep this fully isolated from the dev DB used for manual verification.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres:adi131003@localhost:5432/salonjaa_test",
      DATABASE_SSL: "false",
      // Separate Redis DB index (not a separate server) so BullMQ queues used by tests never
      // share job data with the dev server's own queues on DB 0.
      REDIS_URL: "redis://localhost:6379/1",
      JWT_ACCESS_SECRET: "test-access-secret-please-be-at-least-32-chars",
      JWT_REFRESH_SECRET: "test-refresh-secret-please-be-at-least-32-chars",
      DISABLE_AUTH_RATE_LIMITS: "true",
      LOG_LEVEL: "silent",
    },
  },
});
