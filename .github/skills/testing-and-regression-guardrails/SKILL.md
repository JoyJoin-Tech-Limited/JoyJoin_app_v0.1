---
name: Testing and Regression Guardrails
description: Focused regression tests, invariant tests, structural tests, and CI scripts to lock in cleanup and architecture decisions. Use when adding tests for boundaries, invariants, or recently cleaned-up behaviour.
---

# Testing and Regression Guardrails

**Core rule:** Tests in this repo serve two purposes: verifying correctness and locking in architectural decisions. When a boundary is established or a cleanup is completed, add a test to prevent regression.

## When to use this skill

- Adding a regression test after fixing a bug or completing a cleanup
- Writing a test to enforce an architectural invariant (e.g. signal boundary, module ownership)
- Adding a structural test that verifies file placement or import rules
- Setting up a CI guardrail script for a convention that should not regress

## Test infrastructure

Tests use **Vitest** across workspaces.

```bash
# Run server tests
npm run test -w @joyjoin/server

# Run a specific test file
npm run test -w @joyjoin/server -- src/__tests__/poolMatchingService.test.ts

# Run user-client tests
npm run test -w @joyjoin/user-client
```

Workspace-specific test files:
- `apps/server/src/__tests__/` — server unit and integration tests
- `apps/user-client/src/features/onboarding/active/__tests__/` — onboarding flow tests
- `apps/user-client/src/hooks/__tests__/` — hook tests

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

1. Identify the specific behaviour that must not regress
2. Write the narrowest test that would fail if the regression was reintroduced
3. Add it to the appropriate `__tests__` directory
4. Include a comment explaining what it is guarding against

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
