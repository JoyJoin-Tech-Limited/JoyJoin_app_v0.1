---
name: monorepo-workspace-governance
description: >
  Root orchestration-only ownership, workspace dependency ownership, normalized scripts/tsconfig
  structure, and secret/env/legacy guardrails. Use when modifying root package.json, workspace
  configs, or adding/removing dependencies. Trigger phrases: "add a dependency", "change root
  scripts", "move code between workspaces", "update tsconfig", "guardrails is failing".
---

# Monorepo Workspace Governance

**Core rule:** The root `package.json` orchestrates but does not own runtime code. Each workspace owns its own dependencies, scripts, and tsconfig. The root enforces structure via guardrail scripts.

## When to use this skill

- Adding or updating a dependency
- Modifying a workspace `package.json` script
- Changing the root `package.json`
- Adding a new workspace or moving code between workspaces
- Updating `tsconfig` files

## Workspace boundaries

```
/                          ← Root (orchestration only)
├── apps/
│   ├── mini-program/      ← mini-program (launch-primary client)
│   ├── admin-client/      ← @joyjoin/admin-client
│   └── server/            ← @joyjoin/server
├── packages/
│   ├── shared/            ← @joyjoin/shared
│   └── e2e/               ← @joyjoin/e2e
└── [tooling dirs]         ← scripts/, docs/, deployment/, infra/
```

> **📘 Comprehensive blueprint:** See `docs/FOLDER_STRUCTURE.md` for the full directory map with domain ownership, active vs legacy status, and placement rules.

The root delegates to workspaces. It must not import or own runtime code. Required root scripts (enforced by `scripts/check/check-guardrails.mjs`) include `check`, `check:clients`, `check:server`, `check:full`, `set-admin`, and `guardrails`. Do not change these script names without updating the guardrail check.

Workspace `package.json` files should expose `dev`, `build`, `typecheck`, `lint`, and `test` scripts. Root scripts delegate via `npm run <script> -w @joyjoin/<workspace>`.

## Root ownership rules

- Each workspace declares its own `dependencies` and `devDependencies`
- Cross-workspace shared code lives in `packages/shared` — not duplicated across apps
- Admin-only code and dependencies belong in `apps/admin-client` — never imported into other apps
- Never use the deprecated `shared/` root folder; use `packages/shared/src/` instead

See [`references/governance-details.md`](references/governance-details.md) for tsconfig normalization, script naming conventions, secret/env/legacy guardrails, and dependency ownership rules.

## Quick examples

**User says:** "Add `date-fns` to the server package."
**Apply this skill by:** Running `npm install date-fns -w @joyjoin/server` from the repo root. Confirm `date-fns` appears in `apps/server/package.json`, not the root `package.json`. Run `npm run guardrails` to verify.
**Result:** Dependency is scoped correctly, root `package.json` stays orchestration-only.

---

**User says:** "I need to add a `db:seed` script accessible from the root."
**Apply this skill by:** Adding the script to `apps/server/package.json` first, then adding a root delegation (`npm run db:seed -w @joyjoin/server`) to root `package.json`. Check whether `check-guardrails.mjs` needs updating if the script name is required by guardrails.
**Result:** Script is accessible at the root without violating workspace ownership rules.

## Troubleshooting

- **`npm run guardrails` fails with "missing required script"** — a required root script was renamed or removed. Check `scripts/check/check-guardrails.mjs` for the expected script names and commands and restore the exact match.
- **Dependency installed to the wrong workspace** — a package was added to root `package.json` instead of the workspace that uses it. Move it: remove from root, add to the correct workspace with `-w @joyjoin/<workspace>`.
- **TypeScript errors after changing `tsconfig`** — workspace `tsconfig.json` may have lost its `extends` reference to `tsconfig.base.json`, or a new workspace path is missing from the root `tsconfig.json` `references` array.
- **Admin-client code is being bundled into mini-program** — a direct import from `apps/admin-client` was added to `apps/mini-program`. Remove it and move the shared logic to `packages/shared` if needed.
- **Legacy identifiers in new code** — `scripts/check/check-guardrails.mjs` flags `hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, and `interestsTop`. Remove or quarantine these identifiers in active code.
- **Shared package missing a peer dependency** — `packages/shared/package.json` declares `react` as a `peerDependency` and `@radix-ui/react-slot` + `lucide-react` as `dependencies` for shared UI exports. Add shared UI primitives there, not in individual apps.

## Review checklist

- [ ] New dependencies are added to the workspace that uses them, not the root
- [ ] Root `package.json` does not own any runtime dependencies
- [ ] Guardrail-enforced root scripts (`check`, `check:clients`, `check:server`, `check:full`, `set-admin`) are present and match exact commands
- [ ] `npm run guardrails` passes after the change
- [ ] `tsconfig` references are up to date if new workspaces were added
- [ ] No cross-app imports (user-client ↔ admin-client)
