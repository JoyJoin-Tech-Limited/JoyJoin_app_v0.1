---
name: Auth, Session, and Safety Boundaries
description: Policy-based auth gating, typed request/session contracts, explicit non-production-only debug/dev auth surfaces, and fail-closed handling for sensitive flows. Use when adding API routes, auth checks, or dev tooling.
---

# Auth, Session, and Safety Boundaries

**Core rule:** Auth is enforced via policy helpers, not inline checks. Debug and dev auth surfaces are explicitly gated to non-production environments. Sensitive flows fail closed on error.

## When to use this skill

- Adding a new API route that requires authentication
- Implementing or reviewing admin-only endpoints
- Adding development or test authentication tooling
- Reviewing webhook validation logic
- Working on session management or cookie configuration

## Auth policy helpers

Auth gating is handled through policy helpers in `apps/server/src/auth/policy.ts`, not inline `if (!req.session.userId)` checks.

```typescript
// Prefer this
requireAuth(req, res, next);        // authenticated user required
requireAdmin(req, res, next);       // admin-level required

// Not this
if (!req.session.userId) { return res.status(401).json(...); }
```

Use the appropriate middleware — do not implement custom session reads in route handlers.

## Admin routes

- All `/api/admin/*` routes must use `requireAdmin` middleware
- Admin RBAC matrix is documented in `docs/admin-rbac-matrix.md`
- Admin audit events must be logged via `apps/server/src/lib/adminAuditLogger.ts`
- Admin-specific pages belong in `apps/admin-client`, not `apps/user-client`

## Typed request/session contracts

- Session data is typed — do not access arbitrary keys on `req.session`
- Request user context is attached by auth middleware — use the typed accessor, not raw session reads
- When adding a new field to session, update the session type definition

## Dev and debug auth surfaces

Dev auth tools are explicitly gated:

- **Server:** `ENABLE_DEV_AUTH_TOOLS=1` environment variable must be set
- **Client:** `import.meta.env.DEV && VITE_ENABLE_DEV_TOOLS=1` must both be true
- Dev auth routes are registered in `apps/server/src/phoneAuth.ts` (behind the env gate)
- Never ship dev auth tools without the environment guard
- In development, the server accepts `wechat_test_<uuid>` mock codes — this is also gated on non-production

```typescript
// Server-side gate pattern
if (process.env.ENABLE_DEV_AUTH_TOOLS !== '1') {
  return res.status(404).json({ error: 'Not found' });
}
```

## Session cookies

Production session cookies must be configured with:
- `httpOnly: true`
- `secure: true`
- `sameSite: 'lax'` or `'strict'`

Do not relax `secure: true` for any production codepath.

## Webhook validation

- WeChat Pay webhooks must verify the signature before processing
- Never process webhook payload data before signature verification
- On verification failure, return 400 and log the failure — do not silently ignore

## Fail-closed principle

Sensitive flows should fail closed:

- Unknown or unexpected auth state → deny, log
- Missing required session data → 401, not 500
- Signature mismatch on webhooks → reject and log, not silently accept
- Admin operations on invalid state → reject with explicit error, not partial execution

## Common mistakes to avoid

- Adding inline `req.session` checks in route handlers instead of using policy helpers
- Registering a dev/debug route without an environment gate
- Omitting `requireAdmin` on admin endpoints
- Processing webhook data before verifying the signature
- Storing sensitive state in client-accessible cookies (no `httpOnly`)
- Returning sensitive internal details in 401/403 error responses

## Related files

- `apps/server/src/auth/policy.ts` — policy-based auth helpers
- `apps/server/src/phoneAuth.ts` — SMS auth (with dev-auth env gate)
- `apps/server/src/adminAuth.ts` — admin authentication
- `apps/server/src/wechatAuth.ts` — WeChat OAuth2
- `apps/server/src/lib/adminAuditLogger.ts` — audit logging
- `apps/user-client/src/App.tsx` — client-side dev tools gate
- `docs/admin-rbac-matrix.md` — admin permission matrix
