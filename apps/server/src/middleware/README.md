# Server Middleware

Express middleware for JoyJoin server.

## Middleware modules

- `auth.ts` — Session-based authentication (`requireAuth`, `requireAdmin`)
- `rbac.ts` — Role-based access control gates
- `validation.ts` — Zod schema validation for request bodies
- `errorHandler.ts` — Global error handler (`globalErrorHandler`)
- `requestId.ts` — Request ID injection and tracing
- `logger.ts` — Structured logging middleware

## Adding middleware

1. Export a factory function or Express handler from `middleware/<name>.ts`
2. Apply in `routes.ts` composition root or per-domain as needed
3. Admin routes must chain `requireAdmin` before any business logic
4. Fail-closed: if auth is unknown, reject rather than permit
