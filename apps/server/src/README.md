# Server Architecture Boundaries

This folder contains the active backend for JoyJoin's user-facing app and admin APIs.

## Source-of-truth entry points

- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/index.ts` — server bootstrap
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes.ts` — primary API registration and many active user/admin routes
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/storage.ts` — storage interface and most persistence operations
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/db.ts` — Drizzle database connection

## Active domain ownership

### Auth and onboarding state

Owns authenticated user state, WeChat / phone auth integration, and server-driven onboarding decisions.

Primary files:
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/wechatAuth.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/phoneAuth.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/replitAuth.ts`

Key rule:
- `/api/auth/user` is the authority for `nextStep`, `profileEssentialComplete`, and `profileExtendedComplete`.
- Do not move onboarding state calculation into the client.

### Matching and pool formation

Owns deterministic match scoring, group formation, and related explanation services.

Primary files:
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/poolMatchingService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/poolRealtimeMatchingService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/matchExplanationService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/archetypeChemistry.ts`

Boundary:
- Deterministic matching reads canonical user/profile inputs and `user_interests` data.
- AI explanation layers may enrich output, but must not redefine deterministic scoring rules.

### Social Icebreaker and event-time AI

Owns the active in-event Social Icebreaker flow and supporting AI generation.

Primary files:
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes/socialIcebreaker.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/socialIcebreakerAIService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/socialIcebreakerPhaseConfig.ts`

Boundary:
- New in-event icebreaker work should integrate here, not into legacy toolkit-style flows.

### Payments, subscriptions, and commerce

Owns payment initiation, webhook handling, subscription access, and monetization rules.

Primary files:
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/paymentService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/subscriptionService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes.ts`

### Admin APIs and operational controls

Owns admin authentication, RBAC, moderation, venue/event operations, and KPI endpoints.

Primary files:
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/adminAuth.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/lib/adminAuditLogger.ts`

Boundary:
- All `/api/admin/*` routes must enforce admin middleware.

### Shared infrastructure inside the server app

Use these folders by responsibility:
- `/middleware` — cross-cutting HTTP concerns
- `/lib` — focused helpers and invariants used across domains
- `/services`, `/ai`, `/analytics`, `/inference`, `/gossip`, `/utils` — domain support modules
- `/__tests__` — automated tests

## Where new server files go

- **New HTTP endpoint in an existing domain:** add the route registration in `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes.ts` unless the domain already has a dedicated router module.
- **New isolated router for a cohesive subdomain:** add it under `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes/` and mount it from `routes.ts`.
- **Business logic reused by routes or jobs:** add a service file in `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/` or a domain subfolder; keep controllers thin.
- **Cross-cutting helper or invariant:** add it under `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/lib/`.
- **Request/response middleware:** add it under `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/middleware/`.
- **Database schema or shared types:** do not add them here; put canonical contracts in `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/`.

## Do not treat these as active patterns

- Legacy onboarding/registration assumptions that predate server-driven `nextStep`
- Client-owned onboarding progress reconstruction
- New feature work built on deprecated flows kept only for backward compatibility
