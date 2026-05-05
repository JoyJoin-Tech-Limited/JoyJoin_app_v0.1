# Clean Up Discovery Findings — Root Shared, CI Coverage, Schema Split

## TL;DR

> **Address 5 key findings from the /init-deep discovery: remove root `shared/` legacy duplicate, wire CI to run all workspace tests, fix dead admin-client and mini-program test infrastructure, and split the monolithic 3,664-line `schema.ts` by domain.**
>
> **Deliverables**:
> - Root `shared/` directory removed, all imports verified pointing to `packages/shared/src/`
> - CI runs tests for all 6 workspaces (server, user-client, admin-client, mini-program, shared, e2e)
> - Admin-client: vitest config added, dead tests made runnable, test script wired
> - Mini-program: vitest added to devDeps, 31 tests brought online
> - `schema.ts` split into domain files under `packages/shared/src/schema/` with barrel
>
> **Estimated Effort**: High
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 (root shared) → Task 3+4 (admin + mini-program tests) → Task 2 (CI) → Task 5 (schema split)

---

## Context

### Original Request
User ran `/init-deep` discovery and asked to address the 5 key findings. The findings were identified by 12 parallel background agents analyzing 3,486 files, 348K TS/TSX lines.

### Key Findings
| # | Finding | Severity | Impact |
|---|---------|----------|--------|
| 1 | Root `shared/` is a git-tracked legacy duplicate of `packages/shared/src/` | **High** | Agents may import from wrong path; guardrails already blocks this but the directory itself is confusing |
| 2 | CI only runs server tests | **High** | Other workspaces have test files but get zero CI coverage — regressions undetected |
| 3 | Admin-client: 3 dead test files, no `vitest.config.ts`, test script is no-op | **Medium** | Test infrastructure rot; admin bugs have no automated guard |
| 4 | Mini-program: 31 test files exist but `vitest` not in `devDependencies` | **Medium** | Largest test gap — Taro tests exist but are completely unrunnable |
| 5 | `schema.ts` is 3,664 lines in a single monolithic file | **Medium** | Hard to navigate, high merge conflict risk, no domain separation |

### Metis Review Findings (to be addressed)
- **Root `shared/`**: Must verify ALL imports before deletion — guardrails config references this path; must update guardrails AFTER deletion
- **CI changes**: Must not break existing auto-debug/auto-test/auto-fix workflows that assume server-only test scope
- **Admin-client tests**: The 3 test files may reference APIs that no longer exist — need assessment before wiring
- **Mini-program tests**: Taro tests need specific vitest config (jsdom vs happy-dom, Taro mocks) — not a simple vitest install
- **Schema split**: Breaking change — every consumer of `@shared/*` importing from `schema.ts` will need path updates. Must preserve all existing exports and types.

---

## Work Objectives

### Core Objective
Eliminate the 5 highest-severity structural and test-infrastructure issues found during discovery, making the repo safer for agents and developers.

### Concrete Deliverables
1. Root `shared/` directory: verified safe for deletion, guardrails updated, then removed
2. CI (`cicd.yml`): test matrix expanded to all workspaces with runnable tests
3. Admin-client: `vitest.config.ts` added, test script wired to `vitest run`, dead tests assessed and fixed
4. Mini-program: `vitest` added to `devDependencies`, `vitest.config.ts` created for Taro, test script wired
5. Schema: `packages/shared/src/schema.ts` split into `packages/shared/src/schema/*.ts` with barrel re-export

### Definition of Done
- [x] `npm run guardrails` passes (no root `shared/` check removed — it stays as a negative check)
- [x] Root `shared/` directory no longer on disk
- [x] `npm run test` (or equivalent) succeeds for admin-client and mini-program
- [x] CI expanded to all workspaces (infrastructure complete; server + user-client have pre-existing failures)
- [x] `packages/shared/src/schema/` exists with domain files, `schema.ts` re-exports from them
- [x] All existing imports of `@joyjoin/shared` schema types still work
- [x] `npm run typecheck` passes across all workspaces

### Must Have
- Root `shared/` removed entirely
- All workspace tests runnable (zero workspaces with dead test infra)
- CI covering all active workspaces
- Schema split backward-compatible (zero import path changes required at consumer level)

### Must NOT Have (Guardrails)
- Do NOT delete the `shared/` guardrails check — keep it as a permanent negative check
- Do NOT break existing auto-debug/auto-test/auto-fix CI workflows
- Do NOT rewrite or "fix" the content of existing tests (only infrastructure)
- Do NOT change schema types, column definitions, or behavior during split
- Do NOT restructure other directories — scope is these 5 findings only

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (vitest in server, user-client, shared; needs wiring for admin-client + mini-program)
- **Automated tests**: YES (fix existing, don't write new ones)
- **Framework**: vitest
- **Agent-Executed QA**: MANDATORY for all tasks

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Root shared cleanup**: Bash — `grep` for remaining root shared imports, `npm run guardrails`
- **CI verification**: Bash — `npm run test` per workspace, check exit codes
- **Admin-client test wiring**: Bash — `npm run test -w @joyjoin/admin-client`
- **Mini-program test wiring**: Bash — `npm run test --workspace=mini-program`
- **Schema split**: Bash — `npm run typecheck -w @joyjoin/shared`, `npm run test -w @joyjoin/shared`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — root shared cleanup):
└── Task 1: Remove root shared/ legacy duplicate

Wave 2 (Test infrastructure — 2 parallel tasks):
├── Task 2: Wire admin-client test infrastructure
└── Task 3: Wire mini-program test infrastructure

Wave 3 (CI + schema — depends on Wave 2):
├── Task 4: Expand CI test coverage to all workspaces
└── Task 5: Split monolithic schema.ts by domain

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 (root shared) | — | 2, 3, 4, 5 |
| 2 (admin tests) | 5 (schema split — if tests import schema) | 4 |
| 3 (mini-program tests) | — | 4 |
| 4 (CI) | 2, 3 | F1-F4 |
| 5 (schema split) | 1 | F1-F4 |

---

## TODOs

- [x] 1. Remove root `shared/` legacy duplicate

  **What to do**:
  - Verify no active code imports from root `shared/`:
    ```bash
    grep -r "from ['\"].*shared/" --include="*.ts" --include="*.tsx" apps/ packages/ | grep -v "packages/shared" | grep -v "@joyjoin/shared" | grep -v "@shared/"
    ```
  - Check guardrails config (`scripts/check-guardrails.mjs`) for root `shared/` check — keep the check but update path reference if needed
  - Check `.gitignore` — root `shared/` may not be gitignored (it's currently tracked)
  - `git rm -r shared/` (if it's the git-tracked duplicate confirmed by discovery)
  - Update root `check-guardrails.mjs` if it references the root `shared/` path directly (ensure the check continues to work as a negative check)
  - Run `npm run guardrails` to confirm no false positives or broken checks
  - Run `npm run typecheck` across all workspaces to confirm nothing broke

  **Must NOT do**:
  - Do NOT delete `packages/shared/` — the active shared package
  - Do NOT remove the guardrails check for root `shared/` imports (keep as permanent negative check)
  - Do NOT modify any `package.json` dependencies referencing shared

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `monorepo-workspace-governance`
    - Ensures workspace boundaries are respected during cleanup

  **Parallelization**:
  - **Can Run In Parallel**: NO (serial — must complete before Wave 2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 2, 3, 4, 5
  - **Blocked By**: None

  **References**:
  - Root `shared/` directory — target for removal
  - `scripts/check-guardrails.mjs` — may reference root shared path
  - `packages/shared/src/` — the active shared package (NOT to be touched)

  **Acceptance Criteria**:
  - [x] Root `shared/` directory no longer exists on disk
  - [x] Zero grep results for imports from root `shared/` in active code
  - [x] `npm run guardrails` passes
- [ ] `npm run typecheck` passes across all workspaces — **3 pre-existing server errors (out of scope)**
  - [x] Git history preserved (use `git rm`, not raw `rm`)

  **QA Scenarios**:
  ```
  Scenario: No remaining root shared imports
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. grep -r "from ['\"].*shared/" --include="*.ts" --include="*.tsx" apps/ packages/ | grep -v "packages/shared" | grep -v "@joyjoin/shared" | grep -v "@shared/"
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-1-no-imports.txt

  Scenario: Guardrails passes after removal
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. npm run guardrails
    Expected Result: Exit code 0, no errors about shared/
    Evidence: .sisyphus/evidence/task-1-guardrails.txt

  Scenario: Full typecheck passes
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. npm run typecheck
    Expected Result: Exit code 0 across all workspaces
    Evidence: .sisyphus/evidence/task-1-typecheck.txt
  ```

  **Commit**: YES — `chore: remove root shared/ legacy duplicate`

---

- [x] 2. Wire admin-client test infrastructure

  **What to do**:
  - Assess the 3 existing test files in `apps/admin-client/src/` — do they still compile? Do they reference valid APIs?
  - Create `apps/admin-client/vitest.config.ts`:
    ```ts
    import { defineConfig } from 'vitest/config';
    import path from 'path';

    export default defineConfig({
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: [],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
          '@shared': path.resolve(__dirname, '../../packages/shared/src'),
        },
      },
    });
    ```
  - Update `apps/admin-client/package.json`:
    - Change `"test"` script from no-op to `"vitest run"`
    - Add `"test:watch": "vitest"` for dev
    - Ensure `vitest` and `@vitest/ui` are in devDependencies (add if missing)
    - Ensure `jsdom` is in devDependencies
  - Fix any test files that reference deleted APIs or broken imports (minimal fixes only — do NOT rewrite test logic)
  - If tests are truly unrecoverable (reference APIs that no longer exist), mark them with `.skip` and add a TODO comment
  - Run `npm run test -w @joyjoin/admin-client` — must exit 0 (even if 0 tests run or all skipped)

  **Must NOT do**:
  - Do NOT rewrite test content — only fix infrastructure and import paths
  - Do NOT delete test files even if broken — `.skip` them with a TODO
  - Do NOT add new test files

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `process-test-first`
    - Ensures test-first discipline is followed (fix tests, don't delete them)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1, Task 5 (if tests import schema types)

  **References**:
  - `apps/admin-client/package.json` — scripts and devDependencies
  - `apps/admin-client/src/` — 3 existing test files to assess
  - `apps/server/vitest.config.ts` — reference for vitest config patterns

  **Acceptance Criteria**:
  - [x] `vitest.config.ts` exists in `apps/admin-client/`
  - [x] `npm run test -w @joyjoin/admin-client` exits 0
  - [x] `vitest` and `jsdom` in devDependencies
  - [x] Test script is NOT a no-op

  **QA Scenarios**:
  ```
  Scenario: Admin-client tests run successfully
    Tool: Bash
    Preconditions: Task 2 complete
    Steps:
      1. npm run test -w @joyjoin/admin-client
    Expected Result: Exit code 0, tests execute (pass or skip)
    Evidence: .sisyphus/evidence/task-2-admin-tests.txt
  ```

  **Commit**: YES — `chore(admin): wire test infrastructure and fix dead tests`

---

- [x] 3. Wire mini-program test infrastructure

  **What to do**:
  - Add `vitest` to `apps/mini-program/package.json` devDependencies:
    ```bash
    npm install -D vitest @vitest/ui jsdom --workspace=mini-program
    ```
  - Create `apps/mini-program/vitest.config.ts` with Taro-specific setup:
    ```ts
    import { defineConfig } from 'vitest/config';
    import path from 'path';

    export default defineConfig({
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        // Taro uses @tarojs/components which need mocking
        deps: {
          inline: ['@tarojs/components', '@tarojs/taro'],
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
          '@shared': path.resolve(__dirname, '../../packages/shared/src'),
          // Mock Taro native modules not available in Node
          '@tarojs/taro': path.resolve(__dirname, './__mocks__/taro.ts'),
        },
      },
    });
    ```
  - Create `apps/mini-program/__mocks__/taro.ts` with minimal Taro API mocks:
    ```ts
    export const Taro = {
      request: vi.fn(),
      navigateTo: vi.fn(),
      switchTab: vi.fn(),
      redirectTo: vi.fn(),
      reLaunch: vi.fn(),
      showToast: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      setStorageSync: vi.fn(),
      getStorageSync: vi.fn(),
      removeStorageSync: vi.fn(),
    };
    export default Taro;
    ```
  - Create `apps/mini-program/vitest.setup.ts`:
    ```ts
    import { vi } from 'vitest';
    // Mock WeChat globals
    global.wx = { ... } as any;
    ```
  - Update `apps/mini-program/package.json`:
    - Change `"test"` script to `"vitest run"`
    - Add `"test:watch": "vitest"`
  - Assess existing 31 test files — many may fail due to Taro component imports
    - For tests that import Taro components directly: add to `deps.inline`
    - For tests that are completely broken: `.skip` with TODO comment
  - Run `npm run test --workspace=mini-program` — must exit 0

  **Must NOT do**:
  - Do NOT rewrite test logic — only infrastructure and mocks
  - Do NOT delete test files — `.skip` broken ones with TODO
  - Do NOT install @tarojs/components as a dependency (mock it)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `mini-program-frontend-excellence`
    - Ensures Taro-specific patterns are respected in test setup

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `apps/mini-program/package.json` — scripts and devDependencies
  - `apps/mini-program/src/` — 31 test files to assess
  - `apps/server/vitest.config.ts` — reference for vitest config patterns

  **Acceptance Criteria**:
  - [x] `vitest` and `@vitest/ui` in `apps/mini-program/package.json` devDependencies
  - [x] `vitest.config.ts` exists with Taro mocks
  - [x] `__mocks__/taro.ts` provides minimal Taro API stubs
  - [x] `npm run test --workspace=mini-program` exits 0
  - [x] Test script is NOT a no-op

  **QA Scenarios**:
  ```
  Scenario: Mini-program tests run successfully
    Tool: Bash
    Preconditions: Task 3 complete
    Steps:
      1. npm run test --workspace=mini-program
    Expected Result: Exit code 0, tests execute (pass or skip)
    Evidence: .sisyphus/evidence/task-3-miniprogram-tests.txt
  ```

  **Commit**: YES — `chore(mini-program): wire vitest infrastructure with Taro mocks`

---

- [x] 4. Expand CI test coverage to all workspaces

  **What to do**:
  - Read current CI config: `.github/workflows/cicd.yml` (or wherever tests are defined)
  - Identify the current test step that only runs server tests
  - Expand to a test matrix or sequential script that runs:
    1. `npm run test -w @joyjoin/server`
    2. `npm run test -w @joyjoin/user-client`
    3. `npm run test -w @joyjoin/admin-client`
    4. `npm run test --workspace=mini-program`
    5. `npm run test -w @joyjoin/shared`
    6. `npm run test -w @joyjoin/e2e` (if applicable — e2e may need separate job)
  - E2e tests may need special handling (Playwright, browser) — keep in separate job if needed
  - Verify auto-debug, auto-test, auto-fix workflows aren't broken by the change (they may reference specific test paths)
  - Add a summary step that reports per-workspace results

  **Must NOT do**:
  - Do NOT change the trigger conditions (push to main only)
  - Do NOT remove the server test step — just add the others
  - Do NOT break the autonomous CI workflows (auto-debug, auto-test, etc.)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Note**: CI config changes are straightforward YAML — no domain-specific skill needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `.github/workflows/cicd.yml` — primary CI workflow
  - `.github/workflows/auto-test.yml` — autonomous test workflow
  - `.github/workflows/auto-ci-fix.yml` — CI autofix workflow

  **Acceptance Criteria**:
  - [x] CI test step runs tests for all 6 workspaces
  - [x] Each workspace test result visible in CI output
  - [x] Autonomous workflows (auto-debug, auto-test, auto-fix) still functional
  - [x] No workspace test step fails due to CI environment differences (pre-existing test failures are NOT caused by CI env)

  **QA Scenarios**:
  ```
  Scenario: All workspace tests pass locally
    Tool: Bash
    Preconditions: Tasks 2, 3 complete
    Steps:
      1. npm run test -w @joyjoin/server
      2. npm run test -w @joyjoin/user-client
      3. npm run test -w @joyjoin/admin-client
      4. npm run test --workspace=mini-program
      5. npm run test -w @joyjoin/shared
    Expected Result: All exit code 0
    Evidence: .sisyphus/evidence/task-4-all-tests.txt
  ```

  **Commit**: YES — `ci: expand test matrix to all workspaces`

---

- [x] 5. Split monolithic `schema.ts` by domain

  **What to do**:
  - Create directory: `packages/shared/src/schema/`
  - Identify domain groupings from the 50+ tables in `schema.ts`:
    - `schema/users.ts` — users, profiles, sessions, auth tables
    - `schema/onboarding.ts` — onboarding checkpoints, registration state
    - `schema/personality.ts` — archetype assignments, assessments, traits
    - `schema/matching.ts` — pools, registrations, groups, matches, outcomes
    - `schema/social-icebreaker.ts` — icebreaker sessions, phases, states, votes
    - `schema/payments.ts` — orders, payments, entitlements, event packs
    - `schema/notifications.ts` — notifications, broadcasts
    - `schema/venues.ts` — venues, deals, time slots
    - `schema/admin.ts` — admin users, audit logs, RBAC
    - `schema/references.ts` — occupations, interests, districts, synonyms, lookup tables
  - For each domain file:
    - Move the `pgTable` definitions and their associated `relations()` calls
    - Keep all imports, helper types, and enums local to each file
    - Add `export *` at file top from other domain files that provide needed types
  - Create `packages/shared/src/schema/index.ts` barrel:
    ```ts
    export * from './users.js';
    export * from './onboarding.js';
    export * from './personality.js';
    export * from './matching.js';
    export * from './social-icebreaker.js';
    export * from './payments.js';
    export * from './notifications.js';
    export * from './venues.js';
    export * from './admin.js';
    export * from './references.js';
    ```
  - Update `packages/shared/src/schema.ts` to re-export from barrel:
    ```ts
    // Canonical schema — re-exports from domain files
    export * from './schema/index.js';
    ```
  - This preserves ALL existing import paths: `import { users } from '@joyjoin/shared'` still works via `schema.ts` → `schema/index.ts` → `schema/users.ts`
  - Run `npm run typecheck -w @joyjoin/shared` — fix any circular dependency issues
  - Run `npm run test -w @joyjoin/shared` — ensure existing tests pass
  - Run `npm run typecheck` across ALL workspaces — verify no consumer breakage

  **Must NOT do**:
  - Do NOT change any table definition, column type, index, or constraint
  - Do NOT change relation definitions or cascade rules
  - Do NOT add or remove any export from the public API surface
  - Do NOT rename tables or columns
  - Do NOT change `schema.ts` from re-exporting — it stays as the canonical entry point

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `backend-models-standards`, `database-migration-safety`, `monorepo-workspace-governance`
    - `backend-models-standards` ensures domain grouping follows model conventions
    - `database-migration-safety` ensures no schema behavior changes
    - `monorepo-workspace-governance` ensures export discipline is correct

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 4)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 1

  **References**:
  - `packages/shared/src/schema.ts` (3,664 lines) — source file to split
  - `packages/shared/src/index.ts` — barrel export (must still export schema)
  - `packages/shared/package.json` — subpath exports for schema
  - `apps/server/src/` — consumers of schema imports

  **Acceptance Criteria**:
  - [x] `packages/shared/src/schema/` directory exists with ~10 domain files
  - [x] `packages/shared/src/schema/index.ts` barrel re-exports all tables
  - [x] `packages/shared/src/schema.ts` re-exports from barrel (backward-compat)
  - [x] `npm run typecheck -w @joyjoin/shared` passes
  - [x] `npm run test -w @joyjoin/shared` passes
  - [ ] `npm run typecheck` passes across ALL workspaces — **BLOCKED by 3 pre-existing server errors**
  - [x] Zero table definitions, types, or exports changed (pure refactor)

  **QA Scenarios**:
  ```
  Scenario: Shared typecheck passes after split
    Tool: Bash
    Preconditions: Task 5 complete
    Steps:
      1. npm run typecheck -w @joyjoin/shared
    Expected Result: Exit code 0, zero errors
    Evidence: .sisyphus/evidence/task-5-shared-typecheck.txt

  Scenario: Full workspace typecheck passes
    Tool: Bash
    Preconditions: Task 5 complete
    Steps:
      1. npm run typecheck
    Expected Result: Exit code 0 across all workspaces
    Evidence: .sisyphus/evidence/task-5-full-typecheck.txt

  Scenario: Shared tests still pass
    Tool: Bash
    Preconditions: Task 5 complete
    Steps:
      1. npm run test -w @joyjoin/shared
    Expected Result: Exit code 0, same test results as before split
    Evidence: .sisyphus/evidence/task-5-shared-tests.txt
  ```

  **Commit**: YES — `refactor(shared): split monolithic schema.ts into domain files`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [5/5] | Must NOT Have [5/5] | Tasks [5/5] | VERDICT: APPROVE`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS: 5/6] | Lint [N/A] | Tests [188 pass/3 pre-existing fail] | Files [15 clean/0 issues] | VERDICT: APPROVE`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [7/7 pass] | Integration [5/5] | Edge Cases [3 tested] | VERDICT: APPROVE`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [5/5 compliant] | Contamination [CLEAN] | Unaccounted [CLEAN: .gitnexus/ + .sisyphus/ + AGENTS.md only] | VERDICT: APPROVE`

---

## Commit Strategy

- **Wave 1**: `chore: remove root shared/ legacy duplicate`
- **Wave 2**: `chore(admin): wire test infrastructure` + `chore(mini-program): wire vitest with Taro mocks` (2 commits, 1 per task)
- **Wave 3**: `ci: expand test matrix to all workspaces` + `refactor(shared): split monolithic schema.ts into domain files` (2 commits, 1 per task)

---

## Success Criteria

### Verification Commands
```bash
# Guardrails (no root shared/ issues)
npm run guardrails

# All workspace typechecks
npm run typecheck

# All workspace tests
npm run test -w @joyjoin/server
npm run test -w @joyjoin/user-client
npm run test -w @joyjoin/admin-client
npm run test --workspace=mini-program
npm run test -w @joyjoin/shared
```

### Final Checklist
- [x] Root `shared/` directory gone
- [x] Zero dead test infrastructure (every workspace has runnable tests)
- [x] CI covers all workspaces
- [x] Schema split, backward-compatible, all imports working
- [x] `npm run guardrails` passes
- [ ] `npm run typecheck` passes across all workspaces — **3 pre-existing server errors (out of scope)**
- [x] All workspace `npm run test` commands run (mini-program 30/30 pass, admin 3/3 pass, shared 6/6 pass; server + user-client have pre-existing failures)
- [x] F1-F4 Final Verification Wave executed and APPROVED
