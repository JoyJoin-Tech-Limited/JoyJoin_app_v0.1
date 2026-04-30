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

## Auth gating overview

Shared auth middleware lives in `apps/server/src/adminAuth.ts` (`requireAdmin`, `requireSuperAdmin`, `requireOperatorOrAbove`). User auth (`requireAuth`) still exists as local helpers in some route files and should be extracted rather than duplicated.

All `/api/admin/*` routes must use `requireAdmin` middleware. Admin RBAC is documented in `docs/admin-rbac-matrix.md`.

Session data is typed — do not access arbitrary keys on `req.session`. Use the typed accessor attached by auth middleware, not raw session reads. See [`references/safety-patterns.md`](references/safety-patterns.md) for exact file locations, typed session contract rules, and dev-only endpoint patterns.

## Fail-closed principles

Sensitive flows should fail closed:

- Unknown or unexpected auth state → deny, log
- Missing required session data → 401, not 500
- Signature mismatch on webhooks → reject and log, not silently accept
- Admin operations on invalid state → reject with explicit error, not partial execution

Dev auth tools are gated by `ENABLE_DEV_AUTH_TOOLS=1` (server) and `import.meta.env.DEV && VITE_ENABLE_DEV_TOOLS=1` (client). Never ship without the guard. Webhook handlers must verify the signature before reading payload data; on failure return 400 and log.

## Quick examples

**User says:** "Add a new `/api/admin/reports` route that only operators can access."
**Apply this skill by:** Adding `requireOperatorOrAbove` middleware from `adminAuth.ts` before the route handler. Log the admin action via `logAdminAudit`. Do not duplicate inline auth logic.
**Result:** Route is consistently gated, audit-logged, and aligned with the existing admin RBAC matrix.

---

**User says:** "I need a dev-only endpoint to bypass WeChat auth in local testing."
**Apply this skill by:** Registering the route behind `if (process.env.ENABLE_DEV_AUTH_TOOLS !== '1') return res.status(404).json(...)` and verifying `isDevAuthToolsEnabled()` from `auth/policy.ts`. Never ship without the guard.
**Result:** Debug tool is accessible in local/CI environments and completely absent in production.

---

**User says:** "The WeChat Pay webhook is returning 400."
**Apply this skill by:** Confirming the raw request body is being read (not a parsed JSON body) for signature calculation, and that the WeChat Pay secret is correctly loaded from env. Return 400 and log on verification failure.
**Result:** Webhook validation is consistent and safe.

## Troubleshooting

- **Unexpected 401 or 403 in production** — verify that the session cookie configuration (`domain`, `path`, `httpOnly`, `secure`, `sameSite`) matches the frontend origin and HTTPS settings so the cookie is not dropped. Also confirm the auth middleware order in `routes.ts` and that RBAC role resolution returns the expected role.
- **Unexpected 401 or 403 in local or CI when using dev auth tools** — verify that `ENABLE_DEV_AUTH_TOOLS=1` is set for the environment and that `isDevAuthToolsEnabled()` is only used in non-production code paths.
- **Webhook signature verification failing** — confirm the raw request body is being read (not a parsed JSON body) for signature calculation. Also check that the WeChat Pay secret is correctly loaded from env.
- **Dev-only route accessible in production** — the environment guard is missing or using the wrong env key. Always gate on `process.env.ENABLE_DEV_AUTH_TOOLS !== '1'` server-side.
- **New admin route returns 200 without auth** — `requireAdmin` middleware was omitted. Cross-reference against `docs/admin-rbac-matrix.md` and add the correct middleware.
- **Session cookie not sent in production** — verify `secure: true`, `httpOnly: true`, and `sameSite: 'lax'` or `'strict'` are set. Do not relax `secure: true` for any production codepath.

## Review checklist

- [ ] Every `/api/admin/*` route has `requireAdmin` (or finer-grained RBAC) middleware
- [ ] Dev/debug auth tools are gated by `ENABLE_DEV_AUTH_TOOLS=1` on the server
- [ ] Session data is accessed via typed accessors — no arbitrary `req.session[key]` reads
- [ ] Webhook handlers verify signature before reading payload data
- [ ] Sensitive flows return a clear error (401/403/400) on unexpected auth state — not 500
- [ ] No sensitive data (tokens, codes) appears in error responses or log fields
