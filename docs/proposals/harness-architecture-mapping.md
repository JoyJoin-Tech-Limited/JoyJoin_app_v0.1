# Harness Architecture Mapping: Anthropic PGE → JoyJoin Agents

> **Status:** Architecture mapping — reconciles `harness-design-implementation-phase-mapping.md` and `sprint-contract-implementation-phase.md`  
> **Scope:** Agent roles, Supervisor routing, orchestration.yaml handoffs, model tiers  
> **Date:** 2026-04-23

---

## 1. Consolidation Principles

Two colleague proposals exist. This document resolves their deltas into a single canonical mapping:

| Delta | Resolution |
|---|---|
| Sprint Contract format: JSON (`.git/.orchestration/sprints/*.json`) vs Markdown (`.git/.orchestration/sprint-contracts/*.md`) | **Hybrid Markdown+JSON frontmatter** stored in `.git/.orchestration/sprints/sprint-contract.{taskId}.md`. Machines parse the frontmatter; humans read the body. |
| Contract Evaluator: QA Agent vs Verifier | **Two-phase evaluator:** `Verifier` reviews the *contract draft* (pre-implementation, shallow, cheap). `QA Agent` runs *Sprint Evaluation* (post-implementation, deep, tool-backed). |
| Tier 1 definition: "Direct Delivery" vs "Deterministic gate" | Aligned: Tier 1 = `Auto-Eval` + `npm run check:full` only; no Sprint Contract, no QA Agent evaluation. |
| Tier 3 Planner: Harness Runtime Controller vs reactivated Planner | **HRC is the Tier 3 Planner.** It runs the full pre-implementation PGE → Council → Consensus loop. Supervisor remains the Tier 2 Planner (Sprint Router). |

---

## 2. Role Mapping Table (Question 1)

| Tier | Anthropic Role | JoyJoin Agent | What they do in this tier |
|---|---|---|---|
| **Tier 1**<br>*(Direct Delivery)* | **Planner** | *None* — human prompt or `Supervisor` brief serves as implicit plan. `task-creator` output (if any) is the lightweight contract. | No planning agent invoked. |
| | **Generator** | **Specialist Engineer** (`Backend Engineer`, `AI Engineer`, `Expert React Frontend Engineer`, `Taro Mini-Program Frontend Engineer`) | Implements the bounded change. |
| | **Evaluator** | **`Auto-Eval`** (deterministic dirty-worktree gate) + `npm run check:full` | Runs guardrails, typecheck, tests. No heuristic evaluation. |
| **Tier 2**<br>*(Sprint Contract Loop)* | **Planner** | **`Supervisor`** acting as *Sprint Router* | Decomposes approved plan into sprint-sized chunks; assesses tier; routes one step at a time. May reactivate `Planner` for mid-stream complex decomposition, but this is the exception. |
| | **Generator** | **Specialist Engineer** (same as Tier 1) | Writes Sprint Contract proposal → self-evaluates → implements → hands to Evaluator. |
| | **Evaluator**<br>*Phase A: Contract Review* | **`Verifier`** | Reviews draft Sprint Contract for testability, edge-case coverage, pillar gaps, and unrealistic verification methods. Max 2 negotiation cycles. |
| | **Evaluator**<br>*Phase B: Sprint Evaluation* | **`QA Agent`** in **Sprint Evaluation mode** | Executes the locked contract's verification method (Playwright MCP, Observability MCP, test commands). Grades each criterion `PASS` / `PARTIAL` / `FAIL` with hard thresholds. Any `FAIL` on a required criterion → `VERDICT: REJECT`. |
| **Tier 3**<br>*(Full Harness)* | **Planner** | **`Harness Runtime Controller`** (HRC) | Runs pre-implementation PGE loop + Council Mode + Consensus Synthesis. Produces a locked Sprint Contract and Harness transcript. |
| | **Generator** | **Specialist Engineer** (same) | Implements against the HRC-locked Sprint Contract. No contract negotiation at this stage — the contract is already sealed. |
| | **Evaluator** | **`QA Agent`** (constrained Sprint Evaluation) + **`Verifier`** (skeptical post-claim check) | QA Agent runs: static gate → Playwright smoke for critical journey only → structured review. Max 2 QA rounds. Verifier runs a final skeptical spot-check after QA acceptance. |

### Key rule: No new agents

The Generator is **not** a generic "Implementation Agent." JoyJoin's domain-split engineers (`Backend Engineer`, `AI Engineer`, `Expert React Frontend Engineer`, `Taro Mini-Program Frontend Engineer`) retain their deep specialization. Generator behavior (Sprint Contract protocol, self-evaluation checkpoint, git diff stat) is **protocol and tooling**, not a new persona.

---

## 3. HRC vs. Lightweight Sprint Contract Boundary (Question 2)

### When the full Harness Runtime Controller runs

Trigger **Tier 3 / HRC** when **any** of the following are true:

| Trigger | Examples |
|---|---|
| Core engine change | `poolMatchingService.ts`, personality V4 assessment, archetype assignment, auth/session layer |
| Payment or money flow | WeChat Pay webhook, refund logic, event-pack credit system |
| Architectural boundary change | New cross-workspace shared contract, breaking API change, new WebSocket room semantics |
| Major refactor | >5 core files touched, >300 lines expected, or changes spanning ≥3 workspaces |
| New critical user journey | Onboarding step addition, first-time purchase flow, matching-result reveal |
| Genuine ambiguity | Requirements are unclear enough that a Sprint Contract cannot be drafted confidently |
| User explicitly says "harness this" or "run full harness" | — |

### When the lightweight Sprint Contract runs

Trigger **Tier 2 / Sprint Contract** when **any** of the following are true **and** Tier 3 is **not** triggered:

| Trigger | Examples |
|---|---|
| New route / endpoint / API contract | `POST /api/admin/payments/:id/refund`, new icebreaker phase route |
| Multi-file change (>2 files across >1 directory) | DB column + shared type + server route |
| Auth or permission boundary change | New admin-only route, RBAC rule change |
| Stateful operation or state machine | Payment flow, matching run, icebreaker phase advance |
| DB schema change (migration) | New table, column rename, constraint tightening |
| UI flow or screen (new page/component) | New onboarding step, admin dashboard widget, mini-program page |
| Cross-file dependency | Change in `packages/shared/src/schema.ts` consumed by server + mini-program |
| AI service change | New prompt version, fallback path, LLM-backed feature |

### When neither runs (Tier 1)

Skip Sprint Contract entirely when:
- Single-line fix, copy change, color tweak
- Pure refactoring with no behavior change (extract function, rename variable)
- Test-only change (add test case, update snapshot)
- ≤50 lines, 1 workspace, no new routes, no behavior change

### Decision flowchart (for Supervisor)

```
Received task / plan step
│
├─ Is it ≤50 lines, 1 workspace, no new routes, no behavior change?
│  └─ YES → Tier 1: Route to Engineer → Auto-Eval only
│
├─ Does it match ANY Tier 3 trigger (core engine, payment, >5 core files,
│   architectural boundary, new critical journey, genuine ambiguity)?
│  └─ YES → Tier 3: Route to Harness Runtime Controller first
│            HRC produces locked Sprint Contract
│            → Engineer implements → QA Agent Sprint Evaluation
│            → Verifier skeptical check → Harness Completion Gate
│
└─ Does it match ANY Tier 2 trigger (new route, multi-file, auth,
   stateful op, migration, UI flow, cross-file, AI service)?
   └─ YES → Tier 2: Route to Engineer with "write Sprint Contract" instruction
             Engineer drafts contract → Verifier reviews (max 2 cycles)
             → Engineer implements → QA Agent Sprint Evaluation
             → Auto-Eval dirty-worktree gate
   
   └─ NO → Ambiguous / does not fit thresholds
            Default to Tier 2 (conservative) or route to Planner for clarification
```

---

## 4. Supervisor Routing Decision Tree (Question 3)

Supervisor's **Default workflow** step 2 is replaced with this tier-aware assessment:

### Step 2 (revised): Assess Harness Tier

1. **Inspect scope:** changed files (estimated), workspaces touched, new routes, auth/payment/matching surfaces, schema changes.
2. **Apply Tier 3 filter first** (high-stakes catch-all). If matched → route to `Harness Runtime Controller`.
3. **Apply Tier 2 filter** (complexity threshold). If matched → route to the narrowest specialist engineer with the instruction: `"This is Tier 2. Write a Sprint Contract before editing files."`
4. **Tier 1 fallback** (bounded, trivial). Route directly to engineer. Skip contract. Expect `Auto-Eval` after implementation.
5. **Sprint sizing cap:** If a single plan step implies >10 files or >300 lines, Supervisor **must decompose** into multiple sprints before routing.

### Revised "Routing (pick one)" format

When Supervisor emits routing options for a Tier 2+ task, append the harness tier and model hint:

```
1. Backend Engineer — write Sprint Contract for admin refund API
   (Tier 2, suggested model: GPT-5.4 xhigh — touches payment boundaries)
2. Verifier — review Sprint Contract draft for testability and pillar gaps
   (Tier 2-evaluator, suggested model: GPT-5.4 mini — narrow review pass)
3. QA Agent — Sprint Evaluation after implementation
   (Tier 2-evaluator, suggested model: Sonnet 4.6 — Playwright + observability MCP)
```

### Mid-stream escalation rules

| Condition | Action |
|---|---|
| Engineer discovers scope > contract mid-implementation | Engineer pauses, amends contract, re-routes to Verifier for delta review |
| Verifier rejects contract twice (deadlock) | Supervisor intervenes: either slice the task smaller, or escalate to Planner for scope clarification |
| QA Agent rejects sprint twice | Supervisor routes back to Engineer with specific feedback; on third rejection, Supervisor reopens Planner or escalates to HRC |
| QA Agent accepts sprint | Route to `Auto-Eval` for dirty-worktree gate, then `Launch Readiness Agent` if release-bound |

---

## 5. Handoff Graph Changes (Question 4)

Add the following edges to `orchestration.yaml` → `handoff_graph`:

### A. Sprint Contract negotiation (pre-implementation)

```yaml
# Engineer proposes contract draft to Verifier
- from: "Backend Engineer"
  to: "Verifier"
  label: "Propose Sprint Contract draft"
  prompt: "Review this Sprint Contract for testability, edge-case coverage, Harness pillar gaps, and verification-method feasibility. Return ACK with specific changes or REJECT with concrete feedback. Max 2 cycles."

- from: "AI Engineer"
  to: "Verifier"
  label: "Propose Sprint Contract draft"
  prompt: "Review this Sprint Contract for testability, edge-case coverage, Harness pillar gaps, and verification-method feasibility. Return ACK with specific changes or REJECT with concrete feedback. Max 2 cycles."

- from: "Expert React Frontend Engineer"
  to: "Verifier"
  label: "Propose Sprint Contract draft"
  prompt: "Review this Sprint Contract for testability, edge-case coverage, Harness pillar gaps, and verification-method feasibility. Return ACK with specific changes or REJECT with concrete feedback. Max 2 cycles."

- from: "Taro Mini-Program Frontend Engineer"
  to: "Verifier"
  label: "Propose Sprint Contract draft"
  prompt: "Review this Sprint Contract for testability, edge-case coverage, Harness pillar gaps, and verification-method feasibility. Return ACK with specific changes or REJECT with concrete feedback. Max 2 cycles."

# Verifier returns to engineer for revision or implementation
- from: "Verifier"
  to: "Backend Engineer"
  label: "Contract needs revision"
  prompt: "Revise the Sprint Contract per Verifier feedback, update the Negotiation Log, and resubmit."

- from: "Verifier"
  to: "AI Engineer"
  label: "Contract needs revision"
  prompt: "Revise the Sprint Contract per Verifier feedback, update the Negotiation Log, and resubmit."

- from: "Verifier"
  to: "Expert React Frontend Engineer"
  label: "Contract needs revision"
  prompt: "Revise the Sprint Contract per Verifier feedback, update the Negotiation Log, and resubmit."

- from: "Verifier"
  to: "Taro Mini-Program Frontend Engineer"
  label: "Contract needs revision"
  prompt: "Revise the Sprint Contract per Verifier feedback, update the Negotiation Log, and resubmit."

# Verifier accepts contract — engineer proceeds to implement
- from: "Verifier"
  to: "Backend Engineer"
  label: "Contract accepted — implement"
  prompt: "Contract is locked. Proceed with implementation against the accepted Sprint Contract. Run self-evaluation before handoff."

- from: "Verifier"
  to: "AI Engineer"
  label: "Contract accepted — implement"
  prompt: "Contract is locked. Proceed with implementation against the accepted Sprint Contract. Run self-evaluation before handoff."

- from: "Verifier"
  to: "Expert React Frontend Engineer"
  label: "Contract accepted — implement"
  prompt: "Contract is locked. Proceed with implementation against the accepted Sprint Contract. Run self-evaluation before handoff."

- from: "Verifier"
  to: "Taro Mini-Program Frontend Engineer"
  label: "Contract accepted — implement"
  prompt: "Contract is locked. Proceed with implementation against the accepted Sprint Contract. Run self-evaluation before handoff."
```

### B. Sprint Evaluation (post-implementation)

```yaml
# Engineer hands completed sprint to QA Agent for evaluation
- from: "Backend Engineer"
  to: "QA Agent"
  label: "Sprint complete — evaluate"
  prompt: "The Sprint Contract has been implemented. Run the verification method, grade each acceptance criterion PASS/PARTIAL/FAIL with hard thresholds, and write verdict JSON. Any FAIL on a required criterion → REJECT."

- from: "AI Engineer"
  to: "QA Agent"
  label: "Sprint complete — evaluate"
  prompt: "The Sprint Contract has been implemented. Run the verification method, grade each acceptance criterion PASS/PARTIAL/FAIL with hard thresholds, and write verdict JSON. Any FAIL on a required criterion → REJECT."

- from: "Expert React Frontend Engineer"
  to: "QA Agent"
  label: "Sprint complete — evaluate"
  prompt: "The Sprint Contract has been implemented. Run the verification method, grade each acceptance criterion PASS/PARTIAL/FAIL with hard thresholds, and write verdict JSON. Any FAIL on a required criterion → REJECT."

- from: "Taro Mini-Program Frontend Engineer"
  to: "QA Agent"
  label: "Sprint complete — evaluate"
  prompt: "The Sprint Contract has been implemented. Run the verification method, grade each acceptance criterion PASS/PARTIAL/FAIL with hard thresholds, and write verdict JSON. Any FAIL on a required criterion → REJECT."

# QA Agent rejects sprint — return to engineer
- from: "QA Agent"
  to: "Backend Engineer"
  label: "Sprint failed — return to generator"
  prompt: "Use the Sprint Contract feedback JSON to fix the identified issues. Re-run self-evaluation and resubmit for Sprint Evaluation. Max 3 iterations total."

- from: "QA Agent"
  to: "AI Engineer"
  label: "Sprint failed — return to generator"
  prompt: "Use the Sprint Contract feedback JSON to fix the identified issues. Re-run self-evaluation and resubmit for Sprint Evaluation. Max 3 iterations total."

- from: "QA Agent"
  to: "Expert React Frontend Engineer"
  label: "Sprint failed — return to generator"
  prompt: "Use the Sprint Contract feedback JSON to fix the identified issues. Re-run self-evaluation and resubmit for Sprint Evaluation. Max 3 iterations total."

- from: "QA Agent"
  to: "Taro Mini-Program Frontend Engineer"
  label: "Sprint failed — return to generator"
  prompt: "Use the Sprint Contract feedback JSON to fix the identified issues. Re-run self-evaluation and resubmit for Sprint Evaluation. Max 3 iterations total."

# QA Agent accepts sprint — route to Auto-Eval for dirty-worktree gate
- from: "QA Agent"
  to: "Auto-Eval"
  label: "Sprint accepted — run dirty-worktree gate"
  prompt: "Run the deterministic dirty-worktree quality gate and confirm no new lint, type, or guardrail failures were introduced."
```

### C. Tier 3 (Harness Runtime Controller) edges

```yaml
# Supervisor routes high-stakes work to HRC
- from: "Supervisor"
  to: "Harness Runtime Controller"
  label: "Tier 3 — full harness deliberation"
  prompt: "This task matches Tier 3 triggers (core engine, payment, architectural boundary, or >5 core files). Run the full PGE → Council → Consensus pipeline. Produce a locked Sprint Contract and Harness transcript."

# HRC hands locked contract to QA Agent to stand by for evaluation
- from: "Harness Runtime Controller"
  to: "QA Agent"
  label: "Locked Sprint Contract ready — stand by for evaluation"
  prompt: "The Harness consensus plan includes a locked Sprint Contract. Review it for operational feasibility, then stand by to evaluate the implementation against it after the engineer completes work."

# HRC hands to Supervisor for implementation routing
- from: "Harness Runtime Controller"
  to: "Supervisor"
  label: "Route Harness consensus to implementation"
  prompt: "Use this Harness consensus-locked plan, Sprint Contract, and pillar verdicts to route the correct implementation specialist."
```

### D. Verifier post-claim skeptical check (Tier 3 only)

```yaml
# After QA Agent accepts in Tier 3, route to Verifier for final skeptical check
- from: "QA Agent"
  to: "Verifier"
  label: "Tier 3 — skeptical post-claim verification"
  prompt: "QA Agent has accepted the sprint. Run a narrow, skeptical spot-check: confirm files exist, claims are evidenced, and no hidden gaps remain. Do not repeat QA Agent's full evaluation."

- from: "Verifier"
  to: "Auto-Eval"
  label: "Run dirty-worktree gate"
  prompt: "Run the deterministic dirty-worktree quality gate and confirm final sign-off."
```

---

## 6. Model Tier Recommendations (Question 5)

### Guiding principle

Pair **cheap models to shallow work** and **strong models to irreducible complexity** (`first-principles-velocity` skill). Implementation (Generator) is the irreducible complexity. Planning and evaluation are shallower, but Playwright-based UI evaluation requires more capability than a narrow script check.

### Per-role model assignment

| Role | Task Shape | Recommended Model | Cost Multiplier | Rationale |
|---|---|---|---|---|
| **Planner** — Supervisor (Tier 2 routing) | Routing, tier assessment, brief delegation | **Sonnet 4.6** or **GPT-5.4 xhigh** | 1.00x | Needs tool-use reliability and multi-file context, but not deep architectural reasoning. |
| **Planner** — HRC internal PGE (Tier 3) | Architectural deliberation, council synthesis, veto override justification | **Opus 4.6** or **Opus 4.7** | 3.00–7.50x | High-stakes, multi-agent coordination, ambiguous tradeoffs. Mistakes are expensive. |
| **Generator** — Backend / AI Engineer | Server implementation, LLM integration, multi-file edits | **GPT-5.4 xhigh** or **Sonnet 4.6** | 1.00x | Default shipping tier. Cross-file consistency and tool orchestration matter. |
| **Generator** — Frontend / Taro Engineer | UI implementation, component architecture, mini-program native patterns | **GPT-5.4 xhigh** or **Sonnet 4.6** | 1.00x | Same as backend; visual hierarchy and platform-native patterns require full model capability. |
| **Generator** — Complex refactor / core engine | Matching engine, personality system, auth rewrite | **Opus 4.6** | 3.00x | Heavy architecture, novel invariants, adversarial edge cases. |
| **Evaluator** — Verifier (contract review) | Review markdown contract for vagueness, edge-case gaps | **GPT-5.4 mini** | 0.33x | Narrow, read-only, shallow reasoning. A mistake here is cheap to fix (another negotiation cycle). |
| **Evaluator** — Verifier (post-claim spot-check) | Run targeted commands, inspect files, falsify claims | **GPT-5.4 mini** | 0.33x | Execution-heavy, not reasoning-heavy. |
| **Evaluator** — QA Agent (Sprint Evaluation) | Playwright MCP UI testing, observability MCP health checks, test command execution, structured grading | **Sonnet 4.6** or **GPT-5.4 xhigh** | 1.00x | Interpretation of flaky UI states, screenshot analysis, and cross-stack health checks requires agentic tool reliability. Do **not** use mini for this — misgrading a sprint is expensive. |
| **Evaluator** — QA Agent (static gate only) | Run `npm run test`, `npm run guardrails`, parse pass/fail | **GPT-5.4 mini** | 0.33x | If the contract verification method is purely scripted (no Playwright), mini is sufficient. |

### Cost-control rule

If a Tier 2 task's verification method is **purely command-based** (no Playwright, no WeChat DevTools, no screenshot analysis), downgrade the QA Agent evaluation to **GPT-5.4 mini**. This is the most common cost-saving lever for backend-only sprints.

---

## 7. Appendix: Consolidated Sprint Contract Format

To resolve the JSON-vs-Markdown delta, use a **hybrid file** with JSON frontmatter and Markdown body:

**Storage:** `.git/.orchestration/sprints/sprint-contract.{taskId}.md`

```markdown
---
{
  "sprintId": "sprint_20260423_abc123",
  "parentPlanId": "plan_20260423_def456",
  "generatorAgent": "Backend Engineer",
  "contractEvaluator": "Verifier",
  "sprintEvaluator": "QA Agent",
  "status": "accepted",
  "tier": 2,
  "createdAt": "2026-04-23T10:00:00Z",
  "acceptedAt": "2026-04-23T10:08:00Z",
  "maxEvaluatorIterations": 3,
  "goal": "Add refund endpoint with idempotency key"
}
---

# Sprint Contract: admin-refund-2026-04-23

## 1. Acceptance Criteria

| ID | Criterion | Verification Method | Weight |
|----|-----------|---------------------|--------|
| AC-01 | `POST /api/admin/payments/:id/refund` returns 200 with refundId | `curl` or Vitest | required |
| AC-02 | Duplicate idempotency key returns same response, no double refund | Unit test | required |
| AC-03 | Refund amount cannot exceed original payment | Zod validation test | required |
| AC-04 | Audit log entry created for every refund attempt | Log inspection | required |

## 2. Harness Pillar Criteria

### Reliability
- REL-01: Refund call has 30s timeout and 1 retry.
- REL-02: Idempotent — same payment returns same refundId.

### Scalability
- SCA-01: No N+1 — lookup uses indexed `id`.

### Security
- SEC-01: Route behind `requireAdmin` middleware.
- SEC-02: Request body validated with Zod.

### Observability
- OBS-01: Failure logs `logger.error` with `requestId` and `paymentId`.
- OBS-02: Audit log entry includes actor, target, amount.

### Maintainability
- MNT-01: Route lives in `apps/server/src/routes/domains/adminPayments.ts`.
- MNT-02: Logic lives in `paymentService.ts`, not `storage.ts`.

## 3. Out-of-Scope
- Automatic refund on event cancellation.
- Partial refund UI for split payments.

## 4. Verification Method Summary
Run `npm run test -w @joyjoin/server` scoped to payment routes, `npm run guardrails`, and inspect audit log table.

## 5. Negotiation Log
- **10:00** Implementer proposed: Initial draft with 4 ACs.
- **10:05** Verifier reviewed: "Missing REL-02 (idempotency). Add SEC-02 (Zod)."
- **10:08** Implementer amended: Added REL-02, SEC-02. Verifier accepted.
```

**Why this format:**
- **Machines** (QA Agent grading scripts, Harness Completion Gate) parse the JSON frontmatter and the Markdown tables deterministically.
- **Humans** (engineers reviewing `.git/.orchestration/sprints/` in a PR) read the full narrative without parsing JSON.
- **Git** treats it as a single file (simpler than sidecar JSON).
- **Retention:** 30 days post-merge, then archive to `.git/.orchestration/sprints/archive/`.

---

## 8. Summary: What Changes in orchestration.yaml

| Section | Change |
|---|---|
| `handoff_graph` | Add 24+ new edges (§5): Engineer↔Verifier (contract negotiation), Engineer→QA Agent (evaluation), QA Agent→Engineer (rejection loop), QA Agent→Auto-Eval (acceptance), Supervisor→HRC (Tier 3), HRC→QA Agent (standby), QA Agent→Verifier (Tier 3 skeptical check). |
| `agent_bindings.QA Agent.tooling_assessment` | Upgrade from `partial` to `enhanced`. Add Playwright MCP and WeChat DevTools MCP as realized capabilities (not just recommended). |
| `agent_bindings.Verifier` | Add `contract-evaluation` capability note. |
| `copilot_hooks.orchestration.kickoff_lane` | No change — HRC already exists as the harness lane entry. |

---

**Bottom line:** JoyJoin does not need new agents. It needs **new handoff edges** in `orchestration.yaml`, **hybrid Sprint Contract artifacts**, and **tier-aware Supervisor routing**. The Planner-Generator-Evaluator triad maps cleanly onto existing agents: Supervisor/HRC as Planner, specialist engineers as Generator, and Verifier+QA Agent as the two-phase Evaluator.
