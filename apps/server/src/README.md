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
- Location snapshots are captured on login (`captureLocationSnapshot(req, "login", userId)`), onboarding completion (`captureLocationSnapshot(req, "onboarding_complete", userId)`), and pool registration (`captureLocationSnapshot(req, "pool_registration", userId)`).

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

### Matching-Test Mode (test / staging only)

Owns end-to-end matching validation with one real tester + full-profile bot users through the production matching engine. Defense-in-depth isolation via env gates, DB markers, and a startup sentinel.

Primary files:
- `apps/server/src/services/matchingTestService.ts` — seed bots, create test pool, trigger match, cleanup
- `apps/server/src/routes/domains/matchingTest.ts` — `/api/test/matching-test/*` routes, gated by `isMatchingTestMode()`
- `apps/server/src/lib/isSingleTestMode.ts` — `isMatchingTestMode()` double gate

Boundary:
- Bot profiles include full matching-compatible data (archetypes, `user_interests`, industry tiers) so `poolMatchingService` scores them identically to real users.
- Cleanup deletes all test pool registrations and icebreaker data but preserves `payments` records.
- Startup sentinel crashes the server if `is_test_bot=true` rows exist in `APP_MODE=production`.

Full guide: `docs/operations/test-mode-operations.md` §H

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
- `apps/server/src/routes/domains/payments.ts` — includes `GET /api/payments/ritual-context` (Payment Ritual V2 real DB-backed context); mock payment creation when `MOCK_PAYMENTS=true` (instantly-paid orders, skips WeChat Pay API)
- `apps/server/src/paymentService.ts`
- `apps/server/src/subscriptionService.ts`
- `apps/server/src/repositories/paymentsRepo.ts`
- `apps/server/src/repositories/pricingRepo.ts`

Payment Ritual V2 endpoints:
- `GET /api/payments/ritual-context` — Returns user archetype, active pricing plans, user coupons, and real community stats (total members, weekly new, monthly events, recent activity) scoped by user's city. Requires auth. Gated by `checkPaymentsEnabled`.
- Analytics: `POST /api/analytics/payment` (defined in `routes/domains/analytics.ts`) — Fire-and-forget A/B test funnel instrumentation. Events stored in `paymentRitualEvents` table.

Mock payment mode:
- When `MOCK_PAYMENTS=true`, `POST /api/payments/miniprogram/create` creates orders with `status: "completed"` and `mock: true` without calling WeChat Pay API.
- Client receives `mock: true` in the response and skips `Taro.requestPayment()`, navigating directly to verification.
- Use for dev/staging testing without real charges. Default: `false`.

### Admin APIs and operational controls

Owns admin authentication, RBAC, moderation, venue/event operations, KPI endpoints, and content filter log queries.

Primary files:
- `apps/server/src/routes/domains/admin.ts`
- `apps/server/src/routes/domains/adminEventPools.ts` — CRUD, venue hints, time slot validation, archive/deletion for event pools
- `apps/server/src/routes/domains/venues.ts` — venue CRUD, onboarding lifecycle, deals, time slots, data quality
- `apps/server/src/repositories/venuesRepo.ts` — canonical venue data access; maps raw PostgreSQL `snake_case` rows to camelCase API contract
- `apps/server/src/routes/domains/adminOperations.ts` — content filter log admin endpoint (`GET /api/admin/content-filter/logs`), admin notification broadcast/send with content safety gating
- `apps/server/src/routes/domains/adminGeolocation.ts` — `GET /api/admin/geolocation/heatmap`, `POST /api/admin/geolocation/rollup` — location snapshot analytics, gated by `requireSuperAdmin`
- `apps/server/src/adminAuth.ts`
- `apps/server/src/lib/adminAuditLogger.ts`
- `apps/server/src/lib/featureFlags.ts` — DB-backed feature flag resolver with env fallback and short-lived cache
- `apps/server/src/lib/contentSafety.ts` — shared validation helper `validateContentSafe()` for field-level content filtering
- `apps/server/src/lib/captureLocationSnapshot.ts` — captures IP-based location snapshots on login, onboarding completion, and pool registration
- `apps/server/src/services/ipGeolocationService.ts` — IP geolocation resolution and admin heatmap rollups
- `apps/server/src/repositories/userLocationRepo.ts` — domain data access for user location snapshots and aggregation queries

Boundary:
- All `/api/admin/*` routes must enforce admin middleware.
- `GET /api/admin/content-filter/logs` is gated at operator+ level; pagination + filtering by userId/violationType/severity/field/date range.

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

### Referral & Invitation System

Owns referral codes and event-specific invitations — dual-table system with different lifecycle:

- **`referral_codes`** (permanent, user-level) — each user gets one; used for friend invites with reward tiers
- **`invitations`** (event-specific, expires at event start) — generated per pool registration with `invitationType` and `expiresAt`
- Both flow through the same `invitationCode` field on pool registration; server disambiguates by checking `invitations` table first, then `referral_codes`
- Referral conversions are recorded on pool registration; new-user attribution is recorded at WeChat login
- Session `pendingReferralCode` carries invite attribution across the login → pool-registration flow

Primary files:
- `apps/server/src/routes/domains/referrals.ts` — stats, invites received, invite link generation
- `apps/server/src/wechatAuth.ts` — both login endpoints accept `referralCode` for attribution
- `apps/server/src/routes/domains/userEventPools.ts` — invitation code lookup, self-referral guard, dedup guard, referral conversion recording

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

### Client analytics

Lightweight fire-and-forget endpoints for product analytics. Every endpoint validates against an allowed-event whitelist; mismatched `eventType` values are silently rejected. Rate-limited at 120 req/min per IP.

Primary files:
- `apps/server/src/routes/domains/analytics.ts` — mounts `/api/analytics/profile`, `/api/analytics/payment`, `/api/analytics/discover`, `/api/analytics/auth`, `/api/analytics/squad_unboxing`, `/api/analytics/social_icebreaker`, `/api/analytics/personality_result`, and `/api/analytics/participation_experiment`

Key endpoints:
- `POST /api/analytics/profile` — Profile tab interaction events (`profile_stat_tap`, `profile_archetype_cta_tap`, `profile_menu_tap`, `profile_logout_tap`, `profile_logout_cancel`, `profile_shell_retry`, `profile_share_app_message`, `profile_share_timeline`, `profile_milestone_impression`, `profile_milestone_tap`, `profile_pull_refresh`, `profile_share_card_generated`, `profile_share_card_error`, `profile_view`). Stored in `discoverAnalyticsEvents`.
- `POST /api/analytics/discover` — Discover and paid-event-ticket funnel events. Includes `event_ticket_payment_view`, `plan_switch`, `welcome_coupon_auto_applied`, `pay_start`, `pay_success`/`pay_cancel`/`pay_fail`/`pay_timeout`, `refund_policy_viewed`, `event_ticket_payment_abandon`, and the icebreaker-inclusion terms events `ticket_terms_row_impression`, `ticket_inclusion_sheet_open`, `ticket_inclusion_sheet_close`. Stored in `discoverAnalyticsEvents`.
- `POST /api/analytics/payment` — Payment Ritual V2 funnel events; stored in `paymentRitualEvents`.
- `POST /api/analytics/auth` — Auth revalidation gate events (`auth_revalidation_started`, `auth_revalidation_succeeded`, `auth_revalidation_failed`, `gate_timeout`, `gate_retry`, `gate_dismiss`). Stored in `discoverAnalyticsEvents`.
- `POST /api/analytics/squad_unboxing` — Squad-unboxing reveal interaction events. Stored in `discoverAnalyticsEvents`.
- `POST /api/analytics/social_icebreaker` — Custom-mode and phase-picker in-event events. Stored in `discoverAnalyticsEvents`.
- `POST /api/analytics/personality_result` — Personality result screen interaction events. Stored in `discoverAnalyticsEvents`.
- `POST /api/analytics/participation_experiment` — Participation experiment signal events. Stored in `discoverAnalyticsEvents`.

### Repository and facade boundaries

- Add new persistence logic to the nearest file in `apps/server/src/repositories/`.
- Keep `apps/server/src/storage.ts` as a thin composition layer for existing call sites.
- Put remaining legacy storage behavior behind `apps/server/src/repositories/legacyStorageRepo.ts` rather than expanding active domain repositories with unrelated concerns.

### Shared infrastructure inside the server app

Use these folders by responsibility:
- `/middleware` — cross-cutting HTTP concerns
- `/lib` — focused helpers and invariants used across domains (includes `contentSafety.ts` — `validateContentSafe()` for field-level content filtering)
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
