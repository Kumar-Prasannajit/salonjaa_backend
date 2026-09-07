import { Response } from "express";
import crypto from "crypto";
import { env, isProduction } from "@/config/env";

/**
 * Module 14 — httpOnly cookie auth (see docs/PROGRESS.md's "sessions don't survive a
 * reload" note in Salonjaa_Frontend's docs/KNOWN_BACKEND_LIMITATIONS.md). Tokens are still
 * returned in the JSON body too (frontend_handover.md's documented contract is unchanged,
 * additive only) — cookies are the new primary transport, JSON body stays for
 * Postman/API-client compatibility and as a fallback.
 *
 * accessToken/refreshToken cookies are httpOnly (never JS-readable, closes the XSS
 * token-theft surface the frontend's doc flagged) so a companion csrfToken cookie is
 * deliberately NOT httpOnly — the frontend reads it and echoes it back as an
 * X-CSRF-Token header on state-changing requests (double-submit pattern, see
 * csrf.middleware.ts). An attacker forging a cross-site request can't read that cookie
 * (Same-Origin Policy), so can't produce the matching header.
 */

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";
export const CSRF_COOKIE = "csrfToken";

const ACCESS_TOKEN_MAX_AGE_MS = parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN);
const REFRESH_TOKEN_MAX_AGE_MS = env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 15 * 60 * 1000; // fallback: 15m, matches the documented default
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "s" | "m" | "h" | "d"];
  return value * unitMs;
}

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction, // Secure cookies require HTTPS — off in local http dev, on in prod
    sameSite: "lax" as const,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, { ...baseCookieOptions(), maxAge: ACCESS_TOKEN_MAX_AGE_MS });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, { ...baseCookieOptions(), maxAge: REFRESH_TOKEN_MAX_AGE_MS });

  const csrfToken = crypto.randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...baseCookieOptions(),
    httpOnly: false, // must be JS-readable so the frontend can echo it back as a header
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

/** Refresh only rotates the access token — leave the refresh/csrf cookies as they are. */
export function setAccessTokenCookie(res: Response, accessToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, { ...baseCookieOptions(), maxAge: ACCESS_TOKEN_MAX_AGE_MS });
}

export function clearAuthCookies(res: Response): void {
  const opts = baseCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, opts);
  res.clearCookie(REFRESH_TOKEN_COOKIE, opts);
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false });
}
