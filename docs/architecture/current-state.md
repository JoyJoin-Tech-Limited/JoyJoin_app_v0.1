# Current Architecture Map

This document is the active architecture map for contributors working in the current JoyJoin codebase.

Use it together with:
- `.github/copilot-instructions.md`
- `DEVELOPER_QUICK_REFERENCE.md`
- `docs/onboarding-flow.md`

## Monorepo map

- `apps/user-client` — user-facing React app
- `apps/admin-client` — separate admin React app
- `apps/mini-program` — WeChat Mini Program beta client built with Taro 4 + React 18
- `apps/server` — Express API and operational backend
- `packages/shared` — shared schema, contracts, taxonomies, and engines

## Active architecture by domain

### 1. Onboarding and authenticated routing

**Authority chain**
1. `apps/server/src/routes/domains/auth.ts` computes and serves `nextStep` from `GET /api/auth/user`
2. `apps/user-client/src/hooks/useAuth.ts` exposes that contract
3. `apps/user-client/src/App.tsx` gates routes from `nextStep`
4. `apps/user-client/src/features/onboarding/active/flow.ts` and `useOnboardingOrchestrator.ts` provide the canonical client mapping helpers

**Active flow module**
- `apps/user-client/src/features/onboarding/active/pages/PersonalityTestPage.tsx`
- `apps/user-client/src/pages/PersonalityTestResultPage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/WeChatAuthGatePage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/EssentialDataPage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/ExtendedDataPage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/FinalProfileReviewPage.tsx`

**Active pre-auth route sequence**
- `/personality-test` → `/personality-test/results` → `/personality-test/auth-gate`
- After auth succeeds, the server-owned `nextStep` contract takes over for `/onboarding/setup` → `/onboarding/extended` → `/onboarding/review` → `/discover`

**Boundary rules**
- Do not reconstruct onboarding progress as a new client-side source of truth.
- Treat `guide` and `onboarding` as compatibility values, not new feature targets.
- Keep server-owned completion semantics aligned with the `users` table and `/api/auth/user` response.
- Legacy onboarding surfaces stay under `apps/user-client/src/legacy/onboarding/`.

Primary files:
- `apps/user-client/src/features/onboarding/README.md`
- `apps/user-client/src/App.tsx`
- `apps/user-client/src/hooks/useAuth.ts`
- `apps/server/src/routes/domains/auth.ts`
- `apps/server/src/routes/domains/onboarding.ts`

### 2. Matching, events, and post-match experience

**Deterministic matching**
- `apps/server/src/poolMatchingService.ts`
- `apps/server/src/poolRealtimeMatchingService.ts`
- `packages/shared/src/personality/`

**AI explanation and enrichment**
- `apps/server/src/matchExplanationService.ts`
- `packages/shared/src/types/aiMeta.ts`

**Client surfaces**
- `apps/user-client/src/pages/DiscoverPage.tsx`
- `apps/user-client/src/pages/MatchingStatusPage.tsx`
- `apps/user-client/src/components/matching/`
- `apps/user-client/src/components/event-pool-registration/`
- `apps/mini-program/src/pages/matching-status/index.tsx`
- `apps/mini-program/src/pages/squad-unboxing/index.tsx`
- `apps/mini-program/src/pages/pool-group-detail/index.tsx`

Boundary:
- Deterministic scores come from active server matching rules, not client heuristics.
- **Updated 2026-04-07:** Active blind-pool discovery is pool-first: `BlindBoxEventCard` + `PreJoinVibeBriefSheet` + `JoinEventPoolSheet` are the client entry surfaces, while `MatchingStatusPage` owns the waiting / reveal path after a pending registration exists.
- `PoolForecastStrip` is deterministic client-side atmosphere guidance only; it does not participate in pair scoring or group formation.
- Matching is not deadline-only: `poolRealtimeMatchingService.ts` supports registration-triggered realtime scans and scheduled scans via `scanPoolAndMatch`.
- Post-match clients consume `PoolGroupMemberSummary` from `packages/shared/src/api.ts`; use `ageLabel` and the visibility flags instead of reconstructing exact age or other hidden profile fields client-side.
- Browser blind-box checkout returns through `apps/user-client/src/pages/BlindBoxConfirmationPage.tsx` and `apps/admin-client/src/pages/BlindBoxConfirmationPage.tsx`; both pages poll `/api/payments/status/:wechatOrderId`, keep transient verification failures recoverable, and then hand off to `/events` or `/discover` after confirmation.
- Mini-program payment verification remains separate under `apps/mini-program/src/pages/payment-verification/index.tsx`; keep the JSAPI in-program payment flow there rather than reusing the browser H5 confirmation path.

### 3. Social Icebreaker

**Shared contract**
- `packages/shared/src/socialIcebreaker.ts`

**Server runtime**
- `apps/server/src/routes/socialIcebreaker.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/lib/socialIcebreakerStore.ts` — PostgreSQL-backed session persistence layer (sessions, participants, lie-truths); replaced the previous in-memory Maps

**Client hook/surfaces**
- `apps/user-client/src/hooks/useSocialIcebreaker.ts`
- `apps/user-client/src/pages/IcebreakerSessionPage.tsx`
- `apps/mini-program/src/pages/icebreaker-session/index.tsx`

Boundary:
- This is the active in-event icebreaker system; do not route new primary icebreaker work through legacy toolkit flows.
- All session reads and writes go through `lib/socialIcebreakerStore.ts`; do not add direct `db` calls in the route file.
- `GET /api/social-icebreaker/:socialSessionId` returns `joinedParticipants` in `SocialSessionState`; client participant rendering should prefer that roster over event-attendee fallbacks when it is present.

### 4. Shared contracts and cross-platform ownership

**Canonical schema**
- `packages/shared/src/schema.ts`

**Shared contract barrel**
- `packages/shared/src/index.ts`

**Domain guide**
- `packages/shared/src/README.md`

**Shared cross-platform modules**
- `packages/shared/src/onboarding.ts` — `nextStepToOnboardingStep`, `buildOnboardingProgress`
- `packages/shared/src/api.ts` — typed API helpers and DTOs for onboarding/profile, pricing, coupons, payments, notifications, blind-box events, and pool-group details used by both web and mini-program
- `packages/shared/src/centerTabRouting.ts` — shared center CTA label, destination, and badge rules used by the web bottom nav and the mini-program custom tab bar
- `packages/shared/src/hongKongTime.ts` — shared Hong Kong date comparison and formatting helpers used by both clients
- `packages/shared/src/archetypeColors.ts` — archetype HSL color tokens; single source consumed by both clients
- `packages/shared/src/achievements.ts` — achievement definitions and rarity types used by the gamification system on both platforms
- `packages/shared/src/gamification.ts` — XP/level system shared constants

Boundary:
- If more than one app/runtime must agree on a contract, define it in `packages/shared`.
- If code is runtime-specific, keep it in that app and import only the shared definitions.
- `apps/user-client` is the active web sandbox and future web release surface; `apps/mini-program` is the beta production client. Shared business rules should not fork between them.

### 5. Server domain ownership

**Routes**
- `apps/server/src/routes.ts` is the composition root that mounts domain routers from `apps/server/src/routes/domains/`
- Domain modules currently include auth, onboarding, assessment, analytics, admin, payments, and icebreaker routing

**Data access**
- `apps/server/src/storage.ts` is now a compatibility facade composed from `apps/server/src/repositories/*`
- New persistence logic should live in the nearest domain repository instead of expanding the legacy facade

**Operational entry points**
- `apps/server/src/wechatAuth.ts`
- `apps/server/src/phoneAuth.ts`
- `apps/server/src/adminAuth.ts`
- `apps/server/src/lib/adminAuditLogger.ts`

### 6. Runtime deployment topology

**Active production path**
- `.github/workflows/cicd.yml` deploys by SSHing into the remote server (`SERVER_IP` secret), resetting the checked-out repo, changing into `~/JoyJoin/deployment`, and then running `docker compose -f docker-compose.caddy.yml up -d --build --remove-orphans`.
- `deployment/Caddyfile` is the public edge and TLS terminator for `yuejuapp.com`, `www.yuejuapp.com`, `admin.yuejuapp.com`, and `api.yuejuapp.com`.
- `deployment/docker-compose.caddy.yml` runs the active runtime containers: `joyjoin-api`, `joyjoin-user`, `joyjoin-admin`, and `joyjoin-caddy`.

**Database boundary**
- The active deployment expects `DATABASE_URL` to point at an external PostgreSQL instance.
- The repository does not provision a PostgreSQL container or host-managed database service in `deployment/docker-compose.caddy.yml`; contributors should not assume the remote app server has a local database to attach to.

## Where new files go

### User client
- Route-level page: `apps/user-client/src/pages/` unless it belongs to the active onboarding module
- Active onboarding page/hook/flow utility: `apps/user-client/src/features/onboarding/active/`
- Shared presentation component: `apps/user-client/src/components/`
- Client hook or query adapter: `apps/user-client/src/hooks/`
- Pure browser utility: `apps/user-client/src/lib/` or `apps/user-client/src/utils/`

### Mini Program
- Taro page entry: `apps/mini-program/src/pages/` — register new pages in `apps/mini-program/src/lib/onboardingRoutes.ts`
- Mini Program runtime helper: `apps/mini-program/src/lib/`
- Mini Program hook: `apps/mini-program/src/hooks/`
- Mini Program provider: `apps/mini-program/src/providers/`
- Native WeChat custom tab bar implementation: `apps/mini-program/src/native-custom-tab-bar/`
- The build copies `apps/mini-program/src/native-custom-tab-bar/` into the runtime `custom-tab-bar/` directory; `apps/mini-program/src/custom-tab-bar/` is not the active runtime path.
- Tab selection / center CTA sync: `apps/mini-program/src/lib/tabBarConfig.ts`, `apps/mini-program/src/lib/centerTabRouting.ts`, `apps/mini-program/src/hooks/useCustomTabBarSync.ts`
- Active custom-tab-bar constraints live in `apps/mini-program/README.md`; keep the native tree within `cover-view` nesting rules and treat shadow, gradient, and overflow-driven protrusions as compatibility-sensitive.
- App-level config / lifecycle: `apps/mini-program/src/app.ts` (provider setup), `apps/mini-program/src/app.config.ts` (page list plus `tabBar.custom` ownership)
- Cross-platform contract or pure business rule: `packages/shared/src/` (`api.ts`, `centerTabRouting.ts`, `hongKongTime.ts`)

**Navigation rule:** Tab pages must use `Taro.switchTab()`. Sub-pages use `Taro.navigateTo()` or `Taro.redirectTo()`.

### Server
- Route registration composition: `apps/server/src/routes.ts`
- Cohesive domain router: `apps/server/src/routes/domains/`
- Domain repository: `apps/server/src/repositories/`
- Domain service: `apps/server/src/` or an existing domain subfolder
- Cross-cutting invariant/helper: `apps/server/src/lib/`
- Middleware: `apps/server/src/middleware/`

### Shared package
- Shared schema/model: `packages/shared/src/schema.ts`
- Shared types/contracts: `packages/shared/src/types/`
- Shared product constants/taxonomies: existing closest file in `packages/shared/src/`
- Shared UI primitive: `packages/shared/src/ui/`

## Contribution guardrails

- Prefer adding to an active domain over reviving a legacy path.
- Document active behavior close to the code when a feature has important boundaries.
- When changing onboarding, matching, shared contracts, or server domain ownership, update the nearest domain README if the boundary changes.
