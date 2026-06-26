# API Contract Implementation Reference

## Cross-platform type consumption

Clients import DTOs via `@shared/api`:
- **Web**: `apps/user-client/src/hooks/useAuth.ts` imports `AuthUserResponse`
- **Mini-program**: `apps/mini-program/src/lib/api/api.ts` imports `AuthUserResponse`
- **Server**: `apps/server/src/routes.ts` imports DTOs and schemas from `@shared/schema` and `@shared/api`

### API DTO patterns

`packages/shared/src/api.ts` is a thin barrel that re-exports domain modules from `packages/shared/src/api/*.ts`. Domain modules define:
- `ApiTransport` — abstract request function used by all clients (`api/core.ts`)
- Request/response interfaces (e.g., `AuthUserResponse` in `api/auth.ts`, `EventPoolSummary` in `api/eventPools.ts`)
- Normalization helpers (e.g., `normalizeEventPoolRegistrationPayload` in `api/eventPools.ts`)

## Versioning rewrite specifics

The server strips `/api/v1/` prefixes and routes them identically to `/api/*`:

```ts
// apps/server/src/routes.ts
app.use((req, _res, next) => {
  if (req.url?.startsWith('/api/v1/')) {
    req.url = '/api/' + req.url.slice('/api/v1/'.length);
  }
  next();
});
```

There is no active breaking-version negotiation. All clients today speak the same implicit API version. If a breaking change is unavoidable, prefer additive fields with feature detection over version bumps.

## Drift detection patterns

- **Additive changes are safe**: adding optional fields to a response does not break existing clients
- **Renaming is breaking**: both server and all clients must update atomically
- **Zod `.omit()` / `.pick()` / `.partial()`**: prefer these over redefining schemas to keep the contract close to the DB source of truth
- **Normalizers live in `packages/shared/src/api/*.ts`**: when the server sends snake_case or ambiguous shapes, normalize to a strict client contract in the shared package, not inside each client
- **Never duplicate types**: if a shape is used by both web and mini-program, it belongs in `packages/shared/src/api/<domain>.ts` (re-exported through `packages/shared/src/api.ts`) or `packages/shared/src/types/`

## Zod schema examples

Derived from Drizzle tables using `drizzle-zod`:

```ts
// packages/shared/src/schema.ts
export const insertEventPoolSchema = createInsertSchema(eventPools).omit({
  id: true,
  // ...auto-generated fields
}).extend({
  title: z.string().min(1, "活动标题不能为空"),
  eventType: z.enum(["饭局", "酒局", "其他"]),
});
```

Inline Zod schemas for non-DTO validation:

```ts
const interestSelectionSchema = z.object({
  topicId: z.string(),
  level: z.number().int().min(1).max(3),
  heat: z.number().int().min(3).max(25),
});
```

Server-side usage pattern:

```ts
const parsed = insertEventGroupOutcomeSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
}
```

## Canonical References

- `packages/shared/src/schema.ts` — Drizzle tables + Zod schemas
- `packages/shared/src/api.ts` — API DTO barrel
- `packages/shared/src/api/*.ts` — Domain-specific DTOs, transport helpers, and normalization
- `packages/shared/src/types/` — Domain-specific cross-cutting types
- `apps/server/src/routes.ts` — Route composition root + `/api/v1/*` rewrite
- `apps/mini-program/src/lib/api/api.ts` — Mini-program API transport + auth bootstrap
- `apps/user-client/src/hooks/useAuth.ts` — Web auth/session type consumer
- `apps/server/src/routes/domains/eventGroupOutcomes.ts` — Example of Zod `safeParse` in domain route
- `packages/shared/src/index.ts` — Shared package export barrel
