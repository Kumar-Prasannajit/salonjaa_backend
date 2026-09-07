import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default("/api/v1"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_SSL: z
    .preprocess((value) => value === true || value === "true", z.boolean())
    .default(false),

  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be >= 32 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be >= 32 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),

  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_EXPIRY_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
  OTP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  DISABLE_AUTH_RATE_LIMITS: z
    .preprocess((value) => value === true || value === "true", z.boolean())
    .default(false),

  BOOKING_DEFAULT_EXPIRY_HOURS: z.coerce.number().int().positive().default(12),

  // Module 13 — a payment left PENDING forever (Razorpay widget closed without completing,
  // no webhook to tell us) permanently blocked create-order's "only a FAILED payment can be
  // retried" rule. This is a provisional numeric policy, same category as
  // BOOKING_DEFAULT_EXPIRY_HOURS — the client hasn't specified an exact timeout, chosen to be
  // generous enough for a real checkout attempt. Revisit if given a real number.
  PAYMENT_ORDER_EXPIRY_MINUTES: z.coerce.number().int().positive().default(20),

  // Module 14b — client's "approve then 15-minute payment window" rule (already referenced
  // as an unenforced gap since Module 6/7), now actually built. Same provisional-numeric
  // treatment as the other timing constants above: 15 minutes is the client's own stated
  // figure (docs/PROGRESS.md's Module 6 note), not a guess.
  BOOKING_PAYMENT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

  // Module 14 — httpOnly-cookie auth (see docs/PROGRESS.md). Cookies are scoped to this
  // domain only; cross-subdomain/cross-origin production deployments would need this set
  // explicitly (and SameSite=None+Secure instead of Lax) — out of scope for MVP's single-origin
  // local setup, flagged rather than guessed at.
  COOKIE_DOMAIN: z.string().optional(),

  // Razorpay: optional at boot (like SMTP) so the app still starts before keys are supplied —
  // the Payment module throws a clear runtime error if a payment endpoint is hit without them.
  // Only the client-driven create-order/verify flow is documented (frontend_handover.md); no
  // webhook receiver endpoint is built, so no webhook secret is needed here.
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),

  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().optional().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("Salonjaa <no-reply@salonjaa.com>"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      "Invalid environment configuration:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Environment validation failed. See logged field errors.");
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const authRateLimitsDisabled =
  !isProduction && env.DISABLE_AUTH_RATE_LIMITS;
