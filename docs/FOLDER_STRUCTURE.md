# JoyJoin Monorepo Folder Structure Blueprint

> **Living document.** Last updated: 2026-07-07  
> **Purpose:** Single source of truth for "where does this go?" Eliminates guesswork for agents and humans navigating the codebase.  
> **Scope:** Covers all top-level directories, workspace internals, and cross-cutting concerns. Excludes `node_modules/`, `.git/`, build artifacts.

---

## 1. Root Topology

```
JoyJoin_app_v0.1/
├── 🟢 apps/                    # Shipping application workspaces
├── 🟢 packages/                # Shared libraries & E2E tests
├── 🟡 scripts/                 # Automation, CI, analysis, devtools
├── 🔵 docs/                    # Documentation taxonomy
├── ⚪ .github/                 # CI/CD, agent definitions, skill registry
├── 🟡 .agents/                 # Local agent skill mirrors
├── ⚪ .cursor/                 # Cursor IDE agent stubs & rules
├── 🟡 deployment/              # Docker, nginx, deploy scripts
├── 🟡 infra/                   # Observability stack (Prometheus, Grafana, Loki)
├── 🟡 tools/                   # Standalone utilities
├── 🟠 archived/                # Frozen legacy code (user-client, old docs)
├── ⚪ [config files at root]   # package.json, tsconfig, env, etc.
```

### Legend

| Symbol | Meaning | Examples |
|--------|---------|----------|
| 🟢 | **Active / shipping** — Production code, actively maintained | `apps/`, `packages/shared/` |
| 🟡 | **Tooling / automation** — Scripts, ops, devtools | `scripts/`, `deployment/`, `infra/` |
| 🔵 | **Documentation / process** — specs, runbooks, proposals | `docs/` |
| ⚪ | **Config / orchestration** — CI, agent wiring, project config | `.github/`, root config files |
| 🟠 | **Legacy / archived** — Frozen, do not modify | `archived/` |

---

## 2. App Workspaces (`apps/`)

> **Rule:** Apps must not import from other apps. Reusable logic goes in `packages/shared`.  
> **Import convention:** `@joyjoin/shared` or `@shared/*` for shared code. `@/*` maps to `src/` within each app.

### 2.1 `apps/server/` — Express API Server (Port 5000)

**Package name:** `@joyjoin/server`  
**Domain skills:** `server-domain-architecture`, `auth-session-and-safety-boundaries`, `database-migration-safety`

```
apps/server/
├── src/
│   ├── routes/
│   │   ├── routes.ts              # 🟠 COMPOSITION ROOT (4137 lines — pre-existing debt)
│   │   └── domains/               # Domain-owned routers (extract from routes.ts)
│   │       ├── auth.ts            # Auth, login, onboarding flow
│   │       ├── onboarding.ts      # Onboarding state & step management
│   │       ├── profile.ts         # User profile CRUD
│   │       ├── assessment.ts      # Personality assessment (legacy V1/V2)
│   │       ├── assessmentV4.ts    # V4 adaptive assessment engine
│   │       ├── assessmentResults.ts
│   │       ├── eventPools.ts      # Pool creation & management
│   │       ├── userEventPools.ts  # User pool registration
│   │       ├── eventGroupOutcomes.ts
│   │       ├── blindBoxEvents.ts  # Blind box event lifecycle
│   │       ├── payments.ts        # Payment creation, verification, refunds
│   │       ├── icebreaker.ts      # Social icebreaker session routes
│   │       ├── miniscript.ts      # Mini-script story game
│   │       ├── matchingConfig.ts  # Matcher configuration
│   │       ├── matchingAdmin.ts   # Admin matching operations
│   │       ├── matchExplanations.ts
│   │       ├── matchingShadowErrors.ts
│   │       ├── admin.ts           # Admin portal API
│   │       ├── adminOperations.ts # Admin action handlers
│   │       ├── adminMatchingShadow.ts
│   │       ├── analytics.ts       # Analytics & funnel endpoints
│   │       ├── aiServices.ts      # AI-powered feature endpoints
│   │       ├── geo.ts             # Geolocation & venue APIs
│   │       ├── demo.ts            # Demo / dev-only routes
│   │       ├── devTools.ts        # Development utilities
│   │       ├── duo.ts             # 双人成行 duo invites
│   │       ├── helpers.ts         # Route helpers
│   │       └── xiaoyue.ts         # Xiaoyue mascot AI (analysis only)
│   ├── repositories/              # Data access layer (NEW CODE GOES HERE)
│   │   ├── usersRepo.ts
│   │   ├── eventPoolsRepo.ts
│   │   ├── paymentsRepo.ts
│   │   ├── adminAuditLogsRepo.ts
│   │   ├── socialIcebreakerAiFeedbackRepo.ts
│   │   └── [25+ more domain repos]
│   ├── services/                  # Business logic (lightweight)
│   │   └── eventThemeTitleGenerator.ts
│   ├── middleware/                # Express middleware
│   │   ├── metrics.ts             # Prometheus metrics
│   │   └── requestId.ts           # Request ID propagation
│   ├── lib/                       # Shared server utilities
│   │   ├── logger.ts              # Structured logging (pino)
│   │   ├── adminAuditLogger.ts    # Admin action audit trail
│   │   ├── aiTraceLogger.ts       # LLM call tracing
│   │   ├── errorResponse.ts       # Standardized error formatting
│   │   ├── requestAuth.ts         # Auth policy enforcement
│   │   ├── socialIcebreakerStore.ts
│   │   ├── socialIcebreakerAccess.ts
│   │   ├── socialIcebreakerSweep.ts
│   │   ├── stateTransitions.ts    # State machine helpers
│   │   ├── poolRegistrationRules.ts
│   │   ├── profileEnrichment.ts
│   │   ├── venueDataQuality.ts
│   │   ├── duoInvites.ts          # 双人成行 duo invitation helpers
│   │   ├── miniscriptAgent.ts
│   │   ├── miniscriptCatalog.ts
│   │   ├── miniscriptValidator.ts
│   │   └── configValidation.ts
│   ├── ai/                        # LLM integration layer
│   │   ├── creativeModelRouter.ts
│   │   ├── socialModelRouter.ts
│   │   ├── deepseekClient.ts
│   │   ├── minimaxClient.ts
│   │   ├── minimaxTTSService.ts
│   │   ├── extractLlmJson.ts
│   │   ├── toolInputRepair.ts
│   │   ├── aiQualityGate.ts
│   │   ├── deepseekBudgetTracker.ts
│   │   ├── socialIcebreakerPrompts.ts
│   │   ├── miniscriptPrompts.ts
│   │   ├── miniscriptValidationPrompts.ts
│   │   ├── qualityJudgePrompts.ts
│   │   └── workers/
│   │       └── poolCardCopyWorker.ts
│   ├── auth/                      # Auth policy & sanitization
│   │   ├── policy.ts
│   │   └── sanitizeAuthUser.ts
│   ├── prompts/                   # Prompt governance
│   │   ├── governance.ts
│   │   ├── persona.ts
│   │   ├── reasoning.ts
│   │   └── index.ts
│   ├── analytics/                 # Analytics computation
│   │   └── registrationFunnelAnalytics.ts
│   ├── gossip/                    # Gossip system (profile clustering)
│   │   ├── index.ts
│   │   ├── gossipCacheService.ts
│   │   └── profileClusterHash.ts
│   ├── jobs/                      # Background job workers
│   │   ├── preGenerationQueue.ts
│   │   └── preGenerationWorker.ts
│   ├── cli/                       # CLI admin tools
│   │   ├── createAdminAccount.ts
│   │   ├── createUserAccount.ts
│   │   └── bypassLogin.ts
│   ├── utils/                     # General utilities
│   │   ├── stringUtils.ts
│   │   └── industryValidation.ts
│   ├── types/                     # TypeScript declarations
│   │   └── express-session.d.ts
│   ├── benchmarks/                # Performance benchmarks
│   ├── test-utils/                # Shared test helpers and fixtures (e.g., withServer lifecycle helper)
│   └── __tests__/                 # Vitest test suites
├── migrations/                    # Drizzle migration files
├── drizzle.config.cjs             # Drizzle ORM configuration
└── package.json                   # Workspace manifest
```

**Placement rules for server:**
- New domain endpoints → `src/routes/domains/<domain>.ts`
- New isolated router → `src/routes/<router>.ts` (rare, prefer domains/)
- Business logic → `src/services/` (lightweight) or `src/lib/` (shared)
- DB queries → `src/repositories/` (**not** `storage.ts` — legacy facade)
- Middleware → `src/middleware/`
- Helpers → `src/lib/` or `src/utils/`
- Shared test helpers/fixtures → `src/test-utils/`
- LLM prompts → `src/prompts/` or `src/ai/`

---

### 2.2 `apps/admin-client/` — React Admin Portal (Port 5002)

**Package name:** `@joyjoin/admin-client`  
**Domain skills:** `admin-client-frontend`, `admin-audit-and-rbac-governance`

```
apps/admin-client/
├── src/
│   ├── pages/admin/               # Admin page components (one per route)
│   │   ├── AdminLayout.tsx        # Shell layout with sidebar
│   │   ├── AdminDashboard.tsx     # Overview & KPIs
│   │   ├── AdminUsersPage.tsx
│   │   ├── AdminEventsPage.tsx
│   │   ├── AdminEventPoolsPage.tsx
│   │   ├── AdminMatchingConfigPage.tsx
│   │   ├── AdminMatchingLabPage.tsx
│   │   ├── AdminMatchingLogsPage.tsx
│   │   ├── AdminVenuesPage.tsx
│   │   ├── AdminFinancePage.tsx
│   │   ├── AdminSubscriptionsPage.tsx
│   │   ├── AdminCouponsPage.tsx
│   │   ├── AdminPricingPage.tsx
│   │   ├── AdminOutcomeAnalyticsPage.tsx
│   │   ├── AdminFeedbackPage.tsx
│   │   ├── AdminModerationPage.tsx
│   │   ├── AdminNotificationsPage.tsx
│   │   ├── AdminContentPage.tsx
│   │   ├── AdminAccountsPage.tsx
│   │   ├── AdminReportsPage.tsx
│   │   ├── AdminDataInsightsPage.tsx
│   │   ├── AdminEvolutionPage.tsx
│   │   ├── AdminIcebreakerAiFeedbackPage.tsx
│   │   ├── AdminInteractionLogsPage.tsx
│   │   └── AdminLoginPage.tsx
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives (33 active, 15 unused archived)
│   │   ├── _unused/               # Archived unused shadcn/ui components
│   │   ├── admin/                 # Admin-specific shared components
│   │   ├── discover/              # Event discovery components
│   │   ├── event/                 # Event-related components (cards, registration, matching status)
│   │   ├── profile/               # Profile & personality test components
│   │   ├── matching/              # Matching visualization & reveal animation
│   │   ├── navigation/            # BottomNav, MobileHeader
│   │   ├── animation/             # Loading & transition animations
│   │   ├── event-pool-registration/ # Pool registration flow
│   │   ├── feedback/              # Feedback display components
│   │   ├── icebreaker/            # Icebreaker admin tools
│   │   └── _archive/              # Unused legacy components (preserved for reference)
│   ├── hooks/                     # React hooks (domain-organized)
│   │   ├── auth/                  # useAuth
│   │   ├── notifications/         # useNotificationCounts
│   │   ├── event/                 # useEventPoolRegistration, useGroupAnalysis, useRevealStatus, useWebSocket
│   │   ├── ui/                    # use-toast, use-mobile, useSoundEffects, usePreloadImages
│   │   ├── game/                  # useLevelUp, useXPNotification
│   │   └── icebreaker/            # use-icebreaker-messages, use-icebreaker-topics
│   ├── lib/                       # Utilities, API clients
│   │   └── __tests__/
│   └── static-data/               # Static lookup data
├── public/
└── package.json
```

---

### 2.3 `apps/mini-program/` — Taro WeChat Mini-Program

**Package name:** `mini-program` (no scope, Taro convention)  
**Domain skills:** `mini-program-frontend-excellence`, `wechat-ecosystem-integration`, `platform-coordination-protocol`

> **Launch-primary client.** This is the only shipping user-facing client. Web client archived.

```
apps/mini-program/
├── src/
│   ├── pages/                     # Taro pages (one directory = one route)
│   │   ├── index/                 # Landing / home (+ mechanismBurst.ts hero mechanism offsets)
│   │   ├── login/                 # Phone login
│   │   ├── onboarding/            # Onboarding flow
│   │   │   ├── onboarding/        # Main onboarding shell
│   │   │   ├── essential-data/    # Basic profile (name, gender, city) + stepIds.ts (canonical step ids)
│   │   │   ├── extended-data/     # Extended profile (birth year, intent)
│   │   │   ├── personality-test/  # V4 adaptive assessment
│   │   │   │   └── results/       # Test results + inline WeChat login (auth-gate removed 2026-05)
│   │   ├── discover/              # Event discovery
│   │   ├── events/                # Event listing
│   │   ├── event-detail/          # Single event view
│   │   ├── pool-registration/     # Pool sign-up flow
│   │   │   └── components/        # PoolRegistrationDuoCard, PoolRegistrationDuoBanner, DuoInfoSheet (双人成行 UI)
│   │   ├── matching-status/       # Match results & group reveal
│   │   │   └── styles/            # SCSS partials (consolidated)
│   │   ├── pool-group-detail/     # Post-match group details
│   │   ├── icebreaker-session/    # Social icebreaker UI
│   │   │   ├── phases/            # Phase view components (warmup, lie-detective, etc.)
│   │   │   └── overlays/          # Overlays & modals (celebration, intro, etc.)
│   │   ├── my-events/             # User's registered events
│   │   ├── event-coordination/    # Event day coordination
│   │   ├── event-feedback/        # Post-event feedback
│   │   ├── profile/               # User profile view
│   │   ├── profile-linked/        # Subpackage: profile-linked auxiliary pages
│   │   │   ├── edit-profile/      # Profile editing
│   │   │   ├── rewards/           # Gamification / rewards
│   │   │   ├── invite/            # Referral / invite friends
│   │   │   └── terms/             # Legal terms
│   │   ├── connections/           # Connection list (replaced /chats)
│   │   ├── blind-box-payment/     # Payment flow
│   │   ├── payment-verification/  # Payment status check
│   │   ├── squad-unboxing/        # Subpackage: match reveal (moved to subpackage 2026-07-14)
│   │   └── center-hub/            # Center tab hub page: active events, pending registrations, empty state
│   ├── components/                # Shared Taro components
│   │   ├── ui/                    # UI primitives (Button, Card, FormStepper, etc.)
│   │   ├── loading/               # Loading states & animations
│   │   ├── mascot/                # Archetype & Xiaoyue visuals
│   │   ├── onboarding/            # BoxJourneySpine (装盒进度), UnboxingCeremony (completion overlay)
│   │   ├── ConnectionPointPill/
│   │   ├── GroupAnalysisSourceHint/
│   │   └── VirtualList/
│   ├── hooks/                     # Shared hooks
│   │   ├── auth/                  # useWeChatLogin, authState
│   │   ├── payment/               # usePaymentCoupon
│   │   ├── navigation/            # useJoyJoinNavigation, useMiniPageGate
│   │   ├── onboarding/            # useOnboardingCheckpoint, useOnboardingAnalytics
│   │   ├── useDuoRegistration.ts  # 双人成行 duo invitation state
│   │   └── usePageTTI.ts          # Time-to-first-interactive instrumentation (cold ≤2000 ms, warm ≤800 ms)
│   ├── lib/                       # API client, utilities
│   │   ├── api/                   # api.ts, authSession, websocket, queryClient, persistentCache
│   │   ├── auth/                  # anonymousOnboarding, authSessionQueryKeys, authSessionRules
│   │   ├── payment/               # Payment flow, pending orders, verification
│   │   ├── onboarding/            # onboardingNavigation, onboardingRoutes, onboardingAnalytics
│   │   ├── navigation/            # centerTabRouting, matchingNavigation, tabBarConfig
│   │   ├── wechat/                # Subscribe messages, abort polyfill
│   │   ├── matching/              # chemistryPayoff, groupDisplay, groupAnalysisDebug
│   │   ├── mascot/                # xiaoyueExpressions, mascotDisplay
│   │   ├── analytics/             # featureFlags
│   │   └── utils/                 # logger, uiConstants, haptics, cdnAssets, genderLabel (getGenderLabel)
│   ├── providers/                 # React context providers
│   ├── styles/                    # Global styles, SCSS (incl. _reveal-motion.scss shared reveal keyframes)
│   ├── native-custom-tab-bar/     # WeChat native tab bar
│   └── assets/                    # Static assets (CDN-first in production)
│       ├── illustrations/         # Blind box Lovart illustrations
│       ├── lovart/                # Lovart manifest only (CDN assets)
│       ├── mascot/                # Xiaoyue sprite WebPs + manifest
│       ├── personality/           # Archetype + Xiaoyue expression WebPs
│       │   ├── archetypes/        # 12 archetype illustrations + spritesheet
│       │   └── xiaoyue/           # Mascot character assets
│       ├── icons/                 # Proprietary icon assets
│       │   ├── mood-icons/        # Mood / atmosphere indicators (bundled)
│       │   ├── chemistry-badges/  # Match chemistry indicators (bundled)
│       │   ├── status-icons/      # Matching / event status badges (bundled)
│       │   ├── reaction-icons/    # Icebreaker reaction buttons (CDN)
│       │   ├── category-icons/    # Interest category selectors (bundled locally)
│       │   ├── intent-icons/      # Onboarding intent selectors (bundled locally)
│       │   ├── reveal-icons/      # Squad-unboxing reveal emblems (CDN)
│       │   ├── achievement-badges/ # Gamification achievement toasts (CDN)
│       │   ├── info-labels/       # Semantic / info label icons (bundled locally; calendar/location/people/target inline labels)
│       │   ├── rating-faces/      # Rating / evaluation faces (CDN-only; emoji fallback)
│       │   ├── phase-icons/       # Icebreaker phase emblems (CDN)
│       │   └── ui/                # Profile / settings list icons (bundled locally)
│       ├── fonts/                 # Brand fonts (partially bundled, partially CDN)
│       │   ├── Quicksand/         # English brand font (~124KB, bundled)
│       │   └── Alimama/           # Chinese display font — minimal subset bundled, full from CDN
│       ├── tab-icons/             # Bottom tab icons (bundled)
│       └── joyjoin-logo.webp      # Brand logo (bundled for native tab bar)
├── config/                        # Taro build config
└── package.json
```

---

## 3. Shared Packages (`packages/`)

### 3.1 `packages/shared/` — Cross-App Schema, Types & Logic

**Package name:** `@joyjoin/shared`  
**Domain skills:** `api-contract-versioning`, `backend-models-standards`

> **The monorepo's contract layer.** DB schema, Zod DTOs, types, and domain logic consumed by all apps. Never import from legacy top-level `shared/`.

```
packages/shared/
├── src/
│   ├── schema/                    # Drizzle ORM schema (source of truth)
│   │   ├── _definitions.ts        # Core table definitions (~3000 lines)
│   │   ├── index.ts               # Schema exports
│   │   ├── users.ts               # User tables
│   │   ├── events.ts              # Event & pool tables
│   │   ├── matching.ts            # Matching & group tables
│   │   ├── payments.ts            # Payment & subscription tables
│   │   ├── personality.ts         # Assessment & archetype tables
│   │   ├── socialIcebreaker.ts    # Icebreaker session tables
│   │   ├── admin.ts               # Admin account & audit tables
│   │   ├── analytics.ts           # Analytics tables
│   │   ├── chat.ts                # Message / connection tables
│   │   ├── venues.ts              # Venue catalog tables
│   │   └── misc.ts                # Auxiliary tables
│   ├── types/                     # Cross-platform TypeScript types
│   │   ├── aiMeta.ts
│   │   ├── eventTheme.ts
│   │   ├── groupAnalysis.ts
│   │   └── industry.ts
│   ├── personality/               # 12-archetype V4 engine
│   │   ├── adaptiveEngine.ts
│   │   ├── archetypeRegistry.ts
│   │   ├── archetypeNames.ts
│   │   ├── archetypeSkills.ts
│   │   ├── archetypeCompatibility.ts
│   │   ├── matcherV2.ts           # MatcherV2 assignment algorithm
│   │   ├── matcherV2Gates.ts
│   │   ├── questionsV4*.ts        # Question banks (L1, L2, Advanced, Attractor, Extended)
│   │   ├── prototypes.ts
│   │   ├── feedback.ts
│   │   ├── traitCorrection.ts
│   │   ├── traitDisplayConfig.ts
│   │   ├── resultViewModel.ts
│   │   ├── canvasPalette.ts
│   │   ├── trainingDataCollector.ts
│   │   ├── secondaryQuestionMap.ts
│   │   └── __tests__/             # Vitest tests
│   ├── ui/                        # UI primitives & design tokens
│   │   ├── buttonVariants.ts
│   │   ├── categoryColors.ts
│   │   └── connectionPointCompat.ts
│   ├── iconSystem/                # Proprietary icon mapping system (emoji → tiered asset)
│   │   └── emojiToIconMap.ts      # Composite lookup: same Unicode emoji resolves to different assets per context tier (reaction, category, intent, reveal, achievement, status, ui, semantic/info-label, etc.); unambiguous single-tier emojis fall back automatically
│   ├── legal/                     # Legal copy
│   │   └── joyjoinTermsZh.ts
│   ├── ai/                        # Shared AI prompts & types
│   │   └── onboarding.ts
│   ├── copy/                       # Brand-governed copy modules
│   │   ├── onboardingVoice.ts      # Tier A 12-archetype × 8-step voice matrix + Tier B fallback
│   │   ├── errorBaselines.ts      # Error message factory functions
│   │   ├── emptyStates.ts         # Empty state templates
│   │   ├── mascotVoice.ts         # 悦仔常用句式库
│   │   ├── toneMap.ts             # Surface ↔ tone mapping
│   │   ├── terms.ts               # Core terminology + banned words
│   │   ├── exceptions.ts          # Orange-word exception templates
│   │   └── index.ts               # Barrel export
│   ├── api.ts                     # Shared Zod DTOs & API contracts
│   ├── index.ts                   # Package exports
│   └── [domain modules]           # Business logic modules
│       ├── onboarding.ts          # Onboarding step mapping
│       ├── matchingWeights.ts     # 6D/7D scoring weights
│       ├── socialIcebreaker*.ts   # Icebreaker run plans, phases, tiers
│       ├── microChallengeTemplates.ts
│       ├── phaseRegistry.ts
│       ├── phaseModule.ts
│       ├── groupMirror.ts
│       ├── quipBattle.ts
│       ├── undercoverWord.ts
│       ├── personalityDiceDares.ts
│       ├── miniscript*.ts         # Catalog, game modes, story framework
│       ├── gamification.ts
│       ├── groupAnalysis.ts
│       ├── interests.ts
│       ├── industryTaxonomy.ts
│       ├── occupations.ts
│       ├── missingOccupations.ts
│       ├── occupationSynonymBuilder.ts
│       ├── achievements.ts
│       ├── eventDetail.ts
│       ├── centerTabRouting.ts
│       ├── hongKongTime.ts
│       ├── constants.ts
│       ├── districts.ts
│       ├── archetypeColors.ts
│       ├── archetypeColorTokens.ts
│       ├── mascotConfig.ts
│       ├── topicCards.ts
│       ├── wsEvents.ts
│       ├── utils.ts
│       ├── schemaAnalytics.ts
│       ├── semanticFallback.ts
│       └── atmospherePrediction.ts
├── __tests__/                     # Package-level tests
└── package.json
```

**Placement rules for shared:**
- DB schema changes → `src/schema/` (then `db:generate` + `db:rebuild-journal`)
- Cross-app types → `src/types/` or `src/api/<domain>.ts` (API DTOs, re-exported via `src/api.ts`)
- Personality engine → `src/personality/`
- UI primitives/tokens → `src/ui/`
- Export from `src/index.ts` or add subpath export in `package.json`

---

### 3.2 `packages/e2e/` — Playwright End-to-End Tests

**Package name:** `@joyjoin/e2e`

```
packages/e2e/
├── tests/
│   ├── health-check.spec.ts
│   ├── onboarding-journey.spec.ts
│   ├── event-pools.spec.ts
│   ├── admin-portal.spec.ts
│   └── parity-screenshots.spec.ts
├── mcp-servers/
│   └── observability.mjs
├── playwright.config.ts
└── package.json
```

---

## 4. Automation & Tooling (`scripts/`)

> **Organized by function.** 100+ files grouped into subdirectories by category. When adding a new script, place it in the functional group that best fits. Shared libraries used by multiple groups stay at `scripts/` root.

```
scripts/
├── auto/                          # Auto-* workflow scripts (GitHub Actions companions)
│   ├── auto-ci-fix.mjs
│   ├── auto-debug.mjs
│   ├── auto-digest.mjs
│   ├── auto-docs.mjs
│   ├── auto-eval.mjs
│   ├── auto-eval-core.mjs
│   ├── auto-eval-hook.mjs
│   ├── auto-fix.mjs
│   ├── auto-merge.mjs
│   ├── auto-prune.mjs
│   ├── auto-test.mjs
│   └── auto-triage.mjs
├── check/                         # CI guardrails & verification
│   ├── check-brand-colors.mjs
│   ├── check-bundle-size.mjs
│   ├── check-doc-mapping.mjs
│   ├── check-guardrails.mjs
│   ├── check-guardrails.test.mjs
│   └── check-workspace-dependency-ownership.mjs
├── harness/                       # Harness quality gates & KPIs
│   ├── harness-auto-trigger.mjs
│   ├── harness-completion-gate.mjs
│   ├── harness-completion-gate.test.mjs
│   ├── harness-contract-gate.mjs
│   ├── harness-cost-tracker.mjs
│   ├── harness-full.mjs
│   └── harness-kpi-report.mjs
├── memory/                        # Agent memory & repo-memory operations
│   ├── memory-auto-land.mjs
│   ├── memory-build-index.mjs
│   ├── memory-draft-candidate.mjs
│   ├── memory-lib.mjs
│   ├── memory-promote.mjs
│   ├── memory-query.mjs
│   ├── memory-stage-candidate.mjs
│   └── memory-validate.mjs
├── orchestration/                 # Agent orchestration system
│   ├── orchestration-lib.mjs
│   ├── orchestration-next-actions.mjs
│   ├── orchestration-routing-metrics.mjs
│   ├── orchestration-supervisor.mjs
│   └── orchestration-turn-summary.test.mjs
├── verify/                        # Verification & validation scripts
│   ├── rebuild-journal.mjs
│   ├── validate-harness-lane-requirement.mjs
│   ├── validate-skill-routing.mjs
│   ├── verify-db-alignment.mjs
│   ├── verify-journal-sync.mjs
│   ├── verify-skills.mjs
│   └── verifySeedMap.ts
├── simulate/                      # Simulations & load tests
│   ├── simulate-1000-users.ts
│   ├── simulate-assessment.ts
│   ├── simulateChatRegistration.ts
│   ├── simulate-gossip-system.ts
│   ├── simulate-gossip-system-v2.ts
│   ├── simulate-psychologist-panel.ts
│   └── simulateUserResearch.ts
├── evaluate/                      # Evaluation & analysis
│   ├── comprehensiveEvaluation.ts
│   ├── comprehensive_simulation.ts
│   ├── evaluate-api-drift.mjs
│   ├── evaluate-golden-tasks.mjs
│   ├── evaluate-matching-algorithm.ts
│   ├── evaluateQuestionDesign.ts
│   ├── evaluate-sprint-contract.mjs
│   └── expertPanelDiscussion.ts
├── test/                          # Test suites & E2E flows
│   ├── test-3d-vs-2d.ts
│   ├── test-character-ab.ts
│   ├── test-character-design.ts
│   ├── test-e2e-flow.ts
│   ├── test-enrichment-chat.ts
│   ├── test-fox-details.ts
│   ├── test-fox-style-ab.ts
│   ├── test-glasses.ts
│   ├── test-migration-logic.js
│   ├── test-migration-scripts.md
│   ├── test-skill-routing.mjs
│   └── test-trust-details.ts
├── devtools/                      # Dev tools & utilities
│   ├── convert-miniscript-assets.sh
│   ├── debug-lock-probe.mjs
│   ├── debug-migration-log.mjs
│   ├── design-audit.mjs
│   ├── measure-mini-program-cold-entry.sh
│   ├── mock-h5-server.mjs
│   └── upload-miniscript-assets-to-cdn.sh
├── analysis/                      # One-off analysis scripts
│   ├── analyze-matching-issues.ts
│   ├── analyze-question-bias.ts
│   ├── analyze-skill-utilization.mjs
│   ├── compareRegistrationMethods.ts
│   ├── generate-sprint-contract.mjs
│   ├── personalityAccuracyAnalysis.ts
│   ├── personalityTestSurvey.ts
│   ├── promote-scorecards-to-memory.mjs
│   ├── question_coverage_test.ts
│   ├── quickEvaluation.ts
│   ├── renumber_questions.ts
│   └── run-sprint-evaluation.mjs
├── data/                          # Data files & reports
│   ├── gossip_simulation_data_2025-12-26.json
│   ├── gossip_simulation_report_2025-12-26.md
│   ├── gossip_v2_report_2025-12-26.md
│   ├── persistent-pairs-training.json
│   ├── simulation_report_2025-12-13.md
│   ├── simulation_results_2025-12-13.json
│   ├── training-data.json
│   ├── user_research_results.json
│   └── xiaoyue_experience_report.md
├── synthetic/                     # Synthetic monitoring probes
│   └── happy-path-probe.mjs
├── mcp-launchers/                 # MCP server launchers
├── [shared libraries at root]
│   ├── automation-llm.mjs         # Shared LLM helper (used by auto/)
│   ├── guardrails-app-sources.mjs # Shared guardrail paths (used by check/)
│   └── [root scripts]
│       ├── wecom-notify.mjs
│       ├── screenshot-open.mjs        # One-command screenshot launcher (used by npm run screenshot:*)
│       ├── screenshot-server.mjs      # Playwright screenshot generator served as PNG URLs
│       ├── rebuild-journal.mjs
│       ├── skill-router.mjs
│       ├── skill-routing-metadata.mjs
│       ├── select-harness-tier.mjs
│       ├── select-model-tier.mjs
│       ├── promote-admin.sh
│       └── tool-repair-integration.mjs
```

---

## 5. Documentation Taxonomy (`docs/`)

> **Organization principle:** Subdirectories by content type. Only `README.md` (index) and this file (directory map) remain at root; all other docs live in subdirectories.

### 5.1 By Subdirectory

| Directory | Content Type | Example Files |
|-----------|-------------|---------------|
| `docs/agents/` | Agent-specific documentation | `SelfIteration.md` |
| `docs/api/` | API contract docs | `industry-classification.md` |
| `docs/copy/` | Brand copy strategy & governance | `brand-copy-strategy.md` |
| `docs/architecture/` | System architecture | `current-state.md`, `skill-routing.md`, `documentation-ecosystem-map.md` |
| `docs/automations/` | CI automation system | `README.md` (auto-debug, auto-docs, etc.) |
| `docs/deliberations/` | Multi-agent deliberation transcripts | `2026-04-29-tier-naming-mascot-rebrand-consensus.md` |
| `docs/design/` | Design briefs & assets | `lovart-briefs/phase-icons-*.md` |
| `docs/handoffs/` | Inter-agent handoff notes | `ai-engineer-mini-program-matching-refactor-review.md` |
| `docs/ops/` | Operational runbooks (icebreaker) | `icebreaker-ai-quality-protocol.md` |
| `docs/proposals/` | Feature proposals & PRDs | `unified-connection-reveal-prd.md`, `miniscript-gameplay-ux-v1-prd.md` |
| `docs/qa/` | QA smoke tests | `mini-program-personality-card-sharing-smoke.md` |
| `docs/research/` | Research spikes & reports | `joyjoin-bulletproof-viral-strategy-china.md` |
| `docs/runbooks/` | Operational runbooks | `session-startup-routine.md`, `emergency-auth-surfaces.md` |
| `docs/superpowers/plans/` | Superpowers implementation plans | `2026-04-21-icebreaker-compilation-implementation-plan.md` |
| `docs/tech-debt/` | Tech debt tracking | `connection-points-cleanup.md` |

### 5.2 Subdirectory Layout

| Directory | Content | Example Files |
|-----------|---------|---------------|
| `docs/ai/` | AI system docs, roadmaps, prompts | `AI_INTEGRATION_PLAN.md`, `ai-agent-harness-separation-strategy.md`, `ai-feature-flags.md` |
| `docs/systems/` | Architecture & system references | `MATCHING_ALGORITHM_REFERENCE.md`, `PERSONALITY_TEST_SYSTEM.md`, `onboarding-flow.md`, `observability.md` |
| `docs/product/` | Product strategy & launch docs | `LAUNCH_CONFIG.md`, `launch-risks.md`, `open-beta-wider.md` |
| `docs/reference/` | Cross-cutting reference docs | `PLATFORM_COORDINATION.md`, `CLI_TOOLS.md`, `perf.md`, `wechat-mini-program-reference.md` |
| `docs/admin/` | Admin-specific docs | `admin-rbac-matrix.md` |
| `docs/hiring/` | Hiring & internship JDs | `ai-evaluation-engineer-intern.md`, `ai-operations-engineer-intern.md` |

### 5.3 Content-Topic Subdirectories

| Directory | Content |
|-----------|---------|
| `docs/ai/` | AI/ML system docs (roadmaps, feature inventory, prompts, separation strategy, flags) |
| `docs/systems/` | System architecture & reference (matching, personality, icebreaker, onboarding, observability) |
| `docs/product/` | Product & launch strategy (launch config, risk register, beta checklists) |
| `docs/reference/` | Cross-cutting references (platform coordination, CLI tools, performance, WeChat APIs) |
| `docs/admin/` | Admin-specific docs (RBAC matrix) |
| `docs/hiring/` | Intern & hiring role descriptions |

---

## 6. CI/CD & GitHub (`.github/`)

```
.github/
├── workflows/                     # GitHub Actions workflows
│   ├── deploy-production.yml      # Production deploy pipeline (release branch)
│   ├── deploy-staging.yml         # Staging deploy pipeline (main branch)
│   ├── quality-gates.yml          # Shared quality gates (reusable workflow)
│   ├── auto-debug.yml             # Daily bug scanning
│   ├── auto-docs.yml              # Daily doc generation
│   ├── auto-digest.yml            # Daily engineering digest
│   ├── auto-test.yml              # Daily test generation
│   ├── auto-ci-fix.yml            # On-CI-failure autofix
│   ├── auto-fix.yml               # Daily deterministic fixes
│   ├── auto-merge.yml             # Auto-merge passing PRs
│   ├── auto-prune.yml             # Weekly cleanup
│   ├── auto-triage.yml            # Auto-labeling
│   ├── taro-weapp-build.yml       # Mini-program build
│   ├── synthetic-probe.yml        # Synthetic monitoring
│   ├── orchestrate.yml            # Agent orchestration
│   ├── wecom-trigger.yml          # WeCom automation triggers
│   └── delete-merged-branches.yml
├── agents/                        # Agent persona definitions (30+)
│   ├── README.md                  # Agent portfolio index
│   ├── manifest.json              # Agent registry
│   ├── MODEL_CATALOG.md           # LLM model catalog
│   ├── QUALITY_RUBRIC.md          # Agent quality rubric
│   ├── AGENT_TURN_VISIBLE_FORMAT.md
│   └── [*.agent.md]               # Individual agent specs
│       ├── planner.agent.md
│       ├── backend-engineer.agent.md
│       ├── frontend-engineer.agent.md
│       ├── supervisor.agent.md
│       ├── deliberation-moderator.agent.md
│       ├── harness-runtime-controller.agent.md
│       ├── game-design-agent.agent.md
│       ├── game-development-agent.agent.md
│       └── ...
├── skills/                        # Canonical skill registry
│   ├── README.md                  # Skill index
│   ├── skill-taxonomy.md          # Skill classification
│   ├── ITERATION_ROADMAP.md       # Skill iteration plan
│   ├── routing-schema.yml         # Skill routing schema
│   └── [skill-name]/              # Each skill directory
│       ├── SKILL.md               # Skill definition
│       ├── routing.yml            # Routing metadata
│       └── references/            # Optional reference docs
├── hooks/                         # GitHub hook configs
│   ├── auto-eval.json
│   └── orchestration.json
├── orchestration/                 # Orchestration test data
│   └── tests/golden-tasks.json
├── [policy docs]
│   ├── AI_TOOLING_UNIFIED_BRAIN.md
│   ├── AI_WORKFLOW_POLICY.md
│   ├── CONTRIBUTOR_AGENT_HARNESS.md
│   ├── ORCHESTRATION.md
│   ├── ORCHESTRATION_GOVERNANCE.md
│   └── SUPERPOWERS_JOYOIN_INTEGRATION.md
├── copilot-instructions.md        # GitHub Copilot instructions
├── pull_request_template.md
└── orchestration.yaml             # Orchestration workflow spec
```

---

## 7. Deployment & Infrastructure

### 7.1 `deployment/`

```
deployment/
├── docker-compose.nginx.yml       # Nginx reverse proxy compose
├── nginx/
│   ├── joyjoin.conf               # Main nginx config
│   └── cdn-static.conf            # Static asset CDN config
├── scripts/
│   └── deploy.sh                  # Deployment script
├── .env.production.example        # Production env template
├── .env.staging.example           # Staging env template
├── MIGRATION_GUIDE.md             # Deployment migration guide
└── README.md                      # Deployment docs
```

### 7.2 `infra/`

```
infra/
├── docker-compose.observability.yml  # Full observability stack
├── prometheus/
│   └── prometheus.yml             # Prometheus scrape config
├── grafana/
│   ├── dashboards/                # Dashboard JSONs
│   └── provisioning/              # Auto-provisioning config
├── loki/
│   ├── loki.yml                   # Loki log aggregation
│   └── promtail.yml               # Promtail log shipping
└── alerting/
    ├── alertmanager.yml           # Alertmanager config
    └── rules.yml                  # Alert rules
```

### 7.3 `tools/`

```
tools/
└── screen-mapper/                 # Screen inventory mapper
    ├── screen_mapper.py
    ├── inventory.json
    └── joyjoin-screen-map.html
```

---

## 8. Agent Tooling

### 8.1 `.agents/` — Kimi / OpenCode Skill Mirrors

> **Mirrors `.github/skills/`** for local agent consumption. Kept in sync manually.  
> Each skill is a directory with `SKILL.md` and optional `routing.yml`.

```
.agents/
└── skills/
    ├── README.md
    ├── skill-taxonomy.md
    └── [skill-name]/              # 60+ skills
        ├── SKILL.md
        └── routing.yml
```

**Key skills (most referenced):**
- `task-creator` — Task routing & scoping
- `server-domain-architecture` — Where to put server code
- `social-icebreaker-domain` — Icebreaker session system
- `matching-domain` — Matching algorithm authority
- `onboarding-state-architecture` — Onboarding flow
- `payment-entitlement-authority` — Payments & refunds
- `llm-runtime-safety-and-integration` — AI call safety
- `harness-completion-gate` — Quality gate
- `monorepo-workspace-governance` — Workspace boundaries
- `docs-sync` — Documentation reconciliation

### 8.2 `.cursor/` — Cursor IDE Integration

```
.cursor/
├── agents/                        # Cursor agent stubs
│   ├── README.md
│   ├── planner.md
│   ├── backend-engineer.md
│   ├── frontend-engineer.md
│   ├── supervisor.md
│   ├── verifier.md
│   └── researcher.md
├── skills/                        # Cursor skill stubs (mirror subset)
├── rules/
│   ├── joyjoin-agents.mdc         # Cursor agent rules
│   └── joyjoin-workflow.mdc       # Cursor workflow rules
├── hooks/
│   ├── README.md
│   └── cursor-hook-adapter.mjs    # Hook adapter for Cursor
├── environment.json               # Cursor env config
└── hooks.json                     # Hook registry
```

---

## 9. Config Files at Root

| File | Purpose |
|------|---------|
| `package.json` | **Root orchestration only** — no deps. Defines workspaces & scripts. |
| `package-lock.json` | Lock file for workspace dependencies |
| `tsconfig.json` / `tsconfig.base.json` | Solution-style TypeScript project references |
| `.env` / `.env.example` | Environment variables (never commit `.env`) |
| `AGENTS.md` | **Agent onboarding guide** — canonical constraints, active vs legacy, commands |
| `README.md` | Human quick-start |
| `DEVELOPER_QUICK_REFERENCE.md` | Engineering guardrails, active vs legacy reference |
| `PRODUCT_REQUIREMENTS.md` | Product canon, terminology |
| `CONTRIBUTING.md` | Contribution guidelines |
| `COMPLIANCE_AUDIT_SOCIAL_FEATURES.md` | Compliance documentation |
| `DESIGN.md` / `design_guidelines.md` | Design system overview |
| `QUICK_REFERENCE.md` | Quick reference card |
| `Dockerfile` | Server container image |
| `.dockerignore` | Docker build exclusions |
| `.gitignore` | Git exclusions |
| `.githooks/` | Local git hooks (pre-commit, post-commit) |
| `.mcp.json` | MCP (Model Context Protocol) configuration |
| `opencode.json` | OpenCode IDE configuration |
| `project.config.json` / `project.private.config.json` | WeChat dev tools config |
| `.gitnexus/` | GitNexus metadata |
| `.joyjoin/` | JoyJoin agent memory database (`agent-memory-db/`) |

---

## 10. Decision Log: "Where Does X Go?"

> Quick-reference for the most common "where do I put this?" questions.

### New Feature — Server Side
| What | Where | Why |
|------|-------|-----|
| New REST endpoint | `apps/server/src/routes/domains/<domain>.ts` | Domain ownership |
| New DB query | `apps/server/src/repositories/<name>Repo.ts` | Clean data access layer |
| New business logic | `apps/server/src/services/` (or `src/lib/`) | Separation of concerns |
| New middleware | `apps/server/src/middleware/` | Reusable across routes |
| New LLM prompt | `apps/server/src/prompts/` or `src/ai/` | Prompt governance |
| New DB table | `packages/shared/src/schema/` → `db:generate` | Schema is shared contract |

### New Feature — Client Side
| What | Where | Why |
|------|-------|-----|
| New mini-program page | `apps/mini-program/src/pages/<kebab-name>/` | Taro page convention |
| New shared component | `apps/mini-program/src/components/<PascalCase>/` | Reusable across pages |
| New admin page | `apps/admin-client/src/pages/admin/Admin<Name>Page.tsx` | Admin page convention |
| New UI primitive | `packages/shared/src/ui/` | Cross-app design tokens |

### Cross-Cutting
| What | Where | Why |
|------|-------|-----|
| New shared type | `packages/shared/src/types/` | Cross-platform consumption |
| New API DTO (Zod) | `packages/shared/src/api/<domain>.ts` (re-exported via `packages/shared/src/api.ts`) | Contract versioning |
| New personality question | `packages/shared/src/personality/questionsV4*.ts` | V4 question banks |
| New icebreaker phase | `packages/shared/src/phaseRegistry.ts` + `src/socialIcebreaker*.ts` | Phase system |
| New copy module/string | `packages/shared/src/copy/` | Brand-governed copy |
| New doc — copy strategy | `docs/copy/` | Brand copy governance |
| New auto workflow script | `scripts/auto/<name>.mjs` | CI automation companion |
| New guardrail script | `scripts/check/<name>.mjs` | Quality gate |
| New harness script | `scripts/harness/<name>.mjs` | Quality framework |
| New analysis script | `scripts/analysis/<name>.mjs` | One-off investigation |
| New devtool script | `scripts/devtools/<name>.mjs` | Development utility |
| New doc — feature spec | `docs/proposals/` or `docs/architecture/` | Design/architecture docs |
| New doc — design brief | `docs/design/` or `docs/design/<subtopic>/` | Visual/design docs |
| New doc — runbook | `docs/runbooks/` | Operational procedures |
| New doc — migration | `docs/migrations/` | Migration history |
| New agent definition | `.github/agents/<name>.agent.md` | Canonical agent registry |
| New skill | `.github/skills/<name>/` + mirror to `.agents/skills/` | Skill governance |

---

## Appendix A: Known Structural Debt

> Pre-existing issues identified by `harness-completion-gate`. Not blockers, but documented for future cleanup.

| Issue | Location | Severity | Recommended Action |
|-------|----------|----------|-------------------|
| **routes.ts too large** | `apps/server/src/routes.ts` (4137 lines) | 🔴 High | Extract remaining inline routes into `routes/domains/*.ts` |
| **Skill duplication** | `.agents/skills/` ↔ `.github/skills/` | 🟡 Medium | Automate sync or consolidate to single source |
| **Legacy storage facade** | `apps/server/src/repositories/legacyStorageRepo.ts` | 🟡 Medium | Migrate remaining consumers to repositories |
| **Archived user-client refs** | Some docs/skills still reference `apps/user-client` | 🟢 Low | Update references to `archived/workspaces/user-client` |

> ✅ **Resolved 2026-05-07:** `docs/` reorganized — all loose files moved into topical subdirectories (`ai/`, `systems/`, `product/`, `reference/`, `admin/`). Only `README.md` (index) and `FOLDER_STRUCTURE.md` (this map) remain at root. All hiring JDs moved into `hiring/`. All cross-references updated repo-wide.

---

## Appendix B: Active vs Legacy Quick Reference

> **Never reintroduce legacy identifiers or paths.** See `DEVELOPER_QUICK_REFERENCE.md` for full canon.

| Legacy (Do Not Use) | Active Replacement |
|--------------------|--------------------|
| `apps/user-client/` | `apps/mini-program/` (archived to `archived/workspaces/user-client/`) |
| `shared/` (root dir) | `packages/shared/` via `@joyjoin/shared` |
| `hasSeenGuide` / `has_seen_guide` | Removed — onboarding goes directly to `/discover` |
| `/guide` route | `/onboarding/setup` → `/onboarding/extended` → `/onboarding/review` |
| `registration_sessions` table | Onboarding flows through `users` + `onboarding_checkpoints` |
| `interestsTop` | Use `user_interest_signals` (display only, **never** in scoring) |
| `standard`/`premium`/`bar` tiers | `breeze`/`glow`/`blaze` (破冰局/畅聊局/狂欢局) |
| IcebreakerToolkit | Social Icebreaker (`/api/social-icebreaker/*`) |
| `14-archetype` V1/V2 | `12-archetype` V4 (8–16 questions, ACOEXP 6-trait, MatcherV2) |
| `/chats` surface | `/connections` |
| `圈子` nav label | `连接` |
| `会员/VIP会员` copy | `权益` |
| Xiaoyue chat-based onboarding | Mascot character only (visuals, loading, empty states) |

---

## Appendix C: Workspace Quick Reference

| Workspace | Port | Package Name | Build Tool | Primary Skill |
|-----------|------|--------------|------------|---------------|
| `apps/server` | 5000 | `@joyjoin/server` | esbuild | `server-domain-architecture` |
| `apps/admin-client` | 5002 | `@joyjoin/admin-client` | Vite | `admin-client-frontend` |
| `apps/mini-program` | — | `mini-program` | Taro | `mini-program-frontend-excellence` |
| `packages/shared` | — | `@joyjoin/shared` | tsc | `monorepo-workspace-governance` |
| `packages/e2e` | — | `@joyjoin/e2e` | Playwright | `e2e-test-runner` |

---

*End of Blueprint. For questions or corrections, update this file and run `npm run guardrails` to verify no structural regressions.*
