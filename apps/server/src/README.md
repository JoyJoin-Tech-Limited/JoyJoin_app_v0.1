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
- `apps/server/src/routes/socialIcebreaker.ts` — active social icebreaker session flow
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/socialIcebreakerPhaseConfig.ts`

Boundary:
- `apps/server/src/routes/socialIcebreaker.ts` persists live social-session state through `apps/server/src/lib/socialIcebreakerStore.ts`.
- `apps/server/src/routes/socialIcebreaker.ts` and `apps/server/src/lib/socialIcebreakerStore.ts` own the active social icebreaker session flow.
- Legacy `icebreakerSessions.ts` and `icebreakerRepo.ts` were archived/removed (2026-05).
- New in-event icebreaker work should integrate here, not into legacy toolkit-style flows.

### AI text quality and Xiaoyue writing craft

Owns the deterministic writing quality system applied to all Xiaoyue-generated Chinese text across personality test results, social icebreaker coaching, mini-script narratives, and match explanations.

Primary files:
- `apps/server/src/prompts/craft.ts` — 9 canonical writing axioms (XIAOYUE_CRAFT_PRINCIPLES + XIAOYUE_CRAFT_LITE), versioned prompt module injected into all Xiaoyue LLM call sites. Axiom 9 added 2026-06-02 (对话感/conversational flow).
- `apps/server/src/lib/writingCraftValidator.ts` — deterministic post-generation craft scoring (0-100) with context-aware thresholds: 70 for analysis/narrative, 55 for comment/coaching/lite. Rhythm, imagery, landing, and density checks skipped for short text.
- `apps/server/src/lib/craftQualityGate.ts` — shared `generateWithCraftQuality()` utility wrapping inject → validate → retry (max 2) for any LLM call. New LLM surfaces should use this instead of inline retry.
- `apps/server/src/xiaoyueAnalysisService.ts` — personality test result analysis using `generateWithCraftQuality()` with full principles and 2 retries.
- `apps/server/src/matchExplanationService.ts` — pair match explanations with XIAOYUE_CRAFT_LITE injection + non-blocking craft diagnostic.
- `apps/server/src/ai/socialIcebreakerPrompts.ts` — craft injection into icebreaker comment, recap, and session-pack prompts.
- `apps/server/src/ai/miniscriptPrompts.ts` — craft injection + 3 narrative golden rules (show-don't-tell, conflict-driven, cliffhanger).
- `apps/server/src/lib/miniscriptValidator.ts` — 5 deterministic narrative craft checks run pre-LLM validation.

Key invariants:
- Every LLM call producing Xiaoyue Chinese text must inject craft principles.
- New LLM surfaces should use `generateWithCraftQuality()` from `craftQualityGate.ts` instead of inline retry logic.
- Validation threshold is context-aware: analysis/narrative = 70, comment/coaching = 55.
- Cache keys include `XIAOYUE_CRAFT_PROMPT_VERSION` — axiom updates auto-invalidate.
- `XIAOYUE_CRAFT_LITE` used for token-budget-constrained calls (comments, coaching hints).

Skill: `xiaoyue-writing-craft`

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
- `apps/server/src/lib/featureFlags.ts` — DB-backed feature flag resolver with env fallback and short-lived cache

Boundary:
- All `/api/admin/*` routes must enforce admin middleware.

### Match Compass (preference tuning)

Post-registration preference dashboard on matching-status pending page. Users tune dealbreakers and nice-to-haves until `preference_lock_at` (24h before event). Strictness scalar affects group formation only; pair scores remain sacred.

Primary files:
- `apps/server/src/routes/domains/matchCompass.ts` — mounts `GET /api/event-pools/:id/match-compass`, `PATCH /api/event-pool-registrations/:id/preferences`, `POST /api/event-pool-registrations/:id/preferences/reset`, `POST /api/users/me/preference-dna`
- `apps/server/src/lib/matchCompass.ts` — `buildDefaultPreferencesFromArchetype`, `coerceStrictness`, `resolveTemperatureBand`
- `apps/server/src/poolMatchingService.ts` — `pairMeetsDealbreakers`, `resolveStrictnessWeights`

Boundary:
- Kill switch: `MATCH_COMPASS_STRICTNESS_ENABLED=false` hides UI and forces legacy matching path.
- `preference_strictness` null is coerced to 50 server-side; no mandatory backfill migration.
- Eligibility count uses batched `inArray` loads (no N+1).

### Predictive Shell (composite tab data)

Owns composite endpoints that bundle tab-specific data to reduce client round-trips.

Primary files:
- `apps/server/src/routes/domains/shell.ts` — mounts `/api/shell/discover`, `/api/shell/profile`, `/api/shell/events`, `/api/shell/connections`
- `apps/server/src/repositories/shellRepository.ts` — composite data assembly for all 4 shells
- `apps/server/src/lib/shellCache.ts` — shared NodeCache singleton (30s TTL) with cross-shell invalidation
- `apps/server/src/lib/buildAuthUserResponse.ts` — shared auth response builder used by `/api/auth/user` and all shells
- `apps/server/src/repositories/joinedEventsRepo.ts` — N+1-free user joined events (used by events shell)
- `apps/server/src/repositories/connectionsRepo.ts` — N+1-free mutual connections (used by connections shell)

Boundary:
- Shells return pruned or full `AuthUserResponse` depending on the tab's needs.
- Cache invalidation is triggered on mutations: payment/coupon use, pool registration, connection creation.
- Legacy endpoints (`/api/events/joined`, `/api/my-connections`) remain for client fallback.

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
