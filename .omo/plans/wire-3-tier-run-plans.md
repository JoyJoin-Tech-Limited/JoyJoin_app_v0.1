# Wire 3-Tier Icebreaker Run Plans End-to-End

## TL;DR

> **Replace legacy `standard`/`premium`/`bar` tier IDs with the approved `breeze`/`glow`/`blaze` system across server types, run plan selection, session state, and mini-program UI.**
>
> **Deliverables**:
> - Shared types updated to use `TierMachineId` (`breeze` | `glow` | `blaze`)
> - Server routes accept and return new tier IDs
> - Run plans unwired from DEPRECATED status
> - Mini-program tier selector shows 破冰局/畅聊局/狂欢局
> - Old sessions display correctly via `LEGACY_TIER_MAP`
> - All tests pass with new tier strings
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Wave 1 (Tasks 1-3 parallel) → Task 4 → Task 7 → F1-F4

---

## Context

### Original Request
User asked why the approved 3-tier breeze/glow/blaze system isn't wired into production. Investigation found the tier display manifest and run plans exist but are marked DEPRECATED, while server code and mini-program still use legacy `standard`/`premium`/`bar` IDs.

### Key Decisions from Deliberation
- **Tier IDs**: `breeze` (破冰局), `glow` (畅聊局), `blaze` (狂欢局)
- **Run plans**: BREEZE (40min), GLOW (60min), BLAZE (105min)
- **Consensus doc mapping**: `standard→glow`, `premium→blaze`, `bar→breeze`

### Metis Review Findings (addressed in plan)
- **Old sessions in JSONB**: Will contain legacy tier values → handled via `LEGACY_TIER_MAP`
- **Phase injection logic**: Preserved with new tier IDs (glow→mini_script, blaze→auction, breeze→none)
- **Backward compatibility**: Server accepts new IDs only; old session display resolved at read time
- **No DB migration**: `eventTier` is JSONB, not a typed column

---

## Work Objectives

### Core Objective
Replace every legacy tier ID reference with breeze/glow/blaze across the server and mini-program, making the approved 3-tier system the canonical production implementation.

### Concrete Deliverables
- `packages/shared/src/socialIcebreaker.ts` — `eventTier` type changed to `TierMachineId`
- `packages/shared/src/socialIcebreakerTierManifest.ts` — `LEGACY_TIER_MAP` added
- `packages/shared/src/socialIcebreakerRunPlans.ts` — DEPRECATED removed, legacy entries removed from `TIER_RUN_PLANS`
- `apps/server/src/routes/socialIcebreaker.ts` — `/start` and `/set-tier` handlers use new tier IDs
- `apps/mini-program/src/pages/icebreaker-session/index.tsx` — tier UI uses new IDs and display names
- `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts` — assertions updated

### Definition of Done
- [ ] `npm run typecheck` passes across all workspaces
- [ ] `npm run test -w @joyjoin/server -- socialIcebreakerRoutes` passes
- [ ] `npm run guardrails` passes
- [ ] `npm run build:weapp --workspace=mini-program` succeeds

### Must Have
- All legacy tier IDs replaced in server and mini-program
- Old sessions readable without 500 errors
- Run plans authoritative for session phase ordering

### Must NOT Have (Guardrails)
- Do NOT change venue/event type `bar` references (unrelated)
- Do NOT add vibe selection or tipsy variant (separate feature)
- Do NOT restructure phaseRegistry.ts vs socialIcebreakerRunPlans.ts canonical home
- Do NOT change phase module internals or AI generators
- Do NOT touch web client (zero tier references confirmed)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (vitest in server workspace)
- **Automated tests**: YES (Tests-after — update existing tests)
- **Framework**: vitest
- **Agent-Executed QA**: MANDATORY for all tasks

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **API/Backend**: Bash (curl) — Send requests, assert status + response fields
- **Mini-program build**: Bash — `npm run build:weapp`, verify no errors
- **Type checking**: Bash — `npm run typecheck` per workspace

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — types + manifest + run plans):
├── Task 1: Update SocialSessionState.eventTier type to TierMachineId
├── Task 2: Add LEGACY_TIER_MAP to tier manifest
└── Task 3: Un-deprecate run plans, remove legacy entries

Wave 2 (Server core — route handlers):
├── Task 4: Update /start handler tier logic
└── Task 5: Update /set-tier handler tier logic

Wave 3 (Client — mini-program UI):
└── Task 6: Update mini-program tier selector and labels

Wave 4 (Tests + cleanup):
└── Task 7: Update socialIcebreakerRoutes tests

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 (types) | — | 4, 5, 6 |
| 2 (manifest) | — | 4, 5 |
| 3 (run plans) | — | 4, 5 |
| 4 (/start) | 1, 2, 3 | 7, F1-F4 |
| 5 (/set-tier) | 1, 2, 3 | 7, F1-F4 |
| 6 (mini-program) | 1 | F1-F4 |
| 7 (tests) | 4, 5 | F1-F4 |

---

## TODOs

- [ ] 1. Update `SocialSessionState.eventTier` type to `TierMachineId`

  **What to do**:
  - In `packages/shared/src/socialIcebreaker.ts` line 343, change:
    ```ts
    eventTier?: 'standard' | 'premium' | 'bar';
    ```
    to:
    ```ts
    eventTier?: TierMachineId;
    ```
  - Add import for `TierMachineId` from `./socialIcebreakerTierManifest.js`
  - Verify no other types in `socialIcebreaker.ts` reference legacy tier strings

  **Must NOT do**:
  - Do NOT change any other property types
  - Do NOT touch `SocialIcebreakerPhase` or other unrelated types

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `api-contract-versioning`
    - Ensures type changes follow cross-platform contract patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6, 7
  - **Blocked By**: None

  **References**:
  - `packages/shared/src/socialIcebreaker.ts:343` — Current `eventTier` type definition
  - `packages/shared/src/socialIcebreakerTierManifest.ts:14` — `TierMachineId` type definition
  - `packages/shared/src/socialIcebreaker.ts:325` — `SocialSessionState` interface start

  **Acceptance Criteria**:
  - [ ] `eventTier` property uses `TierMachineId` type
  - [ ] Import for `TierMachineId` exists
  - [ ] `npm run typecheck` in `packages/shared` shows errors ONLY at consumers (expected — will be fixed in later tasks)

  **QA Scenarios**:
  ```
  Scenario: Type check confirms type change
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run `cd packages/shared && npx tsc --noEmit`
      2. Verify error at `socialIcebreaker.ts:343` is gone
      3. Verify NEW errors appear at consumer sites (expected)
    Expected Result: Type changed successfully; consumers need update
    Evidence: .sisyphus/evidence/task-1-typecheck.txt
  ```

  **Commit**: YES (groups with Wave 1)

- [ ] 2. Add `LEGACY_TIER_MAP` to tier manifest

  **What to do**:
  - In `packages/shared/src/socialIcebreakerTierManifest.ts`, add:
    ```ts
    export const LEGACY_TIER_MAP: Record<string, TierMachineId> = {
      standard: 'glow',
      premium: 'blaze',
      bar: 'breeze',
    };
    ```
  - Add helper function:
    ```ts
    export function resolveLegacyTier(legacyTier: string): TierMachineId {
      return LEGACY_TIER_MAP[legacyTier] ?? 'breeze';
    }
    ```
  - Export both from `packages/shared/src/index.ts` if not already exported

  **Must NOT do**:
  - Do NOT change `TIER_DISPLAY_MANIFEST` entries
  - Do NOT add variant logic beyond the map

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None

  **References**:
  - `packages/shared/src/socialIcebreakerTierManifest.ts` — Existing manifest file
  - `packages/shared/src/index.ts` — Barrel export file

  **Acceptance Criteria**:
  - [ ] `LEGACY_TIER_MAP` exported
  - [ ] `resolveLegacyTier()` exported
  - [ ] Both importable from `@joyjoin/shared`

  **QA Scenarios**:
  ```
  Scenario: Map resolves correctly
    Tool: Bash (node REPL)
    Preconditions: None
    Steps:
      1. `node -e "const { resolveLegacyTier } = require('./packages/shared/dist/index.js'); console.log(resolveLegacyTier('standard'), resolveLegacyTier('premium'), resolveLegacyTier('bar'));"`
    Expected Result: Outputs `glow blaze breeze`
    Evidence: .sisyphus/evidence/task-2-map-resolution.txt
  ```

  **Commit**: YES (groups with Wave 1)

- [ ] 3. Un-deprecate run plans and remove legacy entries

  **What to do**:
  - In `packages/shared/src/socialIcebreakerRunPlans.ts`:
    - Remove the `⚠️ DEPRECATED` comment block (lines 1-8)
    - Update header comment to indicate these are the canonical tier run plans
    - In `TIER_RUN_PLANS` (line 79), remove legacy entries:
      ```ts
      // REMOVE these lines:
      standard: DEFAULT_STANDARD_RUN_PLAN,
      premium: DEFAULT_PREMIUM_RUN_PLAN,
      bar: BAR_RUN_PLAN,
      ```
    - Remove `BAR_RUN_PLAN` export entirely (lines 65-77) — it's a legacy plan
    - Keep `DEFAULT_STANDARD_RUN_PLAN` and `DEFAULT_PREMIUM_RUN_PLAN` imports for backward compatibility, but document they are legacy aliases

  **Must NOT do**:
  - Do NOT change BREEZE/GLOW/BLAZE run plan segment definitions
  - Do NOT remove `getRunPlanForTier()` or `getPhaseListForTier()`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None

  **References**:
    - `packages/shared/src/socialIcebreakerRunPlans.ts:1-8` — DEPRECATED comment
    - `packages/shared/src/socialIcebreakerRunPlans.ts:79-86` — TIER_RUN_PLANS map
    - `packages/shared/src/socialIcebreakerRunPlans.ts:65-77` — BAR_RUN_PLAN

  **Acceptance Criteria**:
  - [ ] DEPRECATED warning removed
  - [ ] Legacy entries removed from `TIER_RUN_PLANS`
  - [ ] `BAR_RUN_PLAN` removed
  - [ ] `getRunPlanForTier('breeze')` returns `BREEZE_RUN_PLAN`
  - [ ] `getRunPlanForTier('glow')` returns `GLOW_RUN_PLAN`
  - [ ] `getRunPlanForTier('blaze')` returns `BLAZE_RUN_PLAN`
  - [ ] `getRunPlanForTier('standard')` returns `undefined`

  **QA Scenarios**:
  ```
  Scenario: Run plan resolution works for new tiers
    Tool: Bash (node REPL)
    Preconditions: None
    Steps:
      1. `node -e "const { getRunPlanForTier } = require('./packages/shared/dist/index.js'); console.log(getRunPlanForTier('breeze')?.compilerId, getRunPlanForTier('glow')?.compilerId, getRunPlanForTier('blaze')?.compilerId, getRunPlanForTier('standard'));"`
    Expected Result: `breeze-v1 glow-v1 blaze-v1 undefined`
    Evidence: .sisyphus/evidence/task-3-run-plans.txt
  ```

  **Commit**: YES (groups with Wave 1)

- [ ] 4. Update `/start` handler tier logic

  **What to do**:
  - In `apps/server/src/routes/socialIcebreaker.ts`:
    - Line 165: Change `const tier = eventTier || 'standard';` to `const tier = (eventTier || 'breeze') as TierMachineId;`
    - Lines 166-169: Update phase injection logic:
      ```ts
      // Replace:
      if (tier === 'premium' && !base.includes('mini_script')) { ... }
      if (tier === 'bar' && !base.includes('auction')) { ... }
      // With:
      if (tier === 'glow' && !base.includes('mini_script')) {
        base.push('mini_script');
      }
      if (tier === 'blaze' && !base.includes('auction')) {
        const pdIndex = base.indexOf('personality_dice');
        const insertAt = pdIndex >= 0 ? pdIndex : base.length;
        base.splice(insertAt, 0, 'auction');
      }
      ```
    - Line 181: Change `eventTier: eventTier || 'standard'` to `eventTier: tier`
    - Line 182: Change `runPlan: getRunPlanForTier(eventTier || 'standard')` to `runPlan: getRunPlanForTier(tier)`
    - Add import for `TierMachineId` and `resolveLegacyTier` from `@joyjoin/shared`
    - If `eventTier` is provided but is a legacy value, resolve it:
      ```ts
      const resolvedTier = resolveLegacyTier(eventTier || 'breeze');
      ```
      Then use `resolvedTier` throughout.

  **Must NOT do**:
  - Do NOT change the session creation logic beyond tier handling
  - Do NOT modify `getServerEnabledPhases()`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `server-domain-architecture`
    - Ensures route changes follow server patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
    - `apps/server/src/routes/socialIcebreaker.ts:148-183` — `/start` handler
    - `apps/server/src/routes/socialIcebreaker.ts:159-182` — Session state creation with tier logic
    - `packages/shared/src/socialIcebreakerTierManifest.ts` — `resolveLegacyTier`

  **Acceptance Criteria**:
  - [ ] `/start` with `eventTier: 'breeze'` → creates session with `eventTier: 'breeze'`
  - [ ] `/start` with `eventTier: 'glow'` → creates session with `eventTier: 'glow'` and `mini_script` in enabledPhases
  - [ ] `/start` with `eventTier: 'blaze'` → creates session with `eventTier: 'blaze'` and `auction` in enabledPhases
  - [ ] `/start` with `eventTier: 'standard'` (legacy) → resolves to `glow` via `resolveLegacyTier`
  - [ ] `/start` with no `eventTier` → defaults to `breeze`

  **QA Scenarios**:
  ```
  Scenario: Start session with breeze tier
    Tool: Bash (curl)
    Preconditions: Valid session, authenticated user
    Steps:
      1. POST /api/social-icebreaker/start with body: {"sessionId": "test-1", "eventTier": "breeze"}
      2. Assert response status 200
      3. Assert response.eventTier === 'breeze'
      4. Assert response.runPlan.compilerId === 'breeze-v1'
    Expected Result: Session created with breeze tier and breeze run plan
    Evidence: .sisyphus/evidence/task-4-start-breeze.json

  Scenario: Start session with legacy standard tier (backward compat)
    Tool: Bash (curl)
    Preconditions: Valid session, authenticated user
    Steps:
      1. POST /api/social-icebreaker/start with body: {"sessionId": "test-2", "eventTier": "standard"}
      2. Assert response status 200
      3. Assert response.eventTier === 'glow'
    Expected Result: Legacy 'standard' resolved to 'glow'
    Evidence: .sisyphus/evidence/task-4-start-legacy.json
  ```

  **Commit**: YES (groups with Wave 2)

- [ ] 5. Update `/set-tier` handler tier logic

  **What to do**:
  - In `apps/server/src/routes/socialIcebreaker.ts`:
    - Line 1818: Change validation from:
      ```ts
      if (!tier || !['standard', 'premium', 'bar'].includes(tier))
      ```
      to:
      ```ts
      const VALID_TIERS: TierMachineId[] = ['breeze', 'glow', 'blaze'];
      if (!tier || !VALID_TIERS.includes(tier as TierMachineId))
      ```
    - Line 1833: Change `getRunPlanForTier(tier as 'standard' | 'premium' | 'bar')` to `getRunPlanForTier(tier as TierMachineId)`
    - Line 1834: Change `state.eventTier = tier as 'standard' | 'premium' | 'bar'` to `state.eventTier = tier as TierMachineId`
    - Lines 1839-1846: Update phase injection:
      ```ts
      // Replace premium→mini_script with glow→mini_script
      if (tier === 'glow' && !base.includes('mini_script')) {
        base.push('mini_script');
      }
      // Replace bar→auction with blaze→auction
      if (tier === 'blaze' && !base.includes('auction')) {
        const pdIndex = base.indexOf('personality_dice');
        const insertAt = pdIndex >= 0 ? pdIndex : base.length;
        base.splice(insertAt, 0, 'auction');
      }
      ```

  **Must NOT do**:
  - Do NOT change the warmup-only guard
  - Do NOT change the host authorization check

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `server-domain-architecture`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
    - `apps/server/src/routes/socialIcebreaker.ts:1807-1857` — `/set-tier` handler
    - `packages/shared/src/socialIcebreakerTierManifest.ts` — `TierMachineId`

  **Acceptance Criteria**:
  - [ ] `POST /set-tier` with `{tier: 'blaze'}` → 200, eventTier: 'blaze'
  - [ ] `POST /set-tier` with `{tier: 'standard'}` → 400 (invalid tier)
  - [ ] `POST /set-tier` with `{tier: 'glow'}` → injects mini_script into enabledPhases
  - [ ] `POST /set-tier` non-host → 403
  - [ ] `POST /set-tier` outside warmup → 400

  **QA Scenarios**:
  ```
  Scenario: Set tier to blaze
    Tool: Bash (curl)
    Preconditions: Session exists, in warmup phase, caller is host
    Steps:
      1. POST /api/social-icebreaker/:id/set-tier with body: {"tier": "blaze"}
      2. Assert status 200
      3. Assert response.eventTier === 'blaze'
      4. Assert response.runPlan.compilerId === 'blaze-v1'
      5. Assert response.enabledPhases includes 'auction'
    Expected Result: Tier changed to blaze with auction injected
    Evidence: .sisyphus/evidence/task-5-set-tier-blaze.json

  Scenario: Reject legacy tier
    Tool: Bash (curl)
    Preconditions: Session exists, in warmup phase, caller is host
    Steps:
      1. POST /api/social-icebreaker/:id/set-tier with body: {"tier": "premium"}
      2. Assert status 400
      3. Assert response.error includes "invalid tier"
    Expected Result: Legacy tier rejected with 400
    Evidence: .sisyphus/evidence/task-5-set-tier-legacy.json
  ```

  **Commit**: YES (groups with Wave 2)

- [ ] 6. Update mini-program tier selector and labels

  **What to do**:
  - In `apps/mini-program/src/pages/icebreaker-session/index.tsx`:
    - Line 146: Change `eventTier: 'standard'` to `eventTier: 'breeze'`
    - Line 425: Change `const handleSetTier = useCallback((tier: 'standard' | 'premium' | 'bar')` to `(tier: TierMachineId)`
    - Lines 519-523: Update `tierLabel` map:
      ```ts
      const tierLabel = {
        breeze: '破冰局',
        glow: '畅聊局',
        blaze: '狂欢局',
      }[session?.eventTier ?? 'breeze']
      ```
    - Lines 555-556: Update eventTierBadge styling conditions:
      ```ts
      backgroundColor: session?.eventTier === 'blaze' ? '#d4af37' : 'rgba(255,255,255,0.15)',
      color: session?.eventTier === 'blaze' ? '#1e1e2f' : '#ffffff',
      ```
    - Lines 885-888: Update tier selector options:
      ```ts
      { tier: 'breeze' as const, title: '破冰局', desc: '40分钟 · 暖场+挑战+侦探', tag: '轻松' },
      { tier: 'glow' as const, title: '畅聊局', desc: '60分钟 · 暖场+挑战+侦探+骰子+镜像', tag: '推荐' },
      { tier: 'blaze' as const, title: '狂欢局', desc: '105分钟 · 全阶段体验', tag: '高光' },
      ```
    - Lines 894-895: Update tier selector styling conditions to use new tier IDs
    - Add import for `TierMachineId` from `@joyjoin/shared`

  **Must NOT do**:
  - Do NOT change the tier selector modal structure or animation
  - Do NOT add vibe selection UI
  - Do NOT change the `handleSetTier` API call format

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `mini-program-frontend-excellence`
    - Ensures Taro/mini-program patterns are followed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1, 2

  **References**:
    - `apps/mini-program/src/pages/icebreaker-session/index.tsx:146` — Default tier in start request
    - `apps/mini-program/src/pages/icebreaker-session/index.tsx:425` — handleSetTier type
    - `apps/mini-program/src/pages/icebreaker-session/index.tsx:519-523` — tierLabel map
    - `apps/mini-program/src/pages/icebreaker-session/index.tsx:555-556` — eventTierBadge styling
    - `apps/mini-program/src/pages/icebreaker-session/index.tsx:885-910` — Tier selector UI
    - `packages/shared/src/socialIcebreakerTierManifest.ts` — Display manifest and type

  **Acceptance Criteria**:
  - [ ] Default tier is `breeze`
  - [ ] `tierLabel` resolves 破冰局/畅聊局/狂欢局
  - [ ] Tier selector shows 3 options with correct names and descriptions
  - [ ] `handleSetTier` accepts `TierMachineId`
  - [ ] `npm run typecheck --workspace=mini-program` passes
  - [ ] `npm run build:weapp --workspace=mini-program` succeeds

  **QA Scenarios**:
  ```
  Scenario: Mini-program typecheck passes
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run `npm run typecheck --workspace=mini-program`
    Expected Result: Zero TypeScript errors
    Evidence: .sisyphus/evidence/task-6-typecheck.txt

  Scenario: Mini-program build succeeds
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run `npm run build:weapp --workspace=mini-program`
    Expected Result: Build completes with zero errors
    Evidence: .sisyphus/evidence/task-6-build.txt
  ```

  **Commit**: YES (groups with Wave 3)

- [ ] 7. Update `socialIcebreakerRoutes` tests

  **What to do**:
  - In `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts`:
    - Line 1524: Change `expect(stateBody.eventTier).toBe('standard')` to `toBe('breeze')`
    - Lines 1530, 1538: Change `tier: 'premium'` to `tier: 'glow'`
    - Lines 1542: Change `toBe('premium')` to `toBe('glow')`
    - Lines 1550: Change `tier: 'bar'` to `tier: 'blaze'`
    - Lines 1554: Change `toBe('bar')` to `toBe('blaze')`
    - Search for any other `'standard'`, `'premium'`, `'bar'` references in test file and update
    - Verify assertions about `mini_script` in run plan still make sense (glow tier injects mini_script)
    - Verify assertions about `auction` still make sense (blaze tier injects auction)

  **Must NOT do**:
  - Do NOT change test infrastructure or mock setup
  - Do NOT add new test cases (unless existing assertions fundamentally change)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `process-test-first`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 4, 5

  **References**:
    - `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts:1519-1564` — Tier-related test assertions
    - `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts` — Full test file for search

  **Acceptance Criteria**:
  - [ ] All tier string references updated to breeze/glow/blaze
  - [ ] `npm run test -w @joyjoin/server -- socialIcebreakerRoutes` passes
  - [ ] Zero test failures

  **QA Scenarios**:
  ```
  Scenario: Server tests pass
    Tool: Bash
    Preconditions: Server workspace dependencies installed
    Steps:
      1. Run `npm run test -w @joyjoin/server -- socialIcebreakerRoutes`
    Expected Result: All tests pass, zero failures
    Evidence: .sisyphus/evidence/task-7-tests.txt
  ```

  **Commit**: YES (groups with Wave 4)

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(icebreaker): wire 3-tier system — types, manifest, run plans`
- **Wave 2**: `feat(icebreaker): update server routes for breeze/glow/blaze tiers`
- **Wave 3**: `feat(mini-program): update tier selector for 3-tier system`
- **Wave 4**: `test(icebreaker): update tests for new tier IDs`

---

## Success Criteria

### Verification Commands
```bash
# Type check all workspaces
npm run typecheck

# Run server tests
npm run test -w @joyjoin/server -- socialIcebreakerRoutes

# Guardrails
npm run guardrails

# Mini-program build
npm run build:weapp --workspace=mini-program
```

### Final Checklist
- [ ] All legacy tier IDs removed from server and mini-program
- [ ] `eventTier` type is `TierMachineId` everywhere
- [ ] Old sessions with legacy values display correctly
- [ ] `npm run typecheck` passes across all workspaces
- [ ] `npm run test -w @joyjoin/server` passes
- [ ] `npm run guardrails` passes
- [ ] Mini-program build succeeds
