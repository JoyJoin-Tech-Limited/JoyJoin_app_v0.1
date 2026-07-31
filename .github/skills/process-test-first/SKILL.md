---
name: process-test-first
description: >
  Test-first development discipline: red-green-refactor for deterministic logic,
  bug fixes, and stateful workflows. Use when the failure mode can be expressed
  as an automated check. Includes when to skip test-first with documentation.
  Trigger phrases: test first, red green refactor, TDD, write test first, failing
  test first, regression test, test before fix, red-green-refactor.
---

# Process: Test-First

## Purpose

Lock in correctness before implementation: write the failing test first, make it pass, then refactor. TDD discipline, cross-tool.

---

## When to use this skill

- Fixing a bug that can be reliably reproduced
- Adding deterministic business logic (scoring, validation, state transitions)
- Modifying a state machine (icebreaker phases, onboarding steps, matching rules)
- Refactoring code with existing test coverage

## When NOT to use this skill

- Pure UI changes with no logic (CSS, layout, copy)
- One-line typo fixes
- Prototyping / spike code that will be thrown away
- Integration with external APIs where mocking is impractical
- When the test harness does not exist and creating it exceeds the task scope

> **Rule:** If test-first is impractical, document why in the PR description and add the narrowest regression test immediately after the fix.

---

## The red-green-refactor protocol

### Step 1: Red — write the failing test

1. Identify the behavior to enforce
2. Write the smallest test capturing it
3. Run it — confirm it fails for the right reason
4. Document the failure (error message / failed assertion)

**Example:**
```ts
// Bug: advance guard allows phase skip when not all players ready
test('warmup advance requires all players ready', async () => {
  const state = createMockState({ warmupReadyUserIds: ['user1'], playerCount: 3 });
  await expect(advancePhase(state, 'warmup')).rejects.toThrow('All participants must be ready');
});
```

### Step 2: Green — make it pass

Smallest code change that passes; do not refactor yet; confirm green; run existing tests for regressions.

```ts
if (!hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount)) {
  throw new Error('All participants must be ready before advancing warmup');
}
```

### Step 3: Refactor — clean up

Improve naming/structure/duplication; keep all tests green after every step; stop when clean enough — don't gold-plate.

---

## When to skip test-first

| Reason | What to do instead |
|---|---|
| No test harness exists | Document why; add regression test after fix; create follow-up ticket for harness |
| Flaky external dependency | Document why; use targeted logging; add narrowest integration test after |
| UI-only change | Use visual regression or manual DevTools check |
| Prototype / spike | Mark code as experimental; add tests before merging to main |
| Emergency hotfix | Fix first, add regression test in the same PR before merge |

---

## Regression test discipline

If you skipped test-first, you **must** add a regression test:

1. Reproduce the bug in a test (even after the fix)
2. Revert your fix temporarily — confirm the test fails
3. Re-apply the fix — confirm the test passes
4. Commit test and fix in the same PR

---

## Example

**Bug:** Pool card cache miss metric not incrementing.

**Red:**
```ts
test('records cache miss when no live headline exists', () => {
  const poolIds = ['pool-1'];
  const headlines = new Map(); // empty
  // ... simulate the lookup logic ...
  expect(metrics.poolCardCopyCacheCounters.get('miss')).toBe(1);
});
```

**Green:** Fix the loop in routes.ts to call `recordPoolCardCopyCache('miss')` when headline missing.

**Refactor:** Extract metric recording into a helper function.

*(Same pattern for state-machine changes: red = test for e.g. `auctionAllLotsClosed === false` → throws; green = add guard; refactor = extract `validatePhaseAdvance` helper.)*

---

## Troubleshooting

**Test is too large to write first**
> Decompose to the smallest sub-behavior. If even that is too large, split the task.

**Existing tests too slow for the loop**
> Run only the relevant test file during the loop; run the full suite at the end.

**Not sure what to assert**
> Start with the observable symptom: "returns wrong value" → assert the correct value; "crashes" → assert it doesn't crash.

---

## Review checklist

- [ ] Failing test was written before the fix
- [ ] Test failure message clearly describes the expected behavior
- [ ] Fix is the smallest change that makes the test pass
- [ ] Refactor step did not change behavior (all tests still green)
- [ ] If test-first was skipped, reason is documented and regression test was added
- [ ] New tests are placed in the correct `__tests__` directory
