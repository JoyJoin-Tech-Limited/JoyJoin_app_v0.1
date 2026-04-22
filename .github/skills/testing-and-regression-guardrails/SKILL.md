---
name: testing-and-regression-guardrails
description: >
  Focused regression tests, invariant tests, structural tests, and CI scripts to lock in cleanup
  and architecture decisions. Use when adding tests for boundaries, invariants, or recently
  cleaned-up behaviour. Trigger phrases: "add a regression test", "lock in this boundary",
  "write an invariant test", "guardrails is failing in CI", "which workspace does this test
  belong in?".
---

# Testing and Regression Guardrails

**Core rule:** Tests in this repo serve three purposes: verifying correctness, locking in architectural decisions, and, when practical, capturing expected behaviour before code changes land. When a boundary is established or a cleanup is completed, add a test to prevent regression.

## When to use this skill

- Adding a regression test after fixing a bug or completing a cleanup
- Writing a test to enforce an architectural invariant (e.g. signal boundary, module ownership)
- Adding a structural test that verifies file placement or import rules
- Setting up a CI guardrail script for a convention that should not regress

## Default stance on TDD

- Prefer red-green-refactor for deterministic business logic, bug fixes, and stateful workflows when the failure can be expressed as an automated check.
- For bounded work, a failing unit, integration, or structural test is the preferred starting point when the harness already exists.
- If strict test-first work is impractical, record why before changing production code. Common reasons include missing harnesses, flaky external dependencies, or UI-only reproduction paths.
- When you cannot start with a failing automated check, add the narrowest regression test immediately after the fix and keep the reproduction steps explicit in the change notes.

## Test infrastructure

Tests use **Vitest** in the workspaces that currently have active test suites, but not every workspace `test` script invokes Vitest yet.

### MCP-assisted verification

- **Playwright MCP:** For regression tests that cover browser-based user journeys (onboarding, event discovery, payment flows), use the **Playwright MCP server** (`playwright`) to automate navigation, form interaction, and visual verification. This complements Vitest unit tests with flow-level validation.
- **WeChat DevTools MCP:** For mini-program regression coverage, use the **WeChat DevTools MCP server** (`wechat-devtools`) to automate page navigation, element tapping, and WXML inspection within the WeChat Mini Program runtime.

```bash
# Run server tests
npm run test -w @joyjoin/server

# Run a specific test file
npm run test -w @joyjoin/server -- src/__tests__/poolMatchingService.test.ts

# Run user-client Vitest suites directly (the workspace `test` script is still a placeholder)
npx vitest run --config apps/user-client/vitest.config.ts
```

Workspace-specific test files:
- `apps/server/src/__tests__/` — server unit and integration tests
- `apps/user-client/src/features/onboarding/active/__tests__/` — onboarding flow tests
- `apps/user-client/src/hooks/__tests__/` — hook tests

Current script reality:
- `npm run test -w @joyjoin/server` runs the active server Vitest suite
- `npm run test -w @joyjoin/user-client` is currently a placeholder script, even though `apps/user-client` contains active Vitest tests
- `@joyjoin/shared` and `@joyjoin/admin-client` currently use placeholder `test` scripts

## Types of tests

### Correctness tests
Verify that a function or API behaves correctly for known inputs.
- Pool matching scoring, group formation, chemistry calculations
- Payment service charge and refund logic
- Auth flow responses

### Invariant tests
Assert that a boundary cannot be crossed, regardless of future code changes.
- `interestSignalBoundary.test.ts` — `user_interest_signals` must not appear in deterministic scoring
- Auth RBAC coverage tests — every admin route must be covered by `requireAdmin`
- Route modularization tests — domain routers must be registered in `routes.ts`

### Regression tests
Lock in a fix to prevent re-introduction of a specific bug.
- Social icebreaker phase config — phase transitions that were previously wrong
- Onboarding routing — specific `nextStep` values that previously caused loops

### Structural/guardrail scripts
CI-enforced checks that validate conventions beyond TypeScript types:
- `scripts/check-guardrails.mjs` — root script contracts, env file conventions, legacy identifiers
- Runs on every push via CI

## Writing regression tests

When a bug is fixed or a cleanup is completed:

1. Decide whether the regression can be expressed as a failing automated check before the code change.
2. If yes, write the smallest failing test first, then fix the code, then refactor.
3. If no, document why not, preserve a reliable reproduction path, and add the narrowest regression test immediately after the fix.
4. Add the test to the appropriate `__tests__` directory.
5. Include a comment explaining what it is guarding against.

```typescript
// guards against regression: interestSignalBoundary invariant (PR #379)
// user_interest_signals must not feed into calculateInterestScoreAsync
it('calculateInterestScoreAsync reads only from user_interests', async () => {
  // ...
});
```

## Writing invariant tests

For architectural invariants:

```typescript
// Example pattern: structural import guard
it('poolMatchingService does not import from user_interest_signals', () => {
  const source = fs.readFileSync('./src/poolMatchingService.ts', 'utf-8');
  expect(source).not.toContain('user_interest_signals');
});
```

Keep invariant tests simple and readable — their value is as persistent documentation of intent.

## CI guardrails

`npm run guardrails` runs `scripts/check-guardrails.mjs` which checks:
- Required root scripts exist with exact commands
- No committed real `.env` files
- No legacy onboarding identifiers in tracked files

Do not remove guardrail checks — if a convention changes, update the check, not remove it.

## Common mistakes to avoid

- Deleting a test because it is inconvenient rather than wrong
- Writing tests that only test the happy path for flows with known edge-case regressions
- Skipping an invariant test because "everyone knows the rule" — written tests outlive memory
- Adding a test to the wrong workspace (server tests in user-client, or vice versa)
- Using `expect(true).toBe(true)` style no-op tests to pad coverage
- Forgetting to mock `../repositories/usersRepo` when unit-testing code in `wechatAuth.ts` — it now calls `usersRepo` directly, not `storage`
- Not mocking `../lib/socialIcebreakerStore` in icebreaker route integration tests — the store is PostgreSQL-backed and requires `DATABASE_URL`; integration tests must supply a full in-memory mock of all store functions

## Related files

- `apps/server/src/__tests__/` — server test directory
- `apps/server/src/__tests__/interestSignalBoundary.test.ts` — signal boundary invariant
- `apps/server/src/__tests__/adminRbacCoverage.test.ts` — admin RBAC coverage
- `apps/server/src/__tests__/routeModularization.test.ts` — route modularization structural test
- `apps/server/src/__tests__/poolMatchingService.test.ts` — matching correctness
- `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts` — icebreaker routes
- `apps/user-client/src/features/onboarding/active/__tests__/flow.test.ts` — onboarding flow
- `scripts/check-guardrails.mjs` — CI guardrail script
- `package.json` — root guardrails script

## Quick examples

**User says:** "I fixed a bug where `calculateInterestScoreAsync` was accidentally reading `user_interest_signals`. How do I prevent regression?"
**Apply this skill by:** Adding an invariant test in `apps/server/src/__tests__/interestSignalBoundary.test.ts` that reads the source file and asserts `user_interest_signals` does not appear in the function body.
**Result:** Any future re-introduction of the signal read causes a CI failure immediately.

---

**User says:** "I want to enforce that all `/api/admin/*` routes use `requireAdmin` middleware."
**Apply this skill by:** Adding a structural test in `apps/server/src/__tests__/adminRbacCoverage.test.ts` that parses `routes.ts` (or uses import analysis) to assert every admin route path has the middleware applied.
**Result:** Admin route without the middleware fails CI before it reaches production.

## Troubleshooting

- **Test added to the wrong workspace** — a server test was placed under `apps/user-client/` or vice versa. Move it to `apps/server/src/__tests__/` for server logic, or `apps/user-client/src/…/__tests__/` for client hooks and flows.
- **`npm run test -w @joyjoin/user-client` exits without running tests** — the user-client `test` script is a placeholder. Run Vitest directly: `npx vitest run --config apps/user-client/vitest.config.ts`.
- **Guardrail check passes in CI but fails locally** — the local env has a legacy identifier or real `.env` file that is not tracked. Check `scripts/check-guardrails.mjs` for the exact assertion that failed, then remove the legacy identifier from the local file or delete the untracked `.env` file.
- **Invariant test passes even after a violation** — the test is reading a compiled/transpiled file instead of the TypeScript source. Point `fs.readFileSync` at the `.ts` source path, not `dist/`.

## Review checklist

- [ ] Regression or invariant test is in the correct workspace `__tests__` directory
- [ ] Test is narrow — it would fail specifically if the guarded behaviour regressed
- [ ] Invariant tests read TypeScript source files, not compiled output
- [ ] `npm run guardrails` passes after any changes to root scripts or env conventions
- [ ] New CI guardrail checks update `check-guardrails.mjs`, not remove it
- [ ] Test includes a comment referencing what it guards against (PR number or description)

## Related skills

- [`../process-test-first/SKILL.md`](../process-test-first/SKILL.md) — red-green-refactor discipline for bug fixes and deterministic logic
- [`../process-systematic-debugging/SKILL.md`](../process-systematic-debugging/SKILL.md) — structured root-cause analysis before writing regression tests
