# Proposal: Embedding Anthropic Harness Design into JoyJoin Implementation Phase

> **Status:** Draft proposal for orchestration.yaml and agent definition changes  
> **Scope:** Implementation-phase agent behavior (not kickoff, not post-review)  
> **Date:** 2026-04-23  
> **Based on:** Anthropic "Harness design for long-running application development" (Mar 24, 2026)

---

## 1. Executive Summary

Anthropic's 3-agent harness (Planner → Generator → Evaluator, with Sprint Contracts and hard-threshold evaluation) produced **dramatically better quality** (functional vs. broken) at **20× cost**. JoyJoin already has the pieces, but they are **spatially separated**:

| Anthropic Pattern | JoyJoin Today | JoyJoin Gap |
|-------------------|---------------|-------------|
| Planner | Planner (kickoff only) + Harness Runtime Controller (pre-impl deliberation) | Planner dies after kickoff; no sprint-level decomposition during code execution |
| Generator | Backend/AI/Frontend/Taro Engineer | No sprint contract, no self-evaluation checkpoint, no git boundary |
| Evaluator | **None exactly** | QA Agent plans verification; Verifier spot-checks claims; Auto-Eval runs deterministic gate; **No agent systematically tests the running app against a negotiated contract with hard thresholds** |
| Sprint Contract | Harness Runtime Controller produces one (pre-impl) | Contract is pre-implementation only; no per-sprint contract during active coding |

**Thesis:** We do not need new agents. We need **new behavior modes** for existing agents and **a file-based Sprint Contract loop** that lives *inside* the implementation phase.

---

## 2. Question-by-Question Answers

### Q1: How should Planner-Generator-Evaluator map during direct code execution?

**Planner → Supervisor as Sprint Router**
- Anthropic's Planner stays alive during implementation, breaking the spec into sprint-sized chunks.
- JoyJoin's Planner currently dies after kickoff. We **do not reactivate Planner** during implementation (too expensive, context-switching losses).
- Instead, **Supervisor** takes on "Sprint Router" behavior: it treats the approved plan's steps as sprint boundaries and routes **one step at a time** to the specialist engineer.
- For complex decomposition mid-implementation, Supervisor may reactivate Planner, but this is the exception, not the rule.

**Generator → Existing Specialist Engineers**
- Backend Engineer, AI Engineer, Expert React Frontend Engineer, and Taro Mini-Program Frontend Engineer **are** the Generators.
- They gain **Generator behavior patterns**: write Sprint Contract proposal → self-evaluate → git checkpoint → hand to Evaluator.
- We do **not** create a generic "Implementation Agent." Domain specialization is a JoyJoin strength that Anthropic's single Generator lacks.

**Evaluator → QA Agent (enhanced with Sprint Evaluation mode)**
- QA Agent already owns Playwright MCP, observability MCP, and GitHub MCP.
- We add a **Sprint Evaluation sub-mode** where QA Agent grades the running application against the Sprint Contract using **hard thresholds** (any dimension below threshold → sprint fails, detailed feedback returned to Generator).
- Verifier stays as a separate skeptical post-claim check (not replaced).
- Auto-Eval stays as the deterministic dirty-worktree gate (not replaced).

### Q2: Should Generator BE the Backend Engineer, or a new "Implementation Agent" persona?

**Generator = existing specialist engineers. No new agent.**

Rationale:
- JoyJoin's domain-split (Backend vs. AI vs. Frontend vs. Taro) is intentional and correct. A generic "Implementation Agent" would lose the deep domain skills currently loaded by each engineer.
- The Generator behavior (sprint contract, self-eval, git checkpoint) is **tooling and protocol**, not a new persona.
- Each engineer's agent definition gets a "Sprint Contract Protocol" section.

### Q3: How does Sprint Contract work when a human gives a task directly?

**Two paths:**

**Path A: Human gives detailed task (most common)**
1. Generator (implementing engineer) reads the human's instructions and the approved plan.
2. Generator writes a **Sprint Contract proposal** to `.git/.orchestration/sprints/sprint-{id}.json`:
   - `goal`: one sentence
   - `acceptanceCriteria`: 3–5 testable items
   - `technicalConstraints`: specific rules (e.g., "Must not modify shared schema," "Must use existing repository pattern")
   - `verificationMethod`: Playwright path, API curl command, or test command
3. Generator hands off to QA Agent for contract review.
4. QA Agent reviews for testability and edge-case coverage. May request changes (1–2 cheap iterations).
5. Once ACKed, the contract is locked. Generator implements.

**Path B: Human gives 1-sentence prompt (kickoff lane)**
- Researcher → Planner already runs. Planner's output includes step-by-step execution plan.
- Supervisor decomposes this into sprint-sized chunks.
- Each chunk triggers Path A automatically.

**Key rule:** The Sprint Contract is **file-based** (JSON in `.git/.orchestration/sprints/`), not chat-state. This matches Anthropic's "communication via files" principle and survives context compaction.

### Q4: Where does Evaluator fit — QA Agent, Verifier, Auto-Eval, or a new thing?

**Evaluator = QA Agent with Sprint Evaluation mode.**

Why QA Agent:
- It already has Playwright MCP for browser-based verification.
- It already has observability MCP for backend health checks.
- Its tooling (`read`, `search`, `execute`) supports running tests and inspecting state.
- Its current role is "verification," just not contract-graded verification.

Why not Verifier:
- Verifier is a skeptical spot-checker, not a systematic tester. It runs narrow commands to falsify claims.
- The Evaluator needs to test the *running application* against criteria — closer to QA Agent's journey coverage.

Why not Auto-Eval:
- Auto-Eval is deterministic (scripted guardrails, fingerprint gate). The Evaluator is **heuristic** (Playwright-based UI testing, visual design grading, functionality depth).
- They are complementary layers, not substitutes.

Why not a new agent:
- Adding an agent to the core-v1 graph has blast radius (manifest updates, orchestration.yaml, handoff graph, pre-commit validation).
- QA Agent's current tooling assessment is already "partial" with a recommended Playwright extension. This proposal fulfills that recommendation.

**New behavior added to QA Agent:**
- **Sprint Contract Review:** Read `.git/.orchestration/sprints/*.json`, challenge weak acceptance criteria, ACK or request revision.
- **Sprint Evaluation:** After Generator claims completion, run the verification method, grade each criterion `PASS` / `FAIL` / `PARTIAL`, apply hard thresholds.
- **Feedback Loop:** If any criterion fails, write `.git/.orchestration/sprints/sprint-{id}-feedback.json` and route back to the Generator engineer.
- **Sprint Verdict:** If all pass, write `.git/.orchestration/sprints/sprint-{id}-verdict.json` and route to Auto-Eval → Launch Readiness.

### Q5: How do we avoid the 20× cost blowup while keeping quality gains?

**Tiered harness application:**

| Tier | Trigger | Planner | Generator | Evaluator | Cost Multiplier |
|------|---------|---------|-----------|-----------|-----------------|
| **Tier 1: Direct Delivery** | ≤50 lines, 1 workspace, no new routes | None (human or Supervisor brief) | Engineer implements | **Auto-Eval only** (skip QA Agent Sprint Evaluation) | ~1× |
| **Tier 2: Sprint Contract Loop** | >50 lines OR touches UI OR new API route OR cross-file dependency | Supervisor routes plan step | Engineer writes contract, implements, self-evaluates | **QA Agent** reviews contract + evaluates sprint with hard thresholds | ~3–5× |
| **Tier 3: Full Harness Lane** | Core engine (matching, personality, auth, payment) OR >100 lines OR cross-workspace | Harness Runtime Controller (pre-impl PGE deliberation) | Engineer implements per locked Sprint Contract | **QA Agent** sprint evaluation + **Harness Completion Gate** + **Verifier** skeptical check | ~10–20× |

**Cost-control rules:**

1. **Sprint sizing cap:** No sprint changes more than ~10 files or ~300 lines. If bigger, Supervisor must decompose into multiple sprints.
2. **Evaluator skip for trivial changes:** Tier 1 changes skip QA Agent Sprint Evaluation entirely. Auto-Eval is sufficient.
3. **Contract review is cheap:** QA Agent reading a JSON contract and commenting is a single fast turn (~$0.10). The expensive part is Playwright-based evaluation. We only run Playwright when the contract's `verificationMethod` requires it.
4. **Hard threshold caching:** If Generator was rejected and only fixes a specific file, QA Agent re-evaluates only the failed criterion, not the full suite.
5. **Parallel sprints:** Independent frontend and backend sprints can run in parallel with separate contracts, evaluated separately.
6. **No Evaluator on every commit:** The Evaluator runs at **sprint completion boundaries**, not on every file save or git commit.

---

## 3. Concrete Architecture Changes

### 3.1 New File Artifact: Sprint Contract JSON

```json
// .git/.orchestration/sprints/sprint-{timestamp}-{hash}.json
{
  "sprintId": "sprint_20260423_abc123",
  "parentPlanId": "plan_20260423_def456",
  "generatorAgent": "Backend Engineer",
  "evaluatorAgent": "QA Agent",
  "status": "proposed",
  "goal": "Add refund endpoint with idempotency key",
  "acceptanceCriteria": [
    { "id": "ac-1", "criterion": "POST /api/payments/refund returns 202 with idempotency key", "testMethod": "curl + db query", "weight": "required" },
    { "id": "ac-2", "criterion": "Duplicate idempotency key returns same response, no double refund", "testMethod": "unit test", "weight": "required" },
    { "id": "ac-3", "criterion": "Refund amount cannot exceed original payment", "testMethod": "zod validation test", "weight": "required" },
    { "id": "ac-4", "criterion": "Audit log entry created for every refund attempt", "testMethod": "log inspection", "weight": "required" }
  ],
  "technicalConstraints": [
    "Must use existing payment-entitlement service layer",
    "Must not modify packages/shared/src/schema.ts",
    "Must wrap refund in transaction with audit log"
  ],
  "verificationMethod": {
    "type": "api_test",
    "commands": ["npm run test -w @joyjoin/server -- refund"],
    "playwrightJourney": null
  },
  "maxEvaluatorIterations": 3,
  "createdAt": "2026-04-23T10:00:00Z"
}
```

### 3.2 New File Artifact: Sprint Feedback JSON

```json
// .git/.orchestration/sprints/sprint-{id}-feedback.json
{
  "sprintId": "sprint_20260423_abc123",
  "verdict": "REJECT",
  "evaluatedBy": "QA Agent",
  "grades": [
    { "criterionId": "ac-1", "grade": "PASS", "evidence": "curl returned 202, idempotency key present" },
    { "criterionId": "ac-2", "grade": "FAIL", "evidence": "Duplicate key returned 500 instead of cached 202; race condition in idempotency check" },
    { "criterionId": "ac-3", "grade": "PASS", "evidence": "Zod schema rejects over-refund" },
    { "criterionId": "ac-4", "grade": "PARTIAL", "evidence": "Audit log created on success, missing on validation failure" }
  ],
  "blockingIssues": ["ac-2: idempotency race condition"],
  "concerns": ["ac-4: audit log coverage gap"],
  "feedbackForGenerator": "Fix race condition in idempotency lookup by adding SELECT FOR UPDATE or unique index constraint. Add audit log call before early validation returns.",
  "iteration": 1,
  "evaluatedAt": "2026-04-23T10:30:00Z"
}
```

### 3.3 New File Artifact: Sprint Verdict JSON

```json
// .git/.orchestration/sprints/sprint-{id}-verdict.json
{
  "sprintId": "sprint_20260423_abc123",
  "verdict": "ACCEPT",
  "evaluatedBy": "QA Agent",
  "grades": [
    { "criterionId": "ac-1", "grade": "PASS" },
    { "criterionId": "ac-2", "grade": "PASS" },
    { "criterionId": "ac-3", "grade": "PASS" },
    { "criterionId": "ac-4", "grade": "PASS" }
  ],
  "allRequiredPassed": true,
  "noBlockingIssues": true,
  "nextStep": "Route to Auto-Eval for dirty-worktree gate",
  "evaluatedAt": "2026-04-23T11:00:00Z"
}
```

---

## 4. Changes to orchestration.yaml

### 4.1 New Handoff Edges

Add to `handoff_graph`:

```yaml
    {
      "from": "Backend Engineer",
      "to": "QA Agent",
      "label": "Propose Sprint Contract",
      "prompt": "Review the proposed Sprint Contract JSON for testability, edge-case coverage, and verification method feasibility. ACK with changes or reject with specific feedback."
    },
    {
      "from": "AI Engineer",
      "to": "QA Agent",
      "label": "Propose Sprint Contract",
      "prompt": "Review the proposed Sprint Contract JSON for testability, edge-case coverage, and verification method feasibility. ACK with changes or reject with specific feedback."
    },
    {
      "from": "Expert React Frontend Engineer",
      "to": "QA Agent",
      "label": "Propose Sprint Contract",
      "prompt": "Review the proposed Sprint Contract JSON for testability, edge-case coverage, and verification method feasibility. ACK with changes or reject with specific feedback."
    },
    {
      "from": "Taro Mini-Program Frontend Engineer",
      "to": "QA Agent",
      "label": "Propose Sprint Contract",
      "prompt": "Review the proposed Sprint Contract JSON for testability, edge-case coverage, and verification method feasibility. ACK with changes or reject with specific feedback."
    },
    {
      "from": "QA Agent",
      "to": "Backend Engineer",
      "label": "Sprint failed — return to generator",
      "prompt": "Use the Sprint Contract feedback JSON to fix the identified issues. Re-run self-evaluation and resubmit for Sprint Evaluation."
    },
    {
      "from": "QA Agent",
      "to": "AI Engineer",
      "label": "Sprint failed — return to generator",
      "prompt": "Use the Sprint Contract feedback JSON to fix the identified issues. Re-run self-evaluation and resubmit for Sprint Evaluation."
    },
    {
      "from": "QA Agent",
      "to": "Expert React Frontend Engineer",
      "label": "Sprint failed — return to generator",
      "prompt": "Use the Sprint Contract feedback JSON to fix the identified issues. Re-run self-evaluation and resubmit for Sprint Evaluation."
    },
    {
      "from": "QA Agent",
      "to": "Taro Mini-Program Frontend Engineer",
      "label": "Sprint failed — return to generator",
      "prompt": "Use the Sprint Contract feedback JSON to fix the identified issues. Re-run self-evaluation and resubmit for Sprint Evaluation."
    },
    {
      "from": "Harness Runtime Controller",
      "to": "QA Agent",
      "label": "Hand off Sprint Contract for evaluation",
      "prompt": "The Harness consensus plan includes a locked Sprint Contract. Review it for operational feasibility, then stand by to evaluate the implementation against it."
    }
```

### 4.2 QA Agent Tooling Assessment Update

In `agent_bindings.QA Agent.tooling_assessment`:

```yaml
      "tooling_assessment": {
        "status": "enhanced",
        "summary": "Playwright MCP and observability MCP now used for Sprint Evaluation mode. Contract review (cheap) and Playwright evaluation (expensive) are gated by tier rules.",
        "recommended_extensions": [
          {
            "type": "mcp",
            "label": "Playwright MCP for browser-based sprint evaluation",
            "reason": "Sprint Evaluation requires clicking through the running application to grade UI/UX criteria."
          },
          {
            "type": "mcp",
            "label": "WeChat DevTools MCP for mini-program sprint evaluation",
            "reason": "Taro mini-program sprints require WXSS/WXML inspection and screenshot capture."
          },
          {
            "type": "integration",
            "label": "Sprint contract JSON schema and persistence",
            "reason": "Evaluator must read/write standardized contract and feedback artifacts."
          }
        ]
      }
```

---

## 5. Changes to Agent Definitions

### 5.1 Backend Engineer (`backend-engineer.agent.md`)

Add after "Default workflow":

```markdown
## Sprint Contract Protocol (Generator mode)

For Tier 2+ features (new routes, stateful operations, >50 lines, or cross-file changes):

1. **Before implementing:** Write a Sprint Contract proposal to `.git/.orchestration/sprints/sprint-{timestamp}-{hash}.json`.
   - Goal: one sentence
   - Acceptance criteria: 3–5 testable items, each with a verification method
   - Technical constraints: boundaries you will not cross
2. **Self-evaluation checkpoint:** Before handing to QA Agent, run:
   - `npm run typecheck` (or workspace-scoped equivalent)
   - `npm run test` for affected workspace
   - `npm run harness:gate` (if available)
   - `git diff --stat` to confirm scope matches contract
3. **Handoff:** Route to QA Agent with the sprint contract path.
4. **On rejection:** Read QA Agent's feedback JSON, fix issues, increment iteration counter in contract, re-run self-evaluation, re-submit.
5. **Max iterations:** 3. If not accepted after 3 cycles, escalate to Supervisor for replanning.

For Tier 1 trivial fixes (≤50 lines, one workspace, no new behavior): Skip Sprint Contract. Implement and route directly to Auto-Eval.
```

### 5.2 AI Engineer (`ai-engineer.agent.md`)

Add identical Sprint Contract Protocol section, with AI-specific note:

```markdown
- Acceptance criteria must include: fallback behavior verification, AI trace logging check, and deterministic authority boundary confirmation.
- Verification method must include a runtime test that triggers the fallback path.
```

### 5.3 Expert React Frontend Engineer (`frontend-engineer.agent.md`)

Add Sprint Contract Protocol with frontend-specific criteria:

```markdown
- Acceptance criteria must cover: design quality (coherent visual identity), originality (not default/template), craft (typography, spacing, color, contrast), functionality (usability, primary actions discoverable).
- Verification method should use Playwright MCP for screenshot + navigation validation.
- Include responsive breakpoint checks if the component has mobile/desktop variants.
```

### 5.4 Taro Mini-Program Frontend Engineer (`taro-mini-program-frontend-engineer.agent.md`)

Add Sprint Contract Protocol with mini-program-specific criteria:

```markdown
- Acceptance criteria must cover: Taro-native component usage, WXSS-safe styling, touch target size, and WeChat DevTools screenshot validation.
- Verification method should use WeChat DevTools MCP for WXML inspection and screenshot capture.
- Include subpackage size impact if applicable.
```

### 5.5 QA Agent (`qa-agent.agent.md`)

Major enhancement. Replace the current file's workflow section with:

```markdown
## Operating Modes

### Mode A: Verification Planning (default)
Turn changes into concrete verification work: smoke coverage, regression focus, environment assumptions, clear pass/fail reporting. This is the existing QA Agent behavior.

### Mode B: Sprint Contract Review
When routed from an engineer with a proposed Sprint Contract:
1. Read the contract JSON.
2. Challenge weak acceptance criteria: are they testable? Do they cover edge cases? Is the verification method feasible?
3. Return ACK or revision request within **one turn**.

### Mode C: Sprint Evaluation (Evaluator mode)
When routed from an engineer who claims sprint completion:
1. Read the locked Sprint Contract and the current code changes.
2. Execute the verification method:
   - API/backend changes: run test commands, use Observability MCP for health checks
   - Frontend/web changes: use Playwright MCP to navigate, screenshot, and validate UI
   - Mini-program changes: use WeChat DevTools MCP to inspect and capture
3. Grade each acceptance criterion: `PASS`, `PARTIAL`, or `FAIL`.
4. Apply hard thresholds:
   - Any `FAIL` on a `required` criterion → `VERDICT: REJECT`
   - Any `FAIL` on a `weighted` criterion → `VERDICT: REJECT`
   - `PARTIAL` only allowed if contract explicitly permits it for that criterion
5. Write feedback JSON (if REJECT) or verdict JSON (if ACCEPT).
6. If REJECT, route back to the Generator engineer with specific feedback.
7. If ACCEPT, route to Auto-Eval for dirty-worktree gate.

## Constraints
- DO NOT grade generously. A generator that stubs a feature or misses an edge case must fail.
- DO NOT skip Playwright or WeChat DevTools verification when the contract specifies it.
- DO NOT produce vague feedback. Each FAIL must reference a specific criterion and provide a concrete fix direction.
- Max evaluator iterations per sprint: 3.
```

### 5.6 Supervisor (`supervisor.agent.md`)

Add to "Threshold routing model":

```markdown
- **Tier 1 (trivial):** ≤50 lines, 1 workspace, no new routes, no behavior change → route directly to engineer, skip Sprint Contract, expect Auto-Eval only.
- **Tier 2 (sprint contract):** >50 lines OR new route OR UI change OR cross-file → route to engineer with instruction to write Sprint Contract, then QA Agent.
- **Tier 3 (full harness):** Core engine (matching, personality, auth, payment) OR >100 lines OR cross-workspace → route to Harness Runtime Controller first, then locked Sprint Contract, then implementation, then QA Agent Sprint Evaluation.
```

Add to "Default workflow":

```markdown
4. **Sprint Router behavior:** When an approved plan has multiple steps, route **one step at a time**. Do not hand off the entire plan to an engineer unless the plan is already a single bounded step. Treat each step as a potential sprint boundary.
```

---

## 6. File Placement and Repo Hygiene

- Sprint artifacts live in `.git/.orchestration/sprints/` (already ignored, non-authoritative runtime state).
- No new top-level directories.
- Agent definitions updated in `.github/agents/*.agent.md`.
- Orchestration contract updated in `.github/orchestration.yaml`.
- A JSON schema for sprint contracts should be added: `.git/.orchestration/sprints/schema.json`.

---

## 7. Migration Path

**Phase 1 (immediate):** Update agent definitions and orchestration.yaml handoffs. No runtime behavior changes yet — agents are instructed but not enforced.

**Phase 2 (after validation):** Update Supervisor to emit Tier routing. Engineers start writing Sprint Contracts for Tier 2+ work.

**Phase 3 (after 5–10 sprints):** QA Agent begins Sprint Evaluation mode. Iterate on contract schema based on real usage.

**Phase 4 (mature):** Add `npm run sprint:contract` CLI helper to generate contract template and `npm run sprint:evaluate` to trigger QA Agent evaluation locally.

---

## 8. Risk and Mitigation

| Risk | Mitigation |
|------|------------|
| QA Agent Sprint Evaluation is too slow / expensive | Tier 1 skip rule; Playwright only when contract requires; cache grades for unchanged criteria |
| Engineers skip Sprint Contract writing | Auto-Eval can detect new routes or >50-line changes and flag missing contract; Supervisor enforces Tier 2+ |
| Sprint Contracts become boilerplate | Schema enforces testable criteria; QA Agent rejects vague contracts |
| Feedback loops iterate forever | Max 3 iterations hard cap; escalate to Supervisor on 3rd rejection |
| Context window bloat from large contracts | Contracts are file-based; agent only reads the current sprint JSON, not full history |

---

## 9. Summary: What Changed

| Artifact | Change |
|----------|--------|
| `orchestration.yaml` | 9 new handoff edges; QA Agent tooling status → `enhanced` |
| `backend-engineer.agent.md` | Added Sprint Contract Protocol |
| `ai-engineer.agent.md` | Added Sprint Contract Protocol (AI-specific criteria) |
| `frontend-engineer.agent.md` | Added Sprint Contract Protocol (frontend design criteria) |
| `taro-mini-program-frontend-engineer.agent.md` | Added Sprint Contract Protocol (mini-program criteria) |
| `qa-agent.agent.md` | Added 3 operating modes: Verification Planning, Sprint Contract Review, Sprint Evaluation |
| `supervisor.agent.md` | Added Tier routing rules; added Sprint Router behavior |
| `.git/.orchestration/sprints/` | New runtime directory for contract/feedback/verdict JSON files |

**Bottom line:** JoyJoin's existing agents are the right shapes. We add **Sprint Contract file artifacts** and **hard-threshold Sprint Evaluation** to the implementation flow, gated by a 3-tier cost-control system. The Evaluator is the **QA Agent** elevated with a new sub-mode. The Generator is the **existing specialist engineer** with a pre-flight contract protocol. No new agents required.
