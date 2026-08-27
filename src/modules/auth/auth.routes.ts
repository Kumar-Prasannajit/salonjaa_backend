import { Router } from "express";
import { AuthController } from "@/modules/auth/auth.controller";
import { validate } from "@/middleware/validate.middleware";
import { rateLimit } from "@/middleware/rate-limit.middleware";
import { requireAuth } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from "@/modules/auth/auth.validator";
import { env } from "@/config/env";

const router = Router();
const controller = new AuthController();

router.post(
  "/send-otp",
  rateLimit({
    windowSeconds: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: env.AUTH_RATE_LIMIT_MAX,
    keyPrefix: "ratelimit:auth:ip",
  }),
  validate({ body: sendOtpSchema }),
  asyncHandler((req, res) => controller.sendOtp(req, res))
);

router.post(
  "/verify-otp",
  rateLimit({
    windowSeconds: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: env.AUTH_RATE_LIMIT_MAX,
    keyPrefix: "ratelimit:auth:ip",
  }),
  validate({ body: verifyOtpSchema }),
  asyncHandler((req, res) => controller.verifyOtp(req, res))
);

router.post(
  "/refresh-token",
  validate({ body: refreshTokenSchema }),
  asyncHandler((req, res) => controller.refreshToken(req, res))
);

router.post("/logout", requireAuth, asyncHandler((req, res) => controller.logout(req, res)));

export default router;
