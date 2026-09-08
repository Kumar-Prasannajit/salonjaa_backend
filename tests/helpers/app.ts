import { createApp } from "@/app";

// One Express app instance per test file — createApp() never calls .listen(), so supertest
// drives it in-process (no real port bound, no separate server process to manage).
export const app = createApp();
