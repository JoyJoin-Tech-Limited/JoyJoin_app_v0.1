# JoyJoin — Agent Onboarding Guide

> Compact instructions for AI coding agents. Last updated: 2026-06-02

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
- `/api/guide/mark-seen`, `/api/guide/complete` routes removed (2026-05-07)
- **PNG spritesheets in `src/assets/mascot/` are orphaned** — `XiaoyueSpriteAnimator` loads `.webp` via `cdnAsset()`. Only `.webp` + manifest should be in `src/assets/mascot/`. Source PNGs go in `assets-source/mascot/xiaoyue-strips/` (2026-05-19)

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
# Serves from /static/ on CVM (Express static route in vite.ts). Do NOT change
# CDN_RSYNC_PATH away from /static — Express only looks at /static/ and
# ../server/static/, not /var/www/cdn/static.
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

**Feature Flags (DB-backed, 2026-05-24):** `apps/server/src/lib/featureFlags.ts` is the canonical resolver. DB row is source of truth; env var is fallback. 5s LRU cache (disabled in test env). Five kill switches exposed in auth response `features`: `restartOnboarding`, `smartProfession`, `onboardingForceSkip`, `matchingLiveReveal`, `socialIcebreakerClientForceEnd`. Auth resolution is parallel (`Promise.all`). Admin portal `/admin/feature-flags` (super_admin only) provides toggle UI with source badges, per-flag saving state, empty state, confirmation dialog for dangerous flags (`onboardingForceSkip`, `socialIcebreakerClientForceEnd`), and `updatedAt`/`updatedBy` audit display. Admin mutation is logged to `admin_audit_logs` with action `FEATURE_FLAG_UPDATED`. PUT endpoint validates key against `FLAG_ENV_MAP` whitelist and `value` against `z.enum(["true", "false"])`.

**Social Icebreaker:** Primary in-event flow is `/icebreaker/:sessionId` → Social Icebreaker. `/icebreaker-game` (AI Card Game) is optional deep-dive, not default.
- **Moment Card server render:** `GET /api/social-icebreaker/:id/moment-card.png` (feature-flagged: `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER`)
- **Bonus gate:** when `mini_script` is next eligible, advance pauses at `bonusGateOffered` for host+player vote (`POST .../bonus/respond`, `POST .../bonus/sentiment`)
- **Phase metrics:** `social_icebreaker_phase_metrics` table tracks `dwellTimeMs` per phase on every advance

**Icebreaker tiers & vibe:** Host selects time budget + vibe. Budgets: `breeze` (破冰局, 40min) / `glow` (畅聊局, 60min) / `blaze` (狂欢局, 90min). Vibe: `深聊` (deep_chat, connection-first) / `均衡` (balanced, standard mix) / `暢玩` (play_fun, energy-first). Template compiler (`resolveTemplateSlots` in `packages/shared/src/runPlanCompiler.ts`) resolves phase selection + durations per vibe×tier combo. Feature-flagged: `RUN_PLAN_TEMPLATES_ENABLED`. See `docs/icebreaker/icebreaker-system.md`.

**Game Design Agent:** Compiles dynamic run plan per session using 70% rule engine + 30% LLM. Reads archetype mix + behavioral signals (mood, commonGround, completion rate, pulse). Rule engine runs on every compilation (deterministic); LLM enhances selection + ordering with 3s timeout fallback. See `docs/icebreaker/icebreaker-system.md` §5.

**Phase pool (8 non-core + 1 bonus):** lie_detective, personality_dice, group_mirror, undercover_word, quip_battle, auction, speed_friending. Mini_script is bonus-only (悦仔 offers after last phase before recap, all tiers eligible). **Bonus gate:** host+player vote gate precedes `mini_script` entry when `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true`. **Personality Dice Choose-Your-Prompt:** When `PERSONALITY_DICE_CHOOSE_MODE_ENABLED=true`, each player receives 3 difficulty-tiered dares (easy/medium/hard) and picks one via `POST .../personality-dice/choose`. Fallback: `PERSONALITY_DICE_DARES` bank (36 dares, 3 per archetype).

**Lie Detective V2:** `LIE_DETECTIVE_MODE=v2` enables user-tag-based gameplay (user writes 2 tags, AI expands + inserts 1 fake). V1 remains default. Host-choosable toggle, all tiers. Design: `docs/proposals/spot-the-bot-game-design.md`.

**Boost plan:** All 10 phases must reach composite ≥8.0 (agent may select any phase — none deferred). 11-week roadmap in `.git/.orchestration/plans/boost-all-games-to-8.md`. Shared infra: Reveal Engine, Gesture Kit, Context Injector, Optimistic Sync.

**Match Compass:** Tri-state preference dashboard (`优先契合`/`平衡体验`/`探索惊喜`) on matching-status pending page. Users tune dealbreakers + nice-to-haves post-registration until `preference_lock_at` (24h before event). Strictness scalar 0-100 affects group formation only; pair scores remain sacred. Kill switch: `MATCH_COMPASS_STRICTNESS_ENABLED`.

**Predictive Shell:** Composite `GET /api/shell/*` endpoints (discover, profile, events, connections) bundle tab data to eliminate cold-start round-trips. Landing page prefetches shells via `PrefetchEngine` and injects into TanStack Query keys. Cache invalidation is server-driven (`shellCache.invalidateUser()`) on mutations. Legacy endpoints remain for fallback.

**Mini-program is launch-primary:** `apps/mini-program` is the primary and only shipping user-facing client. The web sandbox (`archived/workspaces/user-client/`) exists for historical reference. Cross-surface rules: `docs/reference/PLATFORM_COORDINATION.md`.

**City Unlock v0.1 (2026-05-19):** Server-owned city expansion tracking via `user_city_interests` + `city_unlock_progress`. Threshold: 50 interested users triggers `collecting` → `researching` status transition + WeCom ops notification. Atomic count updates via Drizzle `sql` expressions (race-safe). Frontend shows gentle banner/feed-card/picker on discover when user has no city interest; progress page at `pages/city-unlock/index`. Admin report: `GET /api/admin/cities/unlock-report`.

**Archetype asset loading (2026-05-22):**
- **Slot machine spritesheet** (`archetype-spritesheet.webp`): loaded from **local bundled path** (`/pages/onboarding/assets/archetypes/`), not CDN. The onboarding subpackage is preloaded at landing page, so the file is on-device before animation starts.
- **Full-size archetype images**: served from CDN as WebP. Preloaded during idle time (intro screen) via `Taro.getImageInfo` + hidden `<Image>` nodes.
- **Canvas poster generation**: draws **WebP primary** with **CDN PNG fallback**. Local PNGs removed from subpackage (saved ~672 KB). If canvas rejects WebP, CDN PNG is fetched on-demand.
- **Decode readiness**: `useSpriteReadiness` hook gates slot animation start until the spritesheet is confirmed decoded (500ms timeout). `backgroundColor` fallback (archetype accent soft) prevents blank circles.
- **Do not** reintroduce local PNG bundling for archetypes. Canvas PNG fallback must use CDN path (`ASSET_BASE_PNG = cdnAsset('/assets/personality/archetypes')`).

**Asset loading strategy (2026-06-02):**
- Two-tier brand font: minimal Alimama subset (66KB) bundled for instant display; full font (621KB) loads from CDN with 500ms defer. Quicksand English font (256KB) bundled and loaded on app launch.
- Route-based CDN preloading: `routePreloadAssets.ts` maps page paths → CDN assets to preload on entry; predictive preloading for likely next screens.
- Bundled assets: tab-icons, joyjoin-logo, joyjoin-logo-tab, tab-bar-notch-bg, custom-tab-bar, archetype spritesheet (subpackage), all icon tiers with retina (@1x/@2x/@3x via `JoyJoinIcon`): mood, chemistry, status, category, intent, reaction, reveal, achievement, archetype heads; landing phase icons (6), empty states, QR code, auction coin icons, Xiaoyue loading + welcome expressions, Quicksand + Alimama minimal fonts. CDN-only: archetype full-body images, matching heroes, promo banners, Lovart illustrations, icebreaker backgrounds, celebration images, extra Xiaoyue expressions, mini-script heroes, UI info-label icons.
- **Promo banner (2026-06-03):** Redesigned from 3-slide auto-rotating carousel to single hero banner with CTA. Uses Lovart-generated low-poly illustration (`banner-hero-lovart-v1.webp`) as full-bleed visual with clean `$color-surface` fallback — no CSS gradient competition. Three copy variants (A/B/C) rotate deterministically by user state (no archetype → C; has archetype → A/B hash). Analytics events: `promo_banner_impression` + `promo_banner_cta_tap` tracked via `discoverAnalytics`. Component: `apps/mini-program/src/components/AiMatchPromoCarousel.tsx`.
- `npm run check:package-size` measures actual zip-compressed size (not raw directory size) against the 2MB WeChat limit.
- Icebreaker challenge-card backgrounds use `<ChallengeCardBgImage>` (WeChat-safe `<Image>` component) instead of CSS `background-image` with CDN URLs, which is historically flaky in WeChat runtime.

**Tab bar icon gotcha:** `centerHub` tab in `tabBarConfig.ts` must have a non-empty `iconPath`. The `miniprogram-ci` upload rejects empty icon paths with `800059`. The custom tab bar component renders the center button independently (`joyjoin-logo-tab.png` + `tab-bar-notch-bg.png`), so any placeholder icon works for validation. The tab bar logo uses a dedicated 128×128 `joyjoin-logo-tab.png` (19KB) instead of the full-resolution `joyjoin-logo.png` (596KB) to stay within the 2MB package budget. This was fixed 2026-05-19.

**Mini-program shared UI primitives (2026-05-27):**
- **`Chip`** (`apps/mini-program/src/components/ui/Chip.tsx`) — unified tag/pill component for interest tags, filters, and selections. Props: `label`, `selected`, `level` (1–3), `compact`, `onClick`. Level hierarchy is monotonic: L1 subtle (`$color-primary-light`) → L2 medium (`rgba(primary, 0.14)`) → L3 strong (`rgba(primary, 0.26)`). Includes checkmark pop-in animation and shimmer pseudo-element.
- **`BrandLogo`** (`apps/mini-program/src/components/ui/BrandLogo.tsx`) — single-source-of-truth logo renderer. Uses local `/assets/joyjoin-logo.webp`. Preset sizes: `sm` (74rpx), `md` (152rpx), `lg` (240rpx), `xl` (520rpx`). Prefer this over hardcoding `<Image src="/assets/joyjoin-logo.webp">`.
- **`JoyJoinIcon`** (`apps/mini-program/src/components/ui/JoyJoinIcon.tsx`) — proprietary icon renderer replacing raw emoji on primary UI surfaces. Props: `emoji`, `size?`, `tier?`, `className?`, `style?`. 4-tier fallback chain (no mapping → require fail → load fail → native emoji). Composite tier-aware lookup via `packages/shared/src/iconSystem/emojiToIconMap.ts` (same Unicode emoji can resolve to different assets per context). Includes fade-in + spring-bounce load animation, reduced-motion support, shimmer placeholder, and `alt` accessibility. Use for reactions, categories, intents, achievements, chemistry badges, status icons, phase emblems, and info labels.- **`XiaoyueChatBubble`** (`apps/mini-program/src/components/mascot/XiaoyueChatBubble.tsx`) — shared mascot coaching bubble with `tail` prop (auto-disabled for vertical/wide layouts), glow ring, and sentence stagger animation. Refactored across edit-profile, extended-data, and profile-review.
- **`TypewriterText`** (`apps/mini-program/src/components/ui/TypewriterText.tsx`) — character-by-character text reveal for mascot speech bubbles. Props: `text`, `speed` (ms/char, clamped ≥16), `delay`, `enabled`, `showCursor`, `onComplete`. Includes punctuation-aware pauses (。！？= 2.5×, ，= 1.5×) and a blinking cursor. Used in personality-test speech bubble; suitable for any mascot "talking" moment.

**Accessibility patterns in personality-test results (2026-05-27):**
- **Reduced motion:** `Taro.getSystemInfoSync().reduceMotion` gates the slot animation; when true, results render immediately without the spinning reel. CSS `@media (prefers-reduced-motion: reduce)` plus a JS-driven `.personality-results--reduce-motion` container class suppresses stagger entrances, holographic shimmer, and card tilt.
- **Error-state screen-reader support:** `ErrorStage` uses `role="alert"` and `aria-live="polite"` so assistive tech announces sync failures.
- **Split-brain hardening:** Server `validateFinalResult()` validates `primaryArchetype` before persistence; client `isValidFinalResult()` blocks transition if invalid. Unified fallback chain ensures slot target and display archetype resolve identically.

**Full-screen state centering (2026-05-29):**
- Loading, empty, and error states must be vertically centered in the viewport. The most common bug is `display: flex; align-items: center` without `min-height` — the content hugs the top.
- **Stand-alone full-screen loaders** (e.g., `OnboardingLoadingShell`, `JoyJoinLoadingScreen`): use `min-height: 100dvh` + flex centering, or `position: fixed; inset: 0` for overlays.
- **States inside `ScrollView`**: the `ScrollView` child does not automatically inherit viewport height. Use `@include scroll-view-centered-state` (`_mixins.scss`) which applies `min-height: 60dvh` + flex centering. This mixin was created specifically for `connections`, `events`, and `center-hub` loading/empty states.
- **Always pair `min-height` with flex centering.** `flex: 1` inside a flex parent with `min-height: 100dvh` also works (see `center-tab-empty`).
- **Guardrails** now flags `&__loading` / `&__empty` / `&__error` blocks in page SCSS that use flex without `min-height`, `flex: 1`, `@include scroll-view-centered-state`, or `position: fixed`.

**Mini-program profile components (2026-05-24):**
- **`ProfileArchetypeHero`** (`apps/mini-program/src/components/profile/ProfileArchetypeHero.tsx`) — celebratory archetype card with gradient background. Props: `archetype?`, `displayName`, `size` (`sm`/`md`/`lg`), `showLabel?`. Uses `ARCHETYPE_FAMILY_GRADIENTS` from `@shared/archetypeColors`. Used in profile tab, edit-profile preview, and onboarding profile-review for visual continuity.
- **`InterestChipCloud`** (`apps/mini-program/src/components/profile/InterestChipCloud.tsx`) — read-only interest chip display with optional L1/L2/L3 level visualization. Props: `labels`, `levels?`, `accent?`, `compact?`, `emptyText?`, `onEmptyClick?`. Used in profile tab, onboarding profile-review, and anywhere interests are displayed read-only.
- **`ProfessionDisplayField`** (`apps/mini-program/src/components/profile/ProfessionDisplayField.tsx`) — displays profession raw text + AI-classified category/segment/niche chips with edit trigger. Used in edit-profile and anywhere profession is displayed read-only.

**Mini-program button styling (2026-05-23):**
- **CTA buttons use solid brand purple (`$color-primary`, `#8B5CF6`) — no gradient.** Gradient was purged from all mini-program CTAs to avoid "AI-generated" aesthetic. The web client's `docs/design/button-design.md` retains gradient specs for archived user-client; mini-program (launch-primary) uses solid fill exclusively.
- **Bottom action bar pattern:** Solid white background (`$color-surface`) + subtle top shadow (`rgba($color-text-primary, 0.04)`) creates floating CTA effect. Used across all onboarding steps.

**Profession input overlay (2026-05-24):**
- **`ProfessionChatOverlay`** (`apps/mini-program/src/components/ProfessionChatOverlay.tsx`) — full-screen conversational overlay for free-text profession input during onboarding step 2 (`essential-data`).
- **Dual-mode:** Feature-flagged via `SMART_PROFESSION_V1_ENABLED` (default `true`). When enabled, calls `POST /api/inference/understand-profession` (server-side `routes/domains/professionUnderstanding.ts`) which runs parallel catalog + AI classification, generates archetype-aware AI reactions with 2-bubble stagger + reveal card with animated tags. When disabled, falls back to the legacy 184-keyword matched reaction system.
- **Background retry:** `useProfessionRetry` hook in `app.ts` silently classifies users with `industryRawInput` but no `industryNiche` on next app open.
- **Keyboard-safe:** Uses `onKeyboardHeightChange` + manual padding; `adjustPosition={false}` on input to prevent native scroll fighting.
- **Optional field:** `occupationId` schema relaxed to `.optional()`; free text stored in both `occupationId` and `industryRawInput`; classification populates `industryCategoryLabel`, `industrySegmentLabel`, `industryNicheLabel`, and new `standardizedOccupationId`.
- **Accessibility:** Includes `@media (prefers-reduced-motion: reduce)` override for all animations (overlay, messages, reveal card, tags), 88rpx touch targets, and `env(safe-area-inset-bottom)` support.

**Mini-program page-stack lifecycle (swipe-back safety):** WeChat keeps pages in the navigation stack alive (hidden, not unmounted). If a page sets `isExiting`/`isPageExiting`/`isSubmitting` before navigating away, those flags survive. When the user swipes back, the page is re-shown but the CTA remains stuck. **Always reset transient exit/submit flags in `useDidShow`** — use `useResetOnShow(setIsPageExiting, setIsSubmitting)` from `apps/mini-program/src/hooks/useResetOnShow.ts`. The navigation hook `useJoyJoinNavigation` already carries an internal reset.

**Mini-program ScrollView trap:** `Taro.pageScrollTo` only works on page-level scroll, **not inside `<ScrollView>`**. For scroll-to-error inside a `ScrollView`, use the `scrollIntoView` prop on `ScrollView` with the target element's `id` (no `#` prefix): `<ScrollView scrollIntoView={scrollToErrorId}>…<View id='field-displayName'>…</View>…</ScrollView>`. Clear the id after ~500ms to prevent re-scrolling on re-render.

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
- **Background-fetch indicator pattern:** When `isFetching && !isLoading`, render a subtle shimmer line (`discover-auth__refresh-indicator`, `events-page__refresh-indicator`) to signal background refresh. Respects `prefers-reduced-motion`.
- **Performance:** Pre-serialized whitelist (`Set<string>`) gives O(1) lookup. Serialization is reused between size-check and `setStorageSync` write. 2s debounce prevents storage churn.

**Edit-profile design patterns (2026-05-24):**
- **2-step grouping:** Step 1 "基础档案" = static facts (name, gender, birth, city, hometown, education). Step 2 "社交画像" = expressive choices (profession via AI overlay, intent grid, interests). Maintains cognitive continuity with onboarding.
- **Validation + scroll-to-error:** Inline field validation with `fieldErrors` state. First error field id passed to `ScrollView scrollIntoView`.
- **Unsaved changes guard:** `Taro.enableAlertBeforeUnload({ message: '…' })` when `hasChanges` is true; `Taro.disableAlertBeforeUnload()` on cleanup.
- **Skeleton loading:** `isInitializing` gates a skeleton block with shimmer animation; disabled under `prefers-reduced-motion`.
- **Floating CTA bar:** Fixed bottom white bar with subtle top shadow (`rgba($color-text-primary, 0.04)`).

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

Five scheduled/event-driven GitHub Actions workflows run autonomously:

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| **`auto-debug.yml`** | Daily 04:00 UTC | Bug scanning — regex engine (11 patterns) + DeepSeek Flash LLM validation. Opens fix PRs. |
| **`auto-docs.yml`** | Daily 05:00 UTC | Doc gap detection across 14 mapped source areas. LLM generates READMEs. Opens doc PRs. |
| **`auto-digest.yml`** | Daily 06:00 UTC | Engineering digest — clusters last 24h commits/PRs into themes via LLM. WeCom only. |
| **`auto-test.yml`** | Daily 07:00 UTC | Test coverage — finds untested production code, generates tests via LLM, validates with vitest. Opens test PRs. |
| **`auto-ci-fix.yml`** | On CI failure | CI autofix — deduplicates via lock files, investigates root cause with LLM, skips flaky tests or reports. |
| **`auto-fix.yml`** | Daily 03:30 UTC | Auto-creates fix PRs for deterministic bugs (empty-catch, missing-await, promise-not-awaited). PR mode only. |
| **`auto-merge.yml`** | Every 30min + on auto workflow complete | Auto-merges auto-generated PRs when CI passes with blast-radius cooldowns (docs→immediate, test→30min, fix→1hr). |
| **`auto-prune.yml`** | Weekly Wed 01:00 UTC | Cleans stale branches, old artifacts, expired reports. `--live` flag required for deletions. |
| **`auto-triage.yml`** | PR/issue open + every 4h | Auto-labels PRs and issues by changed paths, title, and body keywords. Creates missing labels automatically. |

All notify via WeCom when actionable findings are discovered.

Trigger on demand: `gh workflow run <workflow-name>.yml` or via the **WeCom Automation Trigger** workflow.

Full reference: `docs/automations/README.md`

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
