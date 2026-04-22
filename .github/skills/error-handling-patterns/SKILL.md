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
- Adding client-side error copy (title/description) for status-code-based failures

## When NOT to use this skill

- Task is purely about auth gating logic (use `auth-session-and-safety-boundaries`)
- Task is about transaction atomicity or idempotency (use `reliability-and-state-integrity`)
- Task is about logging or metrics for errors (use `platform-observability-and-ops`)
- Task is purely about UI toast/notification styling (use `frontend-component-architecture`)

## API error shapes

The server uses three closely related shapes. Prefer `{ error, code? }` for new routes:

| Shape | Example | When to use |
|-------|---------|-------------|
| `{ error: string, code?: string }` | `{ error: "Pool is full", code: "POOL_FULL" }` | **Preferred** for new routes — machine-readable `code` lets clients branch behavior |
| `{ message: string }` | `{ message: "Event pool not found" }` | Legacy compat — acceptable in existing domains, migrate to `error` when touching the route |
| `{ success: false, error: string }` | `{ success: false, error: "坐标超出服务范围" }` | Geo and legacy endpoints — do not expand |

**Safe message sanitization:**
- `lib/errorResponse.ts` provides `toSafeMessage(err, fallback)` — returns generic text in production, `err.message` in development
- The `globalErrorHandler` middleware (registered after all routes in `index.ts`) catches unhandled errors and sanitizes them automatically

## Zod validation errors

Use `safeParse` — never `parse` directly in route handlers:

```typescript
const result = mySchema.safeParse(req.body);
if (!result.success) {
  // Prefer flatten() for compact client consumption
  return res.status(400).json({
    error: "Invalid request body",
    code: "VALIDATION_ERROR",
    details: result.error.flatten(),
  });
}
```

**Rules:**
- Return `400` for validation failures
- Include `details` only in development or when the field map helps the client correct input
- Do not send `result.error.issues` raw to clients in production — it is verbose and may expose internal field names

## Server custom error classes

For domain-specific failures that need structured handling, extend `Error` with a `name` and public fields:

```typescript
// lib/stateTransitions.ts
export class InvalidTransitionError extends Error {
  constructor(
    public readonly domain: TransitionDomain,
    public readonly fromState: string,
    public readonly toState: string,
  ) {
    super(`Invalid state transition for ${domain}: '${fromState}' → '${toState}' is not allowed.`);
    this.name = 'InvalidTransitionError';
  }
}
```

In route handlers, catch the custom type and return a clean status + code:

```typescript
try {
  assertValidTransition('event_pool', pool.status, req.body.status);
} catch (err) {
  if (err instanceof InvalidTransitionError) {
    return res.status(409).json({ message: err.message, code: 'INVALID_TRANSITION' });
  }
  throw err; // Let globalErrorHandler handle unexpected errors
}
```

## Client error handling — web (`apps/user-client`)

### `apiRequest` helper (`lib/queryClient.ts`)

- Automatically redirects to `/` on `401` (clears React Query cache first)
- Throws `Error("{status}: {text}")` for non-OK responses
- Use `allowStatuses` option when a non-2xx response is expected (e.g., `404` for optional resources)

### Retry rules

- Default query retry is disabled (`retry: false`) in the shared `QueryClient`
- Opt-in retry per hook: skip `401`/`403` to avoid redirect loops

```typescript
useQuery({
  queryKey: ["/api/auth/user"],
  retry: (failureCount, error: any) => {
    if (error?.status === 401 || error?.status === 403) return false;
    return failureCount < 2;
  },
});
```

### Status-code-specific user copy

For flows that need human-friendly error mapping, create a small error-copy helper:

```typescript
// lib/icebreakerSessionRequest.ts
export class IcebreakerSessionRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function getIcebreakerSessionErrorCopy(error: unknown) {
  if (error instanceof IcebreakerSessionRequestError) {
    if (error.status === 401) return { title: "请先登录", description: "登录后才能进入这场破冰体验。" };
    if (error.status === 403) return { title: "你还不在这场活动中", description: "只有本场活动的参与者才能进入破冰会话。" };
    if (error.status === 404) return { title: "会话不存在", description: "这场破冰会话可能还没开始，或已被移除。" };
    if (error.status === 410) return { title: "会话已结束", description: "这场破冰会话已经结束，请返回活动页查看最新状态。" };
  }
  return { title: "加载会话失败", description: "请稍后重试，或先返回活动列表。" };
}
```

## Client error handling — mini-program (`apps/mini-program`)

### `apiRequest` (`lib/api.ts`)

- Returns a typed `ApiError` with `statusCode`, `data`, `isGenericMessage`, `isTransportError`, `requestUrl`, `debugMessage`
- Transport failures (network, timeout, SSL, domain whitelist) are normalized into human-friendly Chinese messages
- `401` responses automatically trigger `handleMiniProgramUnauthorized` unless `handleUnauthorized: false` is passed

### Auth session expiry

- `handleMiniProgramUnauthorized` clears user-scoped queries and redirects to the login page
- `isUnauthorizedApiError(error)` and `getApiErrorStatusCode(error)` are available for branching in UI code

### Error shape consumption

The mini-program API client reads server errors in priority order:

1. `data.error` (string) — preferred `error` field
2. `data.message` (string) — legacy `message` field
3. Generic fallback: `Request failed with status {statusCode}`

## Global error handler middleware

`globalErrorHandler` (from `lib/errorResponse.ts`) is registered **after** all routes in `index.ts`:

- Extracts `err.status ?? err.statusCode ?? 500`
- Logs only `5xx` errors to avoid 4xx noise
- Sanitizes messages via `toSafeMessage` — never sends stack traces to clients

## Common mistakes to avoid

- Using `parse` instead of `safeParse` in route handlers — throws uncaught Zod errors to the global handler
- Returning raw `result.error.issues` in production responses — verbose and may leak internals
- Sending stack traces or raw `Error` objects in JSON responses — always sanitize
- Catching errors with `console.error` and then returning `res.status(500).json({ message: err.message })` — leaks internals in production; use `toSafeMessage` or `sendApiError`
- Not handling `401` consistently on the client — web redirects via `queryClient.ts`, mini-program redirects via `authSession.ts`
- Adding side-effect notifications inside a `try/catch` that swallows the error silently

## Canonical references

- `apps/server/src/lib/errorResponse.ts` — `sendApiError`, `toSafeMessage`, `globalErrorHandler`
- `apps/server/src/index.ts` — middleware registration order
- `apps/server/src/lib/stateTransitions.ts` — `InvalidTransitionError` pattern
- `apps/user-client/src/lib/queryClient.ts` — web `apiRequest`, `getQueryFn`, `handleSessionExpired`
- `apps/user-client/src/lib/icebreakerSessionRequest.ts` — custom error class + status-code copy
- `apps/mini-program/src/lib/api.ts` — mini-program `apiRequest`, `ApiError`, transport errors
- `apps/mini-program/src/lib/authSession.ts` — `handleMiniProgramUnauthorized`, `isUnauthorizedApiError`

## Quick examples

**User says:** "My new route returns raw Zod errors to the client."
**Apply this skill by:** Replacing `schema.parse(req.body)` with `schema.safeParse(req.body)`, and on failure returning `res.status(400).json({ error: "Invalid request body", code: "VALIDATION_ERROR", details: result.error.flatten() })`. In production, omit `details` or gate it behind `NODE_ENV === 'development'`.
**Result:** Clients receive a clean, predictable error shape without internal field leakage.

---

**User says:** "The mini-program shows a generic 'request failed' when the API is unreachable."
**Apply this skill by:** Using `apiRequest` from `apps/mini-program/src/lib/api.ts`. Transport errors are already normalized: timeout → "请求超时…", domain whitelist → "不在小程序合法域名白名单中…", SSL → "无法建立安全连接…". Surface `error.message` in the UI; it is already localized.
**Result:** Users see actionable, network-cause-specific copy instead of a generic failure.

## Troubleshooting

- **Client receives a raw stack trace instead of a safe message** — the route handler is catching an error and returning `err.message` directly. Use `toSafeMessage(err)` or `sendApiError(res, 500, "...")` instead.
- **Zod validation errors are too verbose for the client** — the handler returns `result.error.issues` raw. Switch to `result.error.flatten()` or build a minimal field-to-message map.
- **401 responses are not redirecting the user to login** — on web, ensure `apiRequest` from `lib/queryClient.ts` is used (it handles 401 automatically). On mini-program, ensure `apiRequest` from `lib/api.ts` is used and `handleUnauthorized` is not disabled.
- **Global error handler is not catching thrown errors** — `globalErrorHandler` is registered before routes or not registered at all. In `index.ts`, `app.use(globalErrorHandler)` must come **after** `await registerRoutes(app)`.
- **Duplicate/legacy `{ message: ... }` and `{ error: ... }` shapes in the same route file** — pick one shape per route; migrate legacy `message` responses to `error` + optional `code` when editing the file.

## Review checklist

- [ ] Route handlers use `safeParse`, not `parse`, for Zod validation
- [ ] Error responses use the `{ error, code? }` shape (or existing legacy shape is preserved without mixing)
- [ ] Production responses never contain raw stack traces, `err.stack`, or raw `Error` objects
- [ ] `toSafeMessage` or `sendApiError` is used for caught exceptions in route handlers
- [ ] `globalErrorHandler` is registered after all routes in `index.ts`
- [ ] Web client `401` handling uses `handleSessionExpired` / `apiRequest` from `queryClient.ts`
- [ ] Mini-program `401` handling uses `handleMiniProgramUnauthorized` / `apiRequest` from `lib/api.ts`
- [ ] Custom domain errors carry a `name` and public fields so route handlers can `instanceof` branch

## Related skills

| Skill | When to hand off |
|-------|-----------------|
| `auth-session-and-safety-boundaries` | Auth gating, role checks, session middleware, fail-closed policy |
| `reliability-and-state-integrity` | Transactions, idempotency, execution guards, side-effect separation |
| `platform-observability-and-ops` | Structured logging, request IDs, metrics, audit logging for errors |
| `server-domain-architecture` | Where to place a new route, service, or middleware file |
| `platform-coordination-protocol` | Cross-platform impact when changing shared API contracts |
| `testing-and-regression-guardrails` | Adding regression tests for error response shapes or 401 behavior |
