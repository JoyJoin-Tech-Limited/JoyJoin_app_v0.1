---
name: api-contract-versioning
description: >
  Shared API contract governance across server, web, and mini-program clients.
  Covers Zod schemas derived from Drizzle tables, DTOs in packages/shared/src/api.ts,
  cross-platform type consumption, and the lightweight /api/v1/* versioning rewrite.
  Use when adding, changing, or reviewing a shared API type, Zod validation schema,
  or route payload shape consumed by more than one surface. Trigger phrases:
  "add a shared DTO", "change API response shape", "Zod schema drift",
  "safeParse validation", "cross-platform contract", "api.ts type".
---

# api-contract-versioning

**Core rule:** API contracts are owned by `packages/shared` and consumed by the server and both clients. Changing a shared type or Zod schema is a cross-cutting change — validate all consumers before merging.

## When to use this skill

- Adding, removing, or renaming a field in a shared API request/response type
- Creating a new Zod validation schema for a route payload
- Modifying an existing schema exported from `packages/shared/src/schema.ts`
- Changing `packages/shared/src/api.ts` DTOs or the `ApiTransport` contract
- Adding a new API endpoint that both mini-program and web will call
- Reviewing whether a server route's response shape matches the client's expectation
- Diagnosing type mismatches between server and client (e.g., optional vs required, string vs number)

## When NOT to use this skill

- Task is purely about internal server business logic with no exposed contract change
- Task is only about a client-local UI type that never crosses the network
- Task is about database schema evolution without API surface impact (use `database-migration-safety`)
- Task is about adding a new route file or domain decomposition (use `server-domain-architecture`)

## Shared contract layers

JoyJoin API contracts live in three layers inside `packages/shared`:

| Layer | Location | Purpose |
|-------|----------|---------|
| Database + Zod schemas | `packages/shared/src/schema.ts` | Drizzle table definitions + `createInsertSchema`/`z.object` derivations for runtime validation |
| API DTOs + transport | `packages/shared/src/api.ts` | TypeScript request/response types, `ApiTransport` contract, API helper functions |
| Domain types | `packages/shared/src/types/*.ts` | Cross-cutting domain types (e.g., `GroupAnalysisResponse`, `AIResponseMeta`) |

### Zod schema patterns

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

### API DTO patterns

`packages/shared/src/api.ts` defines:
- `ApiTransport` — abstract request function used by all clients
- Request/response interfaces (e.g., `AuthUserResponse`, `EventPoolSummary`)
- Normalization helpers (e.g., `normalizeEventPoolRegistrationPayload`)

Clients import DTOs via `@shared/api`:
- **Web**: `apps/user-client/src/hooks/useAuth.ts` imports `AuthUserResponse`
- **Mini-program**: `apps/mini-program/src/lib/api.ts` imports `AuthUserResponse`
- **Server**: `apps/server/src/routes.ts` imports DTOs and schemas from `@shared/schema` and `@shared/api`

### Versioning

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

## Cross-platform contract discipline

- **Additive changes are safe**: adding optional fields to a response does not break existing clients
- **Renaming is breaking**: both server and all clients must update atomically
- **Zod `.omit()` / `.pick()` / `.partial()`**: prefer these over redefining schemas to keep the contract close to the DB source of truth
- **Normalizers live in `packages/shared/src/api.ts`**: when the server sends snake_case or ambiguous shapes, normalize to a strict client contract in the shared package, not inside each client
- **Never duplicate types**: if a shape is used by both web and mini-program, it belongs in `packages/shared/src/api.ts` or `packages/shared/src/types/`

## Common mistakes to avoid

- Changing a Zod schema in `schema.ts` without checking every `safeParse` consumer in server routes
- Adding a new API response field in the server but not updating `packages/shared/src/api.ts`
- Using `z.any()` on shared DTOs when a precise shape is known
- Defining the same type in both `apps/mini-program` and `apps/user-client` instead of `packages/shared`
- Removing a field from a shared type before all clients have stopped reading it

## Canonical References

- `packages/shared/src/schema.ts` — Drizzle tables + Zod schemas
- `packages/shared/src/api.ts` — API DTOs, transport contract, normalization helpers
- `packages/shared/src/types/` — Domain-specific cross-cutting types
- `apps/server/src/routes.ts` — Route composition root + `/api/v1/*` rewrite
- `apps/mini-program/src/lib/api.ts` — Mini-program API transport + auth bootstrap
- `apps/user-client/src/hooks/useAuth.ts` — Web auth/session type consumer
- `apps/server/src/routes/domains/eventGroupOutcomes.ts` — Example of Zod `safeParse` in domain route
- `packages/shared/src/index.ts` — Shared package export barrel

## Quick Examples

**User says:** "I need to add a new field `dietaryNotes` to the event pool registration payload."
**Apply this skill by:**
1. Add the column to `eventPoolRegistrations` in `packages/shared/src/schema.ts` (if persisted)
2. Update `insertEventPoolRegistrationSchema` in the same file
3. Add `dietaryNotes?: string[] | null` to `EventPoolRegistrationPayload` in `packages/shared/src/api.ts`
4. Update `normalizeEventPoolRegistrationPayload` if the field needs normalization
5. Run `npm run typecheck` across `@joyjoin/server`, `@joyjoin/user-client`, and `mini-program`
6. Verify `apps/server/src/routes/domains/eventPools.ts` handles the new field
**Result:** The contract is updated in one place and all consumers type-check together.

---

**User says:** "The server is returning a new `themeEmoji` field but the mini-program isn't seeing it."
**Apply this skill by:** Checking `packages/shared/src/api.ts` for `PoolGroupSummary` — if `themeEmoji` is missing from the interface, add it there. Also verify `apps/mini-program/src/lib/api.ts` or its consuming pages import the updated type via `@shared/api`.
**Result:** Type drift is caught at the shared boundary, not at runtime in the client.

## Troubleshooting

- **Type mismatch between server and client after schema change** — Run `npm run typecheck` across all workspaces. The shared package must compile first; if it fails, fix `packages/shared/src/api.ts` or `schema.ts` before checking consumers.
- **Zod validation rejects a payload that looks correct** — Check whether the schema uses `.strict()`, `.omit()`, or `.extend()` in a way that forbids the field. Also verify that `req.body` is not being mutated before `safeParse`.
- **Client sees `unknown` for an API response field** — The field is likely not declared in the corresponding interface in `packages/shared/src/api.ts`. Add it and re-export from `packages/shared/src/index.ts` if needed.
- **Mini-program and web disagree on a shape** — Inspect both clients' imports. If they import from `@shared/api`, the fix is in one place. If one client defines a local copy, migrate it to `packages/shared/src/api.ts`.
- **Adding a required field to a response breaks an older client** — Make the field optional (`?:`) in the shared DTO first, populate it server-side, then migrate clients to depend on it before making it required.

## Review checklist

- [ ] Zod schema changes in `schema.ts` are reflected in all server `safeParse` consumers
- [ ] New or changed response fields are added to the corresponding interface in `packages/shared/src/api.ts`
- [ ] Both web and mini-program clients import the updated type from `@shared/api`
- [ ] No duplicate local types were created when a shared type already exists
- [ ] Additive changes use optional fields (`?:`) before making them required across all surfaces
- [ ] Normalization logic for ambiguous server shapes lives in `packages/shared/src/api.ts`, not in clients
- [ ] `npm run typecheck` passes for `@joyjoin/server`, `@joyjoin/user-client`, and `mini-program`
- [ ] If a route shape changes, the sibling platform (web ↔ mini-program) was reviewed for impact

## Related skills

| Skill | Handoff reason |
|-------|----------------|
| `server-domain-architecture` | When the task is about where to place a new route or service, not the contract itself |
| `platform-coordination-protocol` | When a contract change affects both mini-program and web and needs sibling-platform review |
| `database-migration-safety` | When a schema change requires coordinated DB evolution before the API contract can change |
| `backend-models-standards` | When adding a new Drizzle table or deciding on data types and constraints |
| `testing-and-regression-guardrails` | When locking in API contract invariants with structural or type-level tests |
| `auth-session-and-safety-boundaries` | When the contract change touches auth/session types like `AuthUserResponse` |
