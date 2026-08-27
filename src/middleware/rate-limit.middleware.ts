import { NextFunction, Request, Response } from "express";
import { TooManyRequestsError } from "@/shared/errors";
import { checkRateLimit } from "@/shared/rate-limiter";
import { authRateLimitsDisabled } from "@/config/env";

interface RateLimitOptions {
  windowSeconds: number;
  max: number;
  keyPrefix: string;
  /** Builds the discriminator (e.g. IP, email) appended to keyPrefix. Defaults to req.ip. */
  keyFn?: (req: Request) => string;
}

export function rateLimit(options: RateLimitOptions) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (authRateLimitsDisabled) {
      next();
      return;
    }

    const discriminator = options.keyFn
      ? options.keyFn(req)
      : (req.ip ?? "unknown");
    const key = `${options.keyPrefix}:${discriminator}`;
    const result = await checkRateLimit(
      key,
      options.windowSeconds,
      options.max,
    );
    if (!result.allowed) {
      next(
        new TooManyRequestsError("Too many requests, please try again later", {
          retryAfterSeconds: result.retryAfterSeconds,
        }),
      );
      return;
    }
    next();
  };
}
