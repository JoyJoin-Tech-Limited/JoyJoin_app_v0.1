# JoyJoin — Agent Onboarding Guide

> Compact instructions for AI coding agents. Last updated: 2026-07-21

> **2026-07-21 Flash privacy clarification:** optional private reply text is cleared at the earlier of 30 days after delivery or 37 days after submission; this overrides the shorter wording in the Flash formal summary below so undelivered text cannot persist indefinitely.

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

> **Windows developers:** The `.agents/skills/` directory mirrors `.github/skills/` as real files (not symlinks). Git on Windows may check out the mirror entries as plain text files, which prevents OpenCode from discovering skills. If a skill reports "not found", run `npm run setup:agent-skills` to recreate the mirror as copies of the canonical definitions under `.github/skills/`.

> Other skills are available. If your task doesn't match this table, describe the task and ask which skill applies.

### Step 2: Read the canonical doc

Each skill's body or `Related docs` section links to the authoritative documentation for that domain. Follow those links. If a skill has no doc references, it is self-contained.

### Step 3: Pre-implementation checklist

- ☐ Relevant skill loaded and read
- ☐ Skill's constraints understood (invariants, placement rules, naming conventions)
- ☐ No legacy identifiers in your planned approach (re-check §1 below)
- ☐ Cross-platform impact assessed (mini-program + web via `platform-coordination-protocol`)

### Step 4: After implementation

- ☐ For the full pre-ship chain (code review → review swarm → UI/completeness/performance audits → fix → polish → gate), run `pre-ship-pipeline` — a thin orchestrator that sequences the individual checks below and collapses their five grill-me interviews into one consolidated end checkpoint
- ☐ Run `harness-completion-gate` skill to verify 5-pillar compliance
- ☐ For user-facing frontend changes: run `user-satisfaction-audit` — first-person persona walk + six-angle satisfaction scoring (clarity, comprehension, cleanliness, emotional resonance, return hooks, share-worthiness) with a share/return/recommend/pay verdict
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
- **Lie Detective V1 (user-authored 2 truths + 1 lie in mini-program; AI-compatible API fallback) → V2 mode available** (`LIE_DETECTIVE_MODE=v2`): user writes 2 tags, AI expands + inserts 1 fake statement. V1 remains default. Single-test bots generate their sets through the approved LLM service with curated fallback and use seeded random votes. Design spec: `docs/icebreaker/icebreaker-system.md`
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
# CI: a push to main first deploys the same commit to staging. Only after that
#   workflow passes does taro-weapp-build.yml rebuild and upload the 开发版.
#   Automatic uploads target https://staging.joyjoinapp.com; production builds
#   require explicit workflow input api_target=production.
# Manual upload (--appid is required; won't auto-read from project.config.json):
#   npx miniprogram-ci upload --appid wx5a038ee6dee12032 --pp apps/mini-program \
#     --pkp <private-key-file> --uv "1.0.$(date +%Y%m%d).$(date +%H%M)" \
#     --ud "dev build" --rp 1
#
# WeChat upload gotchas (2026-07-22):
#   - Synchronous upload: .github/workflows/taro-weapp-build.yml uses
#     --use-cos=false so miniprogram-ci waits for WeChat backend validation.
#     Without this, async COS upload returns exit 0 before WeChat scans the
#     package, so rejected uploads look like successes in CI.
#   - scope.* permission descriptions must be <= 30 characters.
#     Exceeding this causes errcode 80058 and an invisible upload.
#     Guardrail: npm run validate:wechat-app-config -w mini-program
#     (also runs automatically as part of npm run build:weapp -w mini-program).
#
# CDN asset upload (mascot, phase icons, illustrations → joyjoinapp.com/static)
# Trigger: gh workflow run "Upload CDN Assets"
# Production: nginx serves /static/ from /var/www/cdn/ (alias directive).
# Set CDN_RSYNC_PATH=/var/www/cdn for production uploads. The Express dev
# server fallback (vite.ts: /static/ → ../server/static/) is local-dev only.
# Gotchas (2026-07-31): every localPath in cdn-asset-manifest.json must exist
# in src/ or dist/ (stale entries fail the upload), and the post-upload
# verification jq must match avatar-assets-v2.json sourceAssetCount
# (body+fullStarter+layer+thumb) whenever the build script changes the count.
# Details: docs/agent-context/mini-program-assets.md.
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
- Set `PAYMENTS_ENABLED=true` and `MOCK_PAYMENTS=false` (from GitHub repository variables) to run real WeChat Pay test charges; set `MOCK_PAYMENTS=true` to skip real payment and receive instantly-paid mock orders.
- Staging deploy reads `WECHAT_PAY_PLATFORM_CERT` from GitHub secrets, base64-encodes the value, and writes it into `deployment/.env.staging`. `WECHAT_PAY_PLATFORM_CERT` accepts a plain PEM or base64-encoded PEM, and supports both legacy platform-certificate mode and 微信支付公钥 (public-key) mode.
- **2026-07-20 deployment safety:** staging API/Admin images are built on the GitHub runner and the shared CVM never compiles them. The script validates schema/catalog read-only, requires the container-reachable `postgres-staging:5432/joyjoin_staging` target, gates on `/api/readyz` plus real Admin content, and restores the previous images/Nginx config if the switch fails. The mini-program 开发版 upload starts only after the matching staging commit succeeds.
- **2026-07-28 GHCR image delivery:** staging images are now pushed to GHCR (`ghcr.io/joyjoin-tech-limited/joyjoin-{api,admin}-staging:<sha>`) by the build job and pulled on the CVM (`STAGING_API_IMAGE`/`STAGING_ADMIN_IMAGE`/`GHCR_TOKEN`), replacing the old ~40min chunked-rsync bundle upload that made the stale-candidate check flaky whenever main moved mid-upload. `deploy-staging.sh` retries `docker pull` (layers resume) and keeps the tar-bundle path as a fallback when `STAGING_API_IMAGE` is unset. First-time CVM pulls download full images (slow, cross-Pacific); steady-state pulls only fetch changed app layers. If GHCR pulls prove unreliable from the CVM, the documented next step is a same-region Tencent Cloud TCR registry.
- Build the mini-program with `TARO_APP_API_BASE_URL=https://staging.joyjoinapp.com`.
- Manage staging events and feature flags via `https://staging.admin.joyjoinapp.com`.
- Staging does **not** auto-run migrations; apply `.sql` files manually against `postgres-staging`.
- **2026-07-28 CVM memory safety update:** the staging API container (`joyjoin-api-staging`) is now limited to **2g** with `NODE_OPTIONS=--max-old-space-size=1536 --heapsnapshot-near-heap-limit=3`. The previous 512m limit produced a V8 heap OOM crash-loop (SIGABRT → 502 gaps) under LLM bursts; see `repo-memory/candidates/server-staging-oom-v8-heap-limit.md`. The production API (`joyjoin-api`) also carries `mem_limit: 2g` + `--max-old-space-size=1536` as a shared-host safety rail.
- **2026-07-28 bundle/runtime change:** `@joyjoin/shared` is bundled into the server production bundle by `apps/server/build.mjs`; the container starts with plain `node dist/index.js` (tsx/esm is no longer required at runtime), lowering baseline memory.
- Full guide: `deployment/README.md` and `docs/operations/test-mode-operations.md` §G.

**Local dev payment smoke testing (2026-06-28):**
- Set `APP_MODE=staging`, `PAYMENTS_ENABLED=true`, `TEST_PAYMENT_PRICE_IN_CENTS=1`, and `MOCK_PAYMENTS=true` in root `.env` to test paid flows without real WeChat Pay charges.
- `MOCK_PAYMENTS=true` makes the server return instantly-paid orders (`status: completed`, `mock: true`) and the mini-program skips `Taro.requestPayment()`.
- Restart `npm run dev:server` after changing `.env`.

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

> **Detailed domain context lives in `docs/agent-context/*.md`** (extracted 2026-07-31). Load the relevant file when working in that domain — do not expect the full narrative here.

| Domain | Context file |
|--------|-------------|
| Landing page & cold-start auth | `docs/agent-context/landing-page.md` |
| Onboarding, personality test, edit-profile | `docs/agent-context/onboarding.md` |
| Personality engine status | `docs/agent-context/personality-engine.md` |
| Matching, 足迹, matching-test mode | `docs/agent-context/matching-domain.md` |
| Geo services | `docs/agent-context/geo-services.md` |
| 街头盲盒 (Alang / Flash NPC) | `docs/agent-context/alang-flash.md` |
| Feature flags | `docs/agent-context/feature-flags.md` |
| Social Icebreaker | `docs/agent-context/social-icebreaker.md` |
| Squad unboxing | `docs/agent-context/squad-unboxing.md` |
| Mini-program assets & icons | `docs/agent-context/mini-program-assets.md` |
| Custom tab bar | `docs/agent-context/tab-bar.md` |
| Profile V1.7 / My Image | `docs/agent-context/mini-program-profile.md` |
| Events / footprint / pool-registration | `docs/agent-context/mini-program-events.md` |
| Profession input overlay | `docs/agent-context/profession-overlay.md` |
| Cross-cutting mini-program patterns | `docs/agent-context/mini-program-patterns.md` |
| Flow-animation overlays (intro + blind-box lifecycle) | `docs/agent-context/flow-animation.md` |

**Onboarding is server-driven:** `GET /api/auth/user` returns `nextStep`. Client never computes its own position.

**Matching:** `poolMatchingService.ts` is deterministic authority. 6D scoring; optional 7th semantic dimension behind `ENABLE_SEMANTIC_SIMILARITY`. AI may enrich explanations but must not redefine scoring. Details: `docs/agent-context/matching-domain.md`. Registration capacity gate (`poolRegistrationRules.ts`) skips `POOL_FULL` for `is_test_pool=true` test pools (tester + 5 bots fill 6/6 by design); real pools keep the full capacity rule.

**Social Icebreaker:** Primary in-event flow is `/icebreaker/:sessionId` → Social Icebreaker. Host-paced (no auto-advance), PhaseHeroCard views, all icebreaker LLM calls wrapped in 6s `raceWithTimeout` hard bound. Details: `docs/agent-context/social-icebreaker.md`.

**Feature Flags (DB-backed):** `apps/server/src/lib/featureFlags.ts` is the canonical resolver (DB = source of truth, env = fallback, 5s LRU). Admin toggle UI at `/admin/feature-flags` (super_admin only), mutations audit-logged. Full flag inventory: `docs/agent-context/feature-flags.md`.

**Venue Assignment:** Automatically assigns optimal venues to matched groups via `venueAssignmentService.ts`. Scoring dimensions: budget overlap (30% threshold), cuisine preference overlap, time slot availability (`bookingCount < maxConcurrentEvents`), capacity hard constraint (`seatingCapacity < groupSize` → score=0), and city/district/type/contract-expiry filters. Uses `FOR UPDATE` row locks on slot + booking rows during atomic save to prevent race conditions. Unassigned groups trigger WeCom ops alert (`notifyVenueUnassigned`) and in-app `venue_tbd` notifications. Degraded UX: mini-program shows amber "地点待定" card when unassigned. Canonical doc: `docs/systems/VENUE_ASSIGNMENT_SERVICE.md`.

**Invite/Referral flow (2026-06-04):** Dual-table system: `invitations` (event-specific, `expiresAt` + `invitationType`) vs `referral_codes` (permanent, user-level). Both flow through `invitationCode` on pool registration; server disambiguates (`invitations` first, then `referral_codes`). `pendingReferralCode` in session carries invite attribution across login → pool-registration. Referral conversions recorded on pool registration; new-user attribution at login. Self-referral and dedup guards on both `invitation_uses` and `referral_conversions`.

**Match Compass:** Tri-state preference dashboard (`优先契合`/`平衡体验`/`探索惊喜`) on matching-status pending page. Users tune dealbreakers + nice-to-haves post-registration until `preference_lock_at` (24h before event). Strictness scalar 0-100 affects group formation only; pair scores remain sacred. Kill switch: `MATCH_COMPASS_STRICTNESS_ENABLED`.

**Predictive Shell:** Composite `GET /api/shell/*` endpoints (discover, profile, events, connections) bundle tab data to eliminate cold-start round-trips. Landing page prefetches shells via `PrefetchEngine` and injects into TanStack Query keys. Cache invalidation is server-driven (`shellCache.invalidateUser()`) on mutations (payment/coupon use, pool registration, connection creation, assessment completion, event-feedback submission). Legacy endpoints remain for fallback.

**Mini-program is launch-primary:** `apps/mini-program` is the primary and only shipping user-facing client. The web sandbox (`archived/workspaces/user-client/`) exists for historical reference. Cross-surface rules: `docs/reference/PLATFORM_COORDINATION.md`.

**Tab bar icon gotcha + `switchTab` requirement:** `centerHub` tab in `tabBarConfig.ts` must have a non-empty `iconPath` (the `miniprogram-ci` upload rejects empty icon paths with `800059`). **Crucially, `centerHub` must also be included in `MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS`** (the `tabBar.list` array consumed by `app.config.ts`) because WeChat validates `wx.switchTab` targets against `tabBar.list` even when `custom: true`. Excluding it causes `switchTab:fail can not switch to no-tabBar page`. The custom tab bar component renders the center button independently (`joyjoin-logo-tab.png` + `tab-bar-notch-bg.png`), so any placeholder icon works for both CI validation and `switchTab`. The tab bar logo uses a dedicated 128×128 `joyjoin-logo-tab.png` (19KB) instead of the full-resolution `joyjoin-logo.png` (596KB) to stay within the 2MB package budget. Fixed 2026-05-19 and 2026-06-06.

**Full-screen state centering (2026-05-29 / error-state coverage 2026-06-05):**
- Loading, empty, and error states must be vertically centered in the viewport. The most common bug is `display: flex; align-items: center` without `min-height` — the content hugs the top.
- **Stand-alone full-screen loaders** (e.g., `OnboardingLoadingShell`, `JoyJoinLoadingScreen`): use `min-height: 100vh` fallback before `min-height: 100dvh`, then flex centering, or `position: fixed; inset: 0` for overlays. WeChat WKWebView / older Taro runtimes do not always support `dvh`; the `vh` fallback prevents the surface from collapsing to zero height. The `design-audit.mjs` scanner was updated 2026-06-17 so `min-height: 100vh` fallbacks are no longer flagged.
- **States inside `ScrollView`**: the `ScrollView` child does not automatically inherit viewport height. Use `@include scroll-view-centered-state` (`_mixins.scss`) which applies `min-height: 60dvh` + flex centering. This mixin was created specifically for `connections`, `events`, and `center-hub` loading/empty states.
- **Error states on tab pages (2026-06-05):** Discover, Events, and Connections now render full-page error surfaces with retry CTAs when their primary query fails. Discover uses `StatusCard` with `tone='error'` and a Lovart error illustration; Events and Connections use `XiaoyueEmptyState` with `emotion='sad'` plus a retry action.
- **Branded loading on Connections (2026-06-05):** `pages/connections/index` uses `XiaoyueEmptyState` with `emotion='waiting'` for the initial loading surface instead of a raw spinner, keeping the experience on-brand while data hydrates.
- **Always pair `min-height` with flex centering.** `flex: 1` inside a flex parent with `min-height: 100dvh` also works (see `center-tab-empty`).
- **Guardrails** now flags `&__loading` / `&__empty` / `&__error` blocks in page SCSS that use flex without `min-height`, `flex: 1`, `@include scroll-view-centered-state`, or `position: fixed`.

**Mini-program button styling (2026-05-23):**
- **CTA buttons use solid brand purple (`$color-primary`, `#8B5CF6`) — no gradient.** Gradient was purged from all mini-program CTAs to avoid "AI-generated" aesthetic. The web client's `docs/design/button-design.md` retains gradient specs for archived user-client; mini-program (launch-primary) uses solid fill exclusively.
- **Bottom action bar pattern:** Solid white background (`$color-surface`) + subtle top shadow (`rgba($color-text-primary, 0.04)`) creates floating CTA effect. Used across all onboarding steps.

**Mini-program page-stack lifecycle (swipe-back safety):** WeChat keeps pages in the navigation stack alive (hidden, not unmounted). If a page sets `isExiting`/`isPageExiting`/`isSubmitting` before navigating away, those flags survive. When the user swipes back, the page is re-shown but the CTA remains stuck. **Always reset transient exit/submit flags in `useDidShow`** — use `useResetOnShow(setIsPageExiting, setIsSubmitting)` from `apps/mini-program/src/hooks/useResetOnShow.ts`. The navigation hook `useJoyJoinNavigation` already carries an internal reset.

**Mini-program ScrollView trap:** `Taro.pageScrollTo` only works on page-level scroll, **not inside `<ScrollView>`**. For scroll-to-error inside a `ScrollView`, use the `scrollIntoView` prop on `ScrollView` with the target element's `id` (no `#` prefix): `<ScrollView scrollIntoView={scrollToErrorId}>…<View id='field-displayName'>…</View>…</ScrollView>`. Clear the id after ~500ms to prevent re-scrolling on re-render.

**Database schema drift guard (2026-06-03):**
- Server startup calls `validateDbSchema()` in `apps/server/src/db.ts` before accepting traffic.
- This fail-fast check runs `LIMIT 0` SELECTs on critical tables (`users`, `assessment_sessions`, `assessment_answers`, `event_pools`, `social_icebreaker_sessions`) to catch missing columns immediately.
- If a column defined in Drizzle schema is missing from the DB, the server crashes on startup with a clear message instead of serving 500s to users.
- Always run `npm run db:push` (local) or apply migrations (production) before deploying code that adds new columns.


---

## 7. Guardrails (CI-Enforced)

`npm run guardrails` checks:
- No committed `.env` files with real secrets
- No legacy onboarding identifiers (`hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, `interestsTop`, `topicAvoidances`, `hasPets`, or the removed `hometown` column token)
- No imports from legacy `shared/` root directory
- No cross-app imports
- Admin routes must enforce admin middleware
- Page-level loading/empty/error state blocks must include centering safety (`min-height`, `flex: 1`, or `@include scroll-view-centered-state`)
- No inline emoji in `apps/mini-program/` TS/TSX (use `JoyJoinIcon` or CSS/text; server/admin files are exempt — the scanner reads full staged-file content, not the diff)
- **BEM class coverage (2026-07-27):** every static `__`-containing class referenced in mini-program TS/TSX must be defined in some stylesheet under `src` (`scripts/check/check-class-coverage.mjs`, which compiles every non-partial SCSS so nesting/mixins/interpolation are fully expanded). Regression guard for the 2026-07-26 SquadTableCard zero-CSS incident and the `match-compass` mixin-namespace mismatch it caught. Legacy orphans live in `scripts/check/class-coverage-baseline.json` as a ratchet — the gate fails only on NEW orphans; after fixing baseline entries regenerate with `node scripts/check/check-class-coverage.mjs --write-baseline`. Any new component MUST ship its CSS in the same PR.

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
- `docs/agent-context/` — deep domain context extracted from §6 (load on demand per domain)
- `.agents/skills/` — **OpenCode auto-discovered** skill tree (mirrors `.github/skills/`; regenerate via `npm run setup:agent-skills`)
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

## Street Blind Box NPC Catalog Override (2026-07-30)

- The formal admin/product name is `街头盲盒运营`; `flash`, `/admin/alang`, and the separate `/admin/flash-ops` surface remain internal identifiers.
- The NPC catalog is extensible: there is no five-NPC cap and no closed species allow-list.
- The five built-in NPCs remain required seed content with their fixed weekdays. Additional NPCs are created inactive by operator/super_admin, receive operator-configured species, persona copy, structured dialogue, eligible weekdays, approved location links, and reviewed task links, and may be activated only after those runtime prerequisites are ready.
- Readiness validates every active NPC rather than requiring exactly five active NPCs.
