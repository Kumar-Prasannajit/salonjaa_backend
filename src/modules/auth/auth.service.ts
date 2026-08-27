import { AuthRepository } from "@/modules/auth/auth.repository";
import {
  AuthUserDTO,
  RefreshTokenResult,
  VerifyOtpResult,
} from "@/modules/auth/auth.types";
import { otpProvider } from "@/providers/otp";
import { generateNumericOtp, sha256Hex } from "@/shared/crypto";
import { addSeconds, addDays } from "@/shared/time";
import { TooManyRequestsError, UnauthorizedError } from "@/shared/errors";
import {
  checkRateLimit,
  getCooldownRemaining,
  setCooldown,
} from "@/shared/rate-limiter";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/config/jwt";
import { authRateLimitsDisabled, env } from "@/config/env";
import { ROLE_NAMES, OTP_PURPOSES } from "@/shared/constants";
import { logger } from "@/shared/logger";
import bcrypt from "bcryptjs";

const OTP_PURPOSE = OTP_PURPOSES.LOGIN; // send-otp/verify-otp is a single login-or-register flow

export class AuthService {
  constructor(private readonly repo: AuthRepository = new AuthRepository()) {}

  async sendOtp(email: string): Promise<void> {
    const cooldownKey = `otp:email:${OTP_PURPOSE}:${email}`;
    if (!authRateLimitsDisabled) {
      const cooldownRemaining = await getCooldownRemaining(cooldownKey);
      if (cooldownRemaining > 0) {
        throw new TooManyRequestsError(
          "Please wait before requesting another OTP",
          {
            retryAfterSeconds: cooldownRemaining,
          },
        );
      }

      const rateLimitKey = `ratelimit:otp:email:${email}`;
      const rate = await checkRateLimit(
        rateLimitKey,
        env.OTP_RATE_LIMIT_WINDOW_SECONDS,
        env.OTP_RATE_LIMIT_MAX,
      );
      if (!rate.allowed) {
        throw new TooManyRequestsError(
          "Too many OTP requests, try again later",
          {
            retryAfterSeconds: rate.retryAfterSeconds,
          },
        );
      }
    }

    const code = generateNumericOtp(env.OTP_LENGTH);
    const otpHash = await bcrypt.hash(code, 10);
    const expiresAt = addSeconds(new Date(), env.OTP_EXPIRY_SECONDS);

    await this.repo.invalidateActiveOtps(email, OTP_PURPOSE);
    await this.repo.createOtp(email, OTP_PURPOSE, otpHash, expiresAt);
    if (!authRateLimitsDisabled) {
      await setCooldown(cooldownKey, env.OTP_RESEND_COOLDOWN_SECONDS);
    }

    try {
      await otpProvider.deliver(email, code, OTP_PURPOSE);
    } catch (err) {
      logger.error(
        { err, email },
        "Failed to deliver OTP, but OTP record was created",
      );
    }
  }

  async verifyOtp(
    email: string,
    submittedOtp: string,
  ): Promise<VerifyOtpResult> {
    const otp = await this.repo.findActiveOtp(email, OTP_PURPOSE);
    if (!otp) {
      throw new UnauthorizedError(
        "No active OTP for this email. Please request a new one.",
      );
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("OTP has expired. Please request a new one.");
    }
    if (otp.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedError(
        "Maximum verification attempts exceeded. Please request a new OTP.",
      );
    }

    const matches = await bcrypt.compare(submittedOtp, otp.otpHash);
    if (!matches) {
      await this.repo.bumpOtpAttempts(otp.id, otp.attempts + 1);
      throw new UnauthorizedError("Invalid OTP");
    }

    await this.repo.markOtpVerified(otp.id);

    let user = await this.repo.findUserByEmail(email);
    if (!user) {
      user = await this.repo.createUserWithDefaultRole(
        email,
        ROLE_NAMES.CUSTOMER,
      );
    } else if (!user.emailVerified) {
      await this.repo.markEmailVerified(user.id);
    }

    const roleNames = await this.repo.getUserRoleNames(user.id);
    const session = await this.issueSession(user.id, roleNames);

    const dto: AuthUserDTO = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: roleNames,
    };

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: dto,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResult> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const session = await this.repo.findActiveRefreshTokenById(payload.sid);
    if (!session) {
      throw new UnauthorizedError("Refresh session not found or revoked");
    }

    const tokenHash = sha256Hex(refreshToken);
    if (session.tokenHash !== tokenHash) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    const user = await this.repo.findUserById(payload.sub);
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedError("Account is not active");
    }

    const roleNames = await this.repo.getUserRoleNames(user.id);
    const accessToken = signAccessToken({
      sub: user.id,
      roles: roleNames,
      jti: sha256Hex(`${user.id}:${Date.now()}`),
    });
    return { accessToken };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = verifyRefreshToken(refreshToken);
      await this.repo.revokeRefreshToken(payload.sid);
    } catch {
      // Logout is idempotent/best-effort: an already-invalid token is not an error.
    }
  }

  private async issueSession(userId: string, roles: string[]) {
    const refreshTokenPlaceholder = sha256Hex(
      `${userId}:${Date.now()}:placeholder`,
    );
    const row = await this.repo.createRefreshToken(
      userId,
      refreshTokenPlaceholder,
      addDays(new Date(), env.JWT_REFRESH_EXPIRES_IN_DAYS),
    );

    const refreshToken = signRefreshToken({ sub: userId, sid: row.id });
    const tokenHash = sha256Hex(refreshToken);
    await this.repo.setRefreshTokenHash(row.id, tokenHash);

    const accessToken = signAccessToken({
      sub: userId,
      roles,
      jti: sha256Hex(`${userId}:${Date.now()}`),
    });
    return { accessToken, refreshToken };
  }
}
