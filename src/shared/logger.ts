import pino from "pino";
import { env, isProduction } from "@/config/env";

/**
 * Central structured logger. Redacts sensitive fields at the transport level so
 * accidental inclusion of tokens/OTPs/passwords in log objects never reaches output.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "*.accessToken",
      "*.refreshToken",
      "*.token",
      "*.otp",
      "*.otpHash",
      "*.password",
      "*.signature",
      "req.body.otp",
      "req.body.password",
    ],
    censor: "[REDACTED]",
  },
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", singleLine: false },
      },
});

export type Logger = typeof logger;
