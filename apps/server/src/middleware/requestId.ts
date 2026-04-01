/**
 * Request ID / Correlation ID Middleware
 * 请求关联 ID 中间件
 *
 * Attaches a unique `request_id` to every incoming HTTP request so that all
 * log lines produced within the same request lifecycle can be correlated in
 * the log aggregation backend (Loki, CloudWatch, Datadog, etc.).
 *
 * Behaviour:
 *   1. Reads `X-Request-Id` header if present (allows upstream proxies /
 *      load balancers to propagate a trace ID they generated).
 *   2. Falls back to a freshly generated UUID v4 otherwise.
 *   3. Exposes the ID on `req.requestId` for use in route handlers and
 *      middleware.
 *   4. Echoes the ID back in the `X-Request-Id` response header so clients
 *      and API consumers can include it in support requests.
 *
 * Usage in route handlers:
 *   const reqLogger = logger.child({ request_id: req.requestId });
 *   reqLogger.info('Processing event registration', { eventId });
 *
 * Mount this middleware as early as possible in `index.ts`:
 *   import { requestIdMiddleware } from './middleware/requestId';
 *   app.use(requestIdMiddleware);
 */

import { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

// Augment Express Request so TypeScript knows about `requestId`
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation ID for this HTTP request. */
      requestId: string;
    }
  }
}

/**
 * Express middleware that attaches a correlation ID to every request.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers['x-request-id'];
  // Accept a single string header value; ignore malformed arrays.
  const requestId =
    typeof incoming === 'string' && incoming.length > 0
      ? incoming
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
