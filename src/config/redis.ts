import Redis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

redis.on("connect", () => {
  logger.info("Redis connected");
});

export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
}
