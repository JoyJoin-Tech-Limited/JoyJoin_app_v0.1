# Server Routes

API route organization and domain ownership for JoyJoin server.

## Structure

- `routes.ts` — Composition root. All domain routers registered here.
- `routes/domains/` — Domain-specific route modules (auth, events, payments, profile, etc.)

## Adding a new route

1. Create domain router in `routes/domains/<domain>.ts`
2. Export a `register*Routes(app)` function
3. Register it in `routes.ts` composition root
4. Add admin routes under `/api/admin` with appropriate RBAC middleware

## Key constraints

- Auth gates must be applied before business logic
- Admin routes require `requireAdmin` middleware; sensitive ops require `requireSuperAdmin`
- Zod validation for all request bodies
- Structured error responses via `failSafe` / `globalErrorHandler`
