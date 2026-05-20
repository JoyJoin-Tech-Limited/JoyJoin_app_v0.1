# JoyJoin — Agent Onboarding Guide

> Compact instructions for AI coding agents. Last updated: 2026-05-20

---

## 0. Before You Code — Mandatory Context Checklist

> **Do these steps before editing a single file.** Most implementation errors come from skipping unknown constraints, not from coding mistakes.

### Step 1: Load the domain skill

Use the `skill` tool to load the skill that owns the boundary you're touching. These are the highest-regression areas — missing the wrong skill here is the #1 cause of rework:

| Area you're modifying | Skill to load (mandatory) |
|----------------------|--------------------------|
| Server routes, endpoints, middleware | `server-domain-architecture` |
| Matching scores, pair weighting, group formation | `matching-domain` |
| Payment creation, verification, refunds, webhooks | `payment-entitlement-authority` |
| Onboarding flow, `nextStep` logic, completion signals | `onboarding-state-architecture` |
| Social Icebreaker phases, sessions, state machine | `social-icebreaker-domain` |
| Any AI/LLM call in production code | `llm-runtime-safety-and-integration` |
| Admin routes, RBAC, audit logging | `admin-audit-and-rbac-governance` |
| Changes touching both mini-program and web | `platform-coordination-protocol` |
| Any user-facing UI (web or mini-program) | `joyjoin-brand-guidelines` |
| Database schema changes, migrations | `database-migration-safety` |
| New feature flag, kill switch, rollout config | `feature-flags-launch-config` |

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
- `LEGACY_TIER_MAP` + `resolveLegacyTier()` removed from `socialIcebreakerTierManifest.ts` (2026-05-07)
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

# WeChat Mini-Program upload (开发版)
# Set WECHAT_PRIVATE_KEY in GitHub Secrets → every main push auto-uploads.
# IP must be whitelisted at mp.weixin.qq.com → 开发管理 → 开发设置 → IP白名单
# Manual upload:
#   npx miniprogram-ci upload --appid <appid> --pp apps/mini-program \
#     --pkp <private-key-file> --uv "1.0.$(date +%Y%m%d).$(date +%H%M)" \
#     --ud "dev build" --rp 1
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

**Local dev auth:** phone login demo code is `666666`. Bypass: `npm run user:bypass <phone> "$ADMIN_CREATE_SECRET_KEY"`.

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

**Personality:** 12 archetypes, V4 adaptive assessment. `packages/shared/src/personality/` owns the engine.

**Matching:** `poolMatchingService.ts` is deterministic authority. 6D scoring (chemistry, interest, socialAffinity, backgroundDiversity, preference, language). Optional 7th semantic dimension behind `ENABLE_SEMANTIC_SIMILARITY`. AI may enrich explanations but **must not** redefine scoring.

**Social Icebreaker:** Primary in-event flow is `/icebreaker/:sessionId` → Social Icebreaker. `/icebreaker-game` (AI Card Game) is optional deep-dive, not default.
- **Moment Card server render:** `GET /api/social-icebreaker/:id/moment-card.png` (feature-flagged: `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER`)
- **Bonus gate:** when `mini_script` is next eligible, advance pauses at `bonusGateOffered` for host+player vote (`POST .../bonus/respond`, `POST .../bonus/sentiment`)
- **Phase metrics:** `social_icebreaker_phase_metrics` table tracks `dwellTimeMs` per phase on every advance

**Icebreaker tiers & vibe:** Host selects time budget + vibe. Budgets: `breeze` (破冰局, 40min) / `glow` (畅聊局, 60min) / `blaze` (狂欢局, 105min). Vibe: 聊天为主 / 混合 / 竞技为主. Resolved via `packages/shared/src/socialIcebreakerTierManifest.ts`. See `docs/icebreaker/icebreaker-system.md`.

**Game Design Agent:** Compiles dynamic run plan per session using 70% rule engine + 30% LLM. Reads archetype mix + behavioral signals (mood, commonGround, completion rate, pulse). Rule engine runs on every compilation (deterministic); LLM enhances selection + ordering with 3s timeout fallback. See `docs/icebreaker/icebreaker-system.md` §5.

**Phase pool (8 non-core + 1 bonus):** lie_detective, personality_dice, group_mirror, undercover_word, quip_battle, auction, speed_friending. Mini_script is bonus-only (悦仔 offers after last phase before recap, all tiers eligible). **Bonus gate:** host+player vote gate precedes `mini_script` entry when `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true`.

**Lie Detective V2:** `LIE_DETECTIVE_MODE=v2` enables user-tag-based gameplay (user writes 2 tags, AI expands + inserts 1 fake). V1 remains default. Host-choosable toggle, all tiers. Design: `docs/proposals/spot-the-bot-game-design.md`.

**Boost plan:** All 10 phases must reach composite ≥8.0 (agent may select any phase — none deferred). 11-week roadmap in `.git/.orchestration/plans/boost-all-games-to-8.md`. Shared infra: Reveal Engine, Gesture Kit, Context Injector, Optimistic Sync.

**Match Compass:** Tri-state preference dashboard (`优先契合`/`平衡体验`/`探索惊喜`) on matching-status pending page. Users tune dealbreakers + nice-to-haves post-registration until `preference_lock_at` (24h before event). Strictness scalar 0-100 affects group formation only; pair scores remain sacred. Kill switch: `MATCH_COMPASS_STRICTNESS_ENABLED`.

**Predictive Shell:** Composite `GET /api/shell/*` endpoints (discover, profile, events, connections) bundle tab data to eliminate cold-start round-trips. Landing page prefetches shells via `PrefetchEngine` and injects into TanStack Query keys. Cache invalidation is server-driven (`shellCache.invalidateUser()`) on mutations. Legacy endpoints remain for fallback.

**Mini-program is launch-primary:** `apps/mini-program` is the primary and only shipping user-facing client. The web sandbox (`archived/workspaces/user-client/`) exists for historical reference. Cross-surface rules: `docs/reference/PLATFORM_COORDINATION.md`.

**City Unlock v0.1 (2026-05-19):** Server-owned city expansion tracking via `user_city_interests` + `city_unlock_progress`. Threshold: 50 interested users triggers `collecting` → `researching` status transition + WeCom ops notification. Atomic count updates via Drizzle `sql` expressions (race-safe). Frontend shows gentle banner/feed-card/picker on discover when user has no city interest; progress page at `pages/city-unlock/index`. Admin report: `GET /api/admin/cities/unlock-report`.

**Tab bar icon gotcha:** `centerHub` tab in `tabBarConfig.ts` must have a non-empty `iconPath`. The `miniprogram-ci` upload rejects empty icon paths with `800059`. The custom tab bar component renders the center button independently (`box-logo.webp` + `tab-bar-notch-bg.png`), so any placeholder icon works for validation. This was fixed 2026-05-19.

---

## 7. Guardrails (CI-Enforced)

`npm run guardrails` checks:
- No committed `.env` files with real secrets
- No legacy onboarding identifiers (`hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, `interestsTop`)
- No imports from legacy `shared/` root directory
- No cross-app imports
- Admin routes must enforce admin middleware

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
