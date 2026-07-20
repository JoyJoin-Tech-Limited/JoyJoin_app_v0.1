# Current Architecture Map

This document is the active architecture map for contributors working in the current JoyJoin codebase.

Use it together with:
- `.github/copilot-instructions.md`
- `DEVELOPER_QUICK_REFERENCE.md`
- `docs/systems/systems/onboarding-flow.md`
- `docs/ai/ai/ai-workflow-documentation-refresh.md` — when updating documentation across `docs/`, `.github/skills/`, and `.github/agents/` in one effort (scope tiers, validation)

## Monorepo map

- `apps/user-client` — user-facing React app
- `apps/admin-client` — separate admin React app
- `apps/mini-program` — WeChat Mini Program client (Taro 4 + React 18); **launch-primary** surface for the current track (see [`apps/mini-program/README.md`](../../apps/mini-program/README.md))
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
- `/personality-test` → `/personality-test/results` (inline WeChat login + anonymous answer import)
- After auth succeeds, the server-owned `nextStep` contract takes over for `/onboarding/setup` → `/onboarding/extended` → `/onboarding/review` → `/discover`

**Boundary rules**
- Do not reconstruct onboarding progress as a new client-side source of truth.
- Treat `guide` and `onboarding` as compatibility values, not new feature targets.
- Keep server-owned completion semantics aligned with the `users` table and `/api/auth/user` response.
- **`profileExtendedComplete`** (auth response) is not the same gate as **`hasCompletedInterestsCarousel`** — extended-data step uses the carousel flag.
- **`onboardingCheckpoint`** (optional on `users`) can let `auth.ts` advance `nextStep` forward for recovery when the checkpoint is ahead of the base step.
- Legacy onboarding surfaces stay under `apps/user-client/src/legacy/onboarding/`.

**Mini-program:** `apps/mini-program/src/pages/onboarding/` mirrors the value-first and post-auth steps; shared helpers live in `packages/shared/src/onboarding.ts`. **Personality test** UI: `pages/onboarding/personality-test/` (subpackage). **WeChat login:** returning users `pages/login` + `hooks/useWeChatLogin.ts` (`/api/auth/wechat/login`); first-time handoff from test results uses `authenticateMiniProgramUserWithTest` (`/api/auth/wechat/login-with-test`) inline on the results page. The standalone auth-gate page was removed in 2026-05. **Payments:** `pages/blind-box-payment`, `pages/payment-verification`, plus `lib/paymentPendingOrder*.ts` and `app.ts` pending-order resume — see [`docs/reference/reference/PLATFORM_COORDINATION.md`](../reference/PLATFORM_COORDINATION.md).

**Mini-program landing page cold-start behavior (2026-06-08):**
- `AutoLoginBridge` (rendered in `app.ts`) silently re-authenticates returning users via `wx.login` → `seedMiniProgramAuthSession()`. Retryable errors (transport, 500) reset the attempt guard so the next mount/foreground can retry; 401s are treated as expected (new user) and do not retry.
- The landing page (`pages/index/index`) runs a **unified redirect effect** after auth resolves: guests with an incomplete anonymous assessment session → `reLaunch` to `/pages/onboarding/personality-test/index`. Authenticated path takes priority.
- **Returning mid-onboarding users are routed to the welcome-back screen** (`pages/onboarding/welcome-back/index`) instead of directly to `nextStep`. The landing page checks `shouldShowWelcomeBack()`: requires `nextStep !== 'discover'`, `features.restartOnboarding === true`, `restartsRemaining > 0`, and `joyjoin_welcome_back_seen` not set. This gives users context and an explicit restart option.
- The welcome-back `seen` flag is reset after 7 days (`app.ts` `useLaunch` TTL heuristic) because WeChat storage persists across mini-program deletion. Without this, users who delete and re-enter would never see the welcome-back screen again.
- Primary CTA navigation uses a **5s safety timeout** (`navigateWithLegalGate` in `LandingPage.tsx`) that resets the button loading state if `Taro.navigateTo` to the onboarding subpackage hangs (e.g., subpackage download stuck).
- **Authenticated discover routing (2026-06-13):** Returning authenticated users whose `nextStep === 'discover'` are treated as a valid continue state. The primary CTA label shows `进入发现页` and routes directly to Discover (`Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.discover })`) instead of pushing them through onboarding again.

Primary files:
- `apps/user-client/src/features/onboarding/README.md`
- `apps/user-client/src/App.tsx`
- `apps/user-client/src/hooks/useAuth.ts`
- `apps/server/src/routes/domains/auth.ts`
- `apps/server/src/routes/domains/onboarding.ts`
- `packages/shared/src/onboarding.ts`

### 2. Matching, events, and post-match experience

**Deterministic matching**
- `apps/server/src/poolMatchingService.ts` — also implements the feature-flagged operator-review gate (`matchingOperatorReviewEnabled`) and per-pool gender-balance enforcement (soft bonus / hard floors at the commit gate and in all redistribution phases, wired 2026-07-14; see `docs/systems/MATCHING_ALGORITHM_REFERENCE.md` §4.2.1)
- `apps/server/src/poolRealtimeMatchingService.ts`
- `apps/server/src/matchingSemantic.ts` — optional 7th pair dimension when `ENABLE_SEMANTIC_SIMILARITY=true` (weights redistribute; see `poolMatchingService.ts` comments)
- `packages/shared/src/personality/`

**Event pool operations (stats, registration, outcomes)**
- `apps/server/src/routes/domains/eventPools.ts` — includes `GET /api/event-pools/:poolId/stats`; `estimatedGroups` is conservative (`Math.floor` of registrations ÷ `minGroupSize`, capped by pool `targetGroups`)
- `apps/server/src/routes/domains/eventGroupOutcomes.ts` — post-match group outcome submission

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
- Browser blind-box checkout returns through `apps/user-client/src/pages/BlindBoxConfirmationPage.tsx` and `apps/admin-client/src/pages/BlindBoxConfirmationPage.tsx`; both pages poll `/api/payments/status/:wechatOrderId`, keep transient verification failures recoverable, and then hand off to `/events` or `/discover` after confirmation. (Web is reference-only; not shipping.)
- Mini-program payment verification remains separate under `apps/mini-program/src/pages/payment-verification/index.tsx`; keep the JSAPI in-program payment flow there as the canonical launch-primary flow. The browser H5 confirmation path is reference-only.
- Mini-program personality-test results live in `apps/mini-program/src/pages/onboarding/personality-test/results/index.tsx`; keep reveal replay, native share hooks, and the poster composition helper in `apps/mini-program/src/pages/onboarding/personality-test/results/sharePoster.ts` inside that Taro onboarding surface rather than moving them into server or shared runtime modules.

### 2a. 闪现 NPC｜阿浪 + Profile V1.7

**Authority chain**
1. `apps/server/src/routes/domains/alang.ts` owns mission transitions, GPS reports, completion, and archive identity.
2. `apps/server/src/lib/alang/alangDisclosure.ts` removes all search/trigger coordinates and releases `routeDestination` only from the companion stage onward; `alangTargetResolver.ts` supplies the same canonical endpoint to route display and GPS.
3. `packages/shared/src/alang/` and `packages/shared/src/api/alang.ts` own the GCJ-02 `latitude/longitude` contract and legacy JSON normalization.
4. `apps/mini-program/src/pages/alang/` reads `myProgress` on foreground recovery and replaces stale pages according to the server stage.
5. `apps/server/src/routes/domains/personalStory.ts` + `jobs/personalStoryWorker.ts` own the private append-only story; source facts are selected server-side and one durable job resumes from its persisted source cursor.
6. `apps/server/src/routes/domains/equipment.ts` + `repositories/equipmentRepo.ts` own wardrobe, venue/mission pools, entitlement draws, pity, fragments and fragment-only redemption. Clients never choose a user or reward source.

**Map boundary**
- Native Taro/WeChat Map renders the client view; `apps/server/src/routes/domains/geo.ts` reuses `TENCENT_MAP_KEY` for reverse geocoding, POI suggestion/search, and walking routes.
- Search Map receives only the user's current location. The companion route is fetched only after explicit user action.
- Tencent walking distance/ETA is presentational. `alangGeoFence.ts` (5 m + consecutive stable reports) remains arrival authority.
- Alang config/debug pages and target overrides are strict non-production single-test surfaces.
- FUTURE 04 and REMOVED 09 are not active code surfaces. A 2026-07-15 product override uses ACTIVE 07 only as visual tone and authorizes a Profile-only My Image/equipment minimum loop instead of implementing the full FUTURE 08 mockup.
- Profile V1.7 reads real shell/gamification data and renders one of 12 Profile-only 512×768 transparent pixel-animal WebP assets from the CDN over the existing warm-white/purple UI. The approved base assets already contain initial clothing; a character-only fallback handles image failure. Equip/unequip/save/inventory remain server-backed, but unapproved item raster is not requested or replaced with fabricated geometric/code-native layers—the UI keeps the clothed base character until formal layered art is approved and published. It links to `pages/profile-linked/my-image` and `personal-story`. `profileRedesignEnabled=false` stops the V1.7-only gamification/equipment/story work.
- Blind-box story eligibility is server proof, not client or outcome-only state: the acting user's group outcome binds the group, and eligibility additionally requires the current user to be matched, the non-test pool/group to be uncancelled and finished, and that event's current-user `event_feedback.completedAt` to be non-null. Feedback content and scores never enter the model prompt.
- Personal-story AI reuses existing MiniMax/DeepSeek clients. It receives only server-selected keywords and rejects unsupported details; provider failure never creates a deterministic or fabricated chapter. `personalStoryEnabled=false` closes the client entry and GET/POST/status before any story-table access; when the flag is `true` but providers are unavailable, existing chapters remain readable and failed updates do not mutate history.
- Formal Alang art is still `awaiting-approved-art`, so labelled placeholders remain intentional.

Canonical implementation and rollback notes: `docs/alang-prototype/implementation-map.md`.

### 3. Social Icebreaker

**Shared contract**
- `packages/shared/src/socialIcebreaker.ts`

**Server runtime**
- `apps/server/src/routes/domains/icebreaker.ts` — mounts `app.use('/api/social-icebreaker', …, socialIcebreakerRoutes)` (see `routes/socialIcebreaker.ts`)
- `apps/server/src/routes/socialIcebreaker.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/socialIcebreakerPhaseConfig.ts` — phase config aligned with `packages/shared/src/socialIcebreaker.ts`
- `apps/server/src/lib/socialIcebreakerStore.ts` — PostgreSQL-backed session persistence layer (sessions, participants, lie-truths, phase metrics); replaced the previous in-memory Maps
- `apps/server/src/lib/socialIcebreakerSweep.ts` — expiry sweep for persisted sessions
- `apps/server/src/lib/momentCardRenderer.ts` — server-side Moment Card PNG renderer via `@napi-rs/canvas`; registers CJK fonts from common system paths on module load; logs warning if none found

**Client hook/surfaces**
- `apps/user-client/src/hooks/useSocialIcebreaker.ts`
- `apps/user-client/src/pages/IcebreakerSessionPage.tsx`
- `apps/mini-program/src/pages/icebreaker-session/index.tsx` — hosts `BonusGateOverlay` for the `mini_script` bonus vote gate
- `apps/mini-program/src/pages/icebreaker-session/overlays/BonusGateOverlay.tsx`

Boundary:
- This is the active in-event icebreaker system; do not route new primary icebreaker work through legacy toolkit flows.
- All session reads and writes go through `lib/socialIcebreakerStore.ts`; do not add direct `db` calls in the route file.
- `GET /api/social-icebreaker/:socialSessionId` returns `joinedParticipants` in `SocialSessionState`; client participant rendering should prefer that roster over event-attendee fallbacks when it is present.
- `GET /api/social-icebreaker/:socialSessionId/moment-card.png` returns a server-rendered 640×1040 PNG share card when `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER` is enabled. Rate-limited to 5 req/min per user.
- Bonus gate: when `mini_script` is the next eligible phase and `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true`, phase advance pauses at a host+player vote gate (`bonusGateOffered`) instead of entering `mini_script` directly.

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
- `apps/user-client` is the active web sandbox and future web release surface; **`apps/mini-program` is the launch-primary WeChat client** for the current track. Shared business rules should not fork between them — use `packages/shared` and [`docs/reference/reference/PLATFORM_COORDINATION.md`](../reference/PLATFORM_COORDINATION.md) when behaviour must align.

### 5. Server domain ownership

**Routes**
- `apps/server/src/routes.ts` is the composition root that mounts domain routers from `apps/server/src/routes/domains/`
- Domain modules currently include auth, onboarding, assessment, analytics, admin, payments, icebreaker, shell, and matching-review routing

**Predictive Shell**
- `apps/server/src/routes/domains/shell.ts` mounts `/api/shell/discover`, `/api/shell/profile`, `/api/shell/events`, `/api/shell/connections`
- `apps/server/src/repositories/shellRepository.ts` assembles composite responses from `buildAuthUserResponse()`, domain repositories, and notification counts
- `apps/server/src/lib/shellCache.ts` provides a shared NodeCache singleton (30s TTL) with `invalidateUser(userId)` for cross-shell cache clearing
- `apps/server/src/lib/buildAuthUserResponse.ts` is the shared auth response builder used by both `/api/auth/user` and all shells
- Prerequisite repositories: `joinedEventsRepo.ts` (N+1-free joined events) and `connectionsRepo.ts` (N+1-free mutual connections)

**Data access**
- `apps/server/src/storage.ts` is now a compatibility facade composed from `apps/server/src/repositories/*`
- New persistence logic should live in the nearest domain repository instead of expanding the legacy facade

**Operational entry points**
- `apps/server/src/wechatAuth.ts`
- `apps/server/src/phoneAuth.ts`
- `apps/server/src/adminAuth.ts`
- `apps/server/src/lib/adminAuditLogger.ts`
- `apps/server/src/lib/featureFlags.ts` — DB-backed feature flag resolver (DB row → env fallback → 5s cache). Auth-exposed Profile rollout keys include `profileRedesignEnabled`, `profilePixelAvatarEnabled`, `equipmentRewardsEnabled`, and `personalStoryEnabled`; whitelisted keys are independently toggleable from `/admin/feature-flags` by `super_admin`.

### 6. Runtime deployment topology

**Active production path**
- `.github/workflows/deploy-staging.yml` (push to `main`) and `.github/workflows/deploy-production.yml` (push to `release`) deploy by SSHing into the remote server (`SERVER_IP` secret), rsyncing code to `~/JoyJoin`, and running `deployment/scripts/deploy-staging.sh` or `deployment/scripts/deploy-production.sh` respectively. The production job is gated by the GitHub `production` environment.
- Staging API/Admin images are built by GitHub Actions and transferred as a compressed bundle. The shared CVM only loads and switches images; it does not compile application code. The switch is gated by the real DB/config readiness endpoint and Admin content, with previous-image/Nginx rollback on failure.
- The WeChat development-version upload is triggered by a successful `Deploy Staging` `workflow_run` for the same `main` commit, rather than racing the backend deploy.
- `deployment/nginx/joyjoin.conf` is the public edge configuration for host Nginx serving `joyjoinapp.com`, `www.joyjoinapp.com`, `admin.joyjoinapp.com`, and `api.joyjoinapp.com`.
- `deployment/docker-compose.nginx.yml` runs the active runtime containers: `joyjoin-api`, `joyjoin-admin`, `postgres`, and `granite-embedding`. Host Nginx serves the maintenance page at the user-facing root domains; no user-client container is part of the active stack.

**Database boundary**
- Production provisions PostgreSQL 16 as the `postgres` service in `deployment/docker-compose.nginx.yml`, backed by the persistent `pgdata` volume and exposed only on host loopback. The API's `DATABASE_URL` uses that service as its database authority.
- The isolated staging exception is `postgres-staging` in `deployment/docker-compose.staging.yml`; the API URL must resolve to `postgres-staging:5432/joyjoin_staging` from inside Docker. Staging deployment only validates schema/catalog state and never applies DDL or seed data.

## Where new files go

### User client
- Route-level page: `apps/user-client/src/pages/` unless it belongs to the active onboarding module
- Active onboarding page/hook/flow utility: `apps/user-client/src/features/onboarding/active/`
- Shared presentation component: `apps/user-client/src/components/`
- Client hook or query adapter: `apps/user-client/src/hooks/`
- Pure browser utility: `apps/user-client/src/lib/` or `apps/user-client/src/utils/`

### Mini Program (Taro — launch-primary)

- **Page registration:** `apps/mini-program/src/lib/onboarding/onboardingRoutes.ts` defines `MINI_PROGRAM_MAIN_PACKAGE_PAGES`, the subpackages (`root: pages/onboarding`, `pages/pool-registration`, `pages/matching-status`, `pages/icebreaker-session`, `pages/alang`), and `preloadRule` entries; `app.config.ts` imports these — edit onboardingRoutes when adding routes or changing package splits.
- Taro page implementations: `apps/mini-program/src/pages/`
- Mini Program runtime helpers: `apps/mini-program/src/lib/` — domain subdirectories: `api/`, `auth/`, `payment/`, `onboarding/`, `navigation/`, `wechat/`, `matching/`, `mascot/`, `analytics/`, `utils/`
- Mini Program hook: `apps/mini-program/src/hooks/`
- Mini Program provider: `apps/mini-program/src/providers/` (`AuthProvider.tsx`, achievement/accent providers)
- Native WeChat custom tab bar implementation: `apps/mini-program/src/native-custom-tab-bar/`
- The build copies `apps/mini-program/src/native-custom-tab-bar/` into the runtime `custom-tab-bar/` directory; `apps/mini-program/src/custom-tab-bar/` is not the active runtime path.
- Tab selection / center CTA sync: `apps/mini-program/src/lib/navigation/tabBarConfig.ts`, `apps/mini-program/src/lib/navigation/centerTabRouting.ts`, `apps/mini-program/src/lib/navigation/tabBarState.ts`, `apps/mini-program/src/hooks/navigation/useCustomTabBarSync.ts`, `apps/mini-program/src/hooks/navigation/useTabBarStateBridge.ts`
- Active custom-tab-bar constraints live in `apps/mini-program/README.md` and `AGENTS.md` § Custom tab bar geometry; keep the native tree within `cover-view` nesting rules and treat shadow, gradient, and overflow-driven protrusions as compatibility-sensitive. Center button is a root sibling (not nested inside surface) to avoid `cover-view` clipping.
- App-level config / lifecycle: `apps/mini-program/src/app.ts` (provider setup), `apps/mini-program/src/app.config.ts` (`lazyCodeLoading: 'requiredComponents'`, `tabBar.custom`, window defaults)
- Cross-platform contract or pure business rule: `packages/shared/src/` (`api.ts`, `centerTabRouting.ts`, `hongKongTime.ts`, `onboarding.ts`)

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
