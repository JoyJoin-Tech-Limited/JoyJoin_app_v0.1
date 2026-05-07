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

## When NOT to use this skill

- Task is purely about internal server business logic with no exposed contract change
- Task is only about a client-local UI type that never crosses the network
- Task is about database schema evolution without API surface impact (use `database-migration-safety`)
- Task is about adding a new route file or domain decomposition (use `server-domain-architecture`)

## Shared contract layers

JoyJoin API contracts live in three layers inside `packages/shared`:

| Layer | Location | Purpose |
|-------|----------|---------|
| Database + Zod schemas | `packages/shared/src/schema.ts` | Drizzle tables + runtime validation |
| API DTOs + transport | `packages/shared/src/api.ts` | TypeScript types, transport contract |
| Domain types | `packages/shared/src/types/*.ts` | Cross-cutting domain types |

**Versioning:** The server strips `/api/v1/` prefixes and routes identically to `/api/*`. There is no active breaking-version negotiation. Prefer additive fields with feature detection over version bumps.

For implementation details — Zod/Drizzle examples, DTO patterns, drift detection, and cross-platform consumption — see [references/implementation.md](references/implementation.md).

## Quick examples

**User says:** "I need to add a new field `dietaryNotes` to the event pool registration payload."
**Apply this skill by:**
1. Add the column to `eventPools` in `packages/shared/src/schema.ts` (if persisted)
2. Update `insertEventPoolRegistrationSchema` in the same file
3. Add `dietaryNotes?: string[] | null` to `EventPoolRegistrationPayload` in `packages/shared/src/api.ts`
4. Run `npm run typecheck` across `@joyjoin/server`, `@joyjoin/user-client`, and `mini-program`
**Result:** The contract is updated in one place and all consumers type-check together.

---

**User says:** "The server is returning a new `themeEmoji` field but the mini-program isn't seeing it."
**Apply this skill by:** Checking `packages/shared/src/api.ts` for `PoolGroupSummary` — if `themeEmoji` is missing from the interface, add it there. Also verify `apps/mini-program/src/lib/api/api.ts` imports the updated type via `@shared/api`.
**Result:** Type drift is caught at the shared boundary, not at runtime in the client.

## Troubleshooting

- **Type mismatch between server and client after schema change** — Run `npm run typecheck` across all workspaces. Fix `packages/shared/src/api.ts` or `schema.ts` before checking consumers.
- **Zod validation rejects a payload that looks correct** — Check whether the schema uses `.strict()`, `.omit()`, or `.extend()` in a way that forbids the field.
- **Client sees `unknown` for an API response field** — The field is likely not declared in `packages/shared/src/api.ts`. Add it and re-export from `packages/shared/src/index.ts` if needed.
- **Adding a required field to a response breaks an older client** — Make the field optional (`?:`) in the shared DTO first, then migrate clients before making it required.

## Review checklist

- [ ] Zod schema changes in `schema.ts` are reflected in all server `safeParse` consumers
- [ ] New or changed response fields are added to the corresponding interface in `packages/shared/src/api.ts`
- [ ] Both web and mini-program clients import the updated type from `@shared/api`
- [ ] No duplicate local types were created when a shared type already exists
- [ ] Additive changes use optional fields (`?:`) before making them required across all surfaces
- [ ] `npm run typecheck` passes for `@joyjoin/server`, `@joyjoin/user-client`, and `mini-program`
