# JoyJoin — Agent Onboarding Guide

> Compact instructions for AI coding agents. Last updated: 2026-04-30

---

## 1. Active vs. Legacy (Do Not Reintroduce)

Always base implementation on the **current active codebase**, not legacy flows or old git history.

**Legacy — never use:**
- 14-archetype V1/V2 system → replaced by **12-archetype V4** (8–16 questions, ACOEXP 6-trait, MatcherV2)
- `/chats` surface, DM UI → replaced by `/connections`
- `圈子` nav label → `连接`
- `会员/VIP会员` copy → `权益`
- `/guide` as core onboarding → active steps: `/onboarding/setup` → `/onboarding/extended` → `/onboarding/review` → `/discover`
- **Xiaoyue chat-based onboarding is deprecated** — mascot character only (visuals, loading, empty states)
- IcebreakerToolkit → use Social Icebreaker (`/api/social-icebreaker/*`) instead
- **`standard`/`premium`/`bar` tier machine IDs → `breeze`/`glow`/`blaze`** (approved Apr 29 deliberation; `socialIcebreakerTierManifest.ts` exists but not yet wired to client/server)
- **`标准局`/`Premium局`/`酒吧局` display names → `破冰局`/`畅聊局`/`狂欢局`** (see `docs/deliberations/2026-04-29-tier-naming-mascot-rebrand-consensus.md`)
- **Lie Detective V1 (AI-fabricated 2 truths 1 lie) → V2 mode available** (`LIE_DETECTIVE_MODE=v2`): user writes 2 tags, AI expands + inserts 1 fake statement. V1 remains default. Design spec: `docs/proposals/spot-the-bot-game-design.md`
- Root `shared/` directory imports → use `packages/shared/src/` via `@joyjoin/shared` or `@shared/*`

**Canonical references:** `DEVELOPER_QUICK_REFERENCE.md` and `PRODUCT_REQUIREMENTS.md`

---

## 2. Monorepo Boundaries

- **Root `package.json`** is orchestration-only — **no `dependencies` or `devDependencies`**
- Apps **must not** import from other apps. Reusable logic goes in `packages/shared`
- Import shared code via `@joyjoin/shared` or `@shared/*`
- **Never** import from legacy top-level `shared/` directory (enforced by `npm run guardrails`)
- ESM only (`"type": "module"` in all workspace `package.json` files)
- Strict TypeScript, solution-style project references

**Workspaces:** `@joyjoin/user-client` (port 5001), `@joyjoin/admin-client` (port 5002), `@joyjoin/server` (port 5000), `@joyjoin/shared`, `mini-program`

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
npm run db:verify                     # CI gate: schema.ts vs live DB

# Testing reality: only server has real tests
npm run test -w @joyjoin/server       # vitest, real tests
npm run test -w mini-program          # limited coverage
# Other workspaces have no-op placeholders

# Validation
npm run guardrails                    # env, secrets, legacy identifiers, import boundaries
npm run dep-check                     # verify root has no deps
npm run check:full                    # guardrails + lint + tests + build
npm run harness:gate                  # 5-pillar quality gate
```

**Migration discipline:** local dev → `db:push`; before commit → `db:generate` then `db:rebuild-journal`; production → `db:migrate` only.

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

**Server:**
- New domain endpoints → `apps/server/src/routes/domains/<domain>.ts`
- New isolated router → `apps/server/src/routes/<router>.ts`
- Business logic → `apps/server/src/` or domain subfolder
- DB queries → `apps/server/src/repositories/` (**not** `storage.ts`)
- Middleware → `apps/server/src/middleware/`
- Helpers → `apps/server/src/lib/`

**Shared package:**
- DB schema → `packages/shared/src/schema.ts`
- Cross-app types → `packages/shared/src/types/`
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

**Icebreaker tiers:** Host selects from `breeze` (破冰局, 40min casual) / `glow` (畅聊局, 60min standard) / `blaze` (狂欢局, 90min full). Resolved via `packages/shared/src/socialIcebreakerTierManifest.ts`. Machine IDs decoupled from display names. See `docs/deliberations/2026-04-29-tier-naming-mascot-rebrand-consensus.md`.

**Lie Detective V2:** `LIE_DETECTIVE_MODE=v2` enables user-tag-based gameplay (user writes 2 tags, AI expands + inserts 1 fake). V1 (AI-fabricated 3 statements) remains default. Design: `docs/proposals/spot-the-bot-game-design.md`.

**Boost plan:** Planned 10-week roadmap to raise all 10 phases to composite 8.0+ using shared Reveal Engine, Gesture Kit, Context Injector, and Optimistic Sync. (Design doc pending — see `docs/unified-icebreaker-system.md` §11 for implementation sequence.)

**Mini-program is launch-primary:** `apps/mini-program` is the primary client; web (`apps/user-client`) is sandbox. Cross-surface rules: `docs/PLATFORM_COORDINATION.md`.

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

Two scheduled GitHub Actions workflows run daily to analyze code autonomously:

- **`auto-debug.yml`** (daily 04:00 UTC) — scans recent commits for high-severity bugs (null derefs, missing auth, SQL injection, race conditions). Opens PRs with findings. Notifies via WeCom.
- **`auto-docs.yml`** (daily 05:00 UTC) — identifies documentation gaps from recent changes. Generates/updates README files. Opens PRs.

Trigger on demand: `gh workflow run auto-debug.yml` or via the **WeCom Automation Trigger** workflow.

Full reference: `docs/automations/README.md`

---

## 10. Documentation Map

- `README.md` — quick start, env setup
- `DEVELOPER_QUICK_REFERENCE.md` — canonical engineering guardrails, active vs legacy
- `PRODUCT_REQUIREMENTS.md` — product canon, terminology
- `docs/README.md` — architecture docs index
- `docs/automations/README.md` — CI automation system (auto-debug, auto-docs, WeCom)
- `apps/server/src/README.md` — server domain ownership
- `packages/shared/src/README.md` — shared package boundaries
- `.agents/skills/` — **OpenCode auto-discovered** skill tree (mirrors `.github/skills/`; kept in sync manually)
- `.github/skills/README.md` — canonical skill index for specific tasks
- `.github/skills/skill-taxonomy.md` — canonical skill classification (`ai-runtime` vs `internal`)
- `.opencode/agents/README.md` — OpenCode agent stubs (derived from `.github/agents/`)
- `.github/agents/README.md` — canonical full agent portfolio (30+ agents)
