# Server Architecture Boundaries

This folder contains the active backend for JoyJoin's user-facing app and admin APIs.

## Source-of-truth entry points

- `apps/server/src/index.ts` — server bootstrap
- `apps/server/src/routes.ts` — top-level composition root for domain routers
- `apps/server/src/routes/domains/` — extracted route ownership by domain
- `apps/server/src/storage.ts` — compatibility facade composed from domain repositories
- `apps/server/src/repositories/` — domain-oriented data access modules
- `apps/server/src/db.ts` — Drizzle database connection

## Active domain ownership

### Auth and onboarding state

Owns authenticated user state, WeChat / phone auth integration, and server-driven onboarding decisions.

Primary files:
- `apps/server/src/routes/domains/auth.ts`
- `apps/server/src/routes/domains/onboarding.ts`
- `apps/server/src/wechatAuth.ts`
- `apps/server/src/phoneAuth.ts`
- `apps/server/src/repositories/onboardingRepo.ts`
- `apps/server/src/repositories/usersRepo.ts`

Key rule:
- `/api/auth/user` is the authority for `nextStep`, `profileEssentialComplete`, and `profileExtendedComplete`.
- Do not move onboarding state calculation into the client.

### Matching and pool formation

Owns deterministic match scoring, group formation, and related explanation services.

Primary files:
- `apps/server/src/poolMatchingService.ts`
- `apps/server/src/poolRealtimeMatchingService.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/archetypeChemistry.ts`

Boundary:
- Deterministic matching reads canonical user/profile inputs and `user_interests` data.
- AI explanation layers may enrich output, but must not redefine deterministic scoring rules.

### Social Icebreaker and event-time AI

Owns the active in-event Social Icebreaker flow, session/check-in surfaces, and supporting AI generation.

Primary files:
- `apps/server/src/routes/socialIcebreaker.ts`
- `apps/server/src/lib/socialIcebreakerStore.ts`
- `apps/server/src/routes/domains/icebreakerSessions.ts`
- `apps/server/src/repositories/icebreakerRepo.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/socialIcebreakerPhaseConfig.ts`

Boundary:
- `apps/server/src/routes/socialIcebreaker.ts` persists live social-session state through `apps/server/src/lib/socialIcebreakerStore.ts`.
- `apps/server/src/routes/domains/icebreakerSessions.ts` and `apps/server/src/repositories/icebreakerRepo.ts` own event-session, check-in, and attendance-adjacent flows.
- New in-event icebreaker work should integrate here, not into legacy toolkit-style flows.

### Payments, subscriptions, and commerce

Owns payment initiation, webhook handling, subscription access, and monetization rules.

Primary files:
- `apps/server/src/routes/domains/payments.ts`
- `apps/server/src/paymentService.ts`
- `apps/server/src/subscriptionService.ts`
- `apps/server/src/repositories/paymentsRepo.ts`

### Admin APIs and operational controls

Owns admin authentication, RBAC, moderation, venue/event operations, and KPI endpoints.

Primary files:
- `apps/server/src/routes/domains/admin.ts`
- `apps/server/src/adminAuth.ts`
- `apps/server/src/lib/adminAuditLogger.ts`

Boundary:
- All `/api/admin/*` routes must enforce admin middleware.

### Repository and facade boundaries

- Add new persistence logic to the nearest file in `apps/server/src/repositories/`.
- Keep `apps/server/src/storage.ts` as a thin composition layer for existing call sites.
- Put remaining legacy storage behavior behind `apps/server/src/repositories/legacyStorageRepo.ts` rather than expanding active domain repositories with unrelated concerns.

### Shared infrastructure inside the server app

Use these folders by responsibility:
- `/middleware` — cross-cutting HTTP concerns
- `/lib` — focused helpers and invariants used across domains
- `/services`, `/ai`, `/analytics`, `/inference`, `/gossip`, `/utils` — domain support modules
- `/__tests__` — automated tests

## Where new server files go

- **New HTTP endpoint in an existing domain:** add it to the relevant file under `apps/server/src/routes/domains/` and mount it from `apps/server/src/routes.ts` if needed.
- **New isolated router for a cohesive subdomain:** add it under `apps/server/src/routes/` when it already behaves as a standalone module.
- **Business logic reused by routes or jobs:** add a service file in `apps/server/src/` or a domain subfolder; keep controllers thin.
- **Cross-cutting helper or invariant:** add it under `apps/server/src/lib/`.
- **Request/response middleware:** add it under `apps/server/src/middleware/`.
- **Database schema or shared types:** do not add them here; put canonical contracts in `packages/shared/src/`.

## Do not treat these as active patterns

- Legacy onboarding/registration assumptions that predate server-driven `nextStep`
- Client-owned onboarding progress reconstruction
- New feature work built on deprecated flows kept only for backward compatibility
