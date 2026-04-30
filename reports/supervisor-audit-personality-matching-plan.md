# Supervisor Audit Report — Personality & Matching Execution Plan

**Auditor:** Supervisor (native orchestration agent)  
**Plan Source:** DeepSeek v4 Pro deliberation output (5-audit → 3-delegate → consensus)  
**Scope:** 18 claimed bugs across personality system, matching pipeline, and data layer  
**Audit Method:** Parallel file verification + runtime type check + live DB schema query  
**Date:** 2026-04-29

---

## Executive Summary

**Verdict: Plan is directionally correct but contains materially overstated severity claims and one dangerously underspecified Phase-0 fix.**

- **8 of 18 claimed bugs are fully confirmed** with severity matching the plan.
- **3 claims are materially overstated** (C1, C3, M3/M4) and risk misallocating engineering effort.
- **1 Phase-0 fix is factually incorrect** (C3 column restoration) and would fail on deployment.
- **2 issues are missing from the plan** that should be included in Phase 0 or 1.

**Bottom line:** Approve the phased approach, but rewrite Phase 0a and downgrade C1 from "killshot" to "high-priority pipeline fix." The real emergency is not data loss (C3 is broken but not bleeding live production users) — it is the silent chemistry defaulting for demo/phone-auth users and the divergence between three chemistry matrices.

---

## Bug-by-Bug Verification

### 🔴 C1 — Chemistry Pipeline: `users.archetype` vs Machine IDs

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | `poolMatchingService.ts:1062` reads `users.archetype`; `calculateChemistryScore:225` casts it as `ArchetypeName`. |
| Severity | "Every chemistry score silently defaults to 50" | **Overstated.** `users.archetype` stores **mixed data**: WeChat-auth users have machine IDs (`corgi`, `rooster`) → chemistry **works correctly**. Phone-auth and demo users have legacy Chinese names (`连接者`, `探索者`, `火花塞`) → lookup misses → defaults to 50. Null archetypes fallback to `"情绪树洞考拉"` (Chinese name, not in matrix) → also defaults to 50. |
| Blast radius | "Broken since primaryArchetype introduced" | **Partial.** Only affects users created via phone auth, demo scripts, or legacy paths. WeChat mini-program users (launch-primary surface) are mostly unaffected. |
| Fix complexity | Change `users.archetype` → `users.primaryArchetype` + 4 fallback strings | **Correct.** `eventPools.ts:94` already uses `coalesce(users.primaryArchetype, users.archetype, '未设置')`. The matching service should do the same. |

**Supervisor correction:** C1 is a **high-priority bug**, not a "killshot." It does not affect 100% of users. The fix is straightforward: read `primaryArchetype` with `coalesce(archetype)` fallback, and change the fallback string from `"情绪树洞考拉"` to `"koala"`.

---

### 🔴 C3 — `updateInterestsTopics()` Writes to Phantom Columns

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | `usersRepo.ts:254-259` sets `interestsTop`, `primaryInterests`, `topicAvoidances`, `topicsHappy`, `topicsAvoid` on `users` table. |
| Root cause | "Columns exist in PG, just missing from Drizzle" | **WRONG.** Live DB query (`information_schema.columns`) confirms these columns **do NOT exist in PostgreSQL**. Only `interest_favorite` exists. |
| Runtime behavior | "Every interest submit silently loses data" | **Confirmed.** Drizzle's `.set()` typing is permissive (TypeScript compiles cleanly), so the extra fields are silently dropped from the generated SQL `UPDATE`. |
| Fix proposed | "Restore Drizzle columns: 1 file, <10 lines, risk: None" | **Dangerously incorrect.** Restoring Drizzle columns without a DB migration will cause runtime errors when Drizzle tries to write to non-existent columns. |

**Supervisor correction:** C3 requires **either** (a) a proper DB migration to re-add the columns, **or** (b) redirecting the `updateInterestsTopics()` write path to the `user_interests` table (the canonical interest store per schema comments). Option (b) is preferred — it aligns with the documented architecture. Phase 0a must be rewritten to include a migration or a write-path redirect, not a 3-line schema tweak.

---

### 🟡 C2 — Duplicate Trait Profiles (`prototypes.ts` vs `archetypeRegistry.ts`)

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | Both files contain identical `traitProfile` objects for all 12 archetypes. Values match byte-for-byte. |
| Additional finding | Not mentioned | **Both files share the same ID mismatches** (`hamster_praise.id = "dolphin_praise"`, `koala.id = "bear"`). Fixing one without the other creates divergence. |
| Fix | "Copy prototypes.ts into archetypeRegistry.ts; DRY import" | **Partially correct.** The correct fix is to make `archetypeRegistry.ts` the single source of truth and have `prototypes.ts` re-export from it. The plan's direction is right but the mechanic should be reversed (registry is newer and more comprehensive). |

---

### 🟡 C4 — Three Chemistry Matrices Diverged

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | Three distinct matrices with different scores: |
| | | 1. `apps/admin-client/src/lib/archetypeCompatibility.ts` (221 lines) — e.g., `corgi-corgi = 85` |
| | | 2. `packages/shared/src/personality/archetypeCompatibility.ts` (426 lines) — e.g., `corgi-corgi = 82` |
| | | 3. `apps/server/src/archetypeChemistry.ts` (437 lines) — e.g., `corgi-corgi = 70` |
| Severity | "Unify to ONE chemistry matrix (server Matrix A as authority)" | **Correct.** The server matrix is the scoring authority; the admin-client copy is stale and should be deleted. The shared-package matrix can remain for client display if it stays in sync via CI. |

**Supervisor addition:** The plan correctly identifies C4 but understates the blast radius. The admin-client matrix is used in admin dashboards and may mislead operators. Deletion + CI invariant test is the right fix.

---

### 🟢 H1 — P Trait Label: `"耐心"` → `"正能量"`

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | `matcherV2.ts:972` labels trait `P` as `"耐心"` (patience). |
| Correctness | Should be `"正能量"` | **Confirmed.** Archetype descriptions and trait score distributions support `"正能量"` (positive energy). High-P archetypes (rooster=92, corgi=85, hamster_praise=88) are all positivity-driven. Low-P archetypes (turtle=45, cat=45, owl=50) are low-energy, not necessarily impatient. |
| Fix complexity | 1-line string change | **Correct.** Trivial. |

---

### 🟢 H2 — `saveRoleResult()` Missing Transaction Wrapper

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | `assessmentRepo.ts:32-52` does `UPDATE users` then `INSERT roleResults` without `db.transaction()`. Same pattern exists in `legacyStorageRepo.ts:747-769`. |
| Severity | Plan rates "None" | **Accurate for risk.** The INSERT is unlikely to fail (simple, validated data). If it does, the user can retake the test. This is a hygiene issue, not data-loss. |
| Fix complexity | Wrap in `db.transaction()` | **Correct.** Straightforward. |

---

### 🟢 H5 — `.id` Field + Emoji Mismatches in `prototypes.ts`

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | `prototypes.ts:56`: `id: "dolphin_praise"` with `name: "hamster_praise"`, `icon: "🐬"`. `prototypes.ts:117`: `id: "bear"` with `name: "koala"`, `icon: "🐻"`. |
| Additional finding | Not mentioned | **Same mismatches exist in `archetypeRegistry.ts`** (`hamster_praise.id = "dolphin_praise"`, `koala.id = "bear"`). Fixing only `prototypes.ts` leaves registry inconsistent. |
| Fix complexity | "Audit `.id` consumers" | **Correct.** Must fix both files in the same commit. |

---

### 🟢 H6 — `matchExplanationService.ts` Uses Uncalibrated Chemistry

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | `matchExplanationService.ts:504-508` defines its own `getChemistryScore()` using raw `chemistryMatrix`, ignoring `archetypePairFeedbackStats` calibration. The pool matching service correctly uses `getCalibratedChemistryScore()` from `archetypeChemistryCalibration.ts`. |
| Impact | Explanations show different scores than the matching algorithm used | **Confirmed.** Users may see chemistry explanations that disagree with the actual match scores. |
| Fix | Thread calibrated scores into explanations | **Correct.** Requires passing the calibration map into the explanation service or importing `getCalibratedChemistryScore`. |

---

### 🟢 M7 — Confusion Pair Gate Comment/Code Mismatch

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | `matcherV2Gates.ts:115`: comment says `// hamster_praise vs rooster:` but code sets `rivalArchetype: "corgi"`. |
| Impact | Gate may suppress wrong rival | **Confirmed.** If the comment is the intended behavior, the gate is targeting the wrong archetype. If the code is correct, the comment is misleading future maintainers. |
| Fix | Fix comment or code to match intent | **Correct.** Requires product input on intended rivalry. |

---

### 🟡 M3 / M4 — "2,500 Lines of Core Algorithm Have ZERO Tests"

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Claim | Zero tests for MatcherV2 + greedy matching | **Overstated.** Tests exist but are integration/boundary-level, not unit-level: |
| | | - `poolMatchingService.test.ts` (203 lines) — mocks DB and chemistry; tests save/load, not algorithm logic. |
| | | - `interestSignalBoundary.test.ts` (366 lines) — tests that interest signals don't affect deterministic scores. |
| | | - `wechatAuth.test.ts` — mocks `findBestMatchingArchetypesV2` entirely. |
| Actual gap | No direct unit tests for `MatcherV2.findBestMatches()` or `runGreedyPoolMatchingCore()` | **Confirmed.** The core assignment and grouping logic is untested at the unit level. |
| Fix | Add MatcherV2 unit tests + greedy matching tests | **Correct.** But the "ZERO tests" framing creates false urgency. The integration tests provide some safety net. |

---

### 🟡 M5 — `interestsTopicsSchema` Zod Validation

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | Listed as cleanup item | **Unclear what's broken.** `schema.ts:1111-1119` defines the schema with reasonable constraints. No obvious validation bug found during audit. |
| Recommendation | Investigate before fixing | The plan should specify what is wrong with the schema, or drop M5 as unverified. |

---

### 🟢 M6 — Missing `z.enum` on `primaryArchetype`

| Aspect | Plan Claim | Audit Finding |
|--------|-----------|---------------|
| Existence | **Confirmed** | No Zod enum restricts `primaryArchetype` to the 12 machine IDs. `insertRoleResultSchema` uses `createInsertSchema(roleResults)` which inherits the DB type (`varchar`, unconstrained). |
| Impact | Invalid archetype IDs can be persisted | **Confirmed.** A bug in matcher output or a manual API call could write an invalid ID. |
| Fix | Add `z.enum([...12 IDs])` | **Correct.** Low effort, high safety value. |

---

## Plan Soundness Assessment

### Phase Ordering: Correct

The plan's sequence — **C3 emergency → C1 pipeline → C2 consolidation → tests → algorithm improvements → cleanup** — is architecturally sound. Data integrity before algorithm iteration is the right priority.

### Phase 0: Rewrite Required

| Item | Plan | Audit Verdict |
|------|------|---------------|
| 0a C3 | "Restore Drizzle columns, risk: None" | **REJECT.** Columns do not exist in PostgreSQL. Risk is **deployment failure**. Rewrite as: "Migrate `user_interests` table write path OR create DB migration for missing columns." |
| 0b H2 | "Wrap in transaction" | **Approve.** Low risk, correct. |
| 0c H5 | "Fix `.id` fields + emojis" | **Approve with expansion.** Must fix BOTH `prototypes.ts` AND `archetypeRegistry.ts` in the same commit. |

### Phase 1: Approve with Additions

| Item | Plan | Audit Verdict |
|------|------|---------------|
| 1a C1 | Change `users.archetype` → `users.primaryArchetype` | **Approve.** Also fix fallback string from `"情绪树洞考拉"` to `"koala"`. |
| 1b C4 | Unify chemistry matrices | **Approve.** Delete admin-client stale copy; add CI invariant test. |
| 1c H1 | Fix P trait label | **Approve.** Trivial. |
| 1d H6 | Thread calibration into explanations | **Approve.** Medium effort. |

**Missing from Phase 1:** Fix `archetypeRegistry.ts` id mismatches (same as H5). The plan only mentions `prototypes.ts` but the registry has identical mismatches.

### Phase 2–5: Approve as Written

Test coverage (Phase 3) and algorithm improvements (Phase 4) are correctly deferred behind verified baselines. The Thompson Sampling deferral is prudent.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phase 0a deploys Drizzle-only changes and crashes on missing PG columns | High if plan followed verbatim | High (production deploy failure) | **Rewrite Phase 0a** to include DB migration or redirect write path. |
| Fixing `prototypes.ts` ids without fixing `archetypeRegistry.ts` ids | Medium if plan followed verbatim | Medium (display/runtime divergence) | Expand H5 fix scope to both files. |
| C1 fix misses null-archetype fallback | Medium | Medium (null archetypes still get 50) | Include fallback string fix in 1a. |
| C4 matrix deletion breaks admin-client build | Low | Low | Verify no other imports of admin-client's private matrix before deletion. |

---

## Corrected Execution Plan

### Phase 0: Emergency Stop-the-Bleeding *(ship immediately, <1 hour)*

| # | Bug | Fix | File(s) | Risk |
|---|-----|-----|---------|------|
| 0a | **C3** | **Redirect write path:** Change `updateInterestsTopics()` to write interest data to `user_interests` table instead of phantom `users` columns. OR create PG migration to restore columns if `users` table storage is still required. | `apps/server/src/repositories/usersRepo.ts` | **Medium** (requires migration or path change) |
| 0b | **H2** | Wrap `saveRoleResult()` in `db.transaction()` | `apps/server/src/repositories/assessmentRepo.ts` | None |
| 0c | **H5** | Fix `.id` fields + emojis: `"dolphin_praise"→"hamster_praise"`, `"bear"→"koala"`, icons `🐬→🐹`, `🐻→🐨` | `packages/shared/src/personality/prototypes.ts` AND `packages/shared/src/personality/archetypeRegistry.ts` | Low |

### Phase 1: Chemistry Pipeline Correction *(ship after Phase 0, <2 days, ~8 files)*

| # | Bug | Fix |
|---|-----|-----|
| 1a | **C1** | Change `users.archetype` → `coalesce(users.primaryArchetype, users.archetype)` in pool query; fix fallback strings to machine IDs (`"koala"` not `"情绪树洞考拉"`); add `resolveArchetype()` wrapper |
| 1b | **C4** | Unify to ONE chemistry matrix (server `archetypeChemistry.ts` as authority); delete admin-client's third copy; add CI invariant test |
| 1c | **H1** | Fix P trait label: `"耐心"→"正能量"` in `matcherV2.ts:972` |
| 1d | **H6** | Import `getCalibratedChemistryScore` into `matchExplanationService.ts`; replace local `getChemistryScore` |

### Phase 2–5: Unchanged from original plan

*(Source-of-truth consolidation, test coverage, algorithm improvements, cleanup — all approved as written.)*

---

## Utilization

| Task | Agents | Skills |
|------|--------|--------|
| File verification | Supervisor (direct) | `personality-system`, `matching-domain`, `database-migration-safety` |
| DB schema query | Supervisor (direct) | `backend-models-standards` |
| Type/runtime check | Supervisor (direct) | `testing-and-regression-guardrails` |

---

*Audit complete. Plan requires Phase 0a rewrite before implementation begins.*
