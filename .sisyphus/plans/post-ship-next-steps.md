# Post-Ship Next Steps — Priority Execution Plan

## TL;DR

> **Fix two CI/launch blockers (aiModels.ts + SCSS), close Sisyphus boulder, add tier tests, verify phase injection logic.**
>
> **Critical Path**: Task 1 (aiModels fix) → Task 4 (SCSS fix) → Tasks 2+3 parallel → Task 5 verify
>
> **Estimated Effort**: Low-Medium
> **Parallel Execution**: YES — Tasks 2+3 after Task 1 completes
>
> **Delivery Lane**: Direct (Task 1, 2, 4) → Operational (Task 3 tests)

---

## Context

Two plans just shipped:
- `cleanup-discovery-findings` (commit `17821a46`) — legacy cleanup, test infra, CI expansion, schema split
- `wire-3-tier-run-plans` (commit `17821a46`) — breeze/glow/blaze tier system wired end-to-end

This plan captures the remaining follow-up work identified during post-ship analysis.

---

## Work Objectives

### Core Objective
Clean up technical debt and blockers left in the wake of the two shipped plans, ensuring CI is green and launch readiness is unblocked.

### Concrete Deliverables
- `packages/shared/src/aiModels.ts` — duplicate function declarations removed, typecheck passes
- `.sisyphus/boulder.json` — updated to reflect completed plans
- `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts` — tier-specific assertions added
- `apps/mini-program/src/pages/matching-status/_chemistry-card.scss` — undefined variable fixed, build succeeds
- Phase injection logic — verified correct or fixed if needed

### Definition of Done
- [ ] `npm run typecheck` passes in ALL workspaces (0 errors)
- [ ] `npm run test -w @joyjoin/server` passes (0 new failures)
- [ ] `npm run build:weapp --workspace=mini-program` succeeds
- [ ] `npm run guardrails` passes
- [ ] `.sisyphus/boulder.json` reflects completed state

### Must Have
- aiModels.ts compiles without duplicate declaration errors
- Mini-program builds successfully for WeChat
- Sisyphus boulder state accurate

### Must NOT Have (Guardrails)
- Do NOT change AI model behavior or reasoning logic (only fix declarations)
- Do NOT modify matching-status UI beyond fixing the SCSS variable
- Do NOT add new API routes or change existing contracts
- Do NOT introduce new dependencies

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (vitest in server, tsc typecheck in all workspaces)
- **Automated tests**: YES (update existing + add new)
- **Framework**: vitest + tsc --noEmit
- **Agent-Executed QA**: MANDATORY for all tasks

### QA Policy
Every task MUST include agent-executed QA scenarios.

---

## Execution Strategy

### Wave 1: CI Blockers (Sequential — both P0)

```
Wave 1:
├── Task 1: Fix aiModels.ts duplicate declarations
└── Task 4: Fix matching-status SCSS undefined variable
    (Task 4 can start in parallel with Task 1 after initial read)
```

**Wave 2: Housekeeping + Tests (Parallel)**

```
Wave 2:
├── Task 2: Update Sisyphus boulder state
└── Task 3: Add tier-specific tests
```

**Wave 3: Verification (Parallel, non-blocking)**

```
Wave 3:
└── Task 5: Verify phase injection logic
```

### Dependency Matrix

| Task | Depends On | Blocks | Lane | Tier |
|------|-----------|--------|------|------|
| 1 (aiModels) | — | 2, 3 | Direct | Tier 1 |
| 2 (boulder) | 1 | — | Direct | Tier 1 |
| 3 (tests) | 1 | — | Operational | Tier 2 |
| 4 (SCSS) | — | — | Direct | Tier 1 |
| 5 (phase injection) | — | — | Direct | Tier 1 |

---

## TODOs

- [ ] 1. Fix aiModels.ts duplicate function declarations

  **What to do**:
  - In `packages/shared/src/aiModels.ts`:
    - Lines 56 and 208: Remove duplicate `getReasoningEffort` declaration
    - Lines 68 and 220: Remove duplicate `buildThinkingExtraBody` declaration
  - Keep the first occurrence of each function, remove the second
  - Verify no other duplicates exist in the file

  **Must NOT do**:
  - Do NOT change function logic or behavior
  - Do NOT change function signatures
  - Do NOT touch AI model selection logic

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `npm run typecheck --workspace=@joyjoin/shared` shows 0 errors
  - [ ] `npm run typecheck --workspace=mini-program` shows 0 errors (no aiModels cascade)

  **QA Scenarios**:
  ```
  Scenario: Type check passes
    Tool: Bash
    Steps:
      1. Run `npm run typecheck --workspace=@joyjoin/shared`
      2. Run `npm run typecheck --workspace=mini-program`
    Expected Result: Zero TypeScript errors in both
    Evidence: .sisyphus/evidence/task-1-typecheck.txt
  ```

  **Commit**: YES

- [ ] 2. Update Sisyphus boulder state

  **What to do**:
  - Read `.sisyphus/boulder.json`
  - Mark `cleanup-discovery-findings` and `wire-3-tier-run-plans` as completed
  - Update `active_plan` to null or next active plan
  - Add completion timestamps

  **Must NOT do**:
  - Do NOT delete boulder.json
  - Do NOT remove evidence files

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3, after Task 1)

  **Acceptance Criteria**:
  - [ ] Boulder JSON reflects completed state for both plans

  **QA Scenarios**:
  ```
  Scenario: Boulder state accurate
    Tool: Bash
    Steps:
      1. Read `.sisyphus/boulder.json`
      2. Verify both plans marked complete
    Expected Result: No active plans with completed tasks
  ```

  **Commit**: YES (group with Task 3)

- [ ] 3. Add tier-specific tests

  **What to do**:
  - In `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts`:
    - Add test: `/start` with `eventTier: 'blaze'` → response contains `blaze-v1` run plan
    - Add test: `/set-tier` with `tier: 'glow'` → 200, session updated
    - Add test: `/set-tier` with `tier: 'standard'` (legacy) → 400 error
    - Add test: `/set-tier` by non-host → 403 error
    - Add test: `/set-tier` outside warmup → 400 error
  - New test file: `packages/shared/src/__tests__/socialIcebreakerTierManifest.test.ts`:
    - `resolveLegacyTier('standard') === 'glow'`
    - `resolveLegacyTier('premium') === 'blaze'`
    - `resolveLegacyTier('bar') === 'breeze'`
    - `resolveLegacyTier(undefined) === 'breeze'`
    - `resolveLegacyTier('unknown') === 'breeze'` (fallback)

  **Must NOT do**:
  - Do NOT change existing test infrastructure
  - Do NOT mock run plan generation

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2, after Task 1)

  **Acceptance Criteria**:
  - [ ] All new tests pass
  - [ ] `npm run test -w @joyjoin/server` passes (0 failures)
  - [ ] `npm run test -w @joyjoin/shared` passes (0 failures)

  **QA Scenarios**:
  ```
  Scenario: Server tests pass
    Tool: Bash
    Steps:
      1. Run `npm run test -w @joyjoin/server -- socialIcebreakerRoutes`
    Expected Result: All tests pass including new tier assertions
  ```

  **Commit**: YES (group with Task 2)

- [ ] 4. Fix matching-status SCSS build error

  **What to do**:
  - In `apps/mini-program/src/pages/matching-status/_chemistry-card.scss`:
    - Line 103: `$color-text-tertiary` is undefined
    - Check `_variables.scss` for correct variable name or add import
    - Likely fix: `$color-text-muted` or add `$color-text-tertiary` to variables
  - Alternative: Check if the file is missing `@use '../../../styles/variables' as *`

  **Must NOT do**:
  - Do NOT change the visual design
  - Do NOT refactor the entire matching-status page

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)

  **Acceptance Criteria**:
  - [ ] `npm run build:weapp --workspace=mini-program` succeeds with 0 errors

  **QA Scenarios**:
  ```
  Scenario: Mini-program build succeeds
    Tool: Bash
    Steps:
      1. Run `npm run build:weapp --workspace=mini-program`
    Expected Result: Build completes successfully
    Evidence: .sisyphus/evidence/task-4-build.txt
  ```

  **Commit**: YES

- [ ] 5. Verify phase injection logic

  **What to do**:
  - Read current server code in `apps/server/src/routes/socialIcebreaker.ts`
  - Check how `enabledPhases` is set during `/start` and `/set-tier`
  - Compare against run plan segments (BREEZE/GLOW/BLAZE)
  - Verify: does `enabledPhases` need to be restricted to phases in the run plan?
  - If yes: implement restriction logic
  - If no: document decision and move on

  **Must NOT do**:
  - Do NOT implement restriction without product confirmation
  - Do NOT break existing phase behavior

  **Parallelization**:
  - **Can Run In Parallel**: YES (any time)

  **Acceptance Criteria**:
  - [ ] Decision documented: restrict enabledPhases or keep all enabled

  **QA Scenarios**:
  ```
  Scenario: Phase behavior verified
    Tool: Code review
    Steps:
      1. Read /start handler
      2. Read /set-tier handler
      3. Compare with run plan segment lists
    Expected Result: Clear decision on whether restriction is needed
  ```

  **Commit**: YES (only if code change needed)

---

## Commit Strategy

- **Wave 1**: `fix(shared): remove duplicate function declarations in aiModels.ts`
- **Wave 1**: `fix(mini-program): resolve undefined SCSS variable in matching-status`
- **Wave 2**: `chore(sisyphus): mark completed plans in boulder`
- **Wave 2**: `test(icebreaker): add tier-specific assertions for /start and /set-tier`
- **Wave 3**: `feat(icebreaker): restrict enabledPhases to run plan segments` (if needed)

---

## Success Criteria

### Verification Commands
```bash
# Type check all workspaces
npm run typecheck --workspace=@joyjoin/shared
npm run typecheck --workspace=mini-program

# Run tests
npm run test -w @joyjoin/server
npm run test -w @joyjoin/shared

# Build mini-program
npm run build:weapp --workspace=mini-program

# Guardrails
npm run guardrails
```

### Final Checklist
- [ ] `npm run typecheck` passes in all workspaces
- [ ] `npm run test -w @joyjoin/server` passes
- [ ] `npm run test -w @joyjoin/shared` passes
- [ ] `npm run build:weapp --workspace=mini-program` succeeds
- [ ] `npm run guardrails` passes
- [ ] `.sisyphus/boulder.json` reflects completed state
- [ ] Phase injection decision documented
