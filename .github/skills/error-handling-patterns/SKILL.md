---
name: error-handling-patterns
description: >
  Consistent API error shapes, Zod validation error formatting, client-safe error
  responses, transport-layer error handling, and retry patterns across Express routes,
  the web client, and the mini-program. Use when adding or changing an API route,
  formatting validation errors, handling 401/403/session expiry, or standardizing
  error responses across platforms. Trigger phrases: "handle API errors consistently",
  "format Zod validation errors", "client-safe error message", "401 redirect",
  "transport error", "retry pattern".
---

# Error Handling Patterns

**Core rule:** Never leak raw exception messages or stack traces to clients. Use consistent, machine-readable error shapes so both web and mini-program clients can handle failures predictably.

## When to use this skill

- Adding or changing an API route that returns error responses
- Formatting Zod validation errors for client consumption
- Handling 401/session expiry, transport failures, or retries on either client
- Creating a new custom error class for domain-specific failures
- Standardizing error response shapes across server routes

## When NOT to use this skill

- Auth gating logic → use `auth-session-and-safety-boundaries`
- Transaction atomicity or idempotency → use `reliability-and-state-integrity`
- Logging or metrics for errors → use `platform-observability-and-ops`
- UI toast/notification styling → use `frontend-component-architecture`

## API error shapes

The server uses three closely related shapes. Prefer `{ error, code? }` for new routes:

| Shape | Example | When to use |
|-------|---------|-------------|
| `{ error: string, code?: string }` | `{ error: "Pool is full", code: "POOL_FULL" }` | **Preferred** for new routes |
| `{ message: string }` | `{ message: "Event pool not found" }` | Legacy compat — migrate to `error` when touching the route |
| `{ success: false, error: string }` | `{ success: false, error: "坐标超出服务范围" }` | Geo and legacy endpoints — do not expand |

- `lib/errorResponse.ts` provides `toSafeMessage(err, fallback)` — returns generic text in production, `err.message` in development
- The `globalErrorHandler` middleware catches unhandled errors and sanitizes them automatically

## Client retry overview

- **Web:** `apiRequest` from `lib/queryClient.ts` auto-redirects on `401`. Default query retry is disabled (`retry: false`). Opt-in per hook, skipping `401`/`403` to avoid loops.
- **Mini-program:** `apiRequest` from `lib/api.ts` returns typed `ApiError` with transport normalization. `401` triggers `handleMiniProgramUnauthorized` unless disabled.

## Quick examples

**User says:** "My new route returns raw Zod errors to the client."
**Apply this skill by:** Replacing `schema.parse(req.body)` with `schema.safeParse(req.body)`, and on failure returning `res.status(400).json({ error: "Invalid request body", code: "VALIDATION_ERROR", details: result.error.flatten() })`. In production, omit `details` or gate it behind `NODE_ENV === 'development'`.
**Result:** Clients receive a clean, predictable error shape without internal field leakage.

**User says:** "The mini-program shows a generic 'request failed' when the API is unreachable."
**Apply this skill by:** Using `apiRequest` from `apps/mini-program/src/lib/api/api.ts`. Transport errors are already normalized: timeout → "请求超时…", domain whitelist → "不在小程序合法域名白名单中…", SSL → "无法建立安全连接…". Surface `error.message` in the UI; it is already localized.
**Result:** Users see actionable, network-cause-specific copy instead of a generic failure.

## Troubleshooting

- **Client receives a raw stack trace** — the route handler is catching an error and returning `err.message` directly. Use `toSafeMessage(err)` or `sendApiError(res, 500, "...")` instead.
- **Zod validation errors are too verbose** — the handler returns `result.error.issues` raw. Switch to `result.error.flatten()` or build a minimal field-to-message map.
- **401 responses are not redirecting the user to login** — on web, ensure `apiRequest` from `lib/queryClient.ts` is used. On mini-program, ensure `apiRequest` from `lib/api.ts` is used and `handleUnauthorized` is not disabled.
- **Global error handler is not catching thrown errors** — `app.use(globalErrorHandler)` must come **after** `await registerRoutes(app)` in `index.ts`.

## Review checklist

- [ ] Route handlers use `safeParse`, not `parse`, for Zod validation
- [ ] Error responses use the `{ error, code? }` shape (or existing legacy shape is preserved without mixing)
- [ ] Production responses never contain raw stack traces, `err.stack`, or raw `Error` objects
- [ ] `toSafeMessage` or `sendApiError` is used for caught exceptions in route handlers
- [ ] `globalErrorHandler` is registered after all routes in `index.ts`
- [ ] Web client `401` handling uses `apiRequest` from `queryClient.ts`
- [ ] Mini-program `401` handling uses `handleMiniProgramUnauthorized` / `apiRequest` from `lib/api.ts`
- [ ] Custom domain errors carry a `name` and public fields so route handlers can `instanceof` branch

## References

- [`references/patterns.md`](references/patterns.md) — Express middleware code, Zod formatting details, per-platform transport handling (web, mini-program), 401/403/session expiry specifics, custom error class examples
