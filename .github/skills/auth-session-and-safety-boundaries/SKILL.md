---
name: auth-session-and-safety-boundaries
description: >
  Policy-based auth gating, typed request/session contracts, explicit non-production-only
  debug/dev auth surfaces, and fail-closed handling for sensitive flows. Use when adding API routes,
  auth checks, or dev tooling. Trigger phrases: "gate this route for admin only", "add an auth
  check", "register a dev-only endpoint", "verify a webhook signature", "fail safely on auth
  error".
---

# Auth, Session, and Safety Boundaries

**Core rule:** Admin auth should use shared middleware and debug/dev auth surfaces must be explicitly gated to non-production environments. Sensitive flows fail closed on error. Where authenticated-user checks are still duplicated inline, prefer extracting or reusing a shared helper rather than adding another ad-hoc check.

## When to use this skill

- Adding a new API route that requires authentication
- Implementing or reviewing admin-only endpoints
- Adding development or test authentication tooling
- Reviewing webhook validation logic
- Working on session management or cookie configuration

## Auth helper locations

Current auth responsibilities are split:

- `apps/server/src/adminAuth.ts` exports `requireAdmin`, `requireSuperAdmin`, and `requireOperatorOrAbove`
- `apps/server/src/auth/policy.ts` owns environment/debug auth boundaries such as `isDevAuthToolsEnabled()` and `canUseMockWechatAuth()`
- Authenticated-user checks (`requireAuth`) still exist as local helpers in places like `apps/server/src/routes.ts` and `apps/server/src/routes/domains/onboarding.ts`

Use the existing shared middleware where it exists, and avoid creating another one-off auth check if a nearby route file already has an established helper that should be extracted instead.

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

- Adding another one-off `req.session` auth check when an existing shared or local helper should be reused/extracted
- Registering a dev/debug route without an environment gate
- Omitting `requireAdmin` on admin endpoints
- Processing webhook data before verifying the signature
- Storing sensitive state in client-accessible cookies (no `httpOnly`)
- Returning sensitive internal details in 401/403 error responses

## Related files

- `apps/server/src/auth/policy.ts` — env/debug auth boundaries
- `apps/server/src/phoneAuth.ts` — SMS auth (with dev-auth env gate)
- `apps/server/src/adminAuth.ts` — admin authentication
- `apps/server/src/wechatAuth.ts` — WeChat OAuth2
- `apps/server/src/routes.ts` — current local `requireAuth` usage
- `apps/server/src/routes/domains/onboarding.ts` — domain-local `requireAuth` usage
- `apps/server/src/lib/adminAuditLogger.ts` — audit logging
- `apps/user-client/src/App.tsx` — client-side dev tools gate
- `docs/admin-rbac-matrix.md` — admin permission matrix

## Quick examples

**User says:** "Add a new `/api/admin/reports` route that only operators can access."
**Apply this skill by:** Adding `requireOperatorOrAbove` middleware from `adminAuth.ts` before the route handler. Log the admin action via `logAdminAudit`. Do not duplicate inline auth logic.
**Result:** Route is consistently gated, audit-logged, and aligned with the existing admin RBAC matrix.

---

**User says:** "I need a dev-only endpoint to bypass WeChat auth in local testing."
**Apply this skill by:** Registering the route behind `if (process.env.ENABLE_DEV_AUTH_TOOLS !== '1') return res.status(404).json(...)` and verifying `isDevAuthToolsEnabled()` from `auth/policy.ts`. Never ship without the guard.
**Result:** Debug tool is accessible in local/CI environments and completely absent in production.

## Troubleshooting

- **Unexpected 401 or 403 in production** — verify that the session cookie configuration (`domain`, `path`, `httpOnly`, `secure`, `sameSite`) matches the frontend origin and HTTPS settings so the cookie is not dropped. Also confirm the auth middleware order in `routes.ts`, that the expected guards (`requireUser`, `requireAdmin`, `requireOperatorOrAbove`) are present, and that RBAC role resolution returns the expected role.
- **Unexpected 401 or 403 in local or CI when using dev auth tools** — verify that `ENABLE_DEV_AUTH_TOOLS=1` is set for the environment and that `isDevAuthToolsEnabled()` is only used in non-production code paths. Remember that dev auth tools remain hard-disabled in production regardless of this flag.
- **Webhook signature verification failing** — confirm the raw request body is being read (not a parsed JSON body) for signature calculation. Also check that the WeChat Pay secret is correctly loaded from env.
- **Dev-only route accessible in production** — the environment guard is missing or using the wrong env key. Always gate on `process.env.ENABLE_DEV_AUTH_TOOLS !== '1'` and verify the check exists server-side, not just client-side.
- **New admin route returns 200 without auth** — `requireAdmin` middleware was omitted. Cross-reference against `docs/admin-rbac-matrix.md` and add the correct middleware.

## Review checklist

- [ ] Every `/api/admin/*` route has `requireAdmin` (or finer-grained RBAC) middleware
- [ ] Dev/debug auth tools are gated by `ENABLE_DEV_AUTH_TOOLS=1` on the server
- [ ] Session data is accessed via typed accessors — no arbitrary `req.session[key]` reads
- [ ] Webhook handlers verify signature before reading payload data
- [ ] Sensitive flows return a clear error (401/403/400) on unexpected auth state — not 500
- [ ] No sensitive data (tokens, codes) appears in error responses or log fields
