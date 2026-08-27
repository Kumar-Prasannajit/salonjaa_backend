import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/config/jwt";
import { UnauthorizedError } from "@/shared/errors";
import { redis } from "@/config/redis";

export interface AuthenticatedUser {
  id: string;
  roles: string[];
  jti: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }
    const token = header.slice("Bearer ".length).trim();
    const payload = verifyAccessToken(token);

    // Optional immediate-logout denylist check (session:revoked:{jti}).
    const revoked = await redis.get(`session:revoked:${payload.jti}`);
    if (revoked) {
      throw new UnauthorizedError("Session has been revoked");
    }

    req.user = { id: payload.sub, roles: payload.roles, jti: payload.jti };
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    next(new UnauthorizedError("Invalid or expired access token"));
  }
}

/** Attaches req.user if a valid token is present but does not reject the request otherwise. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next();
    return;
  }
  try {
    const token = header.slice("Bearer ".length).trim();
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, roles: payload.roles, jti: payload.jti };
  } catch {
    // Ignore invalid token on optional-auth routes.
  }
  next();
}
