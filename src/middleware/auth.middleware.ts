import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/config/jwt";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors";
import { redis } from "@/config/redis";
import { CSRF_COOKIE } from "@/shared/cookies";

export interface AuthenticatedUser {
  id: string;
  roles: string[];
  jti: string;
}

// Module 14: a request can now authenticate via either a Bearer header (existing API
// clients/Postman) or an httpOnly accessToken cookie (browser frontend). Only the cookie
// path is CSRF-exposed (browsers attach cookies automatically to any site's request; a
// Bearer header can only be set by JS that already had to read the token from somewhere
// JS-readable, which a cross-site attacker can't do) — recorded per-request so the
// mutating-method CSRF check below only applies when it's actually needed.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authMethod?: "bearer" | "cookie";
    }
  }
}

function extractToken(req: Request): { token: string; method: "bearer" | "cookie" } | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return { token: header.slice("Bearer ".length).trim(), method: "bearer" };
  }
  const cookieToken = req.cookies?.accessToken;
  if (cookieToken) {
    return { token: cookieToken, method: "cookie" };
  }
  return null;
}

/**
 * Double-submit CSRF check for cookie-authenticated, state-changing requests. A Bearer
 * request is never checked (browsers don't auto-attach Authorization headers, so it isn't
 * forgeable cross-site the way a cookie-backed request is).
 */
function assertCsrfSafe(req: Request): void {
  if (!MUTATING_METHODS.has(req.method)) return;
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers["x-csrf-token"];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new ForbiddenError("Missing or invalid CSRF token");
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const extracted = extractToken(req);
    if (!extracted) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }
    const payload = verifyAccessToken(extracted.token);

    // Optional immediate-logout denylist check (session:revoked:{jti}).
    const revoked = await redis.get(`session:revoked:${payload.jti}`);
    if (revoked) {
      throw new UnauthorizedError("Session has been revoked");
    }

    if (extracted.method === "cookie") {
      assertCsrfSafe(req);
    }

    req.user = { id: payload.sub, roles: payload.roles, jti: payload.jti };
    req.authMethod = extracted.method;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      next(err);
      return;
    }
    next(new UnauthorizedError("Invalid or expired access token"));
  }
}

/** Attaches req.user if a valid token is present but does not reject the request otherwise. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const extracted = extractToken(req);
  if (!extracted) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(extracted.token);
    req.user = { id: payload.sub, roles: payload.roles, jti: payload.jti };
    req.authMethod = extracted.method;
  } catch {
    // Ignore invalid token on optional-auth routes.
  }
  next();
}
