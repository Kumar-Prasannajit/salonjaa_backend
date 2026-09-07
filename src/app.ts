import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import pinoHttp from "pino-http";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { errorHandler, notFoundHandler } from "@/middleware/error.middleware";
import v1Router from "@/routes/v1";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      // Module 14: cookies now carry accessToken/refreshToken/csrfToken — redact the whole
      // header (and its Set-Cookie response counterpart), same reasoning as Authorization.
      redact: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
      autoLogging: { ignore: (req) => req.url === "/health" },
    })
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
  });

  app.use(env.API_PREFIX, v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
