# JoyJoin Developer Quick Reference Guide

**Version:** 2.3
**Last Updated:** 2026-07-14
**For:** Tech Team Onboarding & Codebase Navigation

---

## ⚠️ CANONICAL RULE: Always Use Active Flow — Never Reference Legacy

> **This rule applies to ALL contributors: human engineers, AI coding agents, and documentation authors.**

**When writing code, copy, documentation, or making any implementation decision:**

- ✅ Base everything on the **current, active codebase** — routes, components, schemas, and API endpoints that exist and are actively used.
- ✅ Check this file (`DEVELOPER_QUICK_REFERENCE.md`) and `PRODUCT_REQUIREMENTS.md` § *Product Canon & Terminology* for the authoritative active-flow reference.
- ❌ **Never** refer to, reintroduce, or base decisions on **legacy flows, deprecated components, old routes, or removed features** — even if they appear in older git history, archived docs, or comments marked "TODO: restore".
- ❌ **Never** treat `QUICK_REFERENCE.md` as authoritative — it is now a legacy redirect-only stub kept for path compatibility. Use this file, `PRODUCT_REQUIREMENTS.md`, and `docs/README.md` instead.
- ❌ **Never** use deprecated terminology from §*Product Canon* — see `PRODUCT_REQUIREMENTS.md` for the current canonical terms.

### What counts as "legacy" (do not use)?
- The **14-archetype V1/V2 system** (火花塞, 探索者, 故事家…) — replaced by the **12-archetype V4 system**
- The **`/chats` event-chat/group-chat surface** — replaced by `/connections` (structured mutual connections)
- Any **direct-message (DM) UI or API** — removed; the product does not have in-app private messaging
- The **`圈子`** nav label — replaced by `连接`
- **`会员 / VIP会员`** user-facing copy — replaced by `权益`
- Any reference to the **`shared/` root folder** as the import source — use `packages/shared/src/` instead
- The removed Alang **“探索地图” / Reference 09** surface. V1.7 allows ACTIVE 03/05/07 plus APPROVED TARGET 06 only; Reference 04/08 are future context and must not trigger implementation.
- The **`/guide` page** as a core onboarding step — **removed**; the active onboarding steps after WeChat login are `/onboarding/setup`, `/onboarding/extended`, and `/onboarding/review`, then directly to `/discover`
- **Demo code `666666`** — legacy phone-based login. Mini-program uses WeChat auth (`微信一键登录`) exclusively. Dev API testing uses `POST /api/auth/dev-login` (development-only). `createDemoDataForUser` in production — gated on `NODE_ENV !== 'production'`

### If you are unsure whether something is active or legacy:
1. Check whether the file/route/component is imported and used in an active entry point (`AdminApp.tsx` for admin, `app.ts` for mini-program) or an active page.
2. Check `PRODUCT_REQUIREMENTS.md` § *Product Canon & Terminology*.
3. If still unsure, flag for human review rather than guessing.


### Guardrails: env files, secrets, and legacy onboarding identifiers
- Never commit a real `.env` file. The only tracked env templates are `.env.example`, `deployment/.env.production.example`, and `deployment/.env.staging.example`.
- Run `npm run guardrails` before pushing. CI runs the same check.
- In active onboarding / auth / CLI code, do not reintroduce these legacy identifiers: `hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, `interestsTop`, `topicAvoidances`, `hasPets`, or the removed `hometown` column token.
- If you ever copied values from the removed tracked `.env` or the old hard-coded deployment database URL, rotate `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `WECHAT_SECRET`, and `ADMIN_CREATE_SECRET_KEY`.

### Guardrails: latent-state and multimodal AI work stays planning-only until gates pass
- Read `docs/ai/ai-agent-harness-separation-strategy.md` first for **current shipped AI behavior, architectural invariants, and separation boundaries**.
- `docs/ai/AI_INTEGRATION_PLAN.md` Phase 3 (`user_latent_state`, behavioral-history explanations, multimodal enrichment) is a **strategy / planning document**, not an instruction to add runtime code now.
- Use `docs/ai/AI_INTEGRATION_PLAN.md` for **phased roadmap, rollout gates, and exit criteria** only; it must not be used by itself to justify runtime features.
- Do **not** add schema migrations, background jobs, scoring inputs, API routes, consent/upload flows, or user-facing UI for latent-state or multimodal features until the documented prerequisites, consent requirements, fairness review, observability, and explicit product/engineering gate approval are all satisfied.
- Planning-only shared contracts are allowed only when they are clearly marked as non-runtime and remain disconnected from active imports/callers.
- Existing deterministic authority still applies: `poolMatchingService.ts` remains the matching authority, and no latent-state or multimodal signal may partially influence matching or user-facing explanations before its rollout gate is formally cleared.

### Guardrails: repo AI workflow and orchestration changes
- Read `.github/AI_WORKFLOW_POLICY.md` before deciding whether work should stay in direct delivery, go through `Researcher` -> `Planner`, or escalate into the operational review lane.
- Read `.github/ORCHESTRATION_GOVERNANCE.md` before changing `.github/agents/`, `.github/skills/`, `.github/orchestration.yaml`, hook behavior, or orchestration runtime scripts.
- For coordinated refreshes across `docs/`, `.github/skills/`, and `.github/agents/`, follow `docs/ai/ai-workflow-documentation-refresh.md` (scope tiers, routing lanes, `npm run orchestration:validate` when orchestration or skill routing changes).
- Keep repo workflow governance separate from runtime product AI authority. For shipped AI behavior and rollout gates, continue to use `docs/ai/ai-agent-harness-separation-strategy.md` and `docs/ai/AI_INTEGRATION_PLAN.md`.
- Do not add a new agent or skill by default. Prefer existing skills and audited support agents unless repeated workflow evidence justifies expansion.

---

## Quick Start

### Prerequisites
```bash
# Ensure Node.js 20+ is installed
node --version

# Install dependencies
npm install

# Push database schema (REQUIRED after pulling changes)
npm run db:push
```

### Development Server
```bash
npm run dev
# Runs on port 5000 - serves both frontend and backend
```

### Optional: Start Granite Embedding Server
Required for semantic similarity matching and occupation free-text search.
```bash
source /tmp/granite-deploy/bin/activate && python3 deploy/granite-embedding/server.py
# Runs on port 8000 — set EMBEDDING_BASE_URL=http://localhost:8000/v1 in .env
# Pre-compute occupation vectors (required for occupation search):
#   EMBEDDING_BASE_URL=http://localhost:8000/v1 npx tsx scripts/build-occupation-vectors.mts
```

### Key Commands
```bash
npm run build            # Build admin-client and server workspaces (user-client archived)
npm run typecheck        # Run TypeScript checks across shared + app workspaces
npm run check:clients    # Typecheck shared + admin-client + mini-program workspaces
npm run check:server     # Typecheck only the server workspace
npm run check:full       # Run guardrails, lint, tests, and the full build
npm run lint             # Alias of the repo TypeScript checks
npm run test             # Run workspace tests (server tests + no-op placeholders elsewhere)
npm run build:weapp --workspace=mini-program  # Build the WeChat Mini Program workspace (runs validate:icon-transparency first)
npm run validate:icon-transparency -w mini-program  # Fail if bundled icons on variable backgrounds are opaque
gh workflow run "Upload CDN Assets"            # Upload static assets to joyjoinapp.com/static
npm run upload:cdn-assets -w mini-program       # Upload CDN assets locally (rsync to CVM)
npm run upload:cdn-assets:dry-run -w mini-program  # Preview what would upload
npm run orchestration:validate      # Validate .github/orchestration.yaml and related runtime files
npm run orchestration:tooling-report # Print the agent tooling sufficiency audit
npm run db:push          # Sync Drizzle schema to database
npm run db:push --force  # Force sync (use when db:push fails)
npm run db:studio        # Open Drizzle Studio (database GUI)
```

### Production deployment topology

- Active production deploys run from `.github/workflows/deploy-production.yml` (triggered by pushes to `release`): GitHub Actions SSHes to `SERVER_IP`, rsyncs code to the remote host, runs `deployment/scripts/deploy-production.sh`, which reloads Nginx and restarts containers. Pushes to `main` deploy to staging via `.github/workflows/deploy-staging.yml`.
- Staging images are built on the GitHub runner, transferred as a bundle, and switched with rollback on the CVM; staging deployment never runs application builds or DDL on the shared host. A successful `Deploy Staging` run triggers the matching mini-program 开发版 upload, so the client is not published ahead of its API.
- The public edge is the self-managed remote server plus host Nginx using `deployment/nginx/joyjoin.conf` (`joyjoinapp.com`, `www.joyjoinapp.com`, `admin.joyjoinapp.com`, `api.joyjoinapp.com`). This is the active production path; do not revive old Fly.io deployment assumptions in active docs or scripts.
- The app runtime requires `DATABASE_URL`; production PostgreSQL 16 is the `postgres` service in `deployment/docker-compose.nginx.yml`, backed by the persistent `pgdata` volume and bound to host loopback only.

### Same-server staging for 体验版 test pricing

An isolated staging API can run on the same production host:

- Compose: `deployment/docker-compose.staging.yml` (`postgres-staging` + `joyjoin-api-staging` on `127.0.0.1:5001`)
- Nginx server block: `deployment/nginx/joyjoin.conf` (`staging.joyjoinapp.com`)
- Env template: `deployment/.env.staging.example`
- Build the mini-program with `TARO_APP_API_BASE_URL=https://staging.joyjoinapp.com`
- Deployment acceptance uses `GET /api/readyz` (DB + config), not the liveness-only `/api/health`; the Admin root page is checked separately.
- Set `APP_MODE=staging` and `TEST_PAYMENT_PRICE_IN_CENTS=1` to charge ¥0.01 in 体验版
- Set `PAYMENTS_ENABLED=true` and `MOCK_PAYMENTS=false` for real WeChat Pay test charges, or `MOCK_PAYMENTS=true` for instantly-paid mock orders
- `WECHAT_PAY_PLATFORM_CERT` supports raw PEM or base64-encoded PEM; staging deploy validates it and aborts on invalid keys
- If a paid order is not fulfilled by webhook, the client falls back to `POST /api/payments/:wechatOrderId/reconcile`
- Street Blind Box formal-flow QA may use `/admin/alang` to start a staging-only manual NPC hold with no automatic end time. Apply `20260808010000_flash_manual_hold.sql` first; operator+ must explicitly stop the hold after testing. Production and missing `APP_MODE` fail closed.

See `deployment/README.md` and `docs/operations/test-mode-operations.md` §G for full setup.

---

## Monorepo Structure

```
joyjoin-monorepo/
├── .github/                  # CI workflows, orchestration contract, agents, and skills
├── .githooks/                # Optional repo-managed local pre/post-commit hooks
├── apps/
│   ├── mini-program/         # WeChat Mini Program — launch-primary client (Taro + React)
│   │   ├── src/
│   │   │   ├── pages/        # Taro page components
│   │   │   ├── components/   # Reusable Taro components
│   │   │   ├── hooks/        # Custom hooks
│   │   │   ├── lib/          # Utilities and API wrappers
│   │   │   └── app.ts        # Mini-program app entry
│   │   └── dist/             # Build output
│   │
│   ├── admin-client/         # Admin portal React app (desktop-first)
│   │   ├── src/
│   │   │   ├── pages/admin/  # Admin-specific pages
│   │   │   ├── components/   # Admin UI components
│   │   │   └── AdminApp.tsx  # Admin app entry
│   │   └── index.html
│   │
│   ├── mini-program/         # WeChat Mini Program — launch-primary client (Taro + React)
│   │   ├── src/
│   │   │   ├── pages/        # Taro page implementations (see lib/onboardingRoutes for app.json list)
│   │   │   ├── components/   # Reusable Taro UI components
│   │   │   ├── hooks/        # Cross-page Taro/query hooks
│   │   │   ├── providers/    # App-level providers (AuthProvider, etc.)
│   │   │   ├── lib/          # onboardingRoutes.ts (page/subpackage/preload), api.ts, tabBarConfig, centerTabRouting
│   │   │   ├── native-custom-tab-bar/ # Native WeChat custom tab-bar files (built to dist/custom-tab-bar)
│   │   │   ├── app.ts        # Mini Program app lifecycle entry
│   │   │   └── app.config.ts # Imports page lists from lib/onboardingRoutes + tabBar from tabBarConfig
│   │   └── package.json
│   │
│   └── server/               # Express.js backend
│       └── src/
│           ├── routes.ts             # Composition root — mounts domain routers
│           ├── routes/domains/       # Domain route modules (auth, onboarding, admin, …)
│           ├── repositories/         # Domain data access (usersRepo, paymentsRepo, …)
│           ├── storage.ts            # Compatibility facade — delegates to repositories/
│           ├── lib/                  # Cross-cutting helpers (logger, adminAuditLogger, …)
│           ├── middleware/           # Express middleware (requestId, metrics)
│           ├── auth/                 # Auth policy helpers (policy.ts)
│           ├── db.ts                 # Drizzle database connection
│           ├── index.ts              # Server entry point
│           ├── wsService.ts          # WebSocket service
│           ├── poolMatchingService.ts              # Group matching logic (deterministic authority)
│           ├── poolRealtimeMatchingService.ts       # Auto-matching scheduler
│           ├── archetypeChemistry.ts               # Chemistry calculations
│           ├── archetypeChemistryCalibration.ts    # Bounded empirical chemistry calibration
│           ├── matchExplanationService.ts           # AI match explanations
│           ├── matchingSemantic.ts                  # Feature-flagged 7th scoring dimension (semantic similarity)
│           ├── matchingMetrics.ts                   # Matching-specific Prometheus metrics
│           ├── embeddingClient.ts                   # Embedding API client (self-hosted endpoint via EMBEDDING_BASE_URL; default model Granite 97M)
│           ├── predictiveRerankingService.ts        # Shadow predictive reranking A/B experiment
│           ├── xiaoyueAnalysisService.ts            # AI personality analysis
│           ├── icebreakerAIService.ts               # AI conversation topics
│           └── ...                                  # Other services
│
├── packages/
│   └── shared/               # Shared contracts, schemas, personality system, UI primitives
│       └── src/
│           ├── api.ts                # Shared API contracts/helpers for web + mini-program
│           ├── centerTabRouting.ts   # Shared center CTA routing + badge rules
│           ├── schema.ts             # Drizzle ORM database schema
│           ├── wsEvents.ts           # WebSocket event interfaces
│           ├── constants.ts          # Shared constants
│           ├── districts.ts          # Shenzhen district taxonomy, cluster proximity maps, external-district mapping, and GPS-aware pool sorting
│           ├── gamification.ts       # XP/Level system
│           ├── hongKongTime.ts       # Shared Hong Kong time helpers
│           └── personality/          # Personality assessment system
│               ├── matcherV2.ts          # MatcherV2 algorithm
│               ├── questionsV4.ts        # V4 adaptive questions (130+)
│               ├── adaptiveEngine.ts     # Question selection engine
│               ├── archetypeRegistry.ts  # 12 archetype definitions
│               ├── archetypeCompatibility.ts  # Chemistry matrix
│               ├── types.ts              # Type definitions
│               └── feedback.ts           # Feedback templates
│
├── migrations/               # Drizzle database migrations
├── scripts/                  # Utility scripts
├── docs/                     # Documentation
└── shared/                   # Legacy shared folder (deprecated, use packages/shared)
```

### Taro mini-program (launch focus)

`apps/mini-program` is the **launch-primary** and only shipping user-facing client. The web sandbox (`apps/user-client`) was archived to `archived/workspaces/user-client/`. Cross-surface rules (mini-program ↔ admin-client): [`docs/reference/PLATFORM_COORDINATION.md`](docs/reference/PLATFORM_COORDINATION.md).

| Concern | Location |
|---------|----------|
| Register pages / main vs onboarding subpackage / `preloadRule` | `apps/mini-program/src/lib/onboarding/onboardingRoutes.ts` → consumed by `app.config.ts` |
| Personality test (V4) | `apps/mini-program/src/pages/onboarding/personality-test/` (test, results); anonymous keys in `lib/anonymousOnboarding.ts` |
| WeChat login | Returning: `pages/login/index.tsx` + `hooks/useWeChatLogin.ts` → `POST /api/auth/wechat/login`. With assessment import: `authenticateMiniProgramUserWithTest` in `lib/api.ts` → `POST /api/auth/wechat/login-with-test` |
| Blind-box payment + verification | `pages/blind-box-payment/`, `pages/payment-verification/`; `lib/paymentEntry.ts`, `lib/paymentPendingOrder.ts`, `lib/paymentPendingOrderStorage.ts`; shared intent helper `createMiniProgramPaymentIntent` in `packages/shared/src/api.ts`. **Payment Ritual V2:** `GET /api/payments/ritual-context` (real DB-backed community stats), `POST /api/analytics/payment` (dedicated A/B analytics endpoint). **Mock payment mode:** when `MOCK_PAYMENTS=true`, server creates instantly-paid orders (skips WeChat Pay API); client skips `Taro.requestPayment()` for mock orders. |
| Auth + API bootstrap | `apps/mini-program/src/lib/api/api.ts` |
| Custom tab bar (native) | `apps/mini-program/src/native-custom-tab-bar/` (see `apps/mini-program/README.md`). Per-tab active highlight, `_confirmedSelected` rollback, offline `syncState` replay, collapse/announcement APIs, and 180ms tap debounce for tab-switch performance |
| Tab list + `tabBar.custom` | `apps/mini-program/src/lib/navigation/tabBarConfig.ts` + `app.config.ts` |
| Shared contracts with web | `packages/shared/src/api.ts`, `centerTabRouting.ts`, `onboarding.ts`, `hongKongTime.ts` |
| Navigation / exit-transition hook | `apps/mini-program/src/hooks/navigation/useJoyJoinNavigation.ts` |
| Swipe-back flag-reset hook | `apps/mini-program/src/hooks/useResetOnShow.ts` |
| Quality bar (pixel precision, DevTools) | `.github/skills/mini-program-frontend-excellence/SKILL.md` |
| 完成度 audit (completeness + ROI recommendations) | `.github/skills/completeness-audit/SKILL.md` (pipeline: ui-layout-audit → frontend-design-audit → completeness-audit) |
| User satisfaction audit (user-perspective, share/return/recommend/pay verdict) | `.github/skills/user-satisfaction-audit/SKILL.md` — first-person persona walk + six-angle scoring; automatic 6th reviewer in the post-implementation-review swarm for user-facing frontend changes (US-01…US-06) |
| Hero promo banner (discover top surface) | `apps/mini-program/src/components/HeroPromoBanner.tsx` — full-bleed Lovart illustration + glass copy panel + breathing CTA + 5 sparkles. The hero image is **CDN-only** (`/assets/promo/banner-hero-lovart-v1.webp`); a gradient overlay skeleton preserves first paint while the asset loads. CTA always wired so it never silently disables; `margin-bottom: 8rpx` prevents boundary clipping. Kill switch via `user.features.promoBannerEnabled` (env `PROMO_BANNER_ENABLED`, default `true`). Promo copy must not fabricate social-proof metrics. |
| Status card (empty/error) | `apps/mini-program/src/components/ui/StatusCard.tsx` — unified status surface with Lovart hero illustration (WebP + PNG fallback), title, description, and optional action. Used on Discover and Events for empty states and on Discover for list-fetch error states. |
| Profile tab (V1.7 target) | `apps/mini-program/src/pages/profile/index.tsx` — existing warm-white/purple Profile UI with the user's canonical V4 archetype rendered from one of 12 Profile-only 512×768 transparent full-body pixel WebP assets (CDN-first, character-only fallback), real XP/trend progress from `GET /api/user/gamification`, real event/connection stats from `GET /api/shell/profile`, profile completion, milestones, service grid, settings, the private continuous-story entry, and the Profile-only “我的形象” entry. The approved base assets already include initial clothing. Equip/unequip/save/inventory remain server-backed, while unpublished per-item raster is visually omitted—do not substitute purple geometric or other fabricated blocks; keep the clothed base character until formal layered art is approved and published. `profileRedesignEnabled=false` selects the compact real-data fallback and skips V1.7 gamification/equipment/personal-story requests. `profilePixelAvatarEnabled`, `equipmentRewardsEnabled`, and `personalStoryEnabled` independently gate the new surfaces and default off. |
| Footprint event card | `apps/mini-program/src/components/events/FootprintOracleCard.tsx` — event card for the "足迹" tab. Uses a two-rail layout: left body shows status pulse, title, date/time/location; right rail shows a compact Nothing-design-inspired countdown, group-size hint, price, or a "待公布" placeholder. Venue-disclosure gating and status-aware waiting copy remain. Completed/cancelled cards are muted with no countdown. Venue location is hidden until the server-derived `displayStatus` reaches `confirmed`/`venue_unlocked`; the raw `matched` status means the group is formed but the venue is still being assigned. The card always renders event type + city/district and only appends the venue name once unlocked. Terminal pool states (`completed`/`cancelled`) override the registration-level status. The right rail is not `aria-hidden`; only the decorative `›` cue is hidden, and rail contents are included in the card's `aria-label` via `railAriaLabel`. |
| Countdown hook | `apps/mini-program/src/hooks/useEventCountdown.ts` — visibility-aware countdown that returns `display`, structured `segments` (`days/hours/minutes/seconds/progress`), `isUrgent`, `hasStarted`, and `isLive`. Ticks are gated by in-viewport state, app background state, `prefers-reduced-motion`, and degradation-tier devices. |
| Event display helpers | `apps/mini-program/src/lib/utils/eventDisplay.ts` — `formatEventDateTime` with relative near-term prefixes (`今天`/`明天`/`后天`) and `getJoinedEventDisplayDateTime` for display vs matching-time precedence. |

```bash
npm run dev:weapp --workspace=mini-program
npm run build:weapp --workspace=mini-program
```

---

## Server Domain Architecture

> Full reference: `apps/server/src/README.md` · `docs/architecture/current-state.md` · skill: `server-domain-architecture`

`routes.ts` is the **composition root** — it mounts domain routers and registers global middleware. Do not add new inline handler blocks to `routes.ts`; extract them into a domain module instead.

| Layer | Location | Rule |
|-------|----------|------|
| Composition root | `routes.ts` | Mounts domain routers; contains transitional legacy handlers |
| Domain route modules | `routes/domains/*.ts` | Own handlers, validation, service calls for their domain |
| Persistence layer | `repositories/*.ts` | All new database queries go here — not in `storage.ts` |
| Compatibility facade | `storage.ts` | Delegates to repositories; do not add new methods |
| Cross-cutting helpers | `lib/` | `logger.ts`, `adminAuditLogger.ts`, `aiTraceLogger.ts`, `socialIcebreakerStore.ts`, `featureFlags.ts` |
| Express middleware | `middleware/` | `requestId.ts` (correlation IDs), `metrics.ts` (Prometheus) |
| Auth policy | `auth/policy.ts` | `isDevAuthToolsEnabled()`, `canUseMockWechatAuth()` — single source of truth |

Active domain modules in `routes/domains/`:

| Module | Owns |
|--------|------|
| `auth.ts` | WeChat auth, session, admin-login, `nextStep` computation, and `GET /api/user/welcome-coupon` (welcome-coupon claim) |
| `onboarding.ts` | Onboarding completion endpoints |
| `assessment.ts` | Personality assessment endpoints |
| `admin.ts` | Admin management API |
| `adminEventPools.ts` | Admin event pool CRUD, venue hints, time slot validation |
| `analytics.ts` | Analytics and KPI endpoints |
| `payments.ts` | WeChat Pay v3 JSAPI (primary, mini-program) + H5 (reference, web), coupon validation, webhook verification, `POST /api/payments/:wechatOrderId/reconcile`, and `GET /api/payments/ritual-context` (Payment Ritual V2 real DB-backed context) |
| `eventPools.ts` | Event pool discovery, registration, and `GET /api/event-pools/:poolId/stats` (`estimatedGroups`, archetype breakdown, historical group themes) |
| `icebreaker.ts` | Mounts **`/api/social-icebreaker`** (Social Icebreaker router from `routes/socialIcebreaker.ts`) and **`/api/tts`** — not the legacy toolkit; legacy random topics live under monolithic `routes.ts` `/api/icebreakers/*` |
| `icebreakerSessions.ts` | Icebreaker session discovery and access endpoints |
| `referrals.ts` | Referral & invitation routes — `GET /api/referral/stats` (referral code + invite stats), `GET /api/referral/invites-received` (incoming invites), invite link generation (mini-program deep link format) |
| `eventGroupOutcomes.ts` | Protected `POST /api/event-pools/:poolId/group-outcome` outcome submission endpoint |
| `adminMatchingShadow.ts` | Admin shadow matching experiments, predictive rerank status and controls |
| `adminMatchingReview.ts` | Operator review queue for formed match groups (list, approve, reject) |
| `matchingShadowErrors.ts` | Shadow-matching error inspection endpoints |
| `occupationSearch.ts` | `POST /api/occupation/search` — free-text occupation search using Granite embedding (exact + semantic hybrid) |
| `shell.ts` | Composite Predictive Shell endpoints (`/api/shell/*`) — discover, profile, events, connections |
| `helpers.ts` | Shared route helpers |
| `matchingTest.ts` | `/api/test/matching-test/*` — seed matching-test bots, create test pool, trigger match, cleanup. Gated by `isMatchingTestMode()` (2026-06-24) |
| `matchCompass.ts` | `GET /api/event-pools/:id/match-compass`, `PATCH /api/event-pool-registrations/:id/preferences`, `POST /api/users/me/preference-dna` — post-registration preference tuning |
| `geo.ts` | `POST /api/geo/reverse-geocode`, `/ip-locate`, `/places/suggest`, `/places/search`, `/walking-route` — server-side Tencent Maps WebService proxy; GCJ-02 `latitude/longitude`, 4s timeout, bounded cache, stable `MAP_*` errors |
| `alang.ts` | `/api/alang/*` mission/progress/GPS/archive API plus `/api/alang/debug/*` strict single-test routes. Search coordinates are redacted; `routeDestination` is companion-stage-only |
| `personalStory.ts` | `/api/personal-story/*` private append-only continuous story. Only server-verified completed real experiences become fact-only chapter inputs; updates run asynchronously through MiniMax with DeepSeek fallback and never replace prior chapters. |
| `equipment.ts` | `/api/equipment/*` current-user inventory, four-slot outfit save, manual activity reward draws, global fourth-draw guarantee, duplicate fragments, and fragment-only exchange. Pools are keyed by `venues.id` or Alang mission ID. |
| `adminGeolocation.ts` | `GET /api/admin/geolocation/heatmap`, `POST /api/admin/geolocation/rollup` — admin location analytics, gated by `requireSuperAdmin` |

---

## Observability & Ops

> Full reference: `docs/systems/observability.md` · `docs/runbooks/observability.md`

| Concern | File / endpoint |
|---------|-----------------|
| Structured logging | `apps/server/src/lib/logger.ts` — prefer `logger.info/warn/error()` for request/operational logs; avoid `console.*` in request handlers (tests/CLIs may still use `console.*`) |
| Request correlation | `apps/server/src/middleware/requestId.ts` — sets `req.requestId`; bind with `logger.child({ request_id: req.requestId })` |
| Prometheus metrics | `apps/server/src/middleware/metrics.ts` — HTTP metrics emitted automatically; domain metrics can be added via the metrics module |
| Metrics scrape endpoint | `GET /api/metrics` |
| Health check | `GET /api/health` → `{ status: 'ok' }` |
| Readiness probe | `GET /api/readyz` → verifies DB + config before returning 200 |
| Admin audit log | `apps/server/src/lib/adminAuditLogger.ts` — emit an audit entry for every sensitive admin action |
| Synthetic monitoring | `scripts/synthetic/happy-path-probe.mjs` — GitHub Actions schedule (every 5 min) |
| CI automations | `scripts/auto-*.mjs` + `.github/workflows/auto-*.yml` — daily bug scanning, docs, digest, test coverage; see `docs/automations/README.md` |
| Infra stack | `infra/` — Prometheus, Alertmanager, Grafana, Loki, Promtail configs |

**Structured logging pattern:**
```typescript
import { logger } from '../lib/logger';
const reqLogger = logger.child({ request_id: req.requestId });
reqLogger.info('Processing registration', { eventId, userId });
logger.error('Payment webhook failed', { orderId, error: err.message });
```

---

## User Journey & Authentication Flow

**Updated:** 2026-06-05 (auth loading gate + prefetch kill-switch hygiene)

### Authentication States

The app uses progressive authentication with server-driven navigation:

```typescript
// From useAuth hook — server-driven navigation (B1)
interface UseAuthResult {
  user: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  nextStep: NextStepType | undefined;       // Server-calculated next route
  profileEssentialComplete: boolean | undefined;
  profileExtendedComplete: boolean | undefined;
  activeAssessmentSessionId: string | null | undefined;
  paymentsEnabled: boolean;                 // Feature flag: payment kill switch — do NOT hardcode in prefetch shells; let the live `/api/auth/user` response own this value
  restartsRemaining?: number;              // Onboarding restart quota remaining (0–5)
  features?: {
    restartOnboarding?: boolean;       // Onboarding restart kill switch
    smartProfession?: boolean;         // AI profession classification overlay
    onboardingForceSkip?: boolean;     // Admin force-skip button on onboarding
    matchingLiveReveal?: boolean;      // Live reveal overlay on matching status
    socialIcebreakerClientForceEnd?: boolean; // Host emergency end button
    personalityShareEnabled?: boolean; // Share poster generation on personality results; current V1.7 Profile does not expose a profile-card share action
    personalitySlotAnimationEnabled?: boolean; // Slot machine reveal animation
    profileRedesignEnabled?: boolean; // Server-owned V1.7 Profile rollout/rollback switch; false renders the compact fallback
    profilePixelAvatarEnabled?: boolean; // Profile-only 12-archetype pixel avatar and My Image surface; default false
    equipmentRewardsEnabled?: boolean; // Inventory, activity reward draws, outfit save, pity, and fragment exchange; default false
    personalStoryEnabled?: boolean; // Private append-only AI story surface and update jobs; default false
  }; // Feature flags from server (DB-backed, resolved in parallel, see lib/featureFlags.ts)
}
```

### Auth loading gate and prefetch feature-flag hygiene (2026-06-05)

**Auth pending rule:** `apps/mini-program/src/hooks/auth/authState.ts` defines `isAuthPending` as:
```typescript
const isAuthPending =
  input.isLoading || (input.isFetching && input.user === undefined)
```
This prevents background refetches from gating the UI once an initial user object has arrived. Fixes the stuck-loading shell after app resume.

**Page gate timeout:** `apps/mini-program/src/hooks/navigation/useMiniPageGate.ts` adds a 4-second force-release ceiling (`MINI_PAGE_GATE_TIMEOUT_MS = 4000`). If auth is still loading after 4s, the gate releases and the page renders its own fallback instead of hanging indefinitely.

**Prefetch engine:** `apps/mini-program/src/lib/prefetchEngine.ts` injects pruned auth fragments for Discover/Events/Connections shells. It intentionally omits kill-switch fields like `paymentsEnabled` so the live auth fetch remains the single source of truth. Previously a hardcoded `paymentsEnabled: false` caused stale "权益维护中" toasts even when payments were enabled server-side.

### Tab-page state patterns (2026-06-05)

The primary tab pages now follow a consistent loading / empty / error vocabulary:

| Page | Loading | Empty | Error |
|------|---------|-------|-------|
| Discover | Skeleton shimmer above list | `StatusCard` with Lovart `lovart-generic-empty.webp` + action CTA | `StatusCard` `tone='error'` with Lovart error illustration + retry |
| Events | Skeleton shimmer above tabs | `StatusCard` with Lovart `lovart-generic-empty.webp` + action CTA | `XiaoyueEmptyState` `emotion='sad'` + retry |
| Connections | `XiaoyueEmptyState` `emotion='waiting'` | `XiaoyueEmptyState` context-aware: `no-events` → discover, `upcoming-event` → events, `feedback-pending` → event-feedback, `feedback-complete` → celebrate badge | `XiaoyueEmptyState` `emotion='reassure'` + retry |

Full-screen empty/error states inside `ScrollView` must use `@include scroll-view-centered-state` (`_mixins.scss`) to guarantee vertical centering.

### Complete User Flow Diagram (Option B: Post-Test Signup)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UNAUTHENTICATED                             │
├─────────────────────────────────────────────────────────────────────┤
│  /                   → LandingPage (redirects to /personality-test) │
│  /personality-test   → PersonalityTestPage (Anonymous)              │
│  /personality-test/results → PersonalityTestResultPage              │
│  /login              → LoginPage (fallback for non-WeChat)          │
│  /invite/:code       → InviteLandingRouter (public)                 │
│  /dev/icebreaker-demo → IcebreakerDemoPage (dev sandbox only)       │
│  /admin/login        → AdminLoginPage                               │
│  *                   → Redirects to LandingPage                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ▼ (After WeChat Login with test results)
┌─────────────────────────────────────────────────────────────────────┐
│              Authenticated - Welcome Back (conditional)             │
├─────────────────────────────────────────────────────────────────────┤
│  /onboarding/welcome-back → WelcomeBackPage                         │
│     Shown once per reinstall when:                                  │
│     • restartOnboarding feature flag = true                         │
│     • nextStep ≠ 'discover'                                         │
│     • restartsRemaining > 0                                         │
│     • User has not seen welcome-back before (client storage)        │
│  User chooses "Continue" → proceed to nextStep                      │
│  User chooses "Restart"  → POST /api/auth/onboarding/restart        │
│     → returns to personality-test, wipes onboarding-derived data    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ▼ (After Welcome Back / Continue or Restart)
┌─────────────────────────────────────────────────────────────────────┐
│                    Authenticated - Needs Essential Data             │
├─────────────────────────────────────────────────────────────────────┤
│  /onboarding/setup   → EssentialDataPage (5 FormStepper steps)      │
│  *                   → Redirects to /onboarding/setup               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ▼ (After Essential Data)
┌─────────────────────────────────────────────────────────────────────┐
│                    Authenticated - Needs Extended Data              │
├─────────────────────────────────────────────────────────────────────┤
│  /onboarding/extended → ExtendedDataPage (Interest Carousel only)   │
│  *                   → Redirects to /onboarding/extended           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ▼ (After Extended Data)
┌─────────────────────────────────────────────────────────────────────┐
│                    Authenticated - Profile Review                   │
├─────────────────────────────────────────────────────────────────────┤
│  /onboarding/review  → FinalProfileReviewPage                       │
│  *                   → Redirects to /onboarding/review             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ▼ (hasSeenProfileReview = true)
┌─────────────────────────────────────────────────────────────────────┐
│                         FULL ACCESS                                 │
├─────────────────────────────────────────────────────────────────────┤
│  /discover           → Event recommendations                        │
│  /events             → My events                                    │
│  /connections        → Post-event connections hub                   │
│  /profile            → Profile & settings                           │
│  See "Main App Routes" section below                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Onboarding Architecture Summary

**Authority chain:** `GET /api/auth/user` (server) → `useAuth()` → `AuthenticatedRouter` → `features/onboarding/active/` — shared step mapping also in `packages/shared/src/onboarding.ts` for the mini-program.

The client **never** computes its own onboarding position. `nextStep` is always the server's value. Optional **`onboardingCheckpoint`** on the user can move `nextStep` forward for recovery (see `routes/domains/auth.ts`).

| `nextStep` value | Route | Completion signal |
|----------------|-------|-------------------|
| `onboarding` | `/onboarding/onboarding` | Pre-personality-test landing (legacy alias) |
| `personality-test` | `/personality-test` | `hasCompletedPersonalityTest` (users table) |
| `essential-data` | `/onboarding/setup` | `profileEssentialComplete` (server-computed) |
| `extended-data` | `/onboarding/extended` | `hasCompletedInterestsCarousel` (users table) |
| `profile-review` | `/onboarding/review` | `hasSeenProfileReview` (users table) |
| `discover` | `/discover` | `onboardingCheckpoint === 'discover'` |

#### Onboarding Step Field Map (single source of truth)

| Step (`nextStep`) | Page | Route | Collects |
|---|---|---|---|
| `personality-test` | 氛围测试 | `/personality-test` | V4 adaptive questions (8–16) → archetype assigned |
| `essential-data` | 基本资料 | `/onboarding/setup` | displayName, gender, birthYear, currentCity, hometown, education, occupation (chat overlay), **lifeStage**, relationshipStatus, intent (up to 3) |
| `extended-data` | 兴趣偏好 | `/onboarding/extended` | 3-tier interest selections (min 3, max 10) across 5 categories |
| `profile-review` | 资料预览 | `/onboarding/review` | Read-only summary plus optional 1–100 character bio (content-safety checked); persisted via `POST /api/profile-review/complete` |

Note: Voice quiz is not part of the onboarding flow. Archetype is assigned during `personality-test` results, not re-collected on `essential-data`.

Pre-auth value-first entry remains `/personality-test` → `/personality-test/results` (inline WeChat login); once the user is authenticated, routing authority switches to server-returned `nextStep`.

**Onboarding restart:** `POST /api/auth/onboarding/restart` clears all onboarding-derived data (preserves WeChat identity + phone), resets the user to `personality-test`, and increments `onboardingRestartCount` (capped at 5). Idempotent — double-tap does not burn quota. Gated by `RESTART_ONBOARDING_ENABLED` env var.

Active onboarding pages: `apps/mini-program/src/pages/onboarding/`  
Legacy surfaces: `archived/workspaces/user-client/src/legacy/onboarding/` — do not add new routes or CTAs there

> Full reference: `docs/systems/onboarding-flow.md` · skill: `onboarding-state-architecture`

### Deprecated Fields

The following fields are **NO LONGER** collected in onboarding (2026-02-04):
- ❌ `languagesComfort` - Moved to profile edit only
- ❌ `activityTimePreference` - Removed entirely
- ❌ `socialFrequency` - Removed entirely  
- ❌ `groupSizeComfort` - Removed entirely
- ❌ `hometownCountry` - Removed entirely

These are commented out in schema but kept for backward compatibility.

### Main App Routes (Fully Authenticated)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | DiscoverPage | Home - event pool discovery |
| `/discover` | DiscoverPage | Same as home |
| `/events` | EventsPage | My events (pending/matched/completed tabs) |
| `/connections` | ConnectionsPage | Post-event connections hub (legacy alias: `/chats`) |
| `/connections/:eventId` | EventCoordinationPage | Event coordination space (legacy alias: `/chats/:eventId`) |
| `/profile` | ProfilePage | User profile |
| `/rewards` | RewardsPage | XP, levels, coupons |
| `/invite` | InvitePage | Invite friends |

### Event Flow Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/event-pool-registration/:id` | EventPoolRegistrationPage | Legacy deep-link route — redirects to `/discover?joinPool=...` join flow |
| `/pool-groups/:groupId` | PoolGroupDetailPage | View matched group details |
| `/blind-box-events/:eventId` | BlindBoxEventDetailPage | Event details |
| `/blindbox/payment` | BlindBoxPaymentPage | Payment flow |
| `/blindbox/confirmation` | RedirectToDiscover | Quarantined legacy route — redirects to DiscoverPage |
| `/events/:eventId/feedback` | EventFeedbackFlow | Post-event feedback |
| `/events/:eventId/deep-feedback` | DeepFeedbackFlow | Anonymous deep feedback |
| `/icebreaker/:sessionId` | IcebreakerSessionPage | Social Icebreaker — **PRIMARY in-event icebreaking flow (use this)** |
| `/icebreaker-recap/:sessionId` | SocialIcebreakerRecapPage | Social icebreaker recap/summary |
| `/icebreaker-game` | IcebreakerGamePage | AI card game — **supporting deep-dive layer** (not the primary flow) |

### Profile Edit Routes

**Mini-program (launch-primary):** `pages/profile-linked/edit-profile/index` — single consolidated 2-step editor (lives in the `pages/profile-linked` subpackage, preloaded from `pages/profile/index`).

**Web (archived):** The following granular edit routes were part of the archived `user-client` and are not active in the mini-program:

| Route | Component | Description |
|-------|-----------|-------------|
| `/profile/edit` | EditProfilePage | Profile edit hub |
| `/profile/edit/basic` | EditBasicInfoPage | Name, avatar |
| `/profile/edit/education` | EditEducationPage | Education info |
| `/profile/edit/work` | EditWorkPage | Work info |
| `/profile/edit/personal` | EditPersonalPage | Personal details |
| `/profile/edit/intent` | EditIntentPage | Social intentions |
| `/profile/edit/interests` | EditInterestsPage | Interests/hobbies |
| `/profile/edit/social` | EditSocialPage | Social preferences |

### Admin Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | AdminDashboard | Admin home |
| `/admin/users` | AdminUsersPage | User management |
| `/admin/event-pools` | AdminEventPoolsPage | Create/manage event pools |
| `/admin/events` | AdminEventsPage | Event management |
| `/admin/matching` | AdminMatchingLabPage | Real-time matching lab |
| `/admin/matching-config` | AdminMatchingConfigPage | Threshold tuning |
| `/admin/matching-logs` | AdminMatchingLogsPage | Match history |
| `/admin/matching-reviews` | AdminMatchingReviewsPage | Review and approve/reject formed match groups before users are revealed |
| `/admin/feedback` | AdminFeedbackPage | User feedback |
| `/admin/subscriptions` | AdminSubscriptionsPage | Subscription management |
| `/admin/coupons` | AdminCouponsPage | Coupon management |
| `/admin/venues` | AdminVenuesPage | Venue partners |
| `/admin/evolution` | AdminEvolutionPage | AI evolution dashboard |
| `/admin/outcome-analytics` | AdminOutcomeAnalyticsPage | Outcome & readiness coverage analytics |
| `/admin/feature-flags` | AdminFeatureFlagsPage | Toggle kill switches (super_admin only) |
| `/admin/accounts` | AdminAccountsPage | Admin account management (super_admin only) |

### Admin Authentication

Admin portal login uses **username/password** credentials stored in the `admin_accounts` table.

**Login endpoint:** `POST /api/admin/login` – accepts `{ username, password }`

**Roles:**
| Role | Access |
|------|--------|
| `super_admin` | Full access including admin account management |
| `operator` | General admin operations; cannot manage admin accounts |
| `viewer` | Read-only access to dashboards and reports |

**Creating the first admin account (CLI):**
```bash
# Set ADMIN_CREATE_SECRET_KEY in .env first
npm run admin:create <username> <password> <secretKey> [role] [displayName]

# Examples:
npm run admin:create admin MySecretPass99 BYPASSSECRET12345678
npm run admin:create ops_user OpPass99 BYPASSSECRET12345678 operator "运营小王"
```

> **Admin auth:** New admins must use `admin_accounts` (username-based). A legacy `users.isAdmin` fallback remains at `/api/auth/admin-login` for existing phone-based admins; migrate them to `admin_accounts` using the CLI above. Do not create new phone-based admin accounts.

---

### In-Event Icebreaker — Primary Flow

The PRIMARY icebreaking experience for matched groups is the **Social Icebreaker**:
- Client route: `/icebreaker/:sessionId`
- API: `/api/social-icebreaker/*` (mounted in `routes/domains/icebreaker.ts`)
- Component: `IcebreakerSessionPage` (web); `apps/mini-program/src/pages/icebreaker-session/` (mini-program)
- Hook: `useSocialIcebreaker`
- Phases: governed by tier-based run plans — `breeze` (破冰局, 40min casual), `glow` (畅聊局, 60min standard), `blaze` (狂欢局, 90min full). Host also selects vibe: `深聊` (deep_chat, connection-first, longer warmup with 3-tier prompts), `均衡` (balanced, standard mix), `暢玩` (play_fun, energy-first, shorter warmup). Default enabled set is MVP (`warmup`, `micro_challenge`, `lie_detective`) **plus** `personality_dice` unless tier selection adds fan-out phases. Tier machine ID (`breeze`/`glow`/`blaze`) is decoupled from display name via `packages/shared/src/socialIcebreakerTierManifest.ts`. Vibe resolved via `packages/shared/src/runPlanCompiler.ts`. Feature-flagged: `RUN_PLAN_TEMPLATES_ENABLED`. See `docs/deliberations/2026-04-29-tier-naming-mascot-rebrand-consensus.md` and `docs/icebreaker/icebreaker-system.md`.
- **Lie Detective V2:** `LIE_DETECTIVE_MODE=v2` switches to user-tag-based gameplay (2 tags + AI fake). V1 (AI-fabricated statements) remains default. Design spec: `docs/icebreaker/icebreaker-system.md`.
- **Moment Card server render:** `GET /api/social-icebreaker/:id/moment-card.png` returns a 640×1040 PNG via `@napi-rs/canvas` when `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER=true`.
- **Bonus gate:** when `mini_script` would be next, phase advance pauses at a host+player vote gate (`bonusGateOffered`) if `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true`. Routes: `POST .../bonus/respond` (host), `POST .../bonus/sentiment` (player).
- **Phase metrics:** `social_icebreaker_phase_metrics` table captures `dwellTimeMs` per phase on every advance.
- Full reference: `docs/icebreaker/icebreaker-system.md`

Do NOT direct users to `/icebreaker-game` (AI Card Game) as the first/default experience.
The Card Game is an optional deep-dive accessible from within the Social Icebreaker.

The IcebreakerToolkit (pre-event game browser) is a **LEGACY** tool replaced by Social Icebreaker (`/api/social-icebreaker/*`). Do not add new Toolkit CTAs.

---

## Matching-State UI Architecture

> **Guardrail:** Full-screen matching-status pages must use the shared `MatchingStateLayout` abstraction. Do not create bespoke dark-background layouts for new screen-level matching states.

### Shared Layout — `MatchingStateLayout`

**File (archived):** `archived/workspaces/user-client/src/components/matching/MatchingStateLayout.tsx`

- Canonical dark background from `archived/workspaces/user-client/src/assets/matching/shared/matching-bg.svg`
- Safe-area header (optional back button + title)
- Composition slots: `hero`, `copy`, `cta`, `footer`

```tsx
<MatchingStateLayout
  hero={<img src={heroSvg} />}
  copy={<StatusCopy />}
  cta={<ActionButtons />}
/>
```

#### Full-Screen Matching-State Screens *(must use `MatchingStateLayout`)*

| Component | Screen state | File |
|-----------|-------------|------|
| `MatchingWaitingScreen` | Blind-pool waiting (fill states: waiting / can_form / full) | `components/MatchingWaitingScreen.tsx` |
| `NoMatchScreen` | No match found | `components/matching/NoMatchScreen.tsx` |

#### Join-Sheet / Pre-Entry Interstitial Screens

| Component | Screen state | File |
|-----------|-------------|------|
| `JoinErrorScreen` | Join / registration error | `components/matching/JoinErrorScreen.tsx` |
| `ExtendedDataEmptyScreen` | Profile data insufficient | `components/matching/ExtendedDataEmptyScreen.tsx` |
| `TestIncompleteScreen` | Personality test incomplete pre-entry gate on `DiscoverPage` | `components/matching/TestIncompleteScreen.tsx` |

#### Post-Match Reveal Components

| Component | Role | File |
|-----------|------|------|
| `MatchRevealSequenceV2` | Active cinematic reveal orchestrator | `components/matching/MatchRevealSequenceV2.tsx` |
| `SurpriseMatchReveal` | Legacy rarity-first reveal overlay | `components/matching/SurpriseMatchReveal.tsx` |
| `MatchPointsDisplay` | Match points renderer | `components/matching/MatchPointsDisplay.tsx` |
| `TablemateCard` *(mini-program, 2026-08-16)* | Reusable matched-member portrait card | `apps/mini-program/src/components/TablemateCard/index.tsx` |

### Key Rules

1. **State must be trigger-driven.** `MatchingStatusPage.tsx` maps real app state (registration status, fill count, WebSocket events) to the correct screen. No placeholder timers or mocked transitions.
2. **Recovery must be correct.** A user returning to the matching-status page after a forced refresh should land in the right state.
3. **For full-screen matching-status screens, never duplicate `matching-bg.svg`.** Import the shared background only via `MatchingStateLayout`. Join-sheet interstitials inherit their presentation context from `JoinEventPoolSheet` and should not wrap themselves in `MatchingStateLayout`.
4. **Asset locations (archived):** `archived/workspaces/user-client/src/assets/matching/{shared,waiting,no-match,join-error,extended-data-empty,test-incomplete}/`
5. **Active blind-pool entry flow:** `DiscoverPage` query-param join sheet → `MatchingStatusPage`; browser blind-box checkout returns through `BlindBoxConfirmationPage`, which confirms payment state and then hands off to `/events` or `/discover`.
6. **Mini-program matched-member cards must reuse `TablemateCard`.** The matching-status matched carousel, pool-group-detail deck strip, and squad-unboxing front-face all share `apps/mini-program/src/components/TablemateCard`; pair-chemistry copy/emoji/helpers live in `apps/mini-program/src/lib/utils/pairChemistry.ts`. Do not rebuild a one-off member card for a new matched surface.

Full reference: `docs/reference/ui-matching-reveal-improvements.md`, `docs/matching-reveal-implementation-summary.md`

---

## Post-Profile-Review Limited Browse Mode *(Scoped Experiment)*

After `FinalProfileReviewPage`, a secondary CTA "先浏览 →" lets users enter read-only event discovery (Discover page) before committing to pool registration.

- Controlled by `ENABLE_LIMITED_BROWSE_MODE` constant in `FinalProfileReviewPage.tsx` (currently `true`)
- Per-session opt-out via `?exp=no_limited_browse`; per-session opt-in via `?exp=limited_browse`
- Session flag set by `enterLimitedBrowseMode()` from `LimitedBrowseBanner`
- **Do not generalise** this pattern or add permanent browse-mode routing without confirming the experiment is complete and the gating logic has been reviewed

---

## Performance Guardrails

> Full reference: `docs/reference/perf.md`

| Guardrail | Rule |
|-----------|------|
| Non-critical routes | **Must** use code splitting / lazy loading — no static imports for non-critical pages |
| Cross-app imports | Apps must **not** import from other apps — shared logic goes in `packages/shared` |
| Matching background | Reuse `matching/shared/matching-bg.svg` via `MatchingStateLayout` — never duplicate |
| Hero images | Prefer WebP + `decoding="async"` over PNG for hero/above-fold images |
| Archetype assets | Defer/gate — do not bulk-preload all 12 archetype images in the app-launch critical path. Preload only the primary result image on test completion / results mount; use `apps/mini-program/src/lib/utils/archetypeAssets.ts` as the canonical registry. |
| Asset prefetching | Gate on real activity state — do not prefetch for no-activity users |

---

### Overview

JoyJoin uses 12 unique Chinese social archetypes based on the ACOEXP 6-trait model:

| Trait | Chinese | Description | Range |
|-------|---------|-------------|-------|
| A | 亲和力 (Affinity) | Warmth, cooperation, trust | 0-100 |
| C | 责任心 (Conscientiousness) | Organization, reliability | 0-100 |
| O | 开放性 (Openness) | Creativity, curiosity | 0-100 |
| E | 情绪稳定 (Emotional Stability) | Calm under pressure | 0-100 |
| X | 外向性 (Extraversion) | Social energy, talkative | 0-100 |
| P | 积极性 (Positivity) | Optimism, enthusiasm | 0-100 |

### The 12 Archetypes

| Archetype | Nickname | Key Traits | Energy |
|-----------|----------|------------|--------|
| **社牛柯基** | 摇尾点火官 | X:95, P:85 | 95 (Very High) |
| **小太阳鸡** | 咯咯小太阳 | P:92, E:88 | 90 (Very High) |
| **夸夸仓鼠** | 彩虹播撒机 | A:85, P:88 | 88 (High) |
| **寻宝狐** | 场域操控师 | O:82, X:75 | 78 (High) |
| **脑洞章鱼** | 创意万花筒 | O:95, A:68 | 65 (Medium) |
| **树洞考拉** | 温柔守护者 | A:92, E:85 | 55 (Medium) |
| **机灵海豚** | 和谐调频员 | E:90, A:75 | 52 (Medium) |
| **人脉蛛** | 人脉编织机 | C:80, A:72 | 48 (Medium) |
| **好奇猫头鹰** | 智慧瞭望塔 | O:88, C:82 | 42 (Low) |
| **靠谱大象** | 沉稳压舱石 | E:92, C:85 | 38 (Low) |
| **小透明猫** | 安静观察者 | E:78, C:72 | 28 (Very Low) |
| **慢热龟** | 踏实推进器 | C:88, E:85 | 25 (Very Low) |

### Cohort Categories

Archetypes are grouped into cohorts for question targeting:

```typescript
type CohortType = 
  | 'creative_explorer'     // 脑洞章鱼, 寻宝狐, 好奇猫头鹰 (high O)
  | 'quiet_anchor'          // 小透明猫, 慢热龟, 靠谱大象 (low X + high C)
  | 'social_catalyst'       // 社牛柯基, 小太阳鸡, 夸夸仓鼠 (high X + high P)
  | 'steady_harmonizer'     // 树洞考拉, 机灵海豚, 人脉蛛 (high A + mid-high E)
  | 'reflective_stabilizer' // 好奇猫头鹰, 慢热龟 (high C + differentiated O/E)
  | 'universal';            // Works for all cohorts
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/personality/archetypeRegistry.ts` | Single source of truth for all archetype data |
| `packages/shared/src/personality/archetypeCompatibility.ts` | Chemistry matrix between archetypes |
| `archived/workspaces/user-client/src/components/StyleSpectrum.tsx` | Archetype result visualization (legacy — mini-program has its own) |

| `archived/workspaces/user-client/src/components/TraitSpectrum.tsx` | Bipolar trait slider display (legacy) |
---

## MatcherV2 Algorithm

### Overview

MatcherV2 is the personality matching algorithm that assigns users to archetypes based on their trait scores.

### Scoring Formula

```typescript
// Final score calculation (0-100 range)
finalScore = (
  baseScore * 0.35 +           // Euclidean distance to archetype profile
  bonusPoints * 0.25 +         // Bonus for matching key traits
  vetoAdjustment * 0.20 +      // Penalty for mismatched traits
  disambiguationBonus * 0.20   // Bonus for confusable pair differentiation
);
```

### VETO System

Critical trait thresholds that can disqualify an archetype:

```typescript
// Example VETO rules for 树洞考拉
"树洞考拉": (traits) => {
  if (traits.A < 65) return { vetoed: true, reason: "A<65: 亲和力过低" };
  if (traits.X > 75) return { vetoed: true, reason: "X>75: 外向性过高" };
  return { vetoed: false };
}
```

### Disambiguation Rules

Handle confusable archetype pairs:

```typescript
const DISAMBIGUATION_RULES = [
  {
    trueArchetype: "好奇猫头鹰",
    rivalArchetype: "慢热龟",
    condition: (t) => t.O >= 70,  // High openness → Owl
    bonusMultiplier: 1.15
  },
  // ... more rules
];
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/personality/matcherV2.ts` | Main matching algorithm |
| `packages/shared/src/personality/prototypes.ts` | Archetype trait profiles |
| `packages/shared/src/personality/traitCorrection.ts` | Score calibration |

---

## V4 Adaptive Personality Assessment

> **Note**: V4 is the current and only supported personality assessment flow. V2 has been deprecated.
> Admin-client retains V2 for legacy admin review purposes only.

### Overview

The V4 assessment dynamically selects 8-16 questions based on real-time confidence levels.

### Question Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Anchor Questions (Q1-Q8)                              │
│  - Core trait coverage                                           │
│  - Establish baseline scores                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: Adaptive Questions (Q9-Q12+)                          │
│  - Based on current archetype predictions                        │
│  - Target confusable pairs                                       │
│  - Stop when confidence threshold reached                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: Differentiation Questions (if needed)                 │
│  - Forced-choice tradeoff questions                              │
│  - Target top confusion pairs                                    │
│  - Maximum 16 questions total                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Assessment Configuration

```typescript
const DEFAULT_ASSESSMENT_CONFIG = {
  minQuestions: 10,
  softMaxQuestions: 12,
  hardMaxQuestions: 16,
  defaultConfidenceThreshold: 0.65,
  confusablePairThreshold: 0.70,
  anchorQuestionCount: 8,
  useV2Matcher: true,  // Use MatcherV2 algorithm
};
```

### Question Types

| Type | Count | Purpose |
|------|-------|---------|
| Anchor (L1) | 15 | Core trait measurement with high discrimination |
| Adaptive (L2) | 30 | Target weak confidence areas dynamically |
| Disambiguation (L3) | 15 | Target specific archetype confusion pairs |
| Total Bank | 60 | V4 adaptive selection (8-16 asked per session) |

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/personality/archetypeNames.ts` | Canonical 12-archetype ordering |
| `packages/shared/src/personality/questionsV4.ts` | 60-question bank with trait vectors |
| `packages/shared/src/personality/adaptiveEngine.ts` | Question selection & confidence tracking |
| `packages/shared/src/personality/matcherV2.ts` | V2 weighted Manhattan distance matcher with asymmetric penalties and VETO filters |
| `packages/shared/src/personality/prototypes.ts` | 12 archetype trait profiles |
| `packages/shared/src/personality/types.ts` | Type definitions (TraitKey, ArchetypeMatch, etc.) |
| `apps/mini-program/src/pages/onboarding/personality-test/` | Adaptive test UI (mini-program) |

| `apps/mini-program/src/pages/onboarding/personality-test/results/` | Results display (mini-program) |
### V2 Matcher Algorithm

**Core Formula:**
```typescript
// 1. Z-score normalization for all traits
userZ = (userScore - 50) / 15  // μ=50, σ=15

// 2. Weighted Manhattan distance
distance = Σ |userZ[trait] - prototypeZ[trait]| × weight[trait]

// 3. Soul trait weights
primary_traits: 1.6-1.8    // Core defining traits
secondary_traits: 1.2-1.3  // Supporting traits
avoid_traits: 0.4-0.8      // Traits to minimize

// 4. Asymmetric penalty for avoid traits
if (user[trait] > prototype[trait] && trait in avoid_traits):
  penalty = λ × (gap - threshold)²  // λ=2.0, threshold=0.5σ

// 5. VETO filters (disqualify extreme mismatches)
// Example: User with X=95 → cannot be 小透明猫 (X=20)

// 6. Gaussian similarity conversion
similarity = exp(-distance² / (2σ²))  // σ=1.2
```

**Trait Scoring Formula:**
```typescript
// Each question option has trait score vector
// Example: { A: 0, C: 2, E: 1, O: 0, X: -1, P: 0 }

// Cumulative scoring across 8-16 questions
finalScore[trait] = rawScore[trait] × normalizationFactor
// Normalized to 0-100 scale for display
```

---

## Key UI Components

### StyleSpectrum

Displays archetype results with orbital visualization.

```typescript
interface StyleSpectrumProps {
  primary: string;                    // Primary archetype name
  adjacentStyles: Array<{
    archetype: string;
    score: number;
  }>;
  spectrumPosition: number;           // 0-100 position on spectrum
  isDecisive?: boolean;               // High confidence match
  traitScores?: TraitScores;          // ACOEXP scores
  uniqueTraits?: string[];            // Archetype-specific traits
  epicDescription?: string;           // Long narrative description
  styleQuote?: string;                // Archetype quote
  counterIntuitiveInsight?: {         // Hidden insight
    text: string;
    rarityPercentage: number;
  };
}
```

**Location (archived):** `archived/workspaces/user-client/src/components/StyleSpectrum.tsx`

### TraitSpectrum

Bipolar trait slider visualization with animated dots.

```typescript
interface TraitSpectrumProps {
  traitScores: {
    A?: number;  // Affinity
    O?: number;  // Openness
    C?: number;  // Conscientiousness
    E?: number;  // Emotional Stability
    X?: number;  // Extraversion
    P?: number;  // Positivity
  };
}
```

**Location (archived):** `archived/workspaces/user-client/src/components/TraitSpectrum.tsx`

### XiaoyueChatBubble

Shared mascot coaching bubble for the mini-program (the web user-client is archived).

```typescript
interface XiaoyueChatBubbleProps {
  content: string;                    // Guidance content
  tail?: boolean;                     // Show tail pointer (auto-disabled for wide layouts)
  hideAvatar?: boolean;               // Hide bubble mascot when companion surface owns mascot
  isLoading?: boolean;                // Show loading state
  loadingText?: string;               // Loading message
  animate?: boolean;                  // Enable stagger entrance animation
  onAnimationComplete?: () => void;   // Callback after entrance finishes
}
```

**Location:** `apps/mini-program/src/components/mascot/XiaoyueChatBubble.tsx`

### Other Important Components

| Component | Purpose |
|-----------|---------|
| `BlindBoxEventCard.tsx` | Event pool discovery cards |
| `PoolForecastStrip.tsx` | Deterministic pool-atmosphere teaser on discovery cards |
| `PoolRegistrationCard.tsx` | Registration status display |
| `ProfileSpotlight.tsx` | Tablemate profile drawer |
| `JoyOrbit.tsx` | Full-screen group member orbital |
| `ConversationTopicsCard.tsx` | AI-generated icebreaker prompts for in-event engagement |
| `MatchCelebrationOverlay.tsx` | Match reveal animation |

---

## Event Pool Matching System

### Two-Stage Model

> **Updated 2026-04-07** — active blind-pool discovery is pool-first, not payment-first. Discovery surfaces can describe pool momentum and threshold progress, but only the server matching pipeline decides when a group actually forms.

```
Stage 1: Pool Discovery + Join
├── User discovers pool on DiscoverPage / BlindBoxEventCard
├── Card can show threshold progress + PoolForecastStrip atmosphere cues
├── Entry can pass through PreJoinVibeBriefSheet → JoinEventPoolSheet
└── Success state means "joined the pool", not "already matched"

Stage 2: Matching Execution + Reveal
├── poolRealtimeMatchingService can scan on registration (realtime)
├── scanPoolAndMatch also runs on scheduled scans
├── MatchingStatusPage owns waiting / reveal / no-match states
└── MatchRevealSequenceV2 is the active cinematic reveal when a group forms
```

### Matching Algorithm Formula

#### Pair Compatibility Score (6D default / 7D feature-flagged)

```typescript
// Default path (ENABLE_SEMANTIC_SIMILARITY=false) — 6 dimensions
pairScore =
  chemistry           × 0.28 +   // 性格化学反应 — archetype chemistry matrix
  interest            × 0.28 +   // 兴趣重叠度  — heat-weighted Jaccard (user_interests table)
  socialAffinity      × 0.20 +   // 社交同频度  — life stage + education affinity + hometown (opt-in)
  backgroundDiversity × 0.15 +   // 背景多样性  — industry + gender diversity
  preference          × 0.05 +   // 活动偏好    — event intent / bar preferences (light signal)
  language            × 0.04;    // 语言沟通    — common languages (light signal)

// Flagged path (ENABLE_SEMANTIC_SIMILARITY=true) — 7 dimensions
pairScore =
  chemistry           × 0.26 +   // 性格化学反应
  interest            × 0.26 +   // 兴趣重叠度
  socialAffinity      × 0.19 +   // 社交同频度
  backgroundDiversity × 0.14 +   // 背景多样性
  preference          × 0.05 +   // 活动偏好
  language            × 0.04 +   // 语言沟通
  semanticSimilarity  × 0.06;    // 语义相似度 — hash-embedding cosine similarity (bounded 35–100)
```

**Semantic similarity:** Built from `archetype`, `lifeStage`, `educationLevel`, `industryNiche`,
`preferredLanguages`, `eventIntent`, bar preferences, and top-10 interest topics with heat weighting.
Reads `user_interests` only — `user_interest_signals` is **never** used in pair scoring.
See `apps/server/src/matchingSemantic.ts` for the full implementation.

**Note — Language (4%):** 普通话覆盖率高，区分力有限，保留为轻量兼容信号。  
**Note — Preference (5%):** 目前酒吧/饭店场景分化有限，保留为轻量场景适配信号。

#### Social Affinity (社交同频度) — same-frequency signals
- **Life stage affinity** (`lifeStage` / `LIFE_STAGE_AFFINITY` matrix — 5×5 canonical vocabulary, averaged both directions)
- **Education affinity** (学历同频度 — ordinal-distance-based; same/nearby levels score higher, NOT a diversity reward)
- **Hometown affinity** (同乡亲和力 — only when both users opted in)

#### Background Diversity (背景多样性) — diversity signals
- **Industry diversity** (行业多样性 — different niche = higher score)
- **Gender diversity** (性别多样性 — different gender = higher score)
- Education is NOT included here; it is an affinity signal.

#### Matrix Distinction
- **Chemistry Matrix** (`archetypeChemistry.ts`): 12×12 archetype compatibility, scores 0–100
- **Life Stage Affinity Matrix** (`LIFE_STAGE_AFFINITY`, `poolMatchingService.ts`): 5×5 `lifeStage` affinity using the canonical vocabulary (学生党, 职场新人, 职场老手, 创业中, 自由职业), averaged forward + reverse for pair score
- **DEPRECATED:** `workMode` is kept for one-release read-only fallback only. New code must write `users.lifeStage`.

#### Group Overall Score

```typescript
overallScore = 
  avgPairScore × 0.60 +      // Average pairwise compatibility
  groupDiversity × 0.25 +    // Group diversity (industries, genders, archetypes, life stages)
  energyBalance × 0.15;      // Communication/energy balance
```

> Note: The `energyBalance` dimension is also referred to as "沟通平衡" (communication balance) in product copy, as it measures social tempo rather than raw archetype energy.

> **Note:** There are two separate matrix concepts in the codebase:
> - **Archetype chemistry matrix** (`archetypeChemistry.ts`) — 12×12 personality compatibility
> - **Life stage affinity matrix** (`LIFE_STAGE_AFFINITY` in `poolMatchingService.ts`) — 5×5 `lifeStage` / 人生阶段 compatibility using the canonical vocabulary. `workMode` is deprecated for writes and kept as a one-release read-only fallback.

#### Per-Pool Gender Balance (wired 2026-07-14)

Four `event_pools` columns are now live (previously inert): `genderBalanceMode` (`none`/`soft`/`hard`, default `soft`), `genderBalanceBonusPoints` (0–100), `minFemaleCount` / `minMaleCount` (0–20, default 0). Soft mode adds a post-clamp bonus in `calculateGroupDiversity` for exact male/female balance and never blocks formation. Hard mode applies the floors as a group-commit gate and in all redistribution phases; a group failing its pool's floor is discarded and members returned to the candidate pool. Floors are hard-mode-only; `genderRestriction="女性"` implies mode `none`. Admin portal create/edit exposes the fields (`性别平衡` section); POST and PATCH enforce identical validation, and PATCH changes are audit-logged. Full spec: `docs/systems/MATCHING_ALGORITHM_REFERENCE.md` §4.2.1.

### Temperature Levels

```typescript
🔥 炽热 (Fire):   score ≥ 85  // Exceptional compatibility
🌡️ 温暖 (Warm):   score 70-84 // Strong compatibility
🌤️ 适宜 (Mild):   score 55-69 // Moderate compatibility
❄️ 冷淡 (Cold):   score < 55  // Low compatibility
```

### Key Files

| File | Purpose |
|------|---------|
| `apps/server/src/poolMatchingService.ts` | Group formation logic |
| `apps/server/src/poolRealtimeMatchingService.ts` | Auto-matching scheduler |
| `apps/server/src/archetypeChemistry.ts` | Chemistry calculations |
| `packages/shared/src/personality/archetypeCompatibility.ts` | Compatibility matrix |

---

## WebSocket Events

### Event Types

```typescript
// Actual WSEventType values (packages/shared/src/wsEvents.ts)
type WSEventType =
  | 'POOL_MATCHED'               // User matched to event group
  | 'EVENT_STATUS_CHANGED'       // Event status update
  | 'EVENT_THEME_TITLE_REVEALED' // Blind box theme revealed
  | 'POOL_REGISTRATION_ADDED'    // New pool registration
  | 'ATTENDANCE_STATUS_UPDATED'  // Attendee confirmed/late/absent
  | 'ICEBREAKER_PHASE_CHANGE'    // Icebreaker session phase
  | 'SOCIAL_PHASE_CHANGED'       // Social icebreaker phase
  // ... and all ICEBREAKER_*, KING_GAME_*, SOCIAL_* event subtypes
```

### POOL_MATCHED Payload

```typescript
interface PoolMatchedData {
  poolId: string;
  poolTitle: string;
  groupId: string;
  groupNumber: number;
  matchScore: number;
  memberCount: number;
  temperatureLevel: string;  // "🔥 炽热", "🌡️ 温暖", etc.
}
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/wsEvents.ts` | Event type definitions |
| `apps/server/src/wsService.ts` | WebSocket server |
| `apps/mini-program/src/hooks/useWebSocket.ts` | Client hook (mini-program) |

---

## Database Schema

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles and authentication |
| `personalityTestResults` | Test scores and archetype |
| `eventPools` | Admin-created event pools |
| `eventPoolRegistrations` | User pool signups with preferences |
| `eventPoolGroups` | Matched groups |
| `events` | Confirmed events |
| `eventAttendees` | Event participants |
| `chatMessages` | Event coordination message records |
| `invitations` | Event-specific invitation codes (expires at event start, linked to inviter) |
| `referral_codes` | Permanent user-level referral codes (linked to user, no expiry) |
| `invitation_uses` | Tracks which invitees used which invitation code (dedup guarded) |
| `userCoupons` | Discount coupons |
| `subscriptions` | Premium subscriptions |
| `matchingThresholds` | Per-pool matching config (includes predictive rerank controls) |
| `poolMatchingLogs` | Matching decision history |
| `user_semantic_profiles` | Persisted semantic embedding profiles generated by the async pipeline (`userSemanticProfileService.ts`); not read by live pair scoring today (current matching computes semantic feature-hash vectors in-memory). Also powers occupation free-text search via pre-computed vectors in `data/occupation-vectors.json` |
| `event_group_outcomes` | Post-event outcome submissions (one per member per group; used for chemistry calibration + admin analytics) |

### Schema Location

`packages/shared/src/schema.ts`

### Database Commands

```bash
npm run db:push        # Sync schema to database
npm run db:push --force # Force sync (destructive)
npm run db:studio      # Open Drizzle Studio GUI
```

---

## AI Services

### DeepSeek Integration

| Service | Purpose |
|---------|---------|
| `xiaoyueAnalysisService.ts` | Personality analysis |
| `matchExplanationService.ts` | Match explanations |
| `icebreakerAIService.ts` | Icebreaker prompt generation |
| `conversationTopicsService.ts` | Group engagement prompts |
| `eventThemeTitleGenerator.ts` | AI-powered event theme title generation for pool groups |

### Event Theme Title Generation Flow

1. **Pool Matching Completes** → `POOL_MATCHED` WebSocket event sent (fast)
2. **Async Generation** → `eventThemeTitleGenerator.ts` generates creative event theme title (1–3 s)
3. **Theme Title Revealed** → `EVENT_THEME_TITLE_REVEALED` WebSocket event sent
4. **Fallback Protection** → Template-based titles if AI fails/times out

**Configuration:**
- `ENABLE_EVENT_THEME_TITLE_GENERATION` - Enable/disable feature (default: true)
- `DEEPSEEK_TIMEOUT_MS` - AI request timeout (default: 5000ms)
- Content safety filtering blocks inappropriate content

### Rate Limiting

All AI endpoints are rate-limited and auth-gated to prevent abuse.

---

## Environment Variables

### Required at startup (`apps/server/src/lib/configValidation.ts`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session encryption |
| `WECHAT_APPID` | WeChat Mini Program App ID (always required) |
| `WECHAT_SECRET` | WeChat Mini Program app secret (always required) |

### Payment env vars (required when `PAYMENTS_ENABLED=true`)

| Variable | Purpose |
|----------|---------|
| `PAYMENTS_ENABLED` | `true`/`false` to enable WeChat Pay integration and its config validation |
| `MOCK_PAYMENTS` | `true`/`false` — when true, payment creation returns instantly-paid mock orders (no real WeChat Pay charges); client skips `Taro.requestPayment` for mock orders. Default: `false` |
| `WECHAT_PAY_APP_ID` | WeChat Pay app ID |
| `WECHAT_PAY_MCH_ID` | WeChat Pay v3 merchant ID |
| `WECHAT_PAY_SERIAL_NO` | WeChat Pay v3 certificate serial |
| `WECHAT_PAY_PRIVATE_KEY` | WeChat Pay v3 RSA private key |
| `WECHAT_PAY_APIV3_KEY` | WeChat Pay v3 API key (must be exactly 32 bytes) |
| `WECHAT_PAY_PLATFORM_CERT` | WeChat Pay platform certificate or public-key PEM for webhook signature verification. Supports raw PEM public key (微信支付公钥 mode), raw PEM platform certificate (legacy), and base64-encoded PEM |
| `WECHAT_PAY_NOTIFY_URL` | Public payment webhook URL; if absent, the server derives it from `APP_URL`, so one of the two must be set when payments are enabled |

### Operational / optional env vars

| Variable | Purpose |
|----------|---------|
| `ADMIN_CREATE_SECRET_KEY` | Admin CLI bootstrap secret |
| `TENCENT_MAP_KEY` | Tencent Maps WebService API key for reverse geocoding, IP定位, POI suggestion/search, and walking routes (server-side only; never expose to mini-program) |
| `TENCENT_MAP_JS_KEY` | Tencent Maps JavaScript API key for admin portal MapPicker |
| `DEEPSEEK_API_KEY` | AI service (via integration); chat/completion only — DeepSeek has no embedding API |
| `APP_URL` | Base public app URL; used as the fallback source for the WeChat Pay notify URL when `WECHAT_PAY_NOTIFY_URL` is unset |

### Dev / feature-flag env vars

| Variable | Purpose |
|----------|---------|
| `ENABLE_DEV_AUTH_TOOLS` | `1` to enable dev/test auth routes (non-production only) |
| `DEBUG_AUTH` | `1` to enable verbose auth debug logging (non-production only) |
| `ENABLE_EVENT_THEME_TITLE_GENERATION` | `true`/`false` to toggle AI event theme generation |
| `DEEPSEEK_TIMEOUT_MS` | AI request timeout in ms (default: 5000) |
| `ENABLE_SEMANTIC_SIMILARITY` | `true` enables the 7th pair-scoring dimension (6% weight, semantic similarity); default `false` — 6D scoring. See `docs/product/LAUNCH_CONFIG.md` and `apps/server/src/matchingSemantic.ts`. |
| `MATCH_COMPASS_STRICTNESS_ENABLED` | `true` shows the Match Compass preference dashboard; `false` hides UI and forces legacy matching path |
| `RESTART_ONBOARDING_ENABLED` | `true` enables the welcome-back screen + onboarding restart flow; default `false` |
| `EMBEDDING_BASE_URL` | Required for self-hosted embedding server (e.g. `http://localhost:8000/v1`). DeepSeek has no embedding API — this must be set for any embedding feature to work |
| `EMBEDDING_API_KEY` | Optional API key for self-hosted embedding endpoint (default empty) |
| `EMBEDDING_MODEL` | Model ID passed to embedding API (default `granite-embedding-97m-multilingual-r2`) |
| `EMBEDDING_TIMEOUT_MS` | Embedding API call timeout (default: 10000) |
| `EMBEDDING_MAX_RETRIES` | Embedding API retry count (default: 2) |
| `RUN_PLAN_TEMPLATES_ENABLED` | `true` enables template-driven run plan compiler **and** the 3×3 vibe grid UX (`深聊`/`均衡`/`暢玩`). When `false`, legacy `compileAgentRunPlan()` runs unchanged and clients hide the vibe selector. Server queries DB `run_plan_templates` with `TEMPLATE_DEFAULTS` fallback | `true` |
| `PERSONALITY_DICE_CHOOSE_MODE_ENABLED` | `true` enables Choose-Your-Prompt variant: 3 difficulty-tiered dares per player, player picks one. `false` retains original single-dare flow |
| `PROMO_BANNER_ENABLED` | `true` shows the discover hero promo banner; `false` kills the entire surface (zero-height spacer) and stops all `promo_banner_*` analytics. DB override via `/admin/feature-flags` (key `promoBannerEnabled`). Default `true` |
| `ENABLE_MATCHING_TEST_MODE` | `true` enables `/api/test/matching-test/*` routes for end-to-end matching with seed bots + real tester payment. Requires `ENABLE_SINGLE_TEST_MODE=true`. Returns 403 in `APP_MODE=production`. Default `false` (2026-06-24) |
| `ALANG_ENABLED` | Environment fallback for DB-backed `alangEnabled`; gates the Alang entry and `/api/alang/*`. Default `false` |
| `ENABLE_SINGLE_TEST_MODE` | Enables non-production single-test surfaces. Alang internal point config/debug routes require this marker (or `APP_MODE=test`); production Alang debug routes stay 404 and auth fails client test mode closed |
| `PROFILE_PIXEL_AVATAR_ENABLED` | Environment fallback for DB-backed `profilePixelAvatarEnabled`; gates the Profile-only 12-archetype pixel avatar and “我的形象” page. Default `false` |
| `EQUIPMENT_REWARDS_ENABLED` | Environment fallback for DB-backed `equipmentRewardsEnabled`; gates inventory, manual reward draw, outfit save, pity, fragments, and fragment exchange. Default `false` |
| `PERSONAL_STORY_ENABLED` | Environment fallback for DB-backed `personalStoryEnabled`; gates the Profile/Alang entry and GET/POST/status before story-table access. When `true` but providers are unavailable, existing chapters remain readable and updates fail without deleting history. Default `false` |
| `CREATIVE_AI_PERSONAL_STORY_PROVIDER` | Optional provider override for the personal-story worker. Normal production order remains MiniMax primary with DeepSeek fallback. |

### Auto-Populated (via Replit)

| Variable | Purpose |
|----------|---------|
| `REPL_ID` | Replit instance ID |
| `REPLIT_DB_URL` | Replit KV store |

---

## Common Debugging Tips

### Frontend Issues

1. **Component not updating:** Check TanStack Query cache invalidation
2. **Route not working:** Verify auth state in `useAuth` hook
3. **Styles broken:** Check Tailwind class conflicts, dark mode variants

### Backend Issues

1. **API returning 401:** Check session middleware, auth state
2. **Database errors:** Run `npm run db:push --force` to sync schema
3. **WebSocket disconnects:** Check `wsService.ts` connection handling

### Personality System Issues

1. **Wrong archetype:** Check VETO thresholds in `matcherV2.ts`
2. **Scores too high/low:** Verify no double multiplication in scoring
3. **Missing adjacent styles:** Check `≥70%` threshold filter

### Matching Issues

1. **No matches formed:** Check `matchingThresholds` values
2. **Poor match quality:** Review `archetypeChemistry.ts` formulas
3. **Missing notifications:** Verify WebSocket `broadcastToUser` calls

---

## Code Conventions

### Standardized Button Component (required for all new UI)

> **Rule:** Always use the shared `<Button>` component for interactive buttons. Do **not** add raw `<button>` elements with ad-hoc styling.

```tsx
// ✅ Correct — uses the shared premium component
import { Button } from "@/components/ui/button";

<Button size="lg" fullWidth onClick={handleSubmit}>提交</Button>
<Button variant="secondary" onClick={onCancel}>取消</Button>
<Button variant="ghost" size="icon" aria-label="返回"><ChevronLeft /></Button>
<Button loading={mutation.isPending}>保存</Button>

// ❌ Avoid — ad-hoc gradient / radius overrides on Button
<Button className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl">…</Button>

// ❌ Avoid — raw button with hard-coded styles
<button className="px-4 py-2 bg-purple-600 rounded-lg text-white">…</button>
```

**Selectable option chips** (radio/checkbox-style lists) are an exception to the raw-button prohibition. Use the CSS tokens directly to stay aligned:
```tsx
<button
  className={`rounded-xl border-2 transition-all duration-150 px-4 py-3 text-sm
    ${selected
      ? '[background:var(--btn-primary-gradient)] text-primary-foreground border-primary font-semibold shadow-[var(--btn-shadow-primary)]'
      : 'border-border hover-elevate active-elevate-2'
    }`}
>…</button>
```

**Source of truth:** `packages/shared/src/ui/Button.tsx` (runtime) · `packages/shared/src/ui/buttonVariants.ts` (styling)  
**Full design reference:** `docs/button-design.md`

### Import Aliases

```typescript
// User client
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import logo from "@assets/logo.png";

// Shared package
import { users, events } from "@shared/schema";
import { TraitKey } from "@shared/personality/types";
```

### API Patterns

```typescript
// TanStack Query - fetching
const { data, isLoading } = useQuery({
  queryKey: ['/api/users', userId],
});

// TanStack Query - mutations
const mutation = useMutation({
  mutationFn: (data) => apiRequest('/api/users', 'POST', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
  },
});
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `StyleSpectrum.tsx`)
- Pages: `PascalCasePage.tsx` (e.g., `ProfilePage.tsx`)
- Hooks: `use*.ts` (e.g., `useAuth.ts`)
- Services: `*Service.ts` (e.g., `poolMatchingService.ts`)

---

## Quick Links

| Resource | Location | Notes |
|----------|----------|-------|
| Product Canon & Active Terminology | `PRODUCT_REQUIREMENTS.md` § Product Canon | **Authoritative — always use this** |
| Active Flow Reference | `DEVELOPER_QUICK_REFERENCE.md` (this file) | **Primary dev reference** |
| Product Requirements | `PRODUCT_REQUIREMENTS.md` | Full PRD |
| Documentation Index | `docs/README.md` | Start here for active docs outside the repo root |
| Contributing Guide | `CONTRIBUTING.md` | Contributor workflow, validation, and doc/skill entry points |
| Current Architecture Map | `docs/architecture/current-state.md` | Active domain ownership |
| Design Guidelines | `design_guidelines.md` | - |
| API Routes | `apps/server/src/routes.ts` + `apps/server/src/routes/domains/` | Composition root + domain modules |
| Database Schema | `packages/shared/src/schema.ts` | - |
| Archetype Data | `packages/shared/src/personality/archetypeRegistry.ts` | - |
| Legacy Redirect Only | `QUICK_REFERENCE.md` | Redirect stub only — not authoritative |
| Platform Coordination Playbook | `docs/reference/PLATFORM_COORDINATION.md` | Canonical web/mini-program auth and payment coordination |
| AI Current-State Guardrails | `docs/ai/ai-agent-harness-separation-strategy.md` | Read first for shipped AI boundaries |
| AI Roadmap & Gates | `docs/ai/AI_INTEGRATION_PLAN.md` | Planning-only phased delivery document |
| **Admin RBAC Matrix** | `docs/admin/admin-rbac-matrix.md` | Admin endpoint → role requirements |
| **Admin Incident Runbook** | `docs/runbooks/admin-incident-handling.md` | Ops tasks, triage, daily checklist |
| **Observability Guide** | `docs/systems/observability.md` | Structured logging, Prometheus, Grafana, alerting, synthetic monitoring |
| **Internal Beta Launch Risks** | `docs/product/launch-risks.md` | MVP caveats + risk acceptance sign-off |

---

## Admin Portal Operational Readiness

### Running the RBAC Coverage Audit Test

The RBAC coverage test introspects the live Express route stack and asserts that every
`/api/admin/*` route (except the public login endpoint) is protected by the appropriate
middleware.

```bash
npm test -w @joyjoin/server -- src/__tests__/adminRbacCoverage.test.ts
```

Expected output: 5 tests passing. The snapshot test also prints the full route/middleware
table to the CI log for audit purposes.

### Audit Logging

Sensitive admin actions emit structured `[AdminAudit]` JSON lines to stdout:

```bash
grep '\[AdminAudit\]' <logfile>
```

The audit logger is at `apps/server/src/lib/adminAuditLogger.ts`. Instrumented actions:
- Admin login (`ADMIN_LOGIN`)
- Account create/update/password-reset (`ADMIN_ACCOUNT_CREATED`, `ADMIN_ACCOUNT_UPDATED`, `ADMIN_PASSWORD_RESET`)
- User ban/unban (`USER_BANNED`, `USER_UNBANNED`)
- Attendance override (`ATTENDANCE_OVERRIDE`)
- Payment refund (`PAYMENT_REFUND_INITIATED`)
- Points adjustment (`ADMIN_POINTS_ADJUSTED`)
