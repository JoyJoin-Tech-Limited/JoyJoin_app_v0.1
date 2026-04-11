# Contributing to JoyJoin

This repo has multiple workspaces, active-versus-legacy guardrails, and a shared skills/agents system. Use the references below before making changes in an unfamiliar area.

## Start here

Read these documents in order:

1. [`DEVELOPER_QUICK_REFERENCE.md`](./DEVELOPER_QUICK_REFERENCE.md) — canonical engineering guardrails and quick start
2. [`PRODUCT_REQUIREMENTS.md`](./PRODUCT_REQUIREMENTS.md) — current product canon and terminology
3. [`docs/README.md`](./docs/README.md) — domain docs index

## Pick the right guidance

- **Need architecture or code-placement guidance?** Start with [`.github/skills/README.md`](./.github/skills/README.md).
- **Need a focused agent for a workflow?** Check [`.github/agents/README.md`](./.github/agents/README.md).
- **Working in the server?** Read [`apps/server/src/README.md`](./apps/server/src/README.md).
- **Working on active onboarding?** Read [`apps/user-client/src/features/onboarding/README.md`](./apps/user-client/src/features/onboarding/README.md).
- **Adding shared code?** Read [`packages/shared/src/README.md`](./packages/shared/src/README.md).

## Workflow expectations

1. Confirm the target area is active, not legacy.
2. Read the relevant skill before changing code in that domain.
3. Keep shared logic in `packages/shared` and app-specific logic in the owning workspace.
4. Update documentation when the public interface, architecture, or contributor workflow changes.
5. Review your change using the Harness Engineering Framework via [`.github/skills/code-review/SKILL.md`](./.github/skills/code-review/SKILL.md).

## Validation before push

Run the smallest set of checks that covers your change, and prefer the full repo checks before merging:

```bash
npm run guardrails
npm run typecheck
npm run test
```

Add workspace-specific checks when needed, for example:

```bash
npm run test -w @joyjoin/server
npm run test -w @joyjoin/user-client
```

## Documentation expectations

- Canonical engineering docs live in [`DEVELOPER_QUICK_REFERENCE.md`](./DEVELOPER_QUICK_REFERENCE.md) and [`docs/architecture/current-state.md`](./docs/architecture/current-state.md).
- Do not revive legacy flows or deprecated terminology from old files, archived docs, or git history.
- If a doc is historical, label it clearly and point readers to the active replacement.

## Pull request expectations

- Explain the problem being solved and the affected domain.
- Note any architecture, API, or workflow changes that required doc updates.
- Call out risks in reliability, scalability, security, observability, and maintainability.
- Include validation notes for the commands or tests you ran.
