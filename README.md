# JoyJoin Monorepo

This is the JoyJoin application monorepo, managed with **npm workspaces**.

## Repository structure

```
/
├── apps/
│   ├── user-client/     # React 18 + Vite PWA (user-facing, port 5001)
│   ├── admin-client/    # React 18 + Vite admin portal (port 5002, deployed to admin.yuejuapp.com)
│   └── server/          # Node.js + Express API server (port 5000)
├── packages/
│   └── shared/          # @joyjoin/shared — internal shared library
├── scripts/             # Repo-wide tooling scripts (guardrails, migration helpers)
├── docs/                # Architecture and feature documentation
├── deployment/          # Docker / Caddy deployment configs
├── tsconfig.base.json   # Shared TypeScript compiler options (extended by all workspaces)
└── tsconfig.json        # Solution-style TypeScript references file (root typecheck)
```

## Workspace purposes

| Workspace | Package name | Purpose |
|-----------|-------------|---------|
| `apps/user-client` | `@joyjoin/user-client` | User-facing React PWA |
| `apps/admin-client` | `@joyjoin/admin-client` | Internal admin portal |
| `apps/server` | `@joyjoin/server` | Express API, WebSocket, DB |
| `packages/shared` | `@joyjoin/shared` | Types, schemas, constants, domain logic shared across apps |

## Where shared code belongs

| Code type | Location |
|-----------|----------|
| Database schema (Drizzle) | `packages/shared/src/schema.ts` |
| WebSocket event contracts | `packages/shared/src/wsEvents.ts` |
| Personality / archetype engine | `packages/shared/src/personality/` |
| Shared constants and vocabularies | `packages/shared/src/constants.ts`, `districts.ts`, `occupations.ts`, etc. |
| UI primitives used by both clients | `packages/shared/src/ui/` |
| User-client-only components/hooks | `apps/user-client/src/` |
| Admin-client-only components/hooks | `apps/admin-client/src/` |
| API routes, services, DB queries | `apps/server/src/` |

**Import rule:** apps must import shared code via `@joyjoin/shared` (package name) or the `@shared/*` path alias. Direct imports from `shared/` (top-level legacy directory) are banned and enforced by the guardrails script.

## Getting started

### Prerequisites

```bash
node --version  # 20+
npm --version   # 10+
```

### Install dependencies

```bash
npm install  # installs all workspace dependencies from repo root
```

### Run apps locally

```bash
npm run dev:server  # start API server (port 5000)
npm run dev:user    # start user-client dev server (port 5001)
npm run dev:admin   # start admin-client dev server (port 5002)
```

### Database

```bash
npm run db:push     # sync Drizzle schema to database (requires DATABASE_URL in .env)
```

## Validation commands

Run these from the repo root before pushing:

```bash
npm run guardrails  # env files, secrets, legacy identifiers, import boundary checks
npm run typecheck   # TypeScript across all workspaces
npm run lint        # lint all workspaces
npm run test        # run tests across all workspaces
npm run check       # guardrails + typecheck (combined)
npm run dep-check   # verify workspace dependency ownership (root must have no deps)
```

## Dependency ownership rules

- **Root `package.json`** is orchestration-only — it contains **no `dependencies` or `devDependencies`**.
- Each workspace owns its own runtime and dev dependencies.
- Packages shared across workspaces are deduplicated automatically by npm workspace hoisting.

Run `npm run dep-check` to verify ownership is correct.

## Cross-app import rules

- Apps **must not** import source files from other apps.
- Reusable logic must live in `packages/shared`.
- These rules are enforced by `npm run guardrails`.

## Adding new shared code

1. Add the file under `packages/shared/src/`.
2. Export it from `packages/shared/src/index.ts` or add a named subpath export in `packages/shared/package.json`.
3. Import in apps via `@joyjoin/shared` or `@shared/your-module`.

## CI/CD

The GitHub Actions pipeline (`.github/workflows/cicd.yml`) runs on push to `main`:

1. **Guardrails** — env files, secrets, legacy identifiers, import boundaries
2. **Typecheck** — TypeScript for user-client, admin-client, and server
3. **AI simulation test** — runs 100 AI simulation iterations
4. **Deploy** — SSH deployment with Docker Compose + schema push

## Further documentation

- [`DEVELOPER_QUICK_REFERENCE.md`](./DEVELOPER_QUICK_REFERENCE.md) — canonical developer guide
- [`docs/`](./docs/) — architecture and feature documentation
- [`packages/shared/src/README.md`](./packages/shared/src/README.md) — shared package boundary rules
