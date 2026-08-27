import { Response } from "express";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, message?: string): Response {
  const body: ApiSuccess<T> = { success: true, data };
  if (message) body.message = message;
  return res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendSuccess(res, data, 201, message);
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}
