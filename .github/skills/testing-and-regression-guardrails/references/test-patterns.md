# Test Patterns Reference

## CI script examples

`npm run guardrails` runs `scripts/check-guardrails.mjs` which checks:
- Required root scripts exist with exact commands
- No committed real `.env` files
- No legacy onboarding identifiers in tracked files

Do not remove guardrail checks — if a convention changes, update the check, not remove it.

## Invariant test templates

For architectural invariants:

```typescript
// Example pattern: structural import guard
it('poolMatchingService does not import from user_interest_signals', () => {
  const source = fs.readFileSync('./src/poolMatchingService.ts', 'utf-8');
  expect(source).not.toContain('user_interest_signals');
});
```

Keep invariant tests simple and readable — their value is as persistent documentation of intent.

## Boundary test patterns

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

## Workspace assignment guide

- `apps/server/src/__tests__/` — server unit and integration tests
- `apps/mini-program/src/**/__tests__/` — mini-program hook and flow tests (limited coverage)

Current script reality:
- `npm run test -w @joyjoin/server` runs the active server Vitest suite
- `npm run test -w mini-program` has limited coverage
- `@joyjoin/shared` and `@joyjoin/admin-client` currently use placeholder `test` scripts

## MCP-assisted verification

- **Playwright MCP:** For regression tests that cover browser-based user journeys (onboarding, event discovery, payment flows), use the **Playwright MCP server** (`playwright`) to automate navigation, form interaction, and visual verification.
- **WeChat DevTools MCP:** For mini-program regression coverage, use the **WeChat DevTools MCP server** (`wechat-devtools`) to automate page navigation, element tapping, and WXML inspection within the WeChat Mini Program runtime.

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

## Common mistakes to avoid

- Deleting a test because it is inconvenient rather than wrong
- Writing tests that only test the happy path for flows with known edge-case regressions
- Skipping an invariant test because "everyone knows the rule" — written tests outlive memory
- Adding a test to the wrong workspace (server tests in the mini-program workspace, or vice versa)
- Using `expect(true).toBe(true)` style no-op tests to pad coverage
- Forgetting to mock `../repositories/usersRepo` when unit-testing code in `wechatAuth.ts`
- Not mocking `../lib/socialIcebreakerStore` in icebreaker route integration tests — the store is PostgreSQL-backed and requires `DATABASE_URL`; integration tests must supply a full in-memory mock of all store functions
