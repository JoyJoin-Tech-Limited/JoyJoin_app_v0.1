# Harness Consensus Plan: Embedding Quality Engineering into JoyJoin's Implementation Flow

> **Status:** Consensus plan — synthesizes 5 parallel agent analyses of Anthropic's "Harness design for long-running application development" (Mar 24, 2026)  
> **Scope:** Implementation-phase harness integration (not kickoff, not post-review only)  
> **Date:** 2026-04-23  
> **Related:** `harness-design-implementation-phase-mapping.md`, `sprint-contract-implementation-phase.md`, `harness-architecture-mapping.md`, `harness-kpi-framework.md`

---

## 1. Executive Summary

Five parallel analyses of Anthropic's harness design article reached **unanimous consensus** on a single architecture: JoyJoin does not need new agents. It needs **new behavior modes** for existing agents, a **tiered evaluation system**, and a **Sprint Contract loop** that lives inside the implementation phase.

**The core insight from Anthropic:** A generator + evaluator negotiating what "done" looks like *before* coding begins produces dramatically better quality than post-hoc review alone. Their harness was 20× more expensive ($200 vs. $9) but produced functional apps where solo runs produced broken ones.

**JoyJoin's answer:** Capture the *discipline* of the harness without the *cost architecture*. Use a 3-tier model that applies expensive evaluation only where risk justifies it.

| Tier | Cost | Frequency | What It Does |
|------|------|-----------|--------------|
| **Tier 1** | ~$0 (baseline) | ~70% of tasks | Deterministic gate: `npm run harness:gate` + `check:full` + Auto-Eval. No Sprint Contract. |
| **Tier 2** | ~$0.50–$2 (1.3–1.7×) | ~25% of tasks | Sprint Contract loop: Implementer writes contract → Verifier reviews → implement → QA Agent evaluates against hard thresholds. |
| **Tier 3** | ~$10–$25 (5–10×) | ~5% of tasks | Full Harness deliberation: Harness Runtime Controller runs PGE → Council → Consensus → locked contract → implement → QA Agent + Verifier. |

**Blended cost:** ~1.3–1.8× vs. pure solo implementation.

---

## 2. Consensus Architecture

### 2.1 Role Mapping (Unanimous Across All Analyses)

| Anthropic Role | JoyJoin Agent | Responsibility |
|----------------|---------------|----------------|
| **Planner** | **Supervisor** (Tier 1/2) or **Harness Runtime Controller** (Tier 3) | Decomposes plan into sprint-sized chunks; assesses tier; routes to specialist. HRC runs full PGE + Council for high-stakes work. |
| **Generator** | **Specialist Engineers** (Backend, AI, Frontend, Taro) | Write Sprint Contract proposal → self-evaluate → implement → hand to Evaluator. No new generic "Implementation Agent." |
| **Evaluator** | **Two-phase:** `Verifier` (contract review, pre-implementation) + `QA Agent` (Sprint Evaluation, post-implementation) | Verifier catches vagueness and pillar gaps in the contract. QA Agent tests the running app against criteria with hard thresholds. |

**Key rule:** Domain specialization is preserved. Backend Engineer stays Backend Engineer; they just gain "Generator behavior" (contract protocol, self-evaluation checkpoint).

### 2.2 The Sprint Contract (Unanimous)

Before the first file edit on Tier 2+ tasks, the Implementer writes a Sprint Contract and negotiates it with the Verifier.

**Format:** Hybrid Markdown+JSON frontmatter stored at `.git/.orchestration/sprints/sprint-contract.{taskId}.md`

**Contents:**
- Metadata (task, agents, tier, status, timestamps)
- Goal (one sentence)
- Acceptance Criteria (3–10 testable items with verification methods and hard thresholds)
- Harness Pillar Criteria (per-pillar, task-specific expectations)
- Out-of-Scope (prevents creep)
- Verification Method Summary
- Negotiation Log (max 2 cycles)

**Trigger conditions:** New routes, multi-file changes, auth changes, stateful operations, DB migrations, UI flows. **Not triggered for:** single-line fixes, pure refactoring, test-only changes, ≤50 lines in 1 workspace.

### 2.3 Hard Thresholds (Unanimous)

Every criterion in the Sprint Contract has a hard threshold. The sprint fails if any required criterion is unmet.

**Per-tier thresholds (from KPI framework):**

| Tier | Pillar Score Threshold | Evaluator Mix | Max Iterations |
|------|----------------------|---------------|----------------|
| Tier 1 | All pillars ≥3 | Automated only | 0 |
| Tier 2 | All pillars ≥3; any <3 → FAIL | Automated + QA Agent | 3 |
| Tier 3 | All pillars ≥4; any <4 → FAIL | Automated + QA Agent + Verifier | 3 (QA) + 1 (Verifier) |

**Auto-fail conditions (any tier):**
- Secrets in diff
- New route with no auth middleware
- `console.log` of user data
- N+1 query with no pagination
- File size >1500 lines (logic) / >1200 lines (frontend) without exemption

### 2.4 Evaluation Flow (Unanimous)

```
Task received
│
├─ Tier 1? → Engineer implements → Auto-Eval gate → Done
│
├─ Tier 2? → Engineer writes Sprint Contract draft
│           → Verifier reviews (max 2 cycles)
│           → Contract accepted
│           → Engineer implements
│           → Self-evaluation
│           → QA Agent Sprint Evaluation (hard thresholds)
│           → If FAIL → feedback → fix → re-evaluate (max 3 iterations)
│           → If PASS → Auto-Eval gate → Done
│
└─ Tier 3? → Harness Runtime Controller runs PGE → Council → Consensus
            → Locked Sprint Contract produced
            → Engineer implements
            → QA Agent Sprint Evaluation
            → Verifier skeptical post-claim check
            → Harness Completion Gate
            → Done
```

### 2.5 File Artifacts (Unanimous)

| Artifact | Path | Purpose |
|----------|------|---------|
| Sprint Contract | `.git/.orchestration/sprints/sprint-contract.{taskId}.md` | Negotiated done-ness criteria |
| Sprint Feedback | `.git/.orchestration/sprints/sprint-{id}-feedback.json` | QA Agent rejection with specific grades |
| Sprint Verdict | `.git/.orchestration/sprints/sprint-{id}-verdict.json` | QA Agent acceptance |
| Harness Scorecard | `.git/.orchestration/scorecards/{taskId}.json` | 5-pillar graded evaluation record |

All files are `.gitignore`d (ephemeral workflow state). Retention: 30 days post-merge, then archive.

---

## 3. KPI Framework (Consensus)

### 3.1 Scoring Rubric: 1–5 per Pillar

Each pillar has 5 sub-criteria (A–E). The pillar score is the **minimum** of its sub-criteria.

| Score | Meaning |
|-------|---------|
| 1 | Critical failure — missing, dangerously wrong, or actively harmful |
| 2 | Partial / superficial — present but incomplete or untested |
| 3 | Adequate / meets minimum — present, correct, verifiable |
| 4 | Good / thorough — well-designed, tested, edge cases considered |
| 5 | Excellent / exemplary — best-in-class, resilient under stress |

**Pillar sub-criteria (summary):**

| Pillar | A | B | C | D | E |
|--------|---|---|---|---|---|
| **Reliability** | Error path coverage | Atomicity / recovery | External call resilience | Idempotency | Race condition safety |
| **Scalability** | N+1 elimination | Pagination / bounding | Memory bounding | Concurrency safety | DB index fitness |
| **Security** | Auth / permission gates | Fail-closed defaults | Secret hygiene | Sensitive data in errors | Input validation |
| **Observability** | Structured error logging | Traceability / correlation | Metrics / alert coverage | Audit logging | Logger discipline |
| **Maintainability** | Layer placement | Cross-app import hygiene | Shared package usage | Pattern consistency | File size / abstraction |

*Full rubric with score definitions per sub-criterion: see `harness-kpi-framework.md` §2.*

### 3.2 Top-Level Effectiveness KPIs

Track these weekly to prove the harness is working:

| KPI | Target | Measurement |
|-----|--------|-------------|
| **Bug Escape Rate** | <10% of P0/P1 bugs escape through Harness gaps | Post-mortem: "Which pillar would have caught this?" |
| **Harness Gate Failure Rate** | Tier 1 <5%; Tier 2 <15%; Tier 3 <10% | % of tasks failing on first evaluation |
| **Rework Rate** | Tier 2 <30%; Tier 3 <20% | % of tasks requiring >1 QA iteration |
| **Sprint Contract Acceptance Rate** | >60% accepted on first review | Contracts accepted without amendment / total contracts |
| **Mean Time to Harness Pass** | Tier 1 <5 min; Tier 2 <30 min; Tier 3 <2 hr | Time from "claim done" to first PASS |

*Full KPI definitions: see `harness-kpi-framework.md` §6.*

---

## 4. Model Tier Recommendations (Consensus)

Pair cheap models to shallow work, strong models to irreducible complexity.

| Role | Task | Model | Cost Multiplier |
|------|------|-------|----------------|
| Supervisor (Tier 2 routing) | Routing, tier assessment | Sonnet 4.6 / GPT-5.4 xhigh | 1.0× |
| HRC (Tier 3 deliberation) | Architectural council, consensus | Opus 4.6 / Opus 4.7 | 3.0–7.5× |
| Generator — standard | Implementation, multi-file edits | GPT-5.4 xhigh / Sonnet 4.6 | 1.0× |
| Generator — core engine | Matching, personality, auth | Opus 4.6 | 3.0× |
| Verifier (contract review) | Review markdown for vagueness | GPT-5.4 mini | 0.33× |
| QA Agent (Sprint Evaluation) | Playwright MCP, grading | Sonnet 4.6 / GPT-5.4 xhigh | 1.0× |
| QA Agent (static only) | Scripted tests, no Playwright | GPT-5.4 mini | 0.33× |

**Cost-control rule:** If a Tier 2 task's verification is purely command-based (no Playwright, no screenshots), downgrade QA Agent to mini.

---

## 5. Orchestration Changes (Consensus)

### 5.1 Supervisor Routing Decision Tree

Replace Supervisor's default workflow step 2 with tier-aware assessment:

1. Inspect scope: changed files, workspaces touched, new routes, auth/payment surfaces, schema changes.
2. **Tier 3 filter first:** Core engine, payment, >5 core files, architectural boundary, new critical journey, genuine ambiguity → route to HRC.
3. **Tier 2 filter:** New route, multi-file, auth, stateful op, migration, UI flow, cross-file, AI service → route to engineer with "write Sprint Contract" instruction.
4. **Tier 1 fallback:** ≤50 lines, 1 workspace, no new routes → route directly to engineer.
5. **Sprint sizing cap:** If a plan step implies >10 files or >300 lines, Supervisor must decompose into multiple sprints.

### 5.2 New Handoff Graph Edges

Add to `orchestration.yaml` → `handoff_graph`:

**Sprint Contract negotiation:**
- `Backend Engineer` / `AI Engineer` / `Expert React Frontend Engineer` / `Taro Mini-Program Frontend Engineer` → `Verifier`: "Propose Sprint Contract draft"
- `Verifier` → each engineer: "Contract needs revision" or "Contract accepted — implement"

**Sprint Evaluation:**
- Each engineer → `QA Agent`: "Sprint complete — evaluate"
- `QA Agent` → each engineer: "Sprint failed — return to generator" (max 3 iterations)
- `QA Agent` → `Auto-Eval`: "Sprint accepted — run dirty-worktree gate"

**Tier 3:**
- `Supervisor` → `Harness Runtime Controller`: "Tier 3 — full harness deliberation"
- `Harness Runtime Controller` → `Supervisor`: "Route Harness consensus to implementation"
- `QA Agent` → `Verifier` (Tier 3 only): "Skeptical post-claim verification"

*Full edge specifications with prompts: see `harness-architecture-mapping.md` §5.*

### 5.3 Agent Definition Changes

**Implementing engineers** (`backend-engineer.agent.md`, `taro-mini-program-frontend-engineer.agent.md`, etc.):
- Add to default workflow: "If `contractRequired: true`, write Sprint Contract draft before editing files. Do not begin implementation until contract is accepted."
- Add constraint: "DO NOT begin file edits on a `contractRequired` task before Sprint Contract acceptance."

**Verifier** (`verifier.agent.md`):
- Add Contract Evaluator mode: review draft contracts for testability, edge-case coverage, pillar gaps, unrealistic verification methods.
- Max 2 negotiation cycles. Return ACK with specific changes or REJECT with concrete feedback.

**QA Agent** (`qa-agent.agent.md`):
- Add Sprint Evaluation mode: run verification method, grade each criterion PASS/PARTIAL/FAIL with hard thresholds, write verdict JSON.
- Re-evaluate only failed criteria on iteration, not full suite.

*Full agent definition deltas: see `sprint-contract-implementation-phase.md` §5.2.*

---

## 6. Tooling Integration (Consensus)

### 6.1 New/Modified Scripts

| Script | Purpose | Tier |
|--------|---------|------|
| `scripts/select-harness-tier.mjs` | Deterministic router: reads git diff + task metadata, recommends tier | All |
| `scripts/evaluate-sprint-contract.mjs` | Single LLM call: diff vs. contract mission check | Tier 2 |
| `scripts/evaluate-api-drift.mjs` | AST-based Zod schema vs. route handler drift detection | Tier 2 |
| `scripts/harness-full.mjs` | Orchestrator: Planner call → Generator → Evaluator with round cap | Tier 3 |
| `npm run harness:gate` (updated) | Reads active Sprint Contract, tags findings with criterion IDs | All |

### 6.2 CI/CD Integration

- **Tier 1:** Runs in existing pre-commit and PR checks (no change).
- **Tier 2:** Non-blocking CI job for PRs labeled `risk-medium`. Runs targeted tests + LLM checks.
- **Tier 3:** Blocking CI job for PRs labeled `risk-high` or `harness-required`. Runs Playwright smoke (journey-only, max 3 tests) + structured review.

### 6.3 Turn-Level Data Flow

```
1. Agent receives task + tier tag
2. If Tier 2+: writes Sprint Contract → saves to .git/.orchestration/sprints/
3. If contract required: routes to Verifier for review
4. Verifier accepts → agent implements
5. Agent self-evaluates against contract criteria
6. Agent hands to QA Agent for Sprint Evaluation
7. QA Agent runs verification method → grades → writes feedback or verdict
8. If rejected → agent fixes → step 5
9. If accepted → Auto-Eval runs dirty-worktree gate
10. If Tier 3 → Verifier runs skeptical spot-check
11. Done
```

*Full technical design with file schemas and sequence diagrams: see `harness-architecture-mapping.md` §7 and `harness-design-implementation-phase-mapping.md` §3.*

---

## 7. Implementation Roadmap

### Week 1: Pilot (Manual)
- Enable Sprint Contracts manually for 3–5 tasks in Kickoff and Harness lanes.
- Use Backend Engineer and Taro Mini-Program Frontend Engineer as pilots.
- No script changes — markdown files + agent instruction updates only.
- Measure: contract acceptance rate, criteria count, post-implementation gate failure rate.

### Week 2: Automation (Tier 2)
- Update `task-creator` skill to auto-tag `contractRequired`.
- Update `backend-engineer.agent.md`, `verifier.agent.md`, `qa-agent.agent.md`.
- Add `scripts/select-harness-tier.mjs`.
- Create `scripts/evaluate-sprint-contract.mjs` and `scripts/evaluate-api-drift.mjs`.
- Wire into CI as non-blocking for `risk-medium` PRs.

### Week 3: Tier 3 + Observability
- Create `scripts/harness-full.mjs` orchestrator.
- Add CI job for `risk-high` / `harness-required` PRs.
- Set hard thresholds: max 2 QA rounds, max 3 smoke tests, max 30-min runtime.
- Add harness tier + cost logging to Prometheus/Loki.

### Week 4: Instrumentation + Baseline
- Update `npm run harness:gate` to read active contracts and tag findings.
- Update turn-summary schema with `harnessScorecardId` and `sprintContract` fields.
- Run 10 pilot tasks across each tier to establish baseline metrics.
- Begin tracking the 5 top-level KPIs in weekly reports.

---

## 8. Open Questions (All Analyses Agree These Need Resolution)

1. **Contract Evaluator veto power:** If the implementer drafts a contract that is too large, should the Evaluator force a slice reduction, or escalate to Supervisor?
2. **Contract drift mid-implementation:** If the implementer discovers a blocker that invalidates a criterion, do they amend mid-flight or stop and re-negotiate?
3. **Playwright in Tier 2 MVP:** Should the Contract Evaluator require a UI preview before accepting, or is that too expensive for MVP?
4. **Human override path:** If implementer and evaluator deadlock after 2 cycles, does Supervisor auto-escalate to human, or try a third cycle?
5. **Scorecard persistence:** Should scorecards be promoted to `repo-memory/` for long-term trend analysis, or stay ephemeral?

---

## 9. Bottom Line

**JoyJoin does not need Anthropic's $200 harness.** We need the *discipline* of the harness (Sprint Contracts, hard thresholds, Evaluator catching real issues) without the *architecture* of the harness (serial agents, Playwright everywhere, 6-hour runs).

The existing deterministic infrastructure (`harness-completion-gate`, `auto-eval`, CI) is our secret weapon. It lets us run **Tier 1 for free**. By adding lightweight, context-constrained Sprint Contracts for **Tier 2** and reserving full multi-agent deliberation for **Tier 3**, we capture 90% of the quality gain at **<2× the cost**.

**The mission:** Do not build a harness. *Upgrade the one we already have.*

---

## Appendix: Parallel Analysis Sources

This consensus plan synthesizes the following parallel analyses, all conducted on the same Anthropic article:

1. **Pragmatist Analysis** (agent-nmcih9lf) — Tiered cost model, essential-vs-luxury decomposition, ROI metrics. *Output: full proposal in task notification.*
2. **Sprint Contract Mechanism** (agent-1blpfp8t) — Contract format, negotiation protocol, per-pillar criteria templates, integration with existing orchestration. *Output: `sprint-contract-implementation-phase.md`.*
3. **Architecture Mapping** (agent-lmj0xvlo) — Role mapping table, Supervisor routing decision tree, handoff graph changes, model tier recommendations. *Output: `harness-architecture-mapping.md`.*
4. **KPI Framework** (agent-mmmc6ji7) — 1–5 scoring rubrics per pillar, hard thresholds per tier, Harness Scorecard JSON schema, effectiveness KPIs. *Output: `harness-kpi-framework.md`.*
5. **Design Mapping** (agent-kbhc847g) — Planner→Generator→Evaluator mapping to JoyJoin agents, Sprint Contract JSON artifacts, orchestration.yaml changes. *Output: `harness-design-implementation-phase-mapping.md`.*
