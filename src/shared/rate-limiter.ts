import { redis } from "@/config/redis";

/**
 * Fixed-window counter rate limiter backed by Redis. Returns whether the action is
 * allowed and increments atomically; the key's TTL is set only on first increment.
 */
export async function checkRateLimit(
  key: string,
  windowSeconds: number,
  maxAttempts: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  if (count > maxAttempts) {
    const ttl = await redis.ttl(key);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(ttl, 1) };
  }
  return { allowed: true, remaining: Math.max(0, maxAttempts - count), retryAfterSeconds: 0 };
}

export async function getCooldownRemaining(key: string): Promise<number> {
  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 0;
}

export async function setCooldown(key: string, seconds: number): Promise<void> {
  await redis.set(key, "1", "EX", seconds);
}
