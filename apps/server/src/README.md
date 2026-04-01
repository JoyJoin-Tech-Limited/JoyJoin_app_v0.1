# Server Architecture Boundaries

This folder contains the active backend for JoyJoin's user-facing app and admin APIs.

## Source-of-truth entry points

- `apps/server/src/index.ts` — server bootstrap
- `apps/server/src/routes.ts` — primary API registration and many active user/admin routes
- `apps/server/src/storage.ts` — storage interface and most persistence operations
- `apps/server/src/db.ts` — Drizzle database connection

## Active domain ownership

### Auth and onboarding state

Owns authenticated user state, WeChat / phone auth integration, and server-driven onboarding decisions.

Primary files:
- `apps/server/src/routes.ts`
- `apps/server/src/wechatAuth.ts`
- `apps/server/src/phoneAuth.ts`
- `apps/server/src/replitAuth.ts`

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

Owns the active in-event Social Icebreaker flow and supporting AI generation.

Primary files:
- `apps/server/src/routes/socialIcebreaker.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/socialIcebreakerPhaseConfig.ts`

Boundary:
- New in-event icebreaker work should integrate here, not into legacy toolkit-style flows.

### Payments, subscriptions, and commerce

Owns payment initiation, webhook handling, subscription access, and monetization rules.

Primary files:
- `apps/server/src/paymentService.ts`
- `apps/server/src/subscriptionService.ts`
- `apps/server/src/routes.ts`

### Admin APIs and operational controls

Owns admin authentication, RBAC, moderation, venue/event operations, and KPI endpoints.

Primary files:
- `apps/server/src/adminAuth.ts`
- `apps/server/src/routes.ts`
- `apps/server/src/lib/adminAuditLogger.ts`

Boundary:
- All `/api/admin/*` routes must enforce admin middleware.

### Shared infrastructure inside the server app

Use these folders by responsibility:
- `/middleware` — cross-cutting HTTP concerns
- `/lib` — focused helpers and invariants used across domains
- `/services`, `/ai`, `/analytics`, `/inference`, `/gossip`, `/utils` — domain support modules
- `/__tests__` — automated tests

## Where new server files go

- **New HTTP endpoint in an existing domain:** add the route registration in `apps/server/src/routes.ts` unless the domain already has a dedicated router module.
- **New isolated router for a cohesive subdomain:** add it under `apps/server/src/routes/` and mount it from `routes.ts`.
- **Business logic reused by routes or jobs:** add a service file in `apps/server/src/` or a domain subfolder; keep controllers thin.
- **Cross-cutting helper or invariant:** add it under `apps/server/src/lib/`.
- **Request/response middleware:** add it under `apps/server/src/middleware/`.
- **Database schema or shared types:** do not add them here; put canonical contracts in `packages/shared/src/`.

## Do not treat these as active patterns

- Legacy onboarding/registration assumptions that predate server-driven `nextStep`
- Client-owned onboarding progress reconstruction
- New feature work built on deprecated flows kept only for backward compatibility
