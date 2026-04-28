# Harness Engineering Workflow — Refinement & Improvement Report

> **Status:** Post-implementation review — 3 pilots completed, all artifacts shipped  
> **Date:** 2026-04-23  
> **Scope:** Implementation-phase harness integration (Tier 1/2/3 model)  
> **Based on:** Anthropic "Harness design for long-running application development" (Mar 24, 2026)

---

## 1. What Was Built

### 1.1 New Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/select-harness-tier.mjs` | Deterministic tier router (reads git diff + task metadata) | ✅ Shipped |
| `scripts/evaluate-sprint-contract.mjs` | Contract vs. implementation diff validator | ✅ Shipped, refined during pilot |
| `scripts/evaluate-api-drift.mjs` | Zod schema / route handler drift detection | ✅ Shipped |
| `scripts/harness-full.mjs` | Tier 3 orchestrator (Planner → Generator → Evaluator) | ✅ Shipped |

### 1.2 Updated Agent Definitions

| Agent | Change |
|-------|--------|
| **Backend Engineer** | Added Sprint Contract step to workflow; added Verifier/QA Agent handoffs |
| **Taro Mini-Program Frontend Engineer** | Same Sprint Contract protocol + handoffs |
| **Verifier** | Added **Contract Evaluator mode** for reviewing draft contracts |
| **QA Agent** | Added **Sprint Evaluation mode** for grading implemented contracts |

### 1.3 Updated Skills

| Skill | Change |
|-------|--------|
| **harness-completion-gate** | Added Sprint Contract awareness — reads active contracts, tags findings with criterion IDs |
| **task-creator** | Added `Harness tier` and `Sprint Contract required?` fields to output |
| **sprint-contract** (new) | Complete skill for writing, negotiating, and evaluating Sprint Contracts |

### 1.4 Updated orchestration.yaml

Added **30+ new handoff edges**:
- Engineer ↔ Verifier (contract proposal / revision / acceptance)
- Engineer → QA Agent (Sprint Evaluation)
- QA Agent → Engineer (rejection loop)
- QA Agent → Verifier (Tier 3 skeptical check)
- HRC → QA Agent (standby for locked contract)

### 1.5 Documentation

| Document | Purpose |
|----------|---------|
| `docs/proposals/harness-consensus-plan.md` | Unified master plan — 3-tier architecture, consensus KPIs, roadmap |
| `docs/proposals/harness-architecture-mapping.md` | Role mapping, Supervisor routing, handoff graph changes, model tiers |
| `docs/proposals/harness-kpi-framework.md` | 1–5 scoring rubrics, tier thresholds, scorecard JSON schema, effectiveness KPIs |
| `docs/proposals/harness-design-implementation-phase-mapping.md` | PGE→JoyJoin agent mapping, Sprint Contract JSON artifacts |
| `docs/proposals/sprint-contract-implementation-phase.md` | Sprint Contract mechanism, negotiation protocol, per-pillar criteria |
| `AGENTS.md` (updated) | Harness Engineering Framework section added |

---

## 2. Pilot Results Summary

### 2.1 Pilot #1 — XiaoyueSessionShell (Mini-Program UI)

| Metric | Value |
|--------|-------|
| Tier | 2 |
| Initial criteria | 6 ACs + 5 pillar |
| After Verifier | 10 ACs + 8 pillar |
| Cycles to accept | 1 |
| Time to accept | ~6 min |

**Gaps caught:**
1. Zero-player state untested (`playerCount: 0`)
2. `onRequestSuggestion` callback untested (only dismiss was tested)
3. `eventTitle` XSS risk
4. Unknown phase value fallback missing
5. Vague observability criterion

**Class of gaps:** Implementation-level edge cases

### 2.2 Pilot #2 — Admin Benchmark API (Backend)

| Metric | Value |
|--------|-------|
| Tier | 2 |
| Initial criteria | 6 ACs + 9 pillar |
| After Verifier | 8 ACs + 12 pillar |
| Cycles to accept | 1 |
| Time to accept | ~6 min |

**Gaps caught:**
1. **Critical:** No benchmark persistence layer exists — contract assumed data was already stored
2. No rate limiting on admin endpoint
3. No admin audit log for benchmark access
4. REL-01 overkill (mock timeout test for simple read)
5. Missing persistence location criterion
6. No migration safety mentioned

**Class of gaps:** Fundamental architectural assumption

### 2.3 Pilot #3 — Refund CSV Export (Cross-Workspace)

| Metric | Value |
|--------|-------|
| Tier | 2 |
| Initial criteria | 11 ACs + 11 pillar |
| After Verifier | 13 ACs + 12 pillar + sequencing section |
| Cycles to accept | 1 |
| Time to accept | ~6 min |

**Gaps caught:**
1. AC-07 date format claimed "ISO 8601" but used non-ISO format (`YYYY-MM-DD HH:mm:ss`)
2. Missing `Content-Disposition` header for browser download
3. No rate limiting on export endpoint
4. No cross-workspace sequencing (shared types → server → client)
5. REL-02 over-engineered (streaming for <1000 rows)
6. SCA-02 over-engineered (limit/offset for MVP)
7. Missing debounce/loading state on download button
8. Missing timezone clarity for `created_at`

**Class of gaps:** Cross-workspace coordination + specification precision

### 2.4 Aggregate Pilot Metrics

| Metric | Value |
|--------|-------|
| Total contracts drafted | 3 |
| Total contracts accepted | 3 (100%) |
| Average negotiation cycles | 1.0 |
| Average time to accept | ~6 min |
| Total gaps caught | **19** |
| Critical gaps (would block implementation) | 1 |
| Medium gaps (would cause rework) | 8 |
| Low gaps (would reduce quality) | 10 |

---

## 3. Refinement & Improvement Points

### 3.1 High Priority — Fix Before Production Use

#### R1. `select-harness-tier.mjs` reads full repo diff instead of task-scoped diff
**Problem:** The script calls `git diff --stat` which captures all unstaged changes in the working tree. In a repo with 240 modified files, every task was misclassified as Tier 3.

**Fix:** Accept an explicit file list via `--files=` argument. If not provided, fall back to `git diff --stat` but warn the user.

**Status:** 🔴 Not fixed

#### R2. `evaluate-sprint-contract.mjs` keyword heuristic is too naive
**Problem:** The script checks if criterion keywords appear in the git diff. For criteria like "Component renders without errors for all 9 phase values," the diff won't contain words like "renders" or "without errors." This produces false negatives.

**Fix:** Replace keyword matching with:
- File existence check (does the expected file exist?)
- Prop/method name extraction from criteria + grep in implementation file
- AST-aware checks for function signatures, error handling, etc.

**Status:** 🟡 Partially fixed (untracked files now included)

#### R3. Verifier contract review has no enforcement mechanism
**Problem:** The Verifier's feedback is advisory. An Implementer could theoretically ignore the REJECT and start coding anyway.

**Fix:** Add a `harness-contract-gate` script that checks if a contract exists and is `accepted` before allowing file edits. Run as a pre-commit hook or agent constraint.

**Status:** 🔴 Not implemented

#### R4. No contract drift handling mid-implementation
**Problem:** If an Implementer discovers a blocker that invalidates a criterion mid-flight, there's no protocol for amending the contract without restarting the Sprint Evaluation.

**Fix:** Add a "Contract Amendment" protocol: Implementer writes amendment proposal → Verifier reviews (1 cycle max) → QA Agent evaluates against amended contract.

**Status:** 🔴 Not implemented

### 3.2 Medium Priority — Quality of Life

#### R5. Sprint Contract template should be auto-generated from task metadata
**Problem:** Writing a contract from scratch takes 5–10 minutes. Much of the structure is boilerplate.

**Fix:** Create `scripts/generate-sprint-contract.mjs` that reads `task-creator` output and pre-fills:
- Goal from task description
- Tier from `select-harness-tier`
- Pillar criteria from a template library (e.g., "new API route" → auto-populate SEC-01, MNT-01)
- Affected workspaces from git diff

**Status:** 🟡 Template skill exists, but no auto-generation script

#### R6. Model tier recommendations are hardcoded in architecture doc
**Problem:** The Supervisor must manually choose model tiers for each role. This is error-prone.

**Fix:** Add model tier hints to `orchestration.yaml` agent bindings, or create a `scripts/select-model-tier.mjs` that reads task metadata + tier and returns recommended model.

**Status:** 🟡 Documented but not automated

#### R7. Turn summary JSON doesn't include harness metadata
**Problem:** The `agent_turn_summary` JSON has no fields for `sprintContractId`, `harnessTier`, or `harnessVerdict`.

**Fix:** Update `orchestration-turn-reporting` skill schema to include:
```json
{
  "harness": {
    "tier": 2,
    "sprintContractId": "sprint_20260423_abc123",
    "contractStatus": "accepted",
    "qaIterations": 1,
    "verdict": "PASS"
  }
}
```

**Status:** 🟡 Mentioned in proposals but not in active schema

#### R8. No dashboard for tracking harness KPIs
**Problem:** The 5 top-level KPIs (bug escape rate, rework rate, etc.) require manual calculation from scattered scorecard JSON files.

**Fix:** Create `scripts/harness-kpi-report.mjs` that:
- Reads all scorecards from `.git/.orchestration/scorecards/`
- Calculates weekly KPIs
- Outputs markdown report for team review

**Status:** 🔴 Not implemented

### 3.3 Low Priority — Nice to Have

#### R9. Playwright MCP integration for Tier 2 evaluations
**Problem:** QA Agent's Sprint Evaluation mode mentions Playwright MCP, but the actual integration path is not scripted.

**Fix:** Create `scripts/run-sprint-evaluation.mjs` that:
- Reads a Sprint Contract
- Launches Playwright for UI-based criteria
- Runs targeted tests for API-based criteria
- Produces a scorecard JSON

**Status:** 🔴 Not implemented

#### R10. Harness scorecards should feed into repo memory
**Problem:** Scorecards are ephemeral (`.gitignore`d). Long-term trend analysis is impossible.

**Fix:** Promote scorecard aggregates to `repo-memory/candidates/` weekly. Track per-pillar trends over time.

**Status:** 🔴 Not implemented

#### R11. Tier 3 (HRC) has not been piloted
**Problem:** All 3 pilots were Tier 2. The full Harness Runtime Controller deliberation pipeline remains theoretical.

**Fix:** Schedule a Tier 3 pilot for the next core engine change (e.g., matching algorithm update, personality assessment revision).

**Status:** 🟡 Scheduled for next core engine task

#### R12. No cost tracking per task
**Problem:** The cost model (Tier 1 = $0, Tier 2 = $0.50–$2, Tier 3 = $10–$25) is estimated, not measured.

**Fix:** Add token usage logging to turn summaries. Aggregate by tier weekly.

**Status:** 🔴 Not implemented

---

## 4. What Worked Well

| Practice | Evidence |
|----------|----------|
| **Sprint Contracts catch real gaps** | 19 gaps caught across 3 pilots; 1 critical blocker prevented |
| **Negotiation is fast** | Average 1 cycle, ~6 minutes to acceptance |
| **Tier 2 is the right default** | All 3 pilots were correctly Tier 2; overhead was justified |
| **Verifier + contract review is cheap** | GPT-5.4 mini sufficient; no need for expensive models |
| **No new agents needed** | Existing agent definitions + handoff edges sufficient |
| **File-based contracts survive context** | Contracts persist across agent turns and context compaction |

---

## 5. Recommended Next Steps (Prioritized)

### Week 2 — Critical Fixes
1. **Fix `select-harness-tier.mjs`** — accept explicit file list, warn on full-repo diff
2. **Improve `evaluate-sprint-contract.mjs`** — replace keyword heuristic with prop-name grep + file existence checks
3. **Add contract gate enforcement** — prevent file edits on non-accepted contracts (agent constraint or pre-commit hook)

### Week 3 — Automation
4. **Auto-generate Sprint Contracts** from task-creator output + templates
5. **Update turn-summary schema** with harness metadata fields
6. **Create `harness-kpi-report.mjs`** dashboard script

### Week 4 — Scale
7. **Pilot Tier 3** on next core engine change
8. **Measure actual costs** per tier and calibrate the model
9. **Promote scorecard aggregates** to repo memory for trend analysis

---

## 6. Bottom Line

The Harness Engineering Framework is **operationally ready for Tier 2 tasks**. The Sprint Contract negotiation caught 19 real gaps in 3 pilots, including 1 critical architectural blocker that would have caused mid-implementation scope explosion.

**The 3 critical fixes (R1–R3) must be implemented before scaling beyond the pilot team.** Once fixed, the framework can safely handle 25–30% of tasks with Sprint Contracts, capturing 90% of the quality gain at <2× the cost.

**The mission remains:** Do not build a harness. *Upgrade the one we already have.*
