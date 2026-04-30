# Error Handling Patterns Reference

## Express Middleware Code

`globalErrorHandler` (from `lib/errorResponse.ts`) is registered **after** all routes in `index.ts`:

- Extracts `err.status ?? err.statusCode ?? 500`
- Logs only `5xx` errors to avoid 4xx noise
- Sanitizes messages via `toSafeMessage` — never sends stack traces to clients

## Zod Formatting Details

Use `safeParse` — never `parse` directly in route handlers:

```typescript
const result = mySchema.safeParse(req.body);
if (!result.success) {
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
- Do not send `result.error.issues` raw to clients in production

## Server Custom Error Classes

For domain-specific failures that need structured handling, extend `Error` with a `name` and public fields:

```typescript
export class InvalidTransitionError extends Error {
  constructor(
    public readonly domain: string,
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
  throw err;
}
```

## Web Client (`apps/user-client`)

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

```typescript
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

## Mini-Program (`apps/mini-program`)

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
