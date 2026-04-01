/**
 * API Error Response Utilities
 *
 * Provides a consistent, client-safe error response shape for all API routes.
 * Shape: { error: string, code?: string }
 *
 * Rules:
 * - Never expose raw exception messages or stack traces in production.
 * - Use `code` for machine-readable error categories that clients can handle.
 */

import { Response } from "express";

export interface ApiErrorBody {
  error: string;
  code?: string;
}

/**
 * Send a standardized JSON error response.
 *
 * @param res   Express response object
 * @param status  HTTP status code
 * @param message User-facing error message (safe to send to client)
 * @param code    Optional machine-readable code for client error handling
 */
export function sendApiError(
  res: Response,
  status: number,
  message: string,
  code?: string
): void {
  const body: ApiErrorBody = { error: message };
  if (code) body.code = code;
  res.status(status).json(body);
}

/**
 * Convert an unknown caught error to a safe message string.
 * In production, generic errors are sanitized to avoid leaking internals.
 */
export function toSafeMessage(err: unknown, fallback = "Internal server error"): string {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    return fallback;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}

/**
 * Global Express error-handling middleware.
 * Must be registered AFTER all routes.
 */
export function globalErrorHandler(
  err: any,
  _req: import("express").Request,
  res: import("express").Response,
  _next: import("express").NextFunction
): void {
  const status: number = err.status ?? err.statusCode ?? 500;

  // Only log 5xx errors to avoid spamming logs with expected 4xx noise
  if (status >= 500) {
    console.error("[error]", err);
  }

  // Never send stack traces or raw error objects to clients
  const message = toSafeMessage(err, "Internal server error");
  sendApiError(res, status, message);
}
