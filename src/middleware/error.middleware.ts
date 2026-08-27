import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors";
import { ApiErrorBody } from "@/shared/response";
import { logger } from "@/shared/logger";
import { isProduction } from "@/config/env";

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    success: false,
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.originalUrl} not found` },
  };
  res.status(404).json(body);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validation failed", details: err.flatten() },
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.originalUrl }, err.message);
    } else {
      logger.warn({ code: err.code, path: req.originalUrl }, err.message);
    }
    const body: ApiErrorBody = {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err, path: req.originalUrl }, "Unhandled error");
  const body: ApiErrorBody = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: isProduction ? "Something went wrong" : (err as Error)?.message ?? "Unknown error",
    },
  };
  res.status(500).json(body);
}
