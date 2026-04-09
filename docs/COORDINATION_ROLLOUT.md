# Coordination Rollout

## Week 1 — Visible signaling only
- Add `.platform` markers to coordinated roots.
- Share the `scripts/platform-map.json` convention with the team.
- Ask reviewers to run `npm run impact-check -- <file>` when touching payment or auth work.

## Week 2 — Non-blocking local reminders
- Enable `.githooks/pre-commit` locally with `git config core.hooksPath .githooks`.
- Keep the hook warning-only so contributors see sibling-platform impact without losing flow.
- Encourage developers to run `npm run impact-check:staged` before pushing.

## Week 3 — Shared API contracts and CI enforcement
- Treat `packages/shared/src/api-types/` as the source of truth for coordinated request/response contracts.
- Run `npm run guardrails:platform -- --changed <base> <head>` in CI for PRs and pushes.
- Fail CI when PRIMARY files change without a sibling review signal or when inline coordinated API types reappear outside `packages/shared/src/api-types/`.

## Week 4 — ESLint tightening
- Keep `platform-boundaries/no-direct-platform-api` and `platform-boundaries/require-sibling-update` at `warn` while the team adapts.
- Promote both rules to `error` after a full sprint of clean runs.
- Expand `scripts/platform-map.json` to new coordinated features only after each pair has a clear PRIMARY/SECONDARY owner.
