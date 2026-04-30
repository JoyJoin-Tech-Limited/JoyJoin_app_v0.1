# Domain Guide

## Domain Ownership Table

| Domain | Router | Repository | Notes |
|--------|--------|------------|-------|
| Auth | `routes/domains/auth.ts` | `repositories/userRepo.ts` | Session + WeChat + phone |
| Onboarding | `routes/domains/onboarding.ts` | `repositories/userRepo.ts` | Server-driven `nextStep` |
| Assessment | `routes/domains/assessment.ts` | `repositories/assessmentRepo.ts` | V4 adaptive |
| Payments | `routes/domains/payments.ts` | `repositories/paymentsRepo.ts` | WeChat Pay v3 |
| Event Pools | `routes/domains/eventPools.ts` | `repositories/eventPoolRepo.ts` | Matching + groups |
| Social Icebreaker | `routes/domains/socialIcebreaker.ts` | `lib/socialIcebreakerStore.ts` | Session lifecycle |
| Admin | `routes/domains/admin.ts` | Various | RBAC + audit log |
| Analytics | `routes/domains/analytics.ts` | `repositories/analyticsRepo.ts` | Reporting only |
| Venues | `routes/domains/venues.ts` | `repositories/venueRepo.ts` | Catalog + assignment |
| Notifications | `routes/domains/notifications.ts` | `repositories/notificationsRepo.ts` | In-app + WS |

Add new domains by creating a new row and following the **New Domain Onboarding Checklist** below.

## storage.ts Facade Deprecation Notes

`storage.ts` is a compatibility facade composed from `repositories/*`.

- **Status:** Legacy; do not expand
- **Existing callsites:** Can remain; do not break without a migration plan
- **New code:** Add to the appropriate repository, not `storage.ts`
- **Migration path:** Extract logic → repository → update `storage.ts` to delegate
- **Goal:** Shrink `storage.ts` surface over time until it can be removed

## New Domain Onboarding Checklist

- [ ] Create `routes/domains/<domain>.ts` with route handlers and validation
- [ ] Create `repositories/<domain>Repo.ts` with new persistence logic
- [ ] Mount the domain router in `routes.ts`
- [ ] Add auth gating and validation middleware inside the domain file
- [ ] Do not add queries directly to `storage.ts`
- [ ] Add operational logging using `lib/logger.ts`
- [ ] If admin-facing, wire `lib/adminAuditLogger.ts`
- [ ] Run `npm run guardrails` to verify no cross-app imports

## Operational Entry Points

Standalone auth and CLI modules remain at `apps/server/src/` root:

- `wechatAuth.ts` — WeChat OAuth2 flow
- `phoneAuth.ts` — SMS phone auth (legacy fallback)
- `adminAuth.ts` — admin authentication
- `auth/policy.ts` — env/debug auth policy helpers

## lib/ — Cross-Cutting Helpers

- `lib/logger.ts` — structured JSON logger
- `lib/adminAuditLogger.ts` — audit event logger
- `lib/aiTraceLogger.ts` — AI trace logger
- `lib/socialIcebreakerStore.ts` — PostgreSQL-backed icebreaker session store

New cross-cutting utilities belong in `lib/`, not inlined in routes.

## middleware/

- `middleware/requestId.ts` — request correlation IDs
- `middleware/metrics.ts` — Prometheus metrics middleware

Express middleware belongs here — not in `routes.ts` or domain files.

## MCP Integration

When reviewing or adding a route that touches database schema, use the **Postgres MCP server** (`postgres`) to verify that live tables, columns, and indexes match code assumptions.
