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

## When NOT to use this skill

- Writing broad integration or E2E tests for full user journeys (use `e2e-test-runner`)
- Benchmarking performance before and after changes (use `performance-benchmark`)
- Task is purely about debugging a production issue with no test addition (use `process-systematic-debugging`)

## Test type overview

| Type | Purpose | Examples |
|------|---------|----------|
| Correctness | Verify function/API behaviour for known inputs | Pool matching scoring, payment logic, auth flows |
| Invariant | Assert a boundary cannot be crossed | `user_interest_signals` must not appear in deterministic scoring; every admin route must use `requireAdmin` |
| Regression | Lock in a fix to prevent re-introduction | Social icebreaker phase transitions; onboarding `nextStep` loops |
| Structural/CI | Validate conventions beyond TypeScript | `scripts/check-guardrails.mjs` — root scripts, env files, legacy identifiers |

Run server tests:
```bash
npm run test -w @joyjoin/server
```

For CI script examples, invariant test templates, boundary test patterns, and workspace assignment guide — see [references/test-patterns.md](references/test-patterns.md).

## Default stance on TDD

- Prefer red-green-refactor for deterministic business logic, bug fixes, and stateful workflows.
- If strict test-first work is impractical, record why before changing production code.
- When you cannot start with a failing automated check, add the narrowest regression test immediately after the fix.

## Quick examples

**User says:** "I fixed a bug where `calculateInterestScoreAsync` was accidentally reading `user_interest_signals`. How do I prevent regression?"
**Apply this skill by:** Adding an invariant test in `apps/server/src/__tests__/interestSignalBoundary.test.ts` that reads the source file and asserts `user_interest_signals` does not appear in the function body.
**Result:** Any future re-introduction of the signal read causes a CI failure immediately.

---

**User says:** "I want to enforce that all `/api/admin/*` routes use `requireAdmin` middleware."
**Apply this skill by:** Adding a structural test in `apps/server/src/__tests__/adminRbacCoverage.test.ts` that parses `routes.ts` to assert every admin route path has the middleware applied.
**Result:** Admin route without the middleware fails CI before it reaches production.

## Troubleshooting

- **Test added to the wrong workspace** — Move it to `apps/server/src/__tests__/` for server logic, or `apps/user-client/src/…/__tests__/` for client hooks and flows.
- **`npm run test -w @joyjoin/user-client` exits without running tests** — the user-client `test` script is a placeholder. Run Vitest directly: `npx vitest run --config apps/user-client/vitest.config.ts`.
- **Flaky test that only fails in CI** — Likely depends on `DATABASE_URL` or timing. Mock external dependencies and avoid unseeded DB state in unit tests.
- **Guardrail check passes in CI but fails locally** — the local env has a legacy identifier or real `.env` file that is not tracked. Check `scripts/check-guardrails.mjs` for the exact assertion that failed.
- **Invariant test passes even after a violation** — the test is reading a compiled/transpiled file instead of the TypeScript source. Point `fs.readFileSync` at the `.ts` source path, not `dist/`.

## Review checklist

- [ ] Regression or invariant test is in the correct workspace `__tests__` directory
- [ ] Test is narrow — it would fail specifically if the guarded behaviour regressed
- [ ] Invariant tests read TypeScript source files, not compiled output
- [ ] `npm run guardrails` passes after any changes to root scripts or env conventions
- [ ] New CI guardrail checks update `check-guardrails.mjs`, not remove it
- [ ] Test includes a comment referencing what it guards against (PR number or description)
