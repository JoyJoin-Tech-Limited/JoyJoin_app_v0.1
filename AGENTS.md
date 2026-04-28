# JoyJoin — Agent Onboarding Guide

> This file is written for AI coding agents. Assume the reader knows nothing about the project.
> Last updated: 2026-04-21

---

## 1. Project Overview

JoyJoin (悦聚) is a social-matching and events platform. Users take a personality assessment, discover event "pools" (blind-box style gatherings), register, and get algorithmically matched into small groups. The platform supports a user-facing web app, an admin portal, a WeChat Mini Program (launch-primary client), and a shared backend API.

This repository is a **monorepo** managed with **npm workspaces**.

---

## 2. Technology Stack

| Layer | Technology |
|-------|------------|
| Package manager | npm 10+ (workspaces) |
| Runtime | Node.js 20+ |
| Language | TypeScript 5.6+ (strict, ESM everywhere) |
| User web app | React 18, Vite 5, Tailwind CSS 3, Radix UI, wouter (routing), TanStack Query |
| Admin web app | React 18, Vite 5, Tailwind CSS 3, Radix UI, Recharts |
| WeChat Mini Program | Taro 4.2 + React 18, Sass |
| Backend | Express 4, WebSocket (`ws`), Drizzle ORM, Zod |
| Database | PostgreSQL 15+ (hosted; Neon or self-managed) |
| AI / LLM | DeepSeek (OpenAI-compatible API), OpenAI SDK |
| Payments | WeChat Pay v3 (optional, feature-flagged) |
| Maps | Gaode (AMap) — admin venue tooling only |
| Tests | Vitest (server has the bulk of tests; clients have no-op placeholders) |
| Build tools | Vite (clients), esbuild (server bundle), Taro CLI (mini-program) |
| Deployment | Docker Compose, host Nginx, GitHub Actions CI/CD |
| Observability | Prometheus metrics, structured logging, Loki/Grafana configs in `infra/` |

---

## 3. Repository Structure

```
/
├── apps/
│   ├── user-client/       # @joyjoin/user-client — React PWA (port 5001)
│   ├── admin-client/      # @joyjoin/admin-client — admin portal (port 5002)
│   ├── server/            # @joyjoin/server — Express API + WebSocket (port 5000)
│   └── mini-program/      # mini-program — Taro WeChat Mini Program
├── packages/
│   └── shared/            # @joyjoin/shared — schemas, types, constants, personality engine, UI primitives
├── scripts/               # Repo-wide tooling (guardrails, migration helpers, simulations)
├── docs/                  # Architecture docs, runbooks, feature specs
├── deployment/            # Docker Compose, Nginx configs, env templates
├── infra/                 # Prometheus, Grafana, Loki, Alertmanager configs
├── migrations/            # Drizzle migration files (in apps/server/migrations/)
├── .github/
│   ├── workflows/         # CI/CD pipelines
│   ├── agents/            # Custom agent definitions for AI orchestration
│   └── skills/            # Reusable skill definitions for AI orchestration
├── tsconfig.json          # Solution-style TypeScript project references
├── package.json           # Root orchestration (no dependencies allowed here)
└── .env / .env.example    # Local environment file (never commit .env)
```

### Key workspace boundaries

- **Root `package.json`** is orchestration-only. It must contain **no `dependencies` or `devDependencies`**.
- Each workspace owns its own runtime and dev dependencies.
- Apps **must not** import source files from other apps. Reusable logic belongs in `packages/shared`.
- Shared code must be imported via `@joyjoin/shared` (or path aliases like `@shared/*`). Direct imports from the legacy top-level `shared/` directory are banned and enforced by guardrails.

---

## 4. Build and Development Commands

Run all commands from the repo root unless noted otherwise.

### Installation and first-time setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Create local environment file
cp .env.example .env
# Edit .env: set DATABASE_URL, SESSION_SECRET, ADMIN_CREATE_SECRET_KEY, WECHAT_APPID, WECHAT_SECRET

# 3. Push database schema (safe mode — say No to destructive prompts)
npm run db:push

# 4. Create first admin account (required for admin portal access)
npm run admin:create -- <username> <password> "$ADMIN_CREATE_SECRET_KEY" super_admin "Local Admin"
```

### Development servers

```bash
npm run dev:server   # Express API on port 5000 (loads ../../.env via --env-file)
npm run dev:user     # User client on port 5001
npm run dev:admin    # Admin client on port 5002
npm run dev:weapp --workspace=mini-program   # Taro WeChat dev build with watch
```

### Build

```bash
npm run build           # Build user-client + admin-client + server
npm run build:user      # Build user-client only
npm run build:admin     # Build admin-client only
npm run build:server    # Build server only (esbuild bundles src/index.ts → dist/index.js)
```

### Type checking and linting

```bash
npm run typecheck        # TypeScript across all workspaces
npm run check:clients    # TypeScript for shared + user-client + admin-client + mini-program
npm run check:server     # TypeScript for server only
npm run lint             # Alias for typecheck across workspaces
npm run check:full       # Guardrails + lint + tests + build
```

### Database

```bash
npm run db:push          # Sync Drizzle schema to DB (local dev only; safe mode)
npm run db:generate      # Generate migration SQL files from schema changes
npm run db:migrate       # Run pending migrations (production & CI)
npm run db:verify        # Verify schema.ts matches live DB (CI gate)
npm run db:journal-check # Ensure all .sql migrations are in _journal.json
npm run db:rebuild-journal # Rebuild _journal.json from migration files
npm run db:status        # Run journal-check + verify
npm run db:studio        # Open Drizzle Studio GUI
```

**Migration discipline:**
- Local dev: Use `db:push` to quickly sync schema changes.
- Before committing: Run `db:generate` to create a proper migration file, then `db:rebuild-journal` to register it.
- Production/CI: Only `db:migrate` is used. `db:push` is banned in production.
- CI gate: `db:verify` runs after every deploy to ensure repo and DB are aligned.

### Testing

```bash
npm run test             # Run tests across all workspaces
npm run test -w @joyjoin/server     # Server tests only (vitest)
```

### Validation and guardrails

```bash
npm run guardrails       # Check env files, secrets, legacy identifiers, import boundaries
npm run dep-check        # Verify root has no deps and workspaces own their dependencies
npm run orchestration:validate      # Validate .github/orchestration.yaml
```

---

## 5. Code Style and Conventions

### Language
- **Code and documentation:** English.
- **User-facing copy:** Chinese (Simplified). Product terms and archetype names are Chinese (e.g., 开心柯基, 太阳鸡).

### TypeScript
- ESM only (`"type": "module"` in all workspace `package.json` files).
- Strict TypeScript is enabled in all workspaces.
- Solution-style project references are used; the root `tsconfig.json` references each workspace.

### Naming and structure
- React components: PascalCase (`EventCard.tsx`).
- Server services and utilities: camelCase (`poolMatchingService.ts`).
- Database schema and shared types: defined in `packages/shared/src/schema.ts` and `packages/shared/src/types/`.
- Path aliases:
  - `@shared/*` → `packages/shared/src/*` (used in all apps)
  - `@/*` → `src/*` (used in client apps and mini-program)

### Import rules (enforced by guardrails)
- Import shared code via `@joyjoin/shared` or `@shared/*`.
- Do **not** import across apps (e.g., `user-client` must not import from `admin-client`).
- Do **not** import from the legacy top-level `shared/` directory.

### Server file placement rules
- New HTTP endpoints in an existing domain → `apps/server/src/routes/domains/<domain>.ts`.
- New isolated subdomain router → `apps/server/src/routes/<router>.ts`.
- Business logic reused by routes → service file in `apps/server/src/` or a domain subfolder.
- Cross-cutting helpers → `apps/server/src/lib/`.
- Middleware → `apps/server/src/middleware/`.
- Database queries → `apps/server/src/repositories/` (do not add new query logic to `storage.ts`).

### Shared package file placement rules
- New DB table or shared model → `packages/shared/src/schema.ts`.
- New cross-app type → `packages/shared/src/types/`.
- New shared constant/taxonomy → place in the closest existing domain file.
- New personality or matching reference → `packages/shared/src/personality/`.
- New shared UI primitive → `packages/shared/src/ui/`.
- Export new contracts intentionally from `packages/shared/src/index.ts` or add a named subpath export in `packages/shared/package.json`.

---

## 6. Testing Strategy

| Workspace | Test framework | Test location | Notes |
|-----------|---------------|---------------|-------|
| `@joyjoin/server` | Vitest (Node environment) | `apps/server/src/__tests__/` | The bulk of automated tests live here. |
| `@joyjoin/user-client` | No-op | — | `npm run test` prints "No tests for @joyjoin/user-client" |
| `@joyjoin/admin-client` | No-op | — | Same no-op placeholder. |
| `mini-program` | Vitest (Node environment) | `src/**/*.{test,spec}.ts(x)` | Limited test coverage. |
| `@joyjoin/shared` | No-op | — | Same no-op placeholder. |

### Running tests
```bash
npm run test -w @joyjoin/server     # Run server test suite
npm run test -w mini-program        # Run mini-program tests
```

### CI testing
The GitHub Actions pipeline runs `npm run test -w @joyjoin/server` after guardrails and type checks, and before the AI simulation test and deployment.

---

## 7. Security and Guardrails

### Environment and secrets
- Never commit a real `.env` file. The only tracked templates are `.env.example`, `deployment/.env.production.example`, and `deployment/.env.staging.example`.
- Rotate secrets if you previously copied from an old tracked `.env`.

### Guardrail checks (`npm run guardrails`)
The guardrails script enforces:
- No committed `.env` files with real secrets.
- No legacy onboarding identifiers in active code (`hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, `interestsTop`).
- No imports from the legacy `shared/` root directory.
- No cross-app imports.

### Admin security
- Admin accounts are stored in the `admin_accounts` table (username/password with bcrypt).
- Admin creation requires `ADMIN_CREATE_SECRET_KEY` via CLI.
- Admin sessions are Express-session based; there is no `ADMIN_API_KEY` for normal requests.
- All `/api/admin/*` routes must enforce admin middleware.

### Auth and local dev helpers
- Phone login demo code in local development: `666666`.
- Dev auth tools are gated by `ENABLE_DEV_AUTH_TOOLS` and `DEBUG_AUTH` env vars.
- Bypass login CLI: `npm run user:bypass <phoneNumber> "$ADMIN_CREATE_SECRET_KEY"`.

---

## 8. Deployment

### Production topology
- Host: self-managed remote server.
- Edge: host Nginx (`deployment/nginx/joyjoin.conf`) terminating TLS for:
  - `yuejuapp.com`, `www.yuejuapp.com` (user client)
  - `admin.yuejuapp.com` (admin client)
  - `api.yuejuapp.com` (API)
- Containers: Docker Compose (`deployment/docker-compose.nginx.yml`) runs:
  - `joyjoin-api` (server)
  - `joyjoin-user` (user-client static files served by nginx)
  - `joyjoin-admin` (admin-client static files served by nginx)
- PostgreSQL is external; the deployment compose does **not** include a DB service.

### CI/CD pipeline (`.github/workflows/cicd.yml`)
On every push to `main`:
1. **Guardrails** — env/secrets/legacy/import checks + workspace dependency ownership + skill routing validation.
2. **Type checks** — shared, user-client, admin-client, server (parallel).
3. **Server tests** — Vitest suite.
4. **AI simulation test** — 100-iteration simulation run against DeepSeek API.
5. **Deploy** — SSH to production host, reset repo, build Docker images, reload Nginx, run migrations, push schema, health checks.

### Build artifacts
- Server: `apps/server/dist/index.js` (esbuild ESM bundle).
- User client: `apps/user-client/dist/` (Vite static build).
- Admin client: `apps/admin-client/dist/` (Vite static build).
- Mini program: `apps/mini-program/dist/` (Taro build; not part of Docker Compose deploy).

---

## 9. Key Architectural Rules

### Active flow authority
- Always base implementation on the **current active codebase**, not legacy flows or old git history.
- Legacy items to avoid: 14-archetype V1/V2, `/chats` surface, DM UI, `圈子` nav label, `会员/VIP会员` copy, root `shared/` imports, `/guide` as core onboarding.
- The canonical reference for active vs. legacy is `DEVELOPER_QUICK_REFERENCE.md` and `PRODUCT_REQUIREMENTS.md`.

### Onboarding is server-driven
- `GET /api/auth/user` returns `nextStep`, `profileEssentialComplete`, `profileExtendedComplete`.
- The client never computes its own onboarding position.
- Active onboarding steps after WeChat login: `/onboarding/setup` → `/onboarding/extended` → `/onboarding/review` → `/discover`.
- **Xiaoyue chat-based onboarding is deprecated.** Xiaoyue lives on only as a mascot character (visual expressions, loading animations, empty states). Do not implement or reference conversational chat as a core onboarding path.

### Personality system
- Current system: **12 archetypes**, V4 adaptive assessment (8–16 questions), ACOEXP 6-trait model.
- MatcherV2 is the deterministic authority for archetype assignment.
- `packages/shared/src/personality/` owns the engine; `packages/shared/src/archetypeColors.ts` owns color tokens.

### Matching system
- `poolMatchingService.ts` is the deterministic authority for group formation.
- Pair compatibility uses 6 dimensions by default (chemistry, interest, socialAffinity, backgroundDiversity, preference, language), with an optional 7th semantic-similarity dimension behind `ENABLE_SEMANTIC_SIMILARITY`.
- AI explanation layers may enrich output but must not redefine deterministic scoring rules.

### Social Icebreaker
- Primary in-event flow: `/icebreaker/:sessionId` → `Social Icebreaker` (`/api/social-icebreaker/*`).
- Do **not** direct users to `/icebreaker-game` (AI Card Game) as the first/default experience; it is an optional deep-dive.
- The IcebreakerToolkit is legacy; do not add new Toolkit CTAs.

### Mini-program is launch-primary
- `apps/mini-program` is the launch-primary client. Web (`apps/user-client`) is the sandbox.
- Cross-surface coordination rules are in `docs/PLATFORM_COORDINATION.md`.

---

## 10. Environment Variables Reference

The repo-root `.env` is loaded by the server and CLI tools. Frontend Vite env vars are set in per-app `.env.local` files or exported in the shell.

| Variable | Required? | Used by | Description |
|----------|-----------|---------|-------------|
| `NODE_ENV` | Yes | All | `development` or `production` |
| `PORT` | Yes | Server | API port (default 5000 locally) |
| `APP_URL` | Yes | Server | Base URL for auth/payment flows |
| `DATABASE_URL` | Yes | Server | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Server | Express session secret |
| `WECHAT_APPID` | Yes | Server | WeChat Mini Program App ID |
| `WECHAT_SECRET` | Yes | Server | WeChat Mini Program secret |
| `ADMIN_CREATE_SECRET_KEY` | Yes | CLI / dev | Secret for `admin:create`, `user:create`, `user:bypass` |
| `DEEPSEEK_API_KEY` | No | Server | AI features (semantic embeddings, event titles, icebreakers) |
| `PAYMENTS_ENABLED` | No | Server | Set `true` to enable WeChat Pay |
| `WECHAT_PAY_*` | No | Server | Multiple WeChat Pay v3 credentials |
| `AMAP_API_KEY` | No | Admin | Gaode Maps venue tooling |
| `VITE_ADMIN_PORTAL_URL` | No | User client | Admin portal redirect URL |
| `VITE_API_URL` | No | Clients | Custom API base (normally leave unset so Vite proxy works) |
| `ENABLE_DEV_AUTH_TOOLS` | No | Server | Enables non-production auth helpers |
| `DEBUG_AUTH` | No | Server | Extra auth logging |
| `ENABLE_SEMANTIC_SIMILARITY` | No | Server | 7th matching dimension |
| `COOKIE_DOMAIN` | No | Server | Cookie domain override |

---

## 11. Observability and Ops

| Concern | Location |
|---------|----------|
| Structured logging | `apps/server/src/lib/logger.ts` — use `logger.info/warn/error()`, avoid `console.*` in request handlers |
| Request correlation | `apps/server/src/middleware/requestId.ts` |
| Prometheus metrics | `apps/server/src/middleware/metrics.ts` + `GET /api/metrics` |
| Health check | `GET /api/health` |
| Readiness probe | `GET /api/readyz` |
| Admin audit log | `apps/server/src/lib/adminAuditLogger.ts` |
| Synthetic probe | `scripts/synthetic/happy-path-probe.mjs` (GitHub Actions schedule) |

---

## 12. Documentation Index

Start here when you need deeper context:

1. `README.md` — Monorepo structure, quick start, env setup.
2. `DEVELOPER_QUICK_REFERENCE.md` — Canonical engineering guardrails, active-flow rules, monorepo quick start, personality system, matching formulas, UI architecture.
3. `PRODUCT_REQUIREMENTS.md` — Product canon, terminology, active feature expectations.
4. `docs/README.md` — Topic index for architecture, onboarding, AI, observability, platform coordination, and design docs.
5. `apps/server/src/README.md` — Server domain ownership and file placement rules.
6. `packages/shared/src/README.md` — Shared package boundary rules.
7. `CONTRIBUTING.md` — Contributor workflow, validation checklist, skills, agents, and review expectations.
8. `.github/AI_WORKFLOW_POLICY.md` — AI workflow routing and delivery lanes.
9. `.github/ORCHESTRATION_GOVERNANCE.md` — Rules for changing agents, skills, and orchestration runtime.

---

## 13. Agent Swarm (Kimi Code)

This repo maintains a native agent orchestration layer under `.github/agents/` and `.github/skills/`. When using **Kimi Code**, these capabilities are bridged into Kimi's skill system via `.agents/skills/` (symlinks to `.github/skills/*/`).

### Delivery Lanes

| Lane | Use when | Entry point |
|---|---|---|
| **Direct delivery** | Bounded task, known surfaces, straightforward path | State a micro-plan, then implement |
| **Kickoff lane** | Broad, ambiguous, cross-workspace, or approval-first | `Researcher` → `Planner` (or `Supervisor` first to auto-sequence) |
| **Deliberation lane** | Cross-domain architecture, high blast radius, or multi-perspective review | `Deliberation Moderator` → `Supervisor` / `Planner` |
| **Harness lane** | Engineering quality must be pre-validated against the 5 Harness pillars; core engine changes; explicit Harness request | `Harness Runtime Controller` → `Supervisor` / `Planner` / `Auto-Eval` |
| **Operational lane** | Validation, release risk, dirty-worktree review | `Auto-Eval`, `QA Agent`, `Launch Readiness Agent` |

**Rule:** Every task starts with an explicit planning check. Do not skip planning.

### Agent Roster

**Core orchestration agents** (native handoff graph):

| Agent | Role | Trigger |
|---|---|---|
| `Supervisor` | Route the next specialist; sequence kickoff when needed | Broad or midstream rerouting |
| `Researcher` | Gather repo context, files, ambiguities before planning | Kickoff research |
| `Planner` | Convert research into approval-first execution plan | After `Researcher` |
| `Auto-Eval` | Dirty-worktree quality gate, local sign-off | Before handoff, after edits |
| `Product Manager` | PRDs, acceptance criteria, backlog artifacts | Product scope refresh |
| `Backend Engineer` | Server implementation in `apps/server` | Backend work |
| `AI Engineer` | Runtime AI, prompts, fallback, trace safety | LLM-backed features |
| `QA Agent` | Smoke validation, regression checklist | Stateful flows, auth, payment |
| `Launch Readiness Agent` | Go/no-go, release blockers, risk review | Production rollout |

**Audited support agents** (manual invocation):

| Agent | Role |
|---|---|
| `Expert React Frontend Engineer` | Web UI in `apps/user-client` |
| `Taro Mini-Program Frontend Engineer` | Mini-program UI in `apps/mini-program` |
| `Taro Migration Specialist` | Web-to-mini-program migration |
| `Mini-Program Parity Auditor` | Cross-platform parity review |
| `Database Schema & Migration Auditor` | Schema evolution safety |
| `debug` | Root-cause investigation |
| `Verifier` | Skeptical completion check |
| `Repo Memory Steward` | Durable memory candidate drafting |
| `Game Design Agent` / `Game Development Agent` | Icebreaker game lifecycle |
| `MiniScript Story Agent` | Mini-script story framework |
| `Deliberation Moderator` | Multi-perspective architecture/design review |

### Skill Quick Reference

Kimi Code auto-triggers skills from `.agents/skills/` based on `name` + `description` frontmatter.

| Question | Skill |
|---|---|
| Review a PR | `code-review` |
| Add a new API route | `server-domain-architecture` |
| Add a database model | `backend-models-standards` + `database-migration-safety` |
| Gate a route for admin | `auth-session-and-safety-boundaries` |
| Add an LLM call safely | `llm-runtime-safety-and-integration` |
| Create an event pool | `event-pool-and-matching-operations` |
| Work with matching logic | `matching-domain` |
| Build icebreaker sessions | `social-icebreaker-domain` |
| Add frontend components | `frontend-component-architecture` + `design-system-governance` |
| Mini-program UI work | `mini-program-frontend-excellence` |
| Monorepo dependency questions | `monorepo-workspace-governance` |
| Cross-platform coordination | `platform-coordination-protocol` |
| Write a PRD | `draft-prd` |
| Sync docs after changes | `docs-sync` |

Full index: `.github/skills/README.md`

### Harness Engineering Framework (Implementation Phase)

JoyJoin uses a **3-tier Harness** to embed quality engineering into the implementation flow, inspired by Anthropic's harness design for long-running agents.

**The core pattern:** Before coding on Tier 2+ tasks, the Implementer (Generator) and Verifier negotiate a **Sprint Contract** — a file-based artifact that defines what "done" looks like with testable criteria and hard thresholds. QA Agent evaluates the implementation against this contract. Any criterion miss fails the sprint.

| Tier | Cost | When | Flow |
|------|------|------|------|
| **Tier 1** | ~$0 (baseline) | Small fixes, ≤50 lines, 1 workspace | Implement → `npm run harness:gate` + Auto-Eval |
| **Tier 2** | ~$0.50–$2 (1.3–1.7×) | New routes, multi-file, auth, stateful ops | Sprint Contract draft → Verifier review → implement → QA Agent Sprint Evaluation (hard thresholds) |
| **Tier 3** | ~$10–$25 (5–10×) | Core engine, payment, major refactor | Harness Runtime Controller deliberation (PGE → Council → Consensus) → locked contract → implement → QA Agent + Verifier |

**Sprint Contract:** Stored at `.git/.orchestration/sprints/sprint-contract.{taskId}.md`. Contains goal, acceptance criteria, Harness pillar criteria, out-of-scope, verification method, and negotiation log.

**Scripts:**
- `node scripts/select-harness-tier.mjs` — deterministic tier router
- `node scripts/evaluate-sprint-contract.mjs --contract=<path>` — contract vs. diff validation
- `node scripts/evaluate-api-drift.mjs` — Zod schema / route handler drift detection
- `node scripts/harness-full.mjs --contract=<path>` — Tier 3 orchestrator

**Agent behavior changes:**
- Implementing engineers write Sprint Contracts before editing files on Tier 2+ tasks.
- Verifier gains a "Contract Evaluator" mode for reviewing draft contracts.
- QA Agent gains a "Sprint Evaluation" mode for grading implemented contracts.

Full spec: `docs/proposals/harness-consensus-plan.md`

---

### Turn Reporting

When acting as a repo agent:
- End every turn with a compact JSON summary (`agent_turn_summary`)
- Include: delivered, files changed, decisions, blockers, learned, next steps, confidence
- `Supervisor` consolidates child summaries into `supervisor_turn_report`
- Visible notes use **executive briefing** shape: Observation / Implication / Next Step / Bottom Line
- Full schema: `.github/skills/orchestration-turn-reporting/SKILL.md`

### Validation Commands

```bash
# Contract + manifest alignment
npm run orchestration:validate

# Skill routing metadata
node scripts/validate-skill-routing.mjs
node scripts/test-skill-routing.mjs

# Turn-summary tests
npm run orchestration:test

# Simulate a broad prompt → should recommend Researcher -> Planner
env ORCHESTRATION_DISABLE_RUNTIME_WRITES=1 \
  node scripts/orchestration-supervisor.mjs copilot-hook user-prompt-submit \
  <<< '{"prompt":"Add a new API endpoint with caching"}'
```
