import { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors";
import { RoleName } from "@/shared/constants";

export function requireRole(...allowedRoles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role as RoleName));
    if (!hasRole) {
      next(new ForbiddenError(`Requires one of roles: ${allowedRoles.join(", ")}`));
      return;
    }
    next();
  };
}
