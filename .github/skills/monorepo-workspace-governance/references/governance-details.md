# Governance Details and Normalization Reference

## tsconfig normalization

- `tsconfig.base.json` at the repo root defines shared `compilerOptions`
- Root `tsconfig.json` is a solution-style file with `references` to each workspace
- Each workspace extends `tsconfig.base.json` and adds workspace-specific settings
- User-client and admin-client currently run `typecheck` against their workspace `tsconfig.json`; `tsconfig.node.json` exists for node-specific tooling and is not invoked by the current `typecheck` script

## Script normalization

Workspace `package.json` files should expose:
- `dev` — local development server
- `build` — production build
- `typecheck` — TypeScript check
- `lint` — ESLint check
- `test` — workspace-owned test entry point (some workspaces still use placeholder scripts today)

Root scripts delegate via `npm run <script> -w @joyjoin/<workspace>`.

## Secret/env/legacy guardrails

Run `npm run guardrails` before pushing. CI runs the same check.

Rules enforced by `scripts/check-guardrails.mjs`:

- Only tracked env templates: `.env.example`, `deployment/.env.production.example`, `deployment/.env.staging.example`
- Real `.env` files must never be committed
- Legacy onboarding identifiers (`hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, `interestsTop`) must not appear in new active code
- If secrets from a tracked `.env` were ever committed, rotate `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `WECHAT_SECRET`, `ADMIN_CREATE_SECRET_KEY`

## Dependency ownership rules

- Each workspace declares its own `dependencies` and `devDependencies`
- Cross-workspace shared code lives in `packages/shared` — not duplicated across apps
- `packages/shared/package.json` declares `react` as a `peerDependency` and `@radix-ui/react-slot` + `lucide-react` as `dependencies` for shared UI exports
- Admin-only code and dependencies belong in `apps/admin-client` — not imported into `apps/user-client`

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
