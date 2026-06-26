# JoyJoin — Agent Onboarding Guide

> Compact instructions for AI coding agents. Last updated: 2026-06-17

---

## 0. Before You Code — Mandatory Context Checklist

> **Do these steps before editing a single file.** Most implementation errors come from skipping unknown constraints, not from coding mistakes.

### Step 1: Load the domain skill

Use the `skill` tool to load the skill that owns the boundary you're touching. These are the highest-regression areas — missing the wrong skill here is the #1 cause of rework:

| Area you're modifying | Skill to load (mandatory) |
|----------------------|--------------------------|
| Server routes, endpoints, middleware | `server-domain-architecture` |
| Matching scores, pair weighting, group formation | `matching-domain` |
| Venue assignment, venue CRUD, time slots, deals | `venue-location-services` |
| Payment creation, verification, refunds, webhooks | `payment-entitlement-authority` |
| Onboarding flow, `nextStep` logic, completion signals | `onboarding-state-architecture` |
| Social Icebreaker phases, sessions, state machine | `social-icebreaker-domain` |
| Any AI/LLM call in production code | `llm-runtime-safety-and-integration` |
| Admin routes, RBAC, audit logging | `admin-audit-and-rbac-governance` |
| Changes touching both mini-program and web | `platform-coordination-protocol` |
| Any user-facing UI (web or mini-program) | `joyjoin-brand-guidelines` |
| Mini-program implementation quality / completeness audit | `completeness-audit` (pipeline: ui-layout-audit → frontend-design-audit → completeness-audit) |
| Post-implementation mini-program performance (流畅度, 速度, 设备适配) | `performance-audit` |
| Database schema changes, migrations | `database-migration-safety` |
| New feature flag, kill switch, rollout config | `feature-flags-launch-config` |
| Xiaoyue text quality, craft validation, AI-generated Chinese copy | `xiaoyue-writing-craft` |

> Other skills are available. If your task doesn't match this table, describe the task and ask which skill applies.

### Step 2: Read the canonical doc

Each skill's body or `Related docs` section links to the authoritative documentation for that domain. Follow those links. If a skill has no doc references, it is self-contained.

### Step 3: Pre-implementation checklist

- ☐ Relevant skill loaded and read
- ☐ Skill's constraints understood (invariants, placement rules, naming conventions)
- ☐ No legacy identifiers in your planned approach (re-check §1 below)
- ☐ Cross-platform impact assessed (mini-program + web via `platform-coordination-protocol`)

### Step 4: After implementation

- ☐ Run `harness-completion-gate` skill to verify 5-pillar compliance
- ☐ For mini-program UI changes: run `completeness-audit` (pipeline: ui-layout-audit → frontend-design-audit → completeness-audit) for a full 完成度 audit with ROI-ranked gap recommendations
- ☐ For mini-program changes: run `performance-audit` for 流畅度, 速度, and 设备适配 gate check (PASS/WARN/BLOCK)
- ☐ Run `docs-sync` skill if docs need updating for the changes

---

## 1. Active vs. Legacy (Do Not Reintroduce)

Always base implementation on the **current active codebase**, not legacy flows or old git history.

**Legacy — never use:**
- 14-archetype V1/V2 system → replaced by **12-archetype V4** (8–16 questions, ACOEXP 6-trait, MatcherV2)
- `/chats` surface, DM UI → replaced by `/connections`
- `圈子` nav label → `连接`
- `会员/VIP会员` copy → `权益`
- `/guide` as core onboarding → removed; active steps: `/onboarding/setup` → `/onboarding/extended` → `/onboarding/review` → `/discover`
- **Xiaoyue chat-based onboarding is deprecated** — mascot character only (visuals, loading, empty states). Chat registration inline handlers removed from routes.ts in 2026-05-01 refactoring; only `routes/domains/xiaoyue.ts` remains (AI analysis, unwired).
- IcebreakerToolkit → use Social Icebreaker (`/api/social-icebreaker/*`) instead
- ~~`standard`/`premium`/`bar` tier machine IDs → `breeze`/`glow`/`blaze`~~ — **WIRED 2026-05-05**: Server `/start` + `/set-tier`, mini-program tier selector, run plans active
- **`标准局`/`Premium局`/`酒吧局` display names → `破冰局`/`畅聊局`/`狂欢局`** (see `docs/deliberations/2026-04-29-tier-naming-mascot-rebrand-consensus.md`)
- **Lie Detective V1 (AI-fabricated 2 truths 1 lie) → V2 mode available** (`LIE_DETECTIVE_MODE=v2`): user writes 2 tags, AI expands + inserts 1 fake statement. V1 remains default. Design spec: `docs/icebreaker/icebreaker-system.md`
- Root `shared/` directory imports → use `packages/shared/src/` via `@joyjoin/shared` or `@shared/*`
- `personalityMatchingV2.ts` → renamed to `personalityMatching.ts` (2026-05-07)
- `archetypeRegistry.ts.bak` → deleted (stale backup, 2026-05-07)
- `hasSeenGuide` column removed from `users` table (2026-05-07)
- `guide` step removed from `OnboardingNextStep` type and onboarding routing (2026-05-07)
- `LEGACY_TIER_MAP` retained in `socialIcebreakerTierManifest.ts` for backward-compat tier mapping in social icebreaker `/start` route (`apps/server/src/routes/socialIcebreaker.ts`); `resolveLegacyTier()` removed (2026-05-07)
- `/api/registration/chat/start`, `/api/registration/chat/message`, `/api/registration/chat/message/stream` handlers removed from `routes.ts` (2026-05-07)
- `/api/guide/mark-seen`, `/api/guide/complete` routes remain as backward-compat stubs in `routes/domains/onboarding.ts` but the `guide` step is no longer part of the active onboarding flow (2026-05-07)
- **PNG spritesheets in `src/assets/mascot/` are orphaned** — `XiaoyueSpriteAnimator` loads `.webp` via `cdnAsset()` with a **local bundled `.webp` fallback** in `/assets/mascot/`. Only `.webp` + manifest should be in `src/assets/mascot/`; source PNGs go in `assets-source/mascot/xiaoyue-strips/` (2026-05-19, fallback added 2026-06-13).

**Canonical references:** `DEVELOPER_QUICK_REFERENCE.md` and `PRODUCT_REQUIREMENTS.md`

---

## 2. Monorepo Boundaries

- **Root `package.json`** is orchestration-only — **no `dependencies` or `devDependencies`**
- Apps **must not** import from other apps. Reusable logic goes in `packages/shared`
- Import shared code via `@joyjoin/shared` or `@shared/*`
- **Never** import from legacy top-level `shared/` directory (enforced by `npm run guardrails`)
- ESM only (`"type": "module"` in all workspace `package.json` files)
- Strict TypeScript, solution-style project references

**Workspaces:** `@joyjoin/admin-client` (port 5002), `@joyjoin/server` (port 5000), `@joyjoin/shared`, `mini-program`
- `@joyjoin/user-client` was archived to `archived/workspaces/user-client/` (2026-05)

**Copy governance:** `docs/copy/brand-copy-strategy.md` — canonical brand copy strategy with tone modes, terminology table, and four-tier constraint system (🔴🟠🟡🟢). Centralized copy modules at `packages/shared/src/copy/` (`getErrorMessage`, `getEmptyStateMessage`, etc.). All user-facing copy must comply with 🔴 Hard Rules. See also [`joyjoin-brand-guidelines`](./.agents/skills/joyjoin-brand-guidelines/SKILL.md).

---

## 3. Exact Commands (Easy to Guess Wrong)

```bash
# Dev servers (run from repo root)
npm run dev:server                    # loads ../../.env via --env-file
npm run dev:weapp --workspace=mini-program   # Taro watch build

# Database (local dev only — say No to destructive prompts)
npm run db:push                       # sync schema; safe mode
npm run db:generate                   # create .sql migration from schema changes
npm run db:rebuild-journal            # register new migration in _journal.json
npm run db:migrate                    # production & CI only
npm run db:verify                     # CI gate: schema/*.ts vs live DB

# Testing reality: only server has real tests
npm run test -w @joyjoin/server       # vitest, real tests
npm run test -w mini-program          # limited coverage
# Other workspaces have no-op placeholders

# Validation
npm run guardrails                    # env, secrets, legacy identifiers, import boundaries
npm run dep-check                     # verify root has no deps
npm run check:full                    # guardrails + lint + tests + build
npm run harness:gate                  # 5-pillar quality gate

# Personality test simulation (accuracy validation)
npm run simulate:personas:generate    # generate boundary personas + centroids
npm run simulate:personas:run:ci      # matcher isolation on centroids (must be 100%)
npm run simulate:personas:run:all     # full suite: boundaries + centroids
npm run simulate:personas:retest      # test-retest reliability (5 runs each)
npm run simulate:expert-packet        # generate human-readable review packet
npm run simulate:gate                 # CI gate: generate + run centroids

# WeChat Mini-Program upload (开发版)
# CI: every push to main triggers taro-weapp-build.yml → auto-uploads 开发版.
# Manual upload (--appid is required; won't auto-read from project.config.json):
#   npx miniprogram-ci upload --appid wx5a038ee6dee12032 --pp apps/mini-program \
#     --pkp <private-key-file> --uv "1.0.$(date +%Y%m%d).$(date +%H%M)" \
#     --ud "dev build" --rp 1
#
# CDN asset upload (mascot, phase icons, illustrations → joyjoinapp.com/static)
# Trigger: gh workflow run "Upload CDN Assets"
# Production: nginx serves /static/ from /var/www/cdn/ (alias directive).
# Set CDN_RSYNC_PATH=/var/www/cdn for production uploads. The Express dev
# server fallback (vite.ts: /static/ → ../server/static/) is local-dev only.
```

**Migration discipline (CVM PostgreSQL):**
- Local dev → `npm run db:push` (say No to destructive prompts).
- Before commit → `npm run db:generate -- --custom` then `npm run db:rebuild-journal`
- Production DDL → **manual** via generated `.sql` files + `psql`
  > ✅ `db:generate --custom` works: it creates `migrations/####_name.sql` and
    registers it in `_journal.json`. Fill the file with your DDL.
  > ✅ Apply with `psql "$DATABASE_URL" -f apps/server/migrations/<file>.sql`
  > ✅ The CI/CD deploy script **skips automated DDL** entirely.
    Schema changes must be applied separately before deploy.
  > ℹ️ Database is a PostgreSQL 16 Docker container on the CVM (`postgres` service).
    DATABASE_URL format: `postgres://joyjoin:<password>@postgres:5432/joyjoin`

**Same-server staging for 体验版 test pricing (2026-06-17):**
- Use `deployment/docker-compose.staging.yml` to run an isolated staging API + Postgres + admin portal on the production host (API port `5001`, admin port `3002`).
- `deployment/nginx/joyjoin.conf` already includes the `staging.joyjoinapp.com` and `staging.admin.joyjoinapp.com` server blocks.
- Set `APP_MODE=staging` and `TEST_PAYMENT_PRICE_IN_CENTS=1` in `deployment/.env.staging` to charge ¥0.01.
- Build the mini-program with `TARO_APP_API_BASE_URL=https://staging.joyjoinapp.com`.
- Manage staging events and feature flags via `https://staging.admin.joyjoinapp.com`.
- Staging does **not** auto-run migrations; apply `.sql` files manually against `postgres-staging`.
- Full guide: `deployment/README.md` and `docs/operations/test-mode-operations.md` §G.

---

## 4. First-Time Setup

```bash
npm install
cp .env.example .env
# Edit .env: DATABASE_URL, SESSION_SECRET, ADMIN_CREATE_SECRET_KEY, WECHAT_APPID, WECHAT_SECRET
npm run db:push                       # say No to destructive prompts
npm run admin:create -- <user> <pass> "$ADMIN_CREATE_SECRET_KEY" super_admin "Local Admin"
```

**Frontend env vars** (e.g., `VITE_ADMIN_PORTAL_URL`, `VITE_API_URL`) go in per-app `.env.local` files, **not** root `.env`. Leave `VITE_API_URL` unset for normal local dev so Vite proxy works.

**Local dev auth:** Mini-program uses WeChat auth (`微信一键登录`) exclusively. For local server API testing, use `POST /api/auth/dev-login` (`NODE_ENV=development` only). Bypass: `npm run user:bypass <phone> "$ADMIN_CREATE_SECRET_KEY"`. Create test users: `npm run user:create`.

---

## 5. Where to Put New Code

> **📘 See `docs/FOLDER_STRUCTURE.md` for the comprehensive directory blueprint** with domain ownership, placement rules, and the "Where does X go?" decision tree.

**Server:**
- New domain endpoints → `apps/server/src/routes/domains/<domain>.ts`
- New isolated router → `apps/server/src/routes/<router>.ts`
- Business logic → `apps/server/src/services/` (lightweight) or `src/lib/` (shared)
- DB queries → `apps/server/src/repositories/` (**not** `storage.ts`)
- Middleware → `apps/server/src/middleware/`
- Helpers → `apps/server/src/lib/`

**Shared package:**
- DB schema → `packages/shared/src/schema/` (then `db:generate` + `db:rebuild-journal`)
- Cross-app types → `packages/shared/src/types/`
- API DTOs (Zod) → `packages/shared/src/api.ts`
- Personality engine → `packages/shared/src/personality/`
- UI primitives → `packages/shared/src/ui/`
- Export from `packages/shared/src/index.ts` or add subpath export in `packages/shared/package.json`

**Path aliases:** `@shared/*` → `packages/shared/src/*`; `@/*` → `src/*` (clients + mini-program)

---

## 6. Key Architectural Rules

**Onboarding is server-driven:** `GET /api/auth/user` returns `nextStep`. Client never computes its own position.

**Landing page cold-start behavior (2026-06-08):**
- `AutoLoginBridge` (in `app.ts`) attempts silent WeChat auto-login for returning users on every cold start. Previously orphaned — now wired into the app component tree. Retryable errors (transport, 500) reset the attempt guard so the next mount/foreground can retry.
- The landing page (`pages/index/index`) runs a **unified redirect effect** after auth resolves: authenticated users → `nextStep`; guests with an incomplete anonymous assessment session → `reLaunch` back to `/pages/onboarding/personality-test/index`. This prevents users from being stranded on the landing page after backgrounding WeChat.
- **Returning mid-onboarding users see the welcome-back screen** (`pages/onboarding/welcome-back/index`) instead of being dumped directly into their `nextStep`. The landing page checks `shouldShowWelcomeBack()`: requires `nextStep !== 'discover'`, `features.restartOnboarding === true`, `restartsRemaining > 0`, and `joyjoin_welcome_back_seen` not set. This gives users context about their progress and an explicit choice to restart (via `POST /api/auth/onboarding/restart`) or continue.
- The welcome-back `seen` flag is reset after 7 days (`app.ts` `useLaunch` TTL heuristic) because WeChat storage persists across mini-program deletion. Without this, users who delete and re-enter would never see the welcome-back screen again.
- Primary CTA navigation uses a **5s safety timeout** (`navigateWithLegalGate` in `LandingPage.tsx`) that resets the button loading state if `Taro.navigateTo` to the onboarding subpackage hangs (e.g., subpackage download stuck). The timeout is tracked in a ref and cleared on unmount to prevent leaks.
- **Swipe-back / foreground recovery (2026-06-13):** `LandingPage.tsx` resets `isPageExiting` via `useResetOnShow` when the page is re-shown (e.g., iOS swipe-back from an onboarding page). The CTA sets `isPageExiting` before calling `navigateToMiniProgramNextStep` so the button shows a loading state during navigation. If the user has an incomplete anonymous assessment session or an authenticated `nextStep`, the primary CTA label is context-aware (`进入发现页` when `nextStep='discover'`, `继续完善档案` for authenticated onboarding, or `继续完成测试` for a guest incomplete session) and routes to the appropriate step instead of restarting from the personality test intro.
- **Authenticated discover routing (2026-06-13):** Returning authenticated users whose `nextStep === 'discover'` are treated as a valid continue state. The primary CTA label shows `进入发现页` and routes directly to Discover (`Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.discover })`) instead of pushing them through onboarding again.
- **Viewport lock + reduced-motion polish (2026-06-23):** The landing page uses a locked `100dvh` shell with `disableScroll: true`; the content zone is flex-constrained with `ResponsiveSpacer` (`collapseBelow={640}`) so the fixed bottom CTA stays reachable on short phones. CTA glow and auth-hint entrance animations are suppressed under `prefers-reduced-motion: reduce`.

**Onboarding restart v0.1 (2026-05-23):** Returning users with partial onboarding may see a welcome-back screen (`/pages/onboarding/welcome-back`) offering to continue or restart. Restart clears all onboarding-derived data including V4 assessment sessions/answers (preserves WeChat identity + phone), resets to `personality-test`, and burns one of 5 lifetime restarts. Gated by `features.restartOnboarding` (DB-backed feature flag) in auth response. Endpoint: `POST /api/auth/onboarding/restart`. Idempotent — double-tap does not consume quota.

**Personality:** 12 archetypes, V4 adaptive assessment. `packages/shared/src/personality/` owns the engine. **2026-06-02 status:**
- 12 centroids: **100% exact match**
- 33 boundaries: **66.7%** (30/45). Anchor option conflation is the bottleneck — 8 anchors with 3-5 trait scores per option create measurement drift of 10-26 pts on traits like X. Attempted fixes (all regressed or net-zero): purity weighting, surgical option edits, ±3 calibration Qs, per-trait multipliers.
- **`applyMeasurementDriftCorrections`** in `adaptiveEngine.ts`: post-hoc promotion for rooster→corgi and koala→dolphin drift patterns. Proven to fix centroid regressions.
- **`classifyFoxVsOctopus`** activated in matcherV2.ts confusion classifier (method existed, wasn't in switch case).
- **Persona audit:** 13/33 boundary personas had wrong `expectedArchetype` — matcher isolation revealed the true labels. Fixed `scripts/simulate/data/all-personas.json`.
- **Calibration Qs (Q51-Q54):** 4 pure single-trait questions (±2 magnitude), feature-flagged via `enableCalibrationQuestions`. Default `true` in V2 config. Performance impact: +2 avg Q, neutral to slightly negative exact-match. Needs shadow-mode data before production enablement.
- **Results page:** Non-decisive matches show subtle "隐约有[secondary]的影子" blend indicator on hero card, prefers `xiaoyueAnalysis.blendLine`.
- New config options: `traitScoreMultiplier`, `traitScoreBaselines`, `useFixedQuestions`, `fixedQuestionIds`, `enableCalibrationQuestions`, `maxCalibrationQuestions`.

**Matching:** `poolMatchingService.ts` is deterministic authority. 6D scoring (chemistry, interest, socialAffinity, backgroundDiversity, preference, language). Optional 7th semantic dimension behind `ENABLE_SEMANTIC_SIMILARITY`. AI may enrich explanations but **must not** redefine scoring.

**Venue Assignment:** Automatically assigns optimal venues to matched groups via `venueAssignmentService.ts`. Scoring dimensions: budget overlap (30% threshold), cuisine preference overlap, time slot availability (`bookingCount < maxConcurrentEvents`), capacity hard constraint (`seatingCapacity < groupSize` → score=0), and city/district/type/contract-expiry filters. Uses `FOR UPDATE` row locks on slot + booking rows during atomic save to prevent race conditions. Unassigned groups trigger WeCom ops alert (`notifyVenueUnassigned`) and in-app `venue_tbd` notifications. Degraded UX: mini-program shows amber "地点待定" card when unassigned. Canonical doc: `docs/systems/VENUE_ASSIGNMENT_SERVICE.md`.

**Feature Flags (DB-backed, 2026-06-17):** `apps/server/src/lib/featureFlags.ts` is the canonical resolver. DB row is source of truth; env var is fallback. 5s LRU cache (disabled in test env).    Kill switches exposed in auth response `features`: `restartOnboarding`, `smartProfession`, `onboardingForceSkip`, `matchingLiveReveal`, `socialIcebreakerClientForceEnd`, `runPlanTemplatesEnabled`, `promoBannerEnabled`, `personalityShareEnabled` (gates share poster generation), `personalitySlotAnimationEnabled` (gates slot machine reveal), `personalityTestEchoEnabled` (gates answer-echo loading state on personality test, default `true`), `squadUnboxingDragRevealEnabled` (gates drag-to-reveal ribbon on squad unboxing, default `true`), `profileRedesignEnabled` (gates redesigned Profile tab UI including milestones and day-0 nudge, default `true`), `socialIcebreakerCustomModeEnabled` (gates custom-mode icebreaker tier selection, default `true`). Server-side kill switches (not exposed in auth): `paymentsEnabled` (gates payment creation), `registrationEnabled` (gates POST /api/event-pools/:id/register and POST /api/event-pools/:id/register-with-payment, default `true`, env `REGISTRATION_ENABLED`), `venueAssignmentEnabled` (gates post-match venue assignment, 2026-06-17 upgraded from env-only). **2026-06-05 fix:** `personalitySlotAnimationEnabled` and `personalityShareEnabled` defined in `FLAG_ENV_MAP` but never resolved in `buildAuthUserResponse.ts` — both are now included in the `Promise.all` parallel fetch and returned to client. Auth resolution is parallel (`Promise.all`). Admin portal `/admin/feature-flags` (super_admin only) provides toggle UI with source badges, per-flag saving state, empty state, confirmation dialog for dangerous flags (`onboardingForceSkip`, `socialIcebreakerClientForceEnd`), and `updatedAt`/`updatedBy` audit display. Admin mutation is logged to `admin_audit_logs` with action `FEATURE_FLAG_UPDATED`. PUT endpoint validates key against `FLAG_ENV_MAP` whitelist and `value` against `z.enum(["true", "false"])`.

**Social Icebreaker:** Primary in-event flow is `/icebreaker/:sessionId` → Social Icebreaker. `/icebreaker-game` (AI Card Game) is optional deep-dive, not default.
- **Custom mode (`custom` tier):** host-driven free-form flow. Server enters `phase_selection` between phases; host picks next phase via `POST .../select-phase` and can end early via `POST .../end-session`. Feature flag: `SOCIAL_ICEBREAKER_CUSTOM_MODE_ENABLED` (default `true`). In-flight custom sessions continue if the flag is disabled.
- Server routes are split across `socialIcebreaker.ts` (start/session), `socialIcebreakerGameplayCore.ts` (micro-challenge, lie-detective, personality-dice), `socialIcebreakerGameplayExtra.ts` (quip-battle, undercover-word, group-mirror, speed-friending, moment-card), `socialIcebreakerCustom.ts`, `socialIcebreakerTier.ts`, and `socialIcebreakerExtended.ts`. AI generation modules are split under `apps/server/src/socialIcebreaker*AI.ts` with a shared `socialIcebreakerAICore.ts`.
- **Moment Card server render:** `GET /api/social-icebreaker/:id/moment-card.png` (feature-flagged: `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER`)
- **Bonus gate:** when `mini_script` is next eligible, advance pauses at `bonusGateOffered` for host+player vote (`POST .../bonus/respond`, `POST .../bonus/sentiment`)
- **Phase metrics:** `social_icebreaker_phase_metrics` table tracks `dwellTimeMs` per phase on every advance

**Icebreaker tiers & vibe:** Host selects time budget + vibe. Budgets: `breeze` (破冰局, 40min) / `glow` (畅聊局, 60min) / `blaze` (狂欢局, 90min). Vibe: `深聊` (deep_chat, connection-first) / `均衡` (balanced, standard mix) / `暢玩` (play_fun, energy-first). The mini-program tier selector (`pages/icebreaker-session/tier-selector`) now renders 3 human-intention preset cards (`轻松破冰` = breeze+balanced, `深度畅聊` = glow+deep_chat · recommended, `游戏狂欢` = blaze+play_fun); an "自定义时长 / 氛围" toggle reveals the original 3×3 grid for power users; a simplified tier-row fallback renders when `runPlanTemplatesEnabled` is false. Custom mode (`自由局`) remains as a separate card. Bundled Lovart WebP art is used for preset/custom card backgrounds. Template compiler (`resolveTemplateSlots` in `packages/shared/src/runPlanCompiler.ts`) resolves phase selection + durations per vibe×tier combo. Feature-flagged: `RUN_PLAN_TEMPLATES_ENABLED`. See `docs/icebreaker/icebreaker-system.md`.

**Game Design Agent:** Compiles dynamic run plan per session using 70% rule engine + 30% LLM. Reads archetype mix + behavioral signals (mood, commonGround, completion rate, pulse). Rule engine runs on every compilation (deterministic); LLM enhances selection + ordering with 3s timeout fallback. See `docs/icebreaker/icebreaker-system.md` §5.

**Phase pool (8 non-core + 1 bonus):** lie_detective, personality_dice, group_mirror, undercover_word, quip_battle, auction, speed_friending. Mini_script is bonus-only (悦仔 offers after last phase before recap, all tiers eligible). **Bonus gate:** host+player vote gate precedes `mini_script` entry when `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true`. **Personality Dice Choose-Your-Prompt:** When `PERSONALITY_DICE_CHOOSE_MODE_ENABLED=true`, each player receives 3 difficulty-tiered dares (easy/medium/hard) and picks one via `POST .../personality-dice/choose`. Fallback: `PERSONALITY_DICE_DARES` bank (36 dares, 3 per archetype).

**Lie Detective V2:** `LIE_DETECTIVE_MODE=v2` enables user-tag-based gameplay (user writes 2 tags, AI expands + inserts 1 fake). V1 remains default. Host-choosable toggle, all tiers. Design: `docs/proposals/spot-the-bot-game-design.md`.

**Boost plan:** All 10 phases must reach composite ≥8.0 (agent may select any phase — none deferred). 11-week roadmap in `.git/.orchestration/plans/boost-all-games-to-8.md`. Shared infra: Reveal Engine, Gesture Kit, Context Injector, Optimistic Sync.

**Invite/Referral flow (2026-06-04):** Dual-table system: `invitations` (event-specific, `expiresAt` + `invitationType`) vs `referral_codes` (permanent, user-level). Both flow through `invitationCode` on pool registration; server disambiguates (`invitations` first, then `referral_codes`). `pendingReferralCode` in session carries invite attribution across login → pool-registration. Referral conversions recorded on pool registration; new-user attribution at login. Self-referral and dedup guards on both `invitation_uses` and `referral_conversions`.

**Match Compass:** Tri-state preference dashboard (`优先契合`/`平衡体验`/`探索惊喜`) on matching-status pending page. Users tune dealbreakers + nice-to-haves post-registration until `preference_lock_at` (24h before event). Strictness scalar 0-100 affects group formation only; pair scores remain sacred. Kill switch: `MATCH_COMPASS_STRICTNESS_ENABLED`.

**Predictive Shell:** Composite `GET /api/shell/*` endpoints (discover, profile, events, connections) bundle tab data to eliminate cold-start round-trips. Landing page prefetches shells via `PrefetchEngine` and injects into TanStack Query keys. Cache invalidation is server-driven (`shellCache.invalidateUser()`) on mutations (payment/coupon use, pool registration, connection creation, assessment completion, event-feedback submission). Legacy endpoints remain for fallback.

**Matching-Test Mode (2026-06-24):** End-to-end matching validation with one real tester + full-profile bot users through the **same production matching engine**. Defense-in-depth isolation: `isMatchingTestMode()` double gate (requires `ENABLE_SINGLE_TEST_MODE` + `ENABLE_MATCHING_TEST_MODE`; returns false in `APP_MODE=production`), DB markers `users.is_test_bot` + `event_pools.is_test_pool`, and a startup sentinel that crashes if test-bot rows exist in production. Routes at `/api/test/matching-test/*` (start, match, cleanup). Service at `apps/server/src/services/matchingTestService.ts`. Bot profiles include archetypes, industry tiers, `user_interests`, and registration preferences so `poolMatchingService` can score them identically to real users. Cleanup preserves payment records. Docs: `docs/operations/test-mode-operations.md` §H.

**Mini-program is launch-primary:** `apps/mini-program` is the primary and only shipping user-facing client. The web sandbox (`archived/workspaces/user-client/`) exists for historical reference. Cross-surface rules: `docs/reference/PLATFORM_COORDINATION.md`.

**City Unlock v0.1 (2026-05-19, updated 2026-06-23):** Server-owned city expansion tracking via `user_city_interests` + `city_unlock_progress`. Threshold: 50 interested users triggers `collecting` → `researching` status transition + WeCom ops notification. Atomic count updates via Drizzle `sql` expressions (race-safe). Frontend: GPS auto-filter handles Shenzhen silently; `CityUnlockFeedCard` (bottom of pool list, with Xiaoyue mascot) is the sole entry point for city interest; `CityPickerSheet` and `LocationFilterDrawer` now share a unified `PickerShell` + `SelectableTile` design language (filled-primary selected state, consistent header, spacing, motion, and safe-area handling). City picker keeps search + hot-city grid + full city list + scroll-to-selected + inline celebration; area drawer keeps cluster sections + 2-column district grid + heat badges + pending "待解锁" badge. Analytics source for city interest is `city_feed_card`. Progress page at `pages/city-unlock/index`. Admin report: `GET /api/admin/cities/unlock-report`. `CityUnlockBanner` was removed 2026-06-10 and is dead code — do not reintroduce.

**Archetype asset loading (2026-06-05):**
- **Slot machine spritesheet** (`archetype-spritesheet.webp`): loaded from **local bundled path** (`/pages/onboarding/assets/archetypes/`), not CDN. The onboarding subpackage is preloaded at landing page, so the file is on-device before animation starts.
- **Full-size archetype images**: served from CDN as WebP. The **primary archetype image is preloaded on test completion and again on the results page mount**; the remaining images load on demand. Do not bulk-preload all 12 in the app-launch critical path.
- **Canvas poster generation**: 1080×1560 portrait poster (was 1080×1920 prior to 2026-06-22 — ~700 px bottom whitespace eliminated). Pokémon-card compact layout: hero art, rank strip, trait bars, top match chips, energy bar, 2-column skill grid, "限量氛围版" holo stamp. All Y-coordinates on 4 px grid with spacing hierarchy (16/24/32 px). Draws **WebP primary** with **CDN PNG fallback**. Archetype image pre-resolved via `Taro.getImageInfo` before generation; path shared between portrait and square poster. If `drawImage` fails, falls back to concentric accent rings (brand-safe). Canvas backing store released after export (`ctx.clearRect`). Transient failures auto-retry once (1.5 s). **Canvas `drawImage` requires a network-resolvable URL** — local bundled paths (e.g., `/pages/onboarding/assets/...`) work for `<Image>` but NOT for canvas. Pass `visual.asset` (CDN URL) to canvas, while UI `<Image>` receives `displayAsset` (local). Canvas `addColorStop` and `fillRoundedRect` calls must receive valid CSS color strings — use `toCanvasRGBA()` helper from shared `canvasHelpers.ts` (`apps/mini-program/src/lib/utils/canvasHelpers.ts`), not hex-alpha concatenation like `${color}88` which produces invalid strings. DPR capped at 2 for all poster renderers (memory safety — 3× on 750px draws ~20MB backing store). Shared module also provides `exportCanvasWithRetry` (DPR 2→1 fallback, 15s timeout guard), `resolveImagePath` (5s timeout), `drawBadge`, `drawTextBlock`, `splitText`, etc.
- **Square WeChat Moments poster** (`generatePersonalitySquarePoster`, 750×750): generated best-effort after portrait poster via `momentsPosterFactory.ts`. Degrades gracefully to portrait-only on failure or on degradation-tier devices. Square Canvas element conditionally rendered. Offline pre-check (`Taro.getNetworkType`) blocks generation when disconnected. Sharing option: "保存朋友圈卡片" in the action sheet.
- **Decode readiness**: `useSpriteReadiness` hook gates slot animation start until the spritesheet is confirmed decoded (500ms timeout). `backgroundColor` fallback (archetype accent soft) prevents blank circles. Skip logic consolidated into a single early gate in `results/index.tsx`: `!personalitySlotAnimationEnabled`. The slot animation is a mandatory default; reduced-motion preference and degradation-tier detection no longer bypass it. Mid-spin frame-budget mitigation (fewer particles, shorter glow, emergency jump-to-result) remains for primary-tier devices when the spin is already underway.
- **Mascot sprite fallback (2026-06-13 / updated 2026-06-18):** `XiaoyueSpriteAnimator` loads mascot sprite sheets from CDN via `cdnAsset()` and falls back to a curated core of bundled local WebP sheets (`welcome`, `idle`, `coach`, `loading`, `listening`, `thinking`) on `onError`. The remaining states are CDN-only to keep the main package under WeChat's 2 MB limit.
- **Do not** reintroduce local PNG bundling for archetypes. Canvas PNG fallback must use CDN path (`ASSET_BASE_PNG = cdnAsset('/assets/personality/archetypes')`).
- **Archetype images must not have text overlays** — no archetype-name initials or watermarks on hero art. Clean art only.
- **WeChat WXSS silently drops `hsla()`** — all color exports from `packages/shared/src/archetypeColors.ts` must use `rgba()` via `formatHSLAsRGBA()`. Files affected: `archetypeVariants.ts` (`hslToCss()`), `visuals.ts` (`accent` field), `getContrastSafeArchetypeColor()`. The shared helper `hslToRgb()` + `formatHSLAsRGBA()` converts HSL→RGBA deterministically.
- **CSS `backgroundImage: url()` is unreliable in WeChat Mini Program runtime** — use `<Image>` component with `overflow:hidden` container + `transform: translate()` for region crops, as done in `ArchetypeSpritesheet.tsx`. This is the same pattern as `<ChallengeCardBgImage>` for icebreaker backgrounds.
- **`ArchetypeHead` variant prop (2026-06-22):** `ArchetypeHead` component (`apps/mini-program/src/components/mascot/ArchetypeHead.tsx`) supports `variant='head' | 'grid'`. The `head` variant is default, sized at 90% of container with head crop offset. The `grid` variant uses 12 circular 128×128 icons cropped from the archetype spritesheet (`archetype-grid` tier), fills container fully (100%), and is used in pool-registration seat heads. Grid icon paths are defined in `GRID_PATHS` (mirroring `HEAD_PATHS` structure) with CDN fallback via `getCdnGridPath()`.
- **Discover pool-card corner vignettes (2026-06-23):** `OracleCard` renders a decorative Lovart illustration in the top-right corner for dining/drinking event types (`饭局`/`酒局` and English aliases). Assets are CDN-only (`/assets/lovart/oraclecard-corner-dining-20260623-v1.webp`, `/assets/lovart/oraclecard-corner-drinks-20260623-v1.webp`), lazy-loaded, and hidden on degradation-tier devices. Mapping lives in `apps/mini-program/src/components/discover/oracleCardAssets.ts`; analytics includes `hasEventTypeVignette` on `pool_card_tap`.

**Asset loading strategy (2026-06-02 / updated 2026-06-18):**
- Two-tier brand font: minimal Alimama subset (66KB) bundled for instant display; full font (621KB) loads from CDN with 500ms defer. Quicksand English font (256KB) bundled and loaded on app launch.
- **Build-time CDN URL guarantee:** `apps/mini-program/config/index.ts` defaults `TARO_APP_CDN_BASE_URL` to `https://joyjoinapp.com/static` in production; the CI workflow also falls back to the same value, so release builds never ship with an undefined CDN base.
- Route-based CDN preloading: `routePreloadAssets.ts` maps page paths → CDN assets to preload on entry; predictive preloading for likely next screens.
- **Interest taxonomy v2.0 illustrations:** 48 active interests across 6 macro categories are CDN-only. Canonical `imageUrl` lives in `packages/shared/src/interests.ts` and resolves via `getInterestAssetUrl()` → `cdnAsset()`.
- App-launch onboarding preloader: `preloadOnboardingAssets` (`apps/mini-program/src/lib/utils/onboardingPreload.ts`) warms onboarding-critical raster assets in staggered tiers. Tier 1 (immediate) intro/welcome art; Tier 2 (~400ms) test expressions, personality emoji icons, intent icons, milestone badge, welcome-back hero; Tier 3 (~1200ms) a curated core of mascot sprite sheets on capable devices. Skips entirely on 2G/offline and defers Tier 3 on low-end devices (`benchmarkLevel <= 15`).
- Archetype asset registry: `apps/mini-program/src/lib/utils/archetypeAssets.ts` is the canonical source for full-size archetype WebP/PNG URLs, bundled slot-machine spritesheet paths, and bulk-preload helpers. `pages/onboarding/personality-test/visuals.ts` re-exports them for existing consumers.
- Bundled assets: tab-icons, joyjoin-logo, joyjoin-logo-tab, tab-bar-notch-bg, custom-tab-bar, archetype spritesheet (subpackage), locally bundled icon tiers as single high-resolution bare `.webp` files (no `@2x`/`@3x` variants): mood, chemistry, category, intent, expression (rating faces), status, semantic (info labels), and ui. WeChat auto-resolves density suffixes; mixed naming causes 404 fallbacks to emoji, so `validate:icon-transparency` now fails the build if any `src/assets/icons/**/*.webp` contains `@`. **Archetype heads already shipped as bare `.webp` filenames** (no `@3x` suffix — see `@3x` pitfall below) and are bundled locally with CDN fallback copies. **Archetype grid icons** (12 circular 128×128 WebP cropped from spritesheet, `archetype-grid` tier) are bundled locally with CDN fallback for pool-registration seat heads. Landing phase icons (6), empty states, QR code, auction coin icons, Xiaoyue loading + welcome expressions, a curated core of Xiaoyue mascot sprite-sheet fallback (`welcome`, `idle`, `coach`, `loading`, `listening`, `thinking`), Quicksand + Alimama minimal fonts. CDN-primary (with local mirrored fallback): **phase emblems**, reaction, reveal, achievement. CDN-only: remaining mascot sprite states, archetype full-body images (WebP primary + PNG fallback), matching heroes, Lovart illustrations, icebreaker backgrounds, celebration images, extra Xiaoyue expressions, mini-script heroes, ceremony heroes, milestone badges, interest taxonomy v2.0 illustrations (`images/interests/*.webp`). The 2026-06-18 Lovart 5×5 status/UI grid was cropped into `status-icons`, `ui`, `info-labels`, and `reaction-icons` and registered in `emojiToIconMap.ts`.
- **Promo banner exception:** the Discover hero banner (`banner-hero-lovart-v1.webp`) is bundled locally under `assets/promo-local/` and falls back to the CDN copy on `onError`. The `promo/` source directory is still CDN-only and uploaded via `cdn-asset-manifest.json`.
- **`CDN_ICON_TIERS` pitfall (2026-06-16 / updated 2026-06-18):** `packages/shared/src/iconSystem/emojiToIconMap.ts` lists tiers that resolve via CDN. Tiers **not** in this set resolve via `localAsset()` with root-relative `/assets/icons/<tier>/` paths against bundled `src/assets/icons/<tier>/`. Current CDN tiers: `phase`, `reaction`, `reveal`, `achievement`. `intent` was incorrectly in `CDN_ICON_TIERS`, causing broken CDN paths and emoji fallback on pool-registration and onboarding intent grids; it is now bundled locally. `category` was also removed from `CDN_ICON_TIERS`; category icons now resolve through bundled `src/assets/icons/category-icons/` and are pre-warmed via `usePreloadCategoryIcons` before the interest-heat picker renders. `phase` moved **into** `CDN_ICON_TIERS` on 2026-06-16 because the full phase-icon set is too large for the main package; only a curated landing-page subset is bundled locally under `/assets/landing-phase-icons/`. **`ui` tier added 2026-06-17** for profile/settings list icons (`/assets/icons/ui/`) and is bundled locally. On 2026-06-18 the Lovart 5×5 status/UI grid was cropped into `status-icons`, `ui`, `info-labels` (semantic), and `reaction-icons`; `status`/`ui`/`semantic` are bundled locally, while `reaction` remains CDN-primary with the same `reaction-icons` folder mirrored locally so `cdnAsset()` can fall back when `TARO_APP_CDN_BASE_URL` is unset. `chemistry` and `ui` icons were previously uploaded to CDN but are no longer kept there (they load from the local bundle). Keep critical subpackage UI chrome out of `CDN_ICON_TIERS`. **Local bundled icons load eagerly by default** (`JoyJoinIcon` disables `lazyLoad` for non-CDN tiers) because WeChat's lazy-load is unreliable for local assets inside subpackages and can fall back to emoji. When `JoyJoinIcon` receives no explicit `tier`, `getIconMapping()` falls back to an unambiguous single-tier mapping if the emoji exists in exactly one tier map.
- **WeChat `@3x` image pitfall (2026-06-05 / resolved 2026-06-22):** If a `<Image>` `src` already contains `@3x`, WeChat's runtime can attempt to load `...@3x@3x.webp`, causing 404 / missing image. The fix is to ship a single high-resolution bare `.webp` filename (no `@2x`/`@3x` suffix) for every bundled icon and let WeChat scale it. `validate:icon-transparency` enforces this by failing the build if any `src/assets/icons/**/*.webp` contains `@`.
- **WeChat `dvh` pitfall (2026-06-05):** `dvh` is not reliably supported in WeChat WKWebView / Taro. Drawer heights must use `rpx` or `vh` with fallbacks. `LocationFilterDrawer` uses `max-height: 980rpx` (~70% of typical device height) plus an inline `style={{ height: '100%' }}` on `<ScrollView>` and a CSS `height: 100%` / `min-height: 0` flex parent.
- **Promo banner (2026-06-03 / refined 2026-06-04 / hardened 2026-06-04 / local-first 2026-06-18):** Renamed `AiMatchPromoCarousel` → `HeroPromoBanner` to match its real single-hero role (not a carousel). Full-bleed Lovart illustration with copy-side purple/pink wash, glass copy panel, breathing CTA pill with circular arrow, 5 drifting sparkles (negative-delay loop, no dead second), 7s slow image drift, and stagger entrance (panel → eyebrow → title → subtitle → CTA). Title uses `$font-cn-display` (Alimama) for the premium "treat" moment. Three copy variants (A/B/C): no archetype → C, has archetype → A by default, `?promo=A|B|C` URL override forces a specific variant. The hero image is bundled locally (`assets/promo-local/banner-hero-lovart-v1.webp`, 750×563) for instant first paint and falls back to the CDN copy on `onError`; PNG fallback is available via CDN if WebP is rejected. The banner frame uses `aspect-ratio: 750 / 563` (≈75.07%) to match the source art; the previous 48% padding-bottom crop was removed 2026-06-23. Bounded retry pill. `role="region"` + `aria-label` + `aria-roledescription="活动推荐横幅"` + `aria-live="polite"`. CTA 88rpx tap target; `env(safe-area-inset-bottom)`. **`backdrop-filter: blur` removed from eyebrow** due to WKWebView compositor cost on WeChat; uses solid `rgba($color-surface, 0.22)` background instead. IntersectionObserver pauses idle loops when off-screen; `useDeviceTier` gates animations on degradation-tier devices; `prefers-reduced-motion` fully respected. Kill switch via `user.features.promoBannerEnabled` (env `PROMO_BANNER_ENABLED`, default `true`). Analytics: `promo_banner_impression` + `promo_banner_cta_tap` + `promo_banner_image_error` + `promo_banner_image_retry` tracked via `discoverAnalytics`. Component: `apps/mini-program/src/components/HeroPromoBanner.tsx`.
- **Payment welcome banner (2026-06-08):** `FirstTimeCouponBanner` surfaces the welcome coupon (`WELCOME50`/`WELCOME40`) in the payment flow. Premium invitation-card aesthetic: solid warm cream background, one large decorative circle (archetype-tinted), glass copy panel with stagger entrance. Counter animation (0→50), confetti burst on tap, "已领取" celebration overlay. Archetype-aware copy ("作为「开心柯基」的你，这份福利专属于你"). Savings preview line ("立省 ¥44") + validity hint ("有效期至 12月25日"). Full accessibility: `role='button'` on slide, `aria-live='polite'` for counter, `role='status'` for claimed state, no nested interactive elements. Analytics: `welcome_coupon_banner_impression` + `welcome_coupon_banner_tap` via `discoverAnalytics`. Zero external assets, zero package weight. Component: `apps/mini-program/src/components/FirstTimeCouponBanner.tsx`.
- **Event ticket payment (2026-06-12):** New unified payment surface replacing the old entitlement-modal → blind-box-payment redirect for event registration. When a user without subscription/credits taps "确认加入这场局", they now land on the **event ticket payment page** (`/pages/event-ticket-payment/index`) — a premium ticket-card UI showing event summary, registration choices as chips, price block with auto-applied coupons, collapsible package upsell (3次/6次 activity packs with dynamic savings), and a sticky `微信支付 ¥XX` CTA. Payment flows through `POST /api/event-pools/:id/register-with-payment` (creates payment with registration payload stored; webhook fulfillment auto-creates the registration). Inline verification polling replaces the separate payment-verification page. Entitled users (subscription/credits) bypass the ticket and register directly. **The existing `blind-box-payment` page remains for standalone plan purchases** — the ticket page is exclusive to event registration. Terminology: `权益` → `报名费`/`活动费用`. Shared API: `registerForPoolWithPayment()` in `packages/shared/src/api.ts`.
- **Batch C + D Lovart assets (2026-06-04 Path B local-bundle → 2026-06-16 CDN):** 8 ceremony heroes (`src/assets/ceremony/`) + 9 milestone badges (`src/assets/badges/`) now resolve via `cdnAsset()` and are uploaded to CDN through `apps/mini-program/scripts/cdn-asset-manifest.json`. They were originally shipped inside the WeChat package (Path B local-bundle, q=55, 600px max, ~570KB raw) because the main package zip fit at 1.98MB. On 2026-06-16 the Xiaoyue mascot sprite-sheet fallback was added to the main package (~684KB), pushing the zip over WeChat's 2MB hard limit. Ceremony and milestone assets were therefore moved to CDN to preserve the mascot fallback. PNG masters remain in `assets-source/lovart/batch-c/` and `assets-source/lovart/batch-d/`. Registries: `apps/mini-program/src/lib/ceremonyHeroes.ts` and `milestoneBadges.ts`.
- **Shared production CDN (2026-06-17):** staging and production builds both load CDN assets from `https://joyjoinapp.com/static` (`/var/www/cdn`). The separate `/var/www/cdn-staging` path was removed to avoid duplicate uploads. Update `TARO_APP_CDN_BASE_URL` in `apps/mini-program/.env.local` if you ever need a different target, but keep the single shared path as the default.
- **CDN upload symlink resolution (2026-06-17):** `apps/mini-program/scripts/upload-cdn-assets.mjs` resolves symlinks via `fs.realpathSync(src)` before copying to the staging directory. This fixes symlinked source directories (e.g. onboarding subpackage assets mirrored under `src/assets/`) which previously copied as broken symlinks to the remote host. `cdn-asset-manifest.json` is the source of truth for the CDN; run `npm run upload:cdn-assets` after changing it.
- `npm run check:package-size` measures actual zip-compressed size (not raw directory size) against the 2MB WeChat limit.
- Icebreaker challenge-card backgrounds use `<ChallengeCardBgImage>` (WeChat-safe `<Image>` component) instead of CSS `background-image` with CDN URLs, which is historically flaky in WeChat runtime.
- **Image aspect-ratio discipline (2026-06-23):** Fixed-height containers paired with `<Image mode='aspectFit'>` create blank bands or cropping when the container aspect does not match the source asset. For images whose rendered size must scale with width, use `mode='widthFix'` and set the container to `height: auto` (or `aspect-ratio: W / H`). When using `aspectFit`, make the container's aspect ratio match the source (e.g., `aspect-ratio: 800 / 531` for `lovart-generic-error.webp`, `aspect-ratio: 1 / 1` for square Lovart empty-state illustrations, `aspect-ratio: 750 / 563` for the Discover promo banner). The pool-registration hero, `StatusCard`, event-detail, pool-group-detail, icebreaker-session, squad-unboxing, and rewards empty states were audited and fixed for this on 2026-06-23.

**Tab bar icon gotcha + `switchTab` requirement:** `centerHub` tab in `tabBarConfig.ts` must have a non-empty `iconPath` (the `miniprogram-ci` upload rejects empty icon paths with `800059`). **Crucially, `centerHub` must also be included in `MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS`** (the `tabBar.list` array consumed by `app.config.ts`) because WeChat validates `wx.switchTab` targets against `tabBar.list` even when `custom: true`. Excluding it causes `switchTab:fail can not switch to no-tabBar page`. The custom tab bar component renders the center button independently (`joyjoin-logo-tab.png` + `tab-bar-notch-bg.png`), so any placeholder icon works for both CI validation and `switchTab`. The tab bar logo uses a dedicated 128×128 `joyjoin-logo-tab.png` (19KB) instead of the full-resolution `joyjoin-logo.png` (596KB) to stay within the 2MB package budget. Fixed 2026-05-19 and 2026-06-06.

**Custom tab bar geometry (2026-06-04 / visual polish 2026-06-05 / hardened 2026-06-11 / simplified 2026-06-23):**
- Surface height: `$tab-bar-height: 128rpx`; root footprint: `$tab-bar-root-height: 182rpx` (accommodates 42rpx center protrusion above surface)
- Center CTA button is a **root sibling** of `.joy-custom-tab-bar__surface` (not nested inside) to avoid surface clipping. It uses `solid #FFF4F8` fill (`$color-bg-tint-pink`) — the previous `#8B5CF6` clashed with the multi-color JoyJoin logo. Gradient was purged from all mini-program CTAs
- **Center positioning uses a flexbox wrapper** (`.joy-custom-tab-bar__center-wrap` with `justify-content: center`) instead of the fragile `left: 50%; transform: translateX(-50%)` pattern. The `transform` approach is unsafe in the WeChat mini-program renderer because `setData` re-renders can drop the `translateX(-50%)` offset when combined with `hover-class` transforms, causing the button to shift right by ~half its width
- Center outer ring: `2rpx solid rgba(255, 107, 157, 0.18)` (`$color-secondary` at ~18% opacity) for subtle definition without competing with the logo
- Surface layering: double shadow (`0 -4rpx 24rpx rgba(0,0,0,0.06), 0 16rpx 48px rgba(0,0,0,0.04)`) plus `1rpx solid rgba(139, 92, 246, 0.06)` top border (`$color-primary` at 6% opacity) for soft lift off the page
- Center button width reduced to `148rpx` (was `192rpx`) to prevent overlapping adjacent tabs on narrow screens
- Selected tab pill now uses `$color-secondary` (`#FF6B9D`) text + icon tint and `rgba(139, 92, 246, 0.08)` background instead of purple-on-purple
- Active tab pill: `rgba(139, 92, 246, 0.08)` background + `border-radius: 24rpx`
- Haptics: `wx.vibrateShort({ type: 'light' })` on every side-tab tap
- State sync: 50ms debounce + shallow diff in native `syncState`; badge updates use WeChat path syntax (`leftTabs[idx].badgeCount`) to avoid array reconstruction and icon flicker. `syncState` is skipped while offline and replayed on reconnect via `wx.onNetworkStatusChange`
- Authoritative rollback: `_confirmedSelected` tracks the last confirmed selection. Rollback uses this (not the optimistic `data.selected`) to handle rapid tab switching safely. `pageLifetimes.show` safety net resets `selected` to `_confirmedSelected` after 100ms on swipe-back
- Failure rollback: `handleTabTap`/`handleCenterTap` roll back `data.selected` to `_confirmedSelected` and show a toast (`切换失败，请重试`) on `wx.switchTab` `fail`. Analytics events `mini_program_tab_bar_switch_fail` and `mini_program_center_button_switch_fail` are tracked
- In-flight guard: a `_switchInFlight` flag prevents a second `wx.switchTab` while one is already pending; a 2s safety timeout releases the guard if the runtime never invokes success/fail
- Active highlight: per-item `.joy-custom-tab-bar__tab--active` background (`rgba(139, 92, 246, 0.08)` + `border-radius: 24rpx`) replaces the previous sliding translateX pill. The orphaned sliding-pill geometry, CSS, and `pillTranslateX`/`pillWidth`/`pillTransitionEnabled` data fields were removed 2026-06-23. Hardcoded `selected === 4` checks were replaced with the `CENTER_TAB_INDEX` constant
- Lifecycle hygiene: `attached` registers `wx.getNetworkType` and `wx.onNetworkStatusChange`; `detached` clears `_syncTimer`, `_showTimer`, `_switchTimer`, `_announcementTimer`, and unregisters the network listener. `pageLifetimes.show` safety net handles swipe-back rollback when optimistic state survives page hide
- Animations: badge pop-in spring, center badge pulse, scoped image fade-in on specific elements only (global selector removed to prevent re-trigger on every `setData`). Gated by `@media (prefers-reduced-motion: reduce)`
- Low-end gating: `wx.getSystemInfoSync().benchmarkLevel <= 15` **or** an iOS device without a `benchmarkLevel` value disables all animations via `.joy-custom-tab-bar--low-end` class (WXSS overrides). `will-change` hints are reset to `auto` on low-end + reduced-motion to free GPU layers.
- Collapse API: `setCollapsed(boolean)` toggles `data.collapsed`, returns `true` when the state changed, and no-ops when already in target state or after `detached`. Collapse/expand announcements (`标签栏已收起` / `标签栏已展开`) are written to `data.announcement` and cleared after 1s
- Screen-reader announcements: tab-switch success writes `data.announcement` (e.g., `已切换到足迹`) and clears after 1s
- Visibility state: `data.hidden` defaults to `true`; `setSelected()` reveals the bar on tab pages. The `_shouldHideOnPage` helper hides the bar when attached to known non-tab routes
- **`catch-move` pitfall (2026-06-11):** Do NOT add `catch-move` to the tab bar root. In WeChat's native `cover-view` layer, `catch-move` on a parent intercepts `touchmove` events and blocks the tap gesture recognizer for child elements — causes all tab buttons to become unresponsive. The tab bar is `position: fixed` and does not need scroll blocking.
- **Tab bar WXML pitfall (2026-06-15):** The active native custom tab bar intentionally uses plain `<view>`/`<image>` (not `<cover-view>`/`<cover-image>`). WeChat's `cover-view` overlay only reliably renders `cover-view`/`cover-image` children; a hybrid tree where `<cover-view>` wraps `<view>`/`<image>` children causes blank tab icons and labels. Keep the root, surface, tabs, and center button as `<view>`/`<image>`.
- **Tab bar visibility smoke test (2026-06-18):** After any tab-bar or routing change, verify with WeChat DevTools that the tab bar is actually visible on tab pages (computed `display: block`, no `hidden` attribute) and hidden on non-tab pages. The WXML tree alone is not enough — the component can be present while `hidden=""` makes it `display: none`. The `_shouldHideOnPage` guard normalizes route formats (`pages/discover/index`, `/pages/discover/index`, and Taro timestamp queries) and defaults to `hidden: true`, revealing the bar only when `setSelected()` is called from a tab page. See `docs/runbooks/mini-program-tab-bar-smoke.md` for the canonical procedure and `apps/mini-program/src/native-custom-tab-bar/__tests__/tabBarBehavior.test.ts` for regression tests.
- **CSS custom properties:** 8 brand tokens (`--jj-primary`, `--jj-secondary`, `--jj-bg-tint-pink`, etc.) declared on `.joy-custom-tab-bar`. All hardcoded hex values in WXSS now reference these variables for maintainability. New colors must use this pattern.
- Active pill `border-radius`: `24rpx` (on 8rpx grid; was `20rpx` before 2026-06-11 fix).
- Haptics: platform-aware — `type: 'light'` on iOS, plain `wx.vibrateShort()` on Android. Silently fails on unsupported devices
- 8rpx rhythm: all spacing normalized to the grid (no 6rpx, 12rpx, or negative-2rpx values)

**Mini-program shared UI primitives (2026-05-27):**
- **`Chip`** (`apps/mini-program/src/components/ui/Chip.tsx`) — unified tag/pill component for interest tags, filters, and selections. Props: `label`, `selected`, `level` (1–3), `compact`, `onClick`. Level hierarchy is monotonic: L1 subtle (`$color-primary-light`) → L2 medium (`rgba(primary, 0.14)`) → L3 strong (`rgba(primary, 0.26)`). Includes checkmark pop-in animation and shimmer pseudo-element.
- **`BrandLogo`** (`apps/mini-program/src/components/ui/BrandLogo.tsx`) — single-source-of-truth logo renderer. Uses local `/assets/joyjoin-logo.webp`. Preset sizes: `sm` (74rpx), `md` (152rpx), `lg` (240rpx), `xl` (520rpx`). Prefer this over hardcoding `<Image src="/assets/joyjoin-logo.webp">`.
- **`JoyJoinIcon`** (`apps/mini-program/src/components/ui/JoyJoinIcon.tsx`) — proprietary icon renderer replacing raw emoji on primary UI surfaces. Props: `emoji`, `size?`, `tier?`, `className?`, `style?`, `lazyLoad?`. 4-tier fallback chain (no mapping → require fail → load fail → native emoji). Composite tier-aware lookup via `packages/shared/src/iconSystem/emojiToIconMap.ts` (same Unicode emoji can resolve to different assets per context; `CDN_ICON_TIERS` controls CDN vs bundled resolution). **Default loading behaviour: CDN tiers lazy-load; local bundled tiers load eagerly** to avoid emoji fallback in subpackages. Includes fade-in + brand motion-curve load animation, reduced-motion support, shimmer placeholder, and `alt` accessibility. Use for reactions, categories, intents, achievements, chemistry badges, status icons, phase emblems, rating faces, and info labels. **Build guard:** `npm run validate:icon-transparency` fails the build if any local bundled icon that floats on variable backgrounds is fully opaque.
- **`XiaoyueChatBubble`** (`apps/mini-program/src/components/mascot/XiaoyueChatBubble.tsx`) — shared mascot coaching bubble with `tail` prop (auto-disabled for vertical/wide layouts), `hideAvatar` prop (default `false`, used when companion surface already renders the mascot to avoid duplication), glow ring, sentence stagger animation, and `aria-live="polite"` + `role="status"` + `aria-atomic="true"` for screen-reader announcement. Refactored across edit-profile, extended-data, profile-review, and pool-registration.
- **`TypewriterText`** (`apps/mini-program/src/components/ui/TypewriterText.tsx`) — character-by-character text reveal for mascot speech bubbles. Props: `text`, `speed` (ms/char, clamped ≥16), `delay`, `enabled`, `showCursor`, `onComplete`, `numberOfLines`. Includes punctuation-aware pauses (。！？= 2.5×, ，= 1.5×) and a blinking cursor. Used in personality-test speech bubble; suitable for any mascot "talking" moment.
- **`StatusCard`** (`apps/mini-program/src/components/ui/StatusCard.tsx`) — unified empty/error/status card with a Lovart hero illustration (CDN WebP with PNG fallback), title, description, and optional action. Props: `tone` (`'empty' | 'error' | 'success'`), `heroSrc?`, `icon?`, `title`, `description?`, `action?`. The hero `<Image>` uses `mode='widthFix'` with `height: auto` so mixed-aspect Lovart illustrations (e.g., 800×531 error art, 800×800 empty art) render without letterboxing. Used on Discover and Events for empty states; also used on Discover for list-fetch error states with a retry CTA.

**Accessibility patterns in personality-test results (2026-06-05 / updated 2026-06-22):**
- **Reduced motion:** CSS `@media (prefers-reduced-motion: reduce)` plus a JS-driven `.personality-results--reduce-motion` container class suppresses stagger entrances, holographic shimmer, and card tilt. The slot-machine animation itself is intentionally mandatory and is not gated by `reduceMotion`; the only bypass is the server-driven `personalitySlotAnimationEnabled` feature flag.
- **Sprite animator crossfade gating:** `XiaoyueSpriteAnimator` crossfade between expression sprites is suppressed when `reduceMotion` is active or when `useDeviceTier()` reports a degradation-tier device. Both the entering and exiting sprites share the same `motionEnabled` gate so a low-end or reduced-motion device never plays one side of the crossfade while the other is frozen.
- **Sprite animator animation engine (2026-06-22 / revised 2026-06-22):** `XiaoyueSpriteAnimator` uses JS-driven `setInterval` with `useState` frame index and `useEffect` cleanup — CSS `steps()` was attempted but reverted because CSS custom properties inside `@keyframes` are unreliable in WeChat runtime (causes horizontal sliding instead of stepping). A `pendingExitCleanupRef` pattern defers crossfade cleanup when the app is hidden (handled via `handleAppHide`/`handleAppShow`), preventing stale DOM state on return. The `animationGen` key on `SpriteFrame` forces remount on state changes (replaces the removed `playKey` pattern). Background tint `rgba($color-primary, 0.04)` on `&__frame` masks the loading gap before the sprite sheet decodes.
- **Slider accessibility:** The `slider` question's live value badge uses `aria-live="polite"` so screen readers announce value changes without overwhelming the user. The badge transform is gated by JS `reduceMotion` and returned as inline `transform` (e.g. `translateX(...) scale(...)`); CSS custom properties for per-frame updates were removed because they are unreliable in the WeChat runtime. `will-change: transform` is applied for GPU-composited drag. A first-time hint `"拖动滑块，选择最符合你的程度"` dismisses on first interaction.
- **Touch-tilt rAF throttling:** The collectible card's touch-drag tilt uses `rafPendingRef` + `pendingTiltRef` to batch `setTouchTilt` calls to a single `requestAnimationFrame`, preventing React state flood during fast swipes.
- **Offline resilience:** `Taro.getNetworkType()` detects offline state on fetch failure. `ErrorStage` shows offline-aware copy (`'网络好像断开了'` vs `'揭晓过程被打断了'`). Retry uses exponential backoff capped at 4s (`Math.min(4000, 1000 * 2^(retryCount-1))`) with `retryTimerRef` cleanup on unmount.
- **Predictive prefetch:** Primary archetype image is preloaded via `preloadImagesWithDiagnostics` on test completion (from the final answer response) and again on results page mount, reducing perceived load time.
- **Timer cleanup:** `FinalStage` tracks its detail-sheet close-animation timeout in `detailCloseTimerRef` and clears it on unmount to prevent setState-after-unmount.
- **Error-state screen-reader support:** `ErrorStage` uses `role="alert"` and `aria-live="polite"` so assistive tech announces sync failures.
- **Split-brain hardening:** Server `validateFinalResult()` validates `primaryArchetype` before persistence; client `isValidFinalResult()` blocks transition if invalid. Unified fallback chain ensures slot target and display archetype resolve identically.
- **Accent colour rule:** Whenever an archetype name appears inline with plain text, render it in the archetype's branded `accentText` colour (computed via `getContrastSafeArchetypeColor()`) with zero separator space (e.g. `典型<span style="color:accentText">柯基</span>`). Applied to hero badge, blend line, bridge card, skill chip, and poster input.

**Full-screen state centering (2026-05-29 / error-state coverage 2026-06-05):**
- Loading, empty, and error states must be vertically centered in the viewport. The most common bug is `display: flex; align-items: center` without `min-height` — the content hugs the top.
- **Stand-alone full-screen loaders** (e.g., `OnboardingLoadingShell`, `JoyJoinLoadingScreen`): use `min-height: 100vh` fallback before `min-height: 100dvh`, then flex centering, or `position: fixed; inset: 0` for overlays. WeChat WKWebView / older Taro runtimes do not always support `dvh`; the `vh` fallback prevents the surface from collapsing to zero height. The `design-audit.mjs` scanner was updated 2026-06-17 so `min-height: 100vh` fallbacks are no longer flagged.
- **States inside `ScrollView`**: the `ScrollView` child does not automatically inherit viewport height. Use `@include scroll-view-centered-state` (`_mixins.scss`) which applies `min-height: 60dvh` + flex centering. This mixin was created specifically for `connections`, `events`, and `center-hub` loading/empty states.
- **Error states on tab pages (2026-06-05):** Discover, Events, and Connections now render full-page error surfaces with retry CTAs when their primary query fails. Discover uses `StatusCard` with `tone='error'` and a Lovart error illustration; Events and Connections use `XiaoyueEmptyState` with `emotion='sad'` plus a retry action.
- **Branded loading on Connections (2026-06-05):** `pages/connections/index` uses `XiaoyueEmptyState` with `emotion='waiting'` for the initial loading surface instead of a raw spinner, keeping the experience on-brand while data hydrates.
- **Always pair `min-height` with flex centering.** `flex: 1` inside a flex parent with `min-height: 100dvh` also works (see `center-tab-empty`).
- **Guardrails** now flags `&__loading` / `&__empty` / `&__error` blocks in page SCSS that use flex without `min-height`, `flex: 1`, `@include scroll-view-centered-state`, or `position: fixed`.

**Mini-program profile components (2026-05-24 / layout hardened 2026-06-04 / redesign shipped 2026-06-16 / profile-linked migration 2026-06-17 / active hardening 2026-06-24):**
- **`ProfileArchetypeHero`** (`apps/mini-program/src/components/profile/ProfileArchetypeHero.tsx`) — celebratory archetype card with gradient background. Props: `archetype?`, `displayName`, `size` (`sm`/`md`/`lg`), `showLabel?`. Uses `ARCHETYPE_FAMILY_GRADIENTS` from `@shared/archetypeColors`. Used in profile tab, edit-profile preview, and onboarding profile-review for visual continuity.
- **`InterestChipCloud`** (`apps/mini-program/src/components/profile/InterestChipCloud.tsx`) — read-only interest chip display with optional L1/L2/L3 level visualization. Props: `labels`, `levels?`, `accent?`, `compact?`, `emptyText?`, `onEmptyClick?`. Used in profile tab, onboarding profile-review, and anywhere interests are displayed read-only.
- **`ProfessionDisplayField`** (`apps/mini-program/src/components/profile/ProfessionDisplayField.tsx`) — displays profession raw text + AI-classified category/segment/niche chips with edit trigger. Used in edit-profile and anywhere profession is displayed read-only.
- **Profile page redesign (2026-06-16):** `pages/profile/index.tsx` renders the social-passport redesign when `features.profileRedesignEnabled` is true (default `true`). It consumes `GET /api/shell/profile` via `getProfileShell()` (`packages/shared/src/api.ts`) with 60s stale time, offline-first React Query config, and cached-shell fallback before showing an error card. `Taro.onNetworkStatusChange` triggers a refetch when connectivity returns, and `PrefetchEngine` warms the Events and Connections shells after Profile data stabilizes. **2026-06-24 hardening note:** the shipped page is actively being stabilized; some intended polish (avatar image rendering, dynamic subtitle, connection-count stat, profile-linked navigation routes) is still being aligned in follow-up passes.
- **Profile-linked subpackage (2026-06-17):** `edit-profile`, `rewards`, `invite`, and `terms` were moved from flat `pages/*` into the `pages/profile-linked` subpackage. `pages/profile/index` preloads the subpackage via `MINI_PROGRAM_PRELOAD_RULES`. Route constants in `apps/mini-program/src/lib/onboarding/onboardingRoutes.ts` reflect the new paths (`pages/profile-linked/edit-profile/index`, etc.).
- **Profile share card (2026-06-16 / lazy-loaded 2026-06-17):** A "分享我的社交名片" menu row (gated by `features.personalityShareEnabled` and requiring an archetype) generates a dedicated 750×750 profile-card poster via `pages/profile/profilePoster.ts` and `pages/profile/useProfileShareCard.ts`. The `generateProfileSharePoster` function is dynamically imported on the first tap to keep the main profile bundle lean; `ShareCardShimmer` provides the loading surface, gated by reduced-motion and degradation-tier checks. The poster is rendered on a hidden off-screen `<Canvas>`, exports through `canvasToTempFilePath`, and degrades to DPR 1 on degradation-tier devices. Native share hooks (`useShareAppMessage`/`useShareTimeline`) pass the user's `referralCode` as `invitationCode` so shares land on the landing page with attribution.
- **Profile milestones (2026-06-16):** `firstEvent` and `streak3` milestone badges are shown under the hero when `features.profileRedesignEnabled` is true. Locked badges render the real badge asset with `filter: grayscale(100%)` rather than a generic lock icon. When multiple thresholds are crossed together, the celebration toasts the highest crossed milestone.
- **Profile analytics (2026-06-16):** `pages/profile/index.tsx` and `useProfileShareCard.ts` send whitelisted events to `POST /api/analytics/profile`: `profile_stat_tap`, `profile_archetype_cta_tap`, `profile_menu_tap`, `profile_logout_tap`, `profile_shell_retry`, `profile_share_app_message`, `profile_share_timeline`, `profile_milestone_impression`, `profile_milestone_tap`, `profile_pull_refresh`, `profile_share_card_generated`, `profile_share_card_error`, `profile_view`.
- **Profile constants/helpers (2026-06-16):** Shared profile logic is extracted into `pages/profile/profileConstants.ts` (completion math, greeting branches, milestone ordering) with regression tests in `profileConstants.test.ts`.
- **Profile page layout guard:** `profile-page__scroll` uses `overflow-y: auto` (not `overflow: hidden`) to allow content scrolling. Hero, archetype card, stats, and action rows each have dedicated SCSS blocks; removing any block without updating JSX causes layout collapse. Stats show `—` placeholder while loading (no `0` flash). Archetype card has staggered entrance animation with `prefers-reduced-motion` fallback.
- **Profile tab wow-elements polish (2026-06-17):** Menu rows use `hoverClass` press feedback with a brand-tinted background transition; primary CTA applies an active `scale(0.98)` transform; the archetype avatar / Xiaoyue greeting use a spring entrance; the share-card action shows a shimmer placeholder while the dynamically-imported poster generator loads. All motion is gated by `prefers-reduced-motion` and `useDeviceTier().isDegradation`.
- **`usePageTTI` (2026-06-17):** `apps/mini-program/src/hooks/usePageTTI.ts` measures time-to-first-interactive on mini-program pages. Budgets: cold start ≤ 2000 ms, warm/preloaded start ≤ 800 ms. Reports via `logInfo` with `wx.reportAnalytics` fallback; non-blocking and safe to add to any page. Used on the migrated `pages/profile-linked/*` screens.

**Mini-program button styling (2026-05-23):**
- **CTA buttons use solid brand purple (`$color-primary`, `#8B5CF6`) — no gradient.** Gradient was purged from all mini-program CTAs to avoid "AI-generated" aesthetic. The web client's `docs/design/button-design.md` retains gradient specs for archived user-client; mini-program (launch-primary) uses solid fill exclusively.
- **Bottom action bar pattern:** Solid white background (`$color-surface`) + subtle top shadow (`rgba($color-text-primary, 0.04)`) creates floating CTA effect. Used across all onboarding steps.

**Profession input overlay (2026-05-24, hardened 2026-06-07, performance + completeness push, polished 2026-06-08):**
- **`ProfessionChatOverlay`** (`apps/mini-program/src/components/ProfessionChatOverlay.tsx`) — full-screen conversational overlay for free-text profession input during onboarding step 2 (`essential-data`).
- **Dual-mode:** Feature-flagged via `smartProfession` (DB-backed, env `SMART_PROFESSION_ENABLED`). When enabled, calls `POST /api/inference/understand-profession` (server-side `routes/domains/professionUnderstanding.ts`) which runs parallel catalog + AI classification, generates archetype-aware AI reactions with 2-bubble stagger + reveal card with animated tags. When disabled, falls back to the legacy 220-keyword matched reaction system (`PROFESSION_REACTION_ENTRIES` hoisted at module level).
- **Echo suppression (2026-06-05):** Skips low-quality AI `reactionHint` bubbles when the hint starts with the user's input and is mostly just the input repeated (heuristic: `startsWith` + length check). Prevents robotic "投资银行！投资银行方向？" echo responses. Tracked via `profession_chat_echo_suppressed` analytics event.
- **Offline detection (2026-06-07):** Live network monitoring via `Taro.onNetworkStatusChange` + `Taro.offNetworkStatusChange`. Offline banner persists at bottom of overlay when disconnected; online banner auto-dismisses when connection restores. Offline guard blocks API call and shows toast `网络好像断了，请检查连接后再试`. Tracked via `profession_chat_offline_blocked` analytics event.
- **Device-tier gating (2026-06-05):** `useDeviceTier()` gates entrance animations. Degradation-tier devices receive `profession-overlay--low-end` class that disables all entrance animations (overlay, messages, reveal card, tags, typing dots, checkmark) and resets `will-change` to `auto`. Paired with existing `@media (prefers-reduced-motion: reduce)` for accessibility.
- **Timeout-aware fallback (2026-06-05):** API call capped to `API_TIMEOUT_MS = 14000ms`. On timeout abort, the overlay surfaces a local keyword-matched reaction (`getReactionForProfession`) instead of silently returning, preserving the emotional "treat" moment. Analytics records `timedOut: true` on the `profession_chat_classification_fallback` event. Send quota is refunded on failure so the user can retry.
- **Inline retry (2026-06-07):** Fallback messages display a tap-to-retry hint directly in the bubble: `没识别准确？点击重新分析`. Tapping re-triggers the same input through `handleRetry`. Tracked via `profession_chat_retry_tapped` analytics event. A global retry button bar also appears below the chat for non-fallback scenarios.
- **Max-send guard (2026-06-07):** 5 sends per session (`MAX_SENDS_PER_SESSION = 5`). When exceeded, a banner appears: `已达到最大重试次数，先继续吧～` with auto-dismiss after 4s. Tracked via `profession_chat_max_send_reached` analytics event.
- **Legacy parity (2026-06-10):** `handleSendLegacy` (smartProfession disabled path) enforces the same guard patterns as the AI path: short-input hint (< 3 chars), debounce (2s), max-send cap (5), offline detection, and send counter tracking (`sendCountRef`, `lastSendTimeRef`). Dependency array updated to include `isOnline`, `hasSent`, `analytics`.
- **Progressive thinking labels (2026-06-05):** Two timed copy stages during inference: `悦仔正在理解你的职业背景…` at 800ms and `还在思考中，马上就好~` at 2800ms. Labels are gated by `thinkingTimersRef` and cleared on unmount, new send, success, and catch paths to prevent stale text flashing after a fallback reaction renders.
- **Race-safe timer cleanup (2026-06-05):** All thinking-label timers are stored in `thinkingTimersRef.current: ReturnType<typeof setTimeout>[]` and bulk-cleared via `clearThinkingTimers()` across unmount, new message send, API success, and error catch. Prevents the "thinking label lingering after fallback" bug.
- **Performance (2026-06-07, hardened 2026-06-08):** Message list is memoized with `useMemo` and wrapped in `<CustomWrapper>` for Taro-native subtree isolation. Message rows use `width: 100%` + `justify-content: flex-end` (user) / `flex-start` (mascot) instead of `align-self: flex-end/flex-start` — this prevents the mascot bubble from constraining the user bubble's `max-width: 70%`. `word-break: normal` with `overflow-wrap: break-word` (was `break-all`) for cleaner mixed CJK/Latin text wrapping. Keyboard scroll-to-bottom uses a stable `scrollTrigger` counter + `ScrollView.scrollIntoView` on a static `id='bottom-anchor'` 1px anchor, avoiding the previous `bottomAnchorKey` re-mount-on-keyboard bug that scrolled to top. Expression assets (`coachGuide`, `loadingSystem`, `homeWelcome`, `testCurious`, `testListening`, `matchSuccess`) are preloaded via hidden `<Image>` nodes only when the overlay is visible (`visible && !isClosing`) to free GPU memory on close. Request deduplication: a `sendGenerationRef` counter is incremented on each new send; responses from stale generations are silently dropped before UI mutation (the previous `AbortController` pattern was a no-op — `apiRequest` does not accept `AbortSignal`).
- **Operational analytics (2026-06-07):** Nine onboarding analytics events track profession chat health: `profession_chat_classification_success` (tag count, confidence, source), `profession_chat_classification_fallback` (error type, input length, `timedOut` flag), `profession_chat_echo_suppressed`, `profession_chat_offline_blocked`, `profession_chat_skipped`, `profession_chat_retry_tapped`, `profession_chat_max_send_reached`, `profession_chat_keyboard_opened` (height), `profession_chat_reveal_card_viewed`. Request deduplication via `sendGenerationRef` counter prevents race conditions on rapid re-sends.
- **Background retry:** `useProfessionRetry` hook in `app.ts` silently classifies users with `industryRawInput` but no `industryNiche` on next app open.
- **Keyboard-safe:** Uses `onKeyboardHeightChange` + manual padding; `adjustPosition={false}` and `cursorSpacing={32}` on input to prevent native scroll fighting. `requestAnimationFrame` used for retry timing instead of `setTimeout(..., 0)`.
- **Stable scroll anchor (2026-06-10):** Inline `paddingBottom` with `max(24rpx, ${keyboardHeight}px)` removed from input bar and CTA — WXSS `max()` with mixed rpx/px is unreliable in WeChat. CTA bottom padding handled by SCSS only. Scroll anchor uses a static `id='bottom-anchor'` element with a `scrollTrigger` counter (incremented only on new messages, not on keyboard events), preventing scroll-to-top on keyboard open/close.
- **Optional field:** `occupationId` schema relaxed to `.optional()`; free text stored in both `occupationId` and `industryRawInput`; classification populates `industryCategoryLabel`, `industrySegmentLabel`, `industryNicheLabel`, and new `standardizedOccupationId`.
- **Accessibility (2026-06-07):** Overlay root has `role="dialog"` and `aria-modal="true"`. Reveal card has `role="region"` and `aria-label="职业分析结果"`. Includes `@media (prefers-reduced-motion: reduce)` override for all animations, 88rpx touch targets, `env(safe-area-inset-bottom)` support, `aria-live="polite"` on chat ScrollView, and per-message `expressionId` for retrospective mascot expression. Skip action uses `homeWelcome` expression (not `coachGuide`) for warmth.
- **Archetype-aware opening (2026-06-08):** When `userArchetype` is known, `OPENING_MESSAGE_ARCHETYPE(archetypeName)` replaces the generic opening with a personalized line (`像你这样的[archetype]，平时是做什么的呀？`) for stronger identity resonance. Expression anticipation: keyword matching maps profession text to Xiaoyue expression (`testCurious` for creative, `testListening` for technical, `coachGuide` for social, `matchSuccess` for leadership) before the API responds, eliminating blank-face delay.
- **Server archetype bridge (2026-06-08):** `POST /api/inference/understand-profession` returns `archetypeContext` in the response body. `buildFallbackReaction(rawText, classification, archetypeTraits?)` incorporates trait descriptors when available (`你身上[trait]的特质，在[label]圈子里其实很吃香`) for warmer fallback copy.
- **Confidence-based follow-up (2026-06-10):** `buildReactionHint` is now conditional: returns empty string when confidence >= 0.85 or source is non-AI. When confidence < 0.85 AND source is AI, server calls `generateClarifyingQuestion` (1500ms timeout, XIAOYUE_CRAFT_PRINCIPLES injected) to produce one warm clarifying question. Frontend guards with `(data.reactionHint ?? '').trim()` and wraps the hint bubble in `if (hintText)` — empty hintText skips the hint bubble entirely. Tracked via `hadFollowUp` on the response.
- **GPU safety (2026-06-08):** `will-change` permanently removed from `&__message`, `&__sparkle`, and `&__reveal-tag-wrap` (not just low-end reset) to free GPU layers. Entrance animations still run via keyframe CSS; GPU promotion is automatic during animation and released afterward.
- **Preloader pattern (2026-06-08):** Off-screen 2rpx preloader (`position: absolute; left: -9999rpx; width: 2rpx; height: 2rpx`) replaces zero-dimension pattern. WeChat native `Image` may skip sources with zero computed dimensions, causing first-render flicker.
- **Reveal card containment (2026-06-08):** `position: relative` on `&__reveal-card` prevents the `position: absolute` celebration layer (`inset: 0`) from spanning the entire viewport instead of the card.
- **Reveal card in ScrollView (2026-06-10):** Reveal card moved inside the `<ScrollView>` (just before the bottom anchor) to enable auto-scroll when `scrollIntoView` fires, ensuring the reveal card is visible even with keyboard open.
- **Touch target compliance (2026-06-08):** Retry hint `min-height: $cta-min-tap` (88rpx) with `inline-flex` + `align-items: center` + larger padding (`$spacing-sm $spacing-md`).
- **孤字 guard (2026-06-08):** CJK text blocks use `word-break: keep-all; overflow-wrap: break-word;` to prevent single-character dangling lines (e.g., reveal title, bridge lines). **Exception:** speech bubbles with `numberOfLines` constraint use `word-break: break-word; overflow-wrap: break-word;` to allow wrapping within the bubble boundary.
- **Polish + bug fixes (2026-06-08):** Flex layout fix: message rows use `width: 100%` + `justify-content: flex-end` (user) / `flex-start` (mascot) instead of the shrink-to-fit `align-self` pattern that caused mascot bubbles to constrain user bubble width. ~~AbortController~~ replaced with `sendGenerationRef` counter (AbortController was a no-op — `apiRequest` doesn't accept `AbortSignal`). Removed broken `HTMLElement` cast from `onAnimationEnd` (Taro events are not DOM events). `handleSendNew` accepts optional `overrideText` param so `handleRetry` can pass `lastUserTextRef.current` directly, avoiding the stale-closure-on-rAF bug. Reveal card now includes a 40rpx Xiaoyue mascot avatar (`matchSuccess` for success, `coachGuide` for fallback) alongside the title for emotional warmth. `word-break: break-all` → `keep-all` for cleaner mixed CJK/Latin text wrapping. Brand name casing fixed (`joyjoin` → `JoyJoin`) in bridge social-proof line. Preload `<Image>` nodes are now conditional (`visible && !isClosing && !deviceTier.isDegradation`) to free GPU memory on close. Added `prefers-reduced-motion` override for reveal-card checkmark animation.
- **Personality test intro mascot fix (2026-06-08):** The intro phase (`phase === 'intro'`) now renders the mascot via `<Image src={getIntroStaticAsset()}>` (animated WebP from CDN) instead of `XiaoyueSpriteAnimator state='intro'`. This restores the smooth fluid animation that was regressed by the sprite-sheet reintroduction. The `Image` has `onError` fallback to `getIntroStaticFallbackAsset()` (static WebP) and respects `reduceMotion` via `Taro.getSystemInfoSync().reduceMotion`. A pulsing placeholder (`personality-test__intro-mascot-placeholder`) renders while the image loads, fading in via `opacity` transition.

**Essential data onboarding patterns (2026-06-05):**
- **Picker `aria-label` pattern:** All picker trigger buttons have dynamic `aria-label` that reflects current selection state (e.g., `出生年份：1990 年` vs `请选择出生年份`). Copy this pattern for all future picker implementations.
- **Intent grid memoization:** The 6-option intent grid is wrapped in `useMemo` with stable dependencies (`intentOptions`, `intent`, `toggleIntent`) to prevent re-render on unrelated state changes (mascot reactions, step transitions).
- **Picker center alignment:** Picker trigger Views use `justify-content: center` with absolutely-positioned checkmark (`position: absolute; right: 24rpx; top: 50%; transform: translateY(-50%)`) to maintain visual centering regardless of checkmark presence.
- **Schema resilience:** `updateFullProfileSchema` in `packages/shared/src/schema/_definitions.ts` accepts `industryConfidence` as `z.union([z.string(), z.number()]).optional()` to handle both string and numeric confidence values from the profession classification API.

**Mini-program page-stack lifecycle (swipe-back safety):** WeChat keeps pages in the navigation stack alive (hidden, not unmounted). If a page sets `isExiting`/`isPageExiting`/`isSubmitting` before navigating away, those flags survive. When the user swipes back, the page is re-shown but the CTA remains stuck. **Always reset transient exit/submit flags in `useDidShow`** — use `useResetOnShow(setIsPageExiting, setIsSubmitting)` from `apps/mini-program/src/hooks/useResetOnShow.ts`. The navigation hook `useJoyJoinNavigation` already carries an internal reset.

**Mini-program ScrollView trap:** `Taro.pageScrollTo` only works on page-level scroll, **not inside `<ScrollView>`**. For scroll-to-error inside a `ScrollView`, use the `scrollIntoView` prop on `ScrollView` with the target element's `id` (no `#` prefix): `<ScrollView scrollIntoView={scrollToErrorId}>…<View id='field-displayName'>…</View>…</ScrollView>`. Clear the id after ~500ms to prevent re-scrolling on re-render.

**ScrollView inside flex parent / drawer scroll containment (2026-06-04 / hardened 2026-06-05 / updated 2026-06-17):** A `<ScrollView>` in a flex container will not scroll unless the parent has `min-height: 0` or explicit height. The `LocationFilterDrawer` uses `min-height: 0` on the flex parent, WeChat's `enableFlex` prop on `<ScrollView>`, and an explicit `height: 100%` inline style. The unreliable `70dvh` max-height was replaced with `calc(1020rpx - $tab-bar-root-height)`; the surface sits `bottom: $tab-bar-root-height` to avoid being hidden behind the custom tab bar. To prevent the background Discover page from scrolling when the drawer is open, `catchMove` is placed on **both** the backdrop and the drawer surface. The internal `<ScrollView>` consumes touch events for its own scrolling; events that reach the surface's `catchMove` (e.g., at the scroll edges) are stopped before they can bubble to the page.
- **Drawer z-index rule:** The drawer's sheet must render above all page chrome. `LocationFilterDrawer` uses `z-index: $z-modal` (`200`) with the sheet inside a portal-like absolute container to ensure it sits above fixed headers and custom tab bars.
- **Heat-badge tokens:** District "heat" indicators render as compact top-right badges using SCSS token classes (`.location-drawer__heat-badge--hot`, `--active`, `--pending`) instead of inline hex strings so colour changes propagate from the design system.
- **ARIA on district tiles:** Each district tile is a `role="button"` with `aria-pressed={isActive}` and a descriptive `aria-label` that includes the district name and heat label (e.g., `福田区，热门地区`).

**Modals at page root level — PageMorphWrapper stacking-context bug (2026-06-10):** WeChat WKWebView treats `position: fixed` elements inside a `position: absolute` container (like `PageMorphWrapper`'s layers) as `position: absolute` relative to the layer rather than the viewport. This causes modals (drawers, sheets) to become invisible when the page is scrolled. Fix: render all `position: fixed` overlays (`LocationFilterDrawer`, `CityPickerSheet`) at the `DiscoverPage` root level, **outside** `PageMorphWrapper`. Lift the relevant state (`drawerOpen`, `showCityPicker`, `selectedCluster`, `selectedDistrict`) to the page component to pass as props. This pattern applies to any page using `PageMorphWrapper` that needs fixed-position overlays.

**Personality test re-entry safety (2026-06-04):**
- **Archetype hard guard:** `pages/onboarding/personality-test/index.tsx` checks `auth.user?.primaryArchetype` on mount. If the user already has an archetype, it immediately redirects to `/pages/discover/index` via `Taro.redirectTo`. This prevents users with completed tests from accidentally re-entering the assessment.
- **Stale-session cleanup (server):** `POST /api/assessment/v4/start` detects incomplete sessions where `selectNextQuestion` returns `null` (all questions answered but `completedAt IS NULL`). It marks the stale session `completed`, calls `markPersonalityTestComplete(userId)`, then starts a fresh session. Wrapped in defensive try-catch to prevent startup 500s.
- **Client `completing` phase error UI:** If the final submission API fails while in `completing` phase, the page renders a Xiaoyue `actionFailure` visual with warm copy ("同步遇到小状况 / 悦仔马上帮你重试~"), `role="alert"` + `aria-live="polite"`, and a retry CTA with `haptics('light')`. This replaces the previous silent loading-shell hang.
- **Completing-phase error recovery (2026-06-13):** On final submission failure the page returns the user to the testing phase (with their last answer pre-filled) instead of dumping them back to the intro, so retrying resumes where the failure occurred. Raw API errors are mapped through `getErrorMessage` baselines before display.
- **Test-page architecture + zero-scroll lock (2026-06-23):** The main orchestrator (`pages/onboarding/personality-test/index.tsx`) stays below the 1200-line frontend threshold by delegating intro, question, preload, and completing-error rendering to focused sub-components (`PersonalityTestIntro`, `PersonalityTestQuestion`, `PersonalityTestPreloadLayer`, `PersonalityTestCompletingError`) with shared types in `types.ts`. The intro and testing phases use locked `100dvh` shells with explicit inner `ScrollView` ports; the answer zone is a Taro `ScrollView` (not CSS `overflow-y`).

**Discover CTA guard pattern (2026-06-04 / hardened 2026-06-05):**
- The `HeroPromoBanner` CTA on discover always receives `onCtaTap={handleBannerCtaTap}`; the component internally decides whether to fire the handler or show a disabled-state toast `暂无开放活动` when no pools are open. This prevents the CTA from silently no-op'ing if props are ever passed incorrectly and guarantees a response on every tap.
- **Promo copy trust rule (2026-06-05):** Static promo variants must not fabricate social-proof metrics (e.g., fake user counts, popularity percentages, "已有 10,000+ 人加入"). Use real, query-backed numbers or omit the metric entirely. This is a trust-sensitive copy constraint.
- Discover empty state (2026-06-05) uses `StatusCard` with `tone='empty'` and the Lovart `lovart-generic-empty.webp` hero illustration (not `XiaoyueEmptyState`). It shows a warm title, explanatory subtitle, and a primary action button (`去发现活动` or `清除筛选` when filters are active).

**Mini-program haptics and interaction patterns (2026-06-02):**
- **Haptics are mandatory on all interactive surfaces** across non-onboarding pages: `discover` (pool card tap, location pill, refresh), `matching-status` (all 10+ buttons, celebration on match), `profile` (action rows, logout), `events` (tab switch), `center-hub` (CTAs).
- **Intensity mapping:** `light` for secondary actions (refresh, back, tab switch, card tap), `medium` for primary CTAs ("查看活动详情", logout), `success` for emotional peaks (match revealed).
- **hoverClass on View-based interactive elements:** Action rows (`profile-page__action-row--active`), tabs (`events-page__tab--pressed`), and any custom `View` with `onClick` must have visible `hoverClass` feedback. Use `transition: background 0.12s ease` + `rgba($color-primary, 0.06–0.08)` tint.
- **Spring entrance animations for special states:** Error, cancelled, no-match, and not-found states on `matching-status` use `matching-status__special-state--enter` (`0.5s cubic-bezier(0.22, 1, 0.36, 1)`). Cards spring in with `translateY(16rpx) scale(0.98) → translateY(0) scale(1)`.
- **Xiaoyue in sad/loading states:** No-match uses `optOutReassure` mascot (bounce-in). Center-hub loading uses `homeWelcome`. Center-hub error uses `actionFailure`. Always pair mascot with warm copy — never dead text alone.
- **Reduced-motion suppression:** All new animations (spring entrances, mascot bounce-in, hover transitions) must be suppressed under `@media (prefers-reduced-motion: reduce)`.

**Persistent Query Cache (Tier 2 offline) — 2026-06-02:**
- **Location:** `apps/mini-program/src/lib/api/persistentCache.ts` owns all persistence logic. **Never** inline `Taro.setStorageSync` calls in page components.
- **Whitelisted keys only:** Only `['mini-program', 'event-pools']` (`POOLS_QUERY_KEY`) and `['mini-program', 'joined-events']` (`JOINED_EVENTS_QUERY_KEY`) are persisted. Matching status, auth user, shell composites, and notification counts are explicitly excluded.
- **Schema version:** `CACHE_SCHEMA_VERSION = 1` inside the persisted wrapper. Hydration discards mismatched versions with `logInfo('[CacheHydrate] version mismatch, skipping')`. Bump when response shape changes.
- **TTL:** 4 hours (`MAX_CACHE_AGE_MS`). Entries older than 4h are silently discarded at hydration.
- **Size cap:** 75KB total (UTF-8 byte count, not JS string length). Exceeding the cap skips the write with a `logWarn`.
- **False-freshness guard:** Hydration passes `{ updatedAt: entry.timestamp }` to `queryClient.setQueryData` so TanStack Query knows the true data age and triggers immediate background refetch if stale.
- **Mutation-triggered eviction:** After any mutation that changes persisted data (pool registration, payment verification, pull-to-refresh), call `evictPersistedQuery(key)` to remove the affected key from storage. This prevents the "did my payment fail?" stale-data bug.
- **Eviction race safety:** `evictPersistedQuery` adds the key to `evictedKeysPendingFlush` and cancels the pending debounce timer. The next `flushCacheToStorage` skips evicted keys.
- **Multi-user safety:** `clearPersistentCache()` is called inside `clearMiniProgramAuthSession({ mode: 'hard' })` (logout). Prevents User B from seeing User A's cached pools/events.
- **Subscribe only successes:** The cache subscriber filters `event.query.state.status !== 'success'` — loading and error states are never persisted.
- **Background-fetch indicator pattern:** When `isFetching && !isLoading`, render a subtle opacity-pulse line (`discover-auth__refresh-indicator`, `events-page__refresh-indicator`) to signal background refresh. Respects `prefers-reduced-motion`.
- **Performance:** Pre-serialized whitelist (`Set<string>`) gives O(1) lookup. Serialization is reused between size-check and `setStorageSync` write. 2s debounce prevents storage churn.

**Auth loading gate and page timeout (2026-06-05):**
- `apps/mini-program/src/hooks/auth/authState.ts` derives `isAuthPending` as `input.isLoading || (input.isFetching && input.user === undefined)`. This means background refetches with an already-cached user object no longer gate the entire UI, fixing the "stuck loading after app resume" bug.
- `apps/mini-program/src/hooks/navigation/useMiniPageGate.ts` enforces a 4-second force-release ceiling (`MINI_PAGE_GATE_TIMEOUT_MS = 4000`). If auth is still loading after 4s, the gate releases automatically so the page can render its own retry/error surface instead of hanging indefinitely on the loading shell.

**Prefetch engine feature-flag hygiene (2026-06-05):**
- `apps/mini-program/src/lib/prefetchEngine.ts` intentionally omits `paymentsEnabled` from the synthetic auth object it injects into the query cache. The real `GET /api/auth/user` fetch owns `paymentsEnabled`; injecting a hardcoded `false` caused stale "权益维护中" toasts when the server had payments enabled. Pruned Discover/Events/Connections shell auth fragments now only set onboarding completion flags and leave kill-switch values for the live auth fetch.

**Edit-profile design patterns (2026-05-24):**
- **2-step grouping:** Step 1 "基础档案" = static facts (name, gender, birth, city, hometown, education). Step 2 "社交画像" = expressive choices (profession via AI overlay, intent grid, interests). Maintains cognitive continuity with onboarding.
- **Validation + scroll-to-error:** Inline field validation with `fieldErrors` state. First error field id passed to `ScrollView scrollIntoView`.
- **Unsaved changes guard:** `Taro.enableAlertBeforeUnload({ message: '…' })` when `hasChanges` is true; `Taro.disableAlertBeforeUnload()` on cleanup.
- **Skeleton loading:** `isInitializing` gates a skeleton block with shimmer animation; disabled under `prefers-reduced-motion`.
- **Floating CTA bar:** Fixed bottom white bar with subtle top shadow (`rgba($color-text-primary, 0.04)`).

**Database schema drift guard (2026-06-03):**
- Server startup calls `validateDbSchema()` in `apps/server/src/db.ts` before accepting traffic.
- This fail-fast check runs `LIMIT 0` SELECTs on critical tables (`users`, `assessment_sessions`, `assessment_answers`, `event_pools`, `social_icebreaker_sessions`) to catch missing columns immediately.
- If a column defined in Drizzle schema is missing from the DB, the server crashes on startup with a clear message instead of serving 500s to users.
- Always run `npm run db:push` (local) or apply migrations (production) before deploying code that adds new columns.

---

## 7. Guardrails (CI-Enforced)

`npm run guardrails` checks:
- No committed `.env` files with real secrets
- No legacy onboarding identifiers (`hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, `interestsTop`)
- No imports from legacy `shared/` root directory
- No cross-app imports
- Admin routes must enforce admin middleware
- Page-level loading/empty/error state blocks must include centering safety (`min-height`, `flex: 1`, or `@include scroll-view-centered-state`)

**Never commit:** `.env`, secrets, or generated build artifacts.

---

## 8. Observability

- Use `logger.info/warn/error()` from `apps/server/src/lib/logger.ts`. Avoid `console.*` in request handlers.
- Health: `GET /api/health`; Readiness: `GET /api/readyz`; Metrics: `GET /api/metrics`
- Admin audit log: `apps/server/src/lib/adminAuditLogger.ts`

---

## 9. Automations (CI Background Agents)

> **⚠️ DISABLED — All auto-* workflows (auto-fix, auto-debug, auto-docs, auto-test, auto-merge, auto-ci-fix) are turned off as of 2026-06-22. They produced zero merges and caused working-tree corruption. Do not re-enable without explicit discussion.**

Full reference: `docs/automations/README.md` (archive only)

---

## 10. Documentation Map

> **Start here:** §0 above lists which skill to load for each common task. This map covers the full doc inventory.

- `README.md` — quick start, env setup
- `DEVELOPER_QUICK_REFERENCE.md` — canonical engineering guardrails, active vs legacy
- `PRODUCT_REQUIREMENTS.md` — product canon, terminology
- `docs/README.md` — architecture docs index
- `docs/automations/README.md` — CI automation system (auto-debug, auto-docs, auto-digest, auto-test, auto-ci-fix, WeCom)
- `apps/server/src/README.md` — server domain ownership
- `packages/shared/src/README.md` — shared package boundaries
- `.agents/skills/` — **OpenCode auto-discovered** skill tree (mirrors `.github/skills/`; kept in sync manually)
- `.github/skills/README.md` — canonical skill index for specific tasks
- `.github/skills/skill-taxonomy.md` — canonical skill classification (`ai-runtime` vs `internal`)
- `.opencode/agents/README.md` — OpenCode agent stubs (derived from `.github/agents/`)
- `.github/agents/README.md` — canonical full agent portfolio (30+ agents)

---

## 11. Surgical Edits Rule — Never Rewrite Entire Files

> **Prefer targeted `edit` tool operations over rewriting entire files.**

When an agent needs to change a subset of logic inside a file, it MUST:
1. Use the `edit` tool with precise `oldString` → `newString` replacement, scoped to the minimum lines necessary.
2. **Only** use `write` (full-file overwrite) when:
   - Creating a brand-new file.
   - The file's entire content is being replaced with a fundamentally different implementation (requires explicit justification).
   - Patching-in from a canonical source that must match byte-for-byte (e.g., config template).

**Rationale:** Full-file rewrites overwrite unrelated working-tree changes (uncommitted fixes, WIP experimentation) and break `git blame` continuity. This rule applies regardless of whether the uncommitted changes are from the agent's own session or from the user's editor.

**Enforcement:** If the user says "you rewrote my file" or a fix regresses because an unrelated part of the file was silently changed, the agent should be corrected to use `edit` and restore the original content for unaffected blocks.

### 11.1 Verify Every Edit Landed on Disk — No Exceptions

> **The `edit` tool can silently fail.** It may return "success" without actually writing to the file system (observed 2026-06-22: 3 sequential "successful" edits left no trace in `git diff`).

After every `edit` call, **immediately verify** the change landed:
```bash
git diff -- <file>          # for existing tracked files
```
Or for new files:
```bash
grep -n "<key line>" <file>  # confirm the new content exists
```

**Do not** skip this step, even for trivial one-liners. A false "success" wastes hours on phantom bugs that don't exist in source but appear in the stale build output. **This rule applies to all sessions, all agents, all edit calls — permanent.**
