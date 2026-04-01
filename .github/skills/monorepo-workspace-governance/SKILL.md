---
name: Monorepo Workspace Governance
description: Root orchestration-only ownership, workspace dependency ownership, normalized scripts/tsconfig structure, and secret/env/legacy guardrails. Use when modifying root package.json, workspace configs, or adding/removing dependencies.
---

# Monorepo Workspace Governance

**Core rule:** The root `package.json` orchestrates but does not own runtime code. Each workspace owns its own dependencies, scripts, and tsconfig. The root enforces structure via guardrail scripts.

## When to use this skill

- Adding or updating a dependency
- Modifying a workspace `package.json` script
- Changing the root `package.json`
- Adding a new workspace or moving code between workspaces
- Updating `tsconfig` files

## Workspace layout

```
/                          ← Root (orchestration only)
├── apps/
│   ├── user-client/       ← @joyjoin/user-client
│   ├── admin-client/      ← @joyjoin/admin-client
│   └── server/            ← @joyjoin/server
└── packages/
    └── shared/            ← @joyjoin/shared
```

## Root package.json — orchestration only

The root delegates to workspaces. It must not import or own runtime code.

Required root scripts (enforced by `scripts/check-guardrails.mjs`):

| Script | Purpose |
|--------|---------|
| `check` | Aliases `typecheck` across workspaces |
| `check:clients` | TypeScript check for both client workspaces |
| `check:server` | TypeScript check for server workspace |
| `check:full` | Full typecheck across all workspaces |
| `set-admin` | Delegates to the server `admin:create` CLI |
| `guardrails` | Runs `scripts/check-guardrails.mjs` |

Do not change these script names or their delegated commands without updating the guardrail check.

## Workspace dependency ownership

- Each workspace declares its own `dependencies` and `devDependencies`
- Cross-workspace shared code lives in `packages/shared` — not duplicated across apps
- `packages/shared/package.json` declares `react` as a `peerDependency` and `@radix-ui/react-slot` + `lucide-react` as `dependencies` for shared UI exports
- Admin-only code and dependencies belong in `apps/admin-client` — not imported into `apps/user-client`

## tsconfig normalization

- `tsconfig.base.json` at the repo root defines shared `compilerOptions`
- Root `tsconfig.json` is a solution-style file with `references` to each workspace
- Each workspace extends `tsconfig.base.json` and adds workspace-specific settings
- User-client and admin-client workspaces run typecheck against **both** `tsconfig.json` and `tsconfig.node.json` (see workspace `package.json` typecheck script)

## Script normalization

Workspace `package.json` files should expose:
- `dev` — local development server
- `build` — production build
- `typecheck` — TypeScript check
- `lint` — ESLint check
- `test` — vitest or equivalent

Root scripts delegate via `npm run <script> -w @joyjoin/<workspace>`.

## Env, secrets, and legacy guardrails

Run `npm run guardrails` before pushing. CI runs the same check.

Rules enforced by `scripts/check-guardrails.mjs`:

- Only tracked env templates: `.env.example`, `deployment/.env.production.example`, `deployment/.env.staging.example`
- Real `.env` files must never be committed
- Legacy onboarding identifiers (`hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, `interestsTop`) must not appear in new active code
- If secrets from a tracked `.env` were ever committed, rotate `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `WECHAT_SECRET`, `ADMIN_CREATE_SECRET_KEY`

## Adding a new dependency

1. Add to the specific workspace that uses it, not the root
2. Run `npm install` from the repo root (npm workspaces resolves correctly)
3. For shared UI primitives accessible to all apps, add to `packages/shared`
4. Check for security advisories before adding new packages

## Common mistakes to avoid

- Adding a runtime dependency to the root `package.json`
- Copying a package into multiple workspaces instead of sharing via `packages/shared`
- Importing admin-client code into user-client (inflates the user bundle)
- Removing or renaming required root scripts without updating `check-guardrails.mjs`
- Using the deprecated `shared/` root folder — use `packages/shared/src/` instead

## Related files

- `package.json` — root orchestration
- `tsconfig.json` — solution-style root config
- `tsconfig.base.json` — shared compiler options
- `scripts/check-guardrails.mjs` — guardrail enforcement
- `apps/*/package.json` — workspace configs
- `packages/shared/package.json` — shared package config
- `DEVELOPER_QUICK_REFERENCE.md` — guardrail runbook
