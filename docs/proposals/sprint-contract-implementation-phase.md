# Proposal: Sprint Contracts in the Implementation Phase

> **Status:** Draft proposal  
> **Scope:** Orchestration, agent workflow, Harness Engineering Framework  
> **Author:** Agent analysis of Anthropic "Harness design for long-running application development" (Mar 24, 2026) applied to JoyJoin  
> **Related:** `.github/agents/harness-runtime-controller.agent.md` (existing pre-implementation PGE loop), `harness-completion-gate` skill, `verifier.agent.md`

---

## 1. Executive Summary

JoyJoin already has a **Harness Completion Gate** (post-implementation) and a **Harness Runtime Controller** (pre-implementation deliberation chamber with PGE loop). What we lack is the **Sprint Contract mechanism in the implementation phase itself** — the moment where the *implementing agent* and an *evaluator persona* negotiate what "done" looks like **before** the first file is edited.

The Anthropic article shows that this negotiation is the single biggest quality lever: a generator + evaluator contract, negotiated pre-code, produces dramatically better outcomes than post-hoc verification alone. JoyJoin can adopt this without the 20× cost overhead by making the contract **lightweight, file-based, and threshold-gated**.

**The core shift:**  
> From: `Plan → Implement → Harness Gate (end)`  
> To: `Plan → Contract Negotiation → Implement → Contract Verification → Harness Gate (end)`

---

## 2. Gap Analysis: Where JoyJoin Stands Today

| Layer | Current State | Gap |
|-------|--------------|-----|
| **Pre-implementation** | Harness Runtime Controller runs PGE loop with Sprint Contract (Phase 1), but this is a *heavy deliberation chamber* for architectural decisions. Contracts are coarse (3 acceptance criteria). Not every implementation task goes through HRC. | Sprint Contract is trapped in the deliberation lane. It does not reach the Direct/Kickoff implementation lanes where 80% of work happens. |
| **Implementation** | Implementing agent (Backend Engineer, Taro Frontend Engineer, etc.) receives a task and executes. No explicit "negotiate done-ness" step. | The agent is the sole arbiter of "what done looks like" mid-flight. Misalignment is only caught at the end gate. |
| **Post-implementation** | Harness Completion Gate runs 5-pillar checklist. Verifier/QA Agent can challenge done-claims. | Verification is *reactive* — it finds gaps after code exists. Rework cost is higher. |

**Key insight from the article:** The evaluator uses Playwright MCP to click through the *running application*, testing UI, API, and DB states. The contract criteria are granular (27 criteria for a level editor). Each criterion has a **hard threshold** — any miss fails the sprint.

JoyJoin's Verifier agent already has the skeptical DNA, but it is invoked **after** the claim. We need to move it **before** the first `edit` tool call.

---

## 3. Proposal: Sprint Contracts in Implementation

### 3.1 What Triggers a Sprint Contract?

**Not every edit.** A Sprint Contract is triggered when a task crosses the **"complexity threshold."**

| Trigger Condition | Examples | Contract Required? |
|-------------------|----------|-------------------|
| **New route / endpoint / API contract** | `POST /api/pools/:id/match`, new WebSocket event | ✅ Yes |
| **Multi-file change (>2 files across >1 workspace)** | New DB column + shared type + mini-program UI + server route | ✅ Yes |
| **Auth or permission boundary change** | New admin-only route, RBAC rule change | ✅ Yes |
| **Stateful operation or state machine** | Payment flow, matching run, icebreaker phase advance | ✅ Yes |
| **DB schema change (migration)** | New table, column rename, constraint tightening | ✅ Yes |
| **UI flow or screen (new page/component)** | New onboarding step, admin dashboard widget | ✅ Yes |
| **Single-line fix, copy change, color tweak** | Fix typo, update hex code, change label text | ❌ No — skip contract |
| **Refactoring with no behavior change** | Extract function, rename variable, move file | ❌ No — skip contract |
| **Test-only change** | Add test case, update snapshot | ❌ No — skip contract |

**Decision mechanism:** The `task-creator` skill or `Planner` agent tags the task with `contractRequired: true|false` as part of lane selection. If ambiguous, default to **yes** — a 2-minute contract write is cheaper than a 20-minute rework loop.

### 3.2 What Does the Contract Contain?

A Sprint Contract is a **negotiated, testable specification** for a single chunk of implementation work. It bridges the gap between the Planner's high-level execution plan and the agent's actual code.

#### File Format: `sprint-contract.{taskId}.md`

```markdown
# Sprint Contract: {taskId}

## Metadata
- **Task:** [one-sentence mission from task-creator]
- **Implementing Agent:** [Backend Engineer | Taro Mini-Program Frontend Engineer | ...]
- **Contract Evaluator:** [Verifier | QA Agent | Harness Runtime Controller delegate]
- **Negotiation Status:** [draft | proposed | accepted | rejected | amended]
- **Created:** [ISO timestamp]
- **Accepted:** [ISO timestamp or "pending"]

---

## 1. Goal
[One sentence: what must be true when this sprint ends?]

## 2. Acceptance Criteria (testable)
Each criterion has a **hard threshold**. The sprint fails if any criterion is unmet.

| ID | Criterion | Verification Method | Threshold | Owner |
|----|-----------|---------------------|-----------|-------|
| AC-01 | [Concrete, observable condition] | [Command / test / MCP check] | PASS/FAIL | Implementer |
| AC-02 | ... | ... | ... | ... |

## 3. Harness Pillar Criteria
Specific, measurable expectations per pillar.

### Reliability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| REL-01 | [e.g., All new routes handle 4xx/5xx with structured error response] | `npm run test -w @joyjoin/server` scoped to route | PASS |
| REL-02 | [e.g., DB writes are atomic or have idempotency key] | Code review + test | PASS |

### Scalability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| SCA-01 | [e.g., No N+1 queries in new repository method] | `EXPLAIN ANALYZE` or test with seeded data | PASS |
| SCA-02 | [e.g., List endpoints paginate at ≤50 items/page] | API test | PASS |

### Security
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| SEC-01 | [e.g., New admin route checks `req.session.isAdmin`] | Auth test or Playwright MCP admin journey | PASS |
| SEC-02 | [e.g., No secrets or tokens in diff] | `npm run guardrails` | PASS |

### Observability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| OBS-01 | [e.g., New failure paths log with `logger.error` + requestId] | Grep diff for `console.` and `logger.` | PASS |
| OBS-02 | [e.g., New mutation calls `adminAuditLogger` when RBAC-relevant] | Code review | PASS |

### Maintainability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| MNT-01 | [e.g., New code lives in correct layer (route/service/repo)] | `npm run guardrails` + file path check | PASS |
| MNT-02 | [e.g., No cross-app imports; shared via `@joyjoin/shared`] | `npm run guardrails` | PASS |
| MNT-03 | [e.g., File size < 1500 lines (logic) or < 1200 lines (frontend)] | `wc -l` on new files | PASS |

## 4. Out-of-Scope (explicit exclusion)
[What this sprint explicitly does NOT do. Prevents scope creep mid-implementation.]

## 5. Verification Method Summary
[One paragraph: how will the Contract Evaluator verify this contract after implementation?]

## 6. Negotiation Log
- **[timestamp]** Implementer proposed: [initial draft]
- **[timestamp]** Evaluator reviewed: [feedback — specific, actionable]
- **[timestamp]** Implementer amended: [changes made]
- **[timestamp]** Evaluator accepted / rejected: [final verdict]
```

### 3.3 Who Negotiates It?

**Two-party negotiation, file-mediated:**

| Role | Agent | Responsibilities |
|------|-------|-----------------|
| **Implementer (Generator)** | The agent assigned to the task (Backend Engineer, Taro Mini-Program Frontend Engineer, AI Engineer, etc.) | Proposes the contract draft based on the Planner's approved plan and their own repo context. Proposes *how* success will be verified. |
| **Contract Evaluator** | `Verifier` (default) or `QA Agent` (for UI-heavy tasks) | Reviews the draft to ensure the implementer is building the *right thing*. Challenges vague criteria, missing edge cases, unrealistic verification methods, and pillar gaps. |

**Negotiation protocol (1–2 turns max):**

1. **Implementer writes draft contract** → saves to `.git/.orchestration/sprint-contracts/sprint-contract.{taskId}.md`
2. **Evaluator reads draft** → returns feedback as structured response (not a file edit; conversation-level to avoid file churn)
3. **Implementer amends** → updates the file, appends to Negotiation Log
4. **Evaluator accepts or rejects** → if accepted, implementation begins; if rejected, max 1 more amendment cycle; if still rejected, escalate to `Supervisor`

**Max cycles:** 2. If not converged, `Supervisor` routes to `Planner` for scope clarification or downgrades to a smaller slice.

### 3.4 How Is It Stored and Referenced?

**Storage:**
- **Canonical file:** `.git/.orchestration/sprint-contracts/sprint-contract.{taskId}.md`
- **Task linkage:** The `taskId` is the same ID used in `task-creator` output and Planner execution plans.
- **Git:** These files are `.gitignore`d (ephemeral workflow state, not durable repo memory).
- **Retention:** Kept for 30 days or until the task's PR is merged, then archived to `.git/.orchestration/sprint-contracts/archive/`.

**Reference points:**
- **Implementer's turn summary:** Must include `"sprintContractId": "{taskId}"` and `"sprintContractStatus": "accepted"` in JSON.
- **Harness Completion Gate:** The gate script reads the active contract (if any) and cross-checks the diff against the contract's pillar criteria. Findings are tagged with contract criterion IDs.
- **Verifier post-implementation:** Verifies against the contract's Acceptance Criteria, not just general "is this done."
- **Supervisor turn report:** If a task had a contract, the Supervisor note references it: `Sprint Contract {taskId} accepted — 7 criteria, 0 rejected.`

### 3.5 Integration with the 5 Harness Pillars

The Sprint Contract is not a replacement for the Harness Completion Gate. It is a **pre-implementation translation** of the gate into task-specific, testable criteria. Here is how each pillar maps:

#### Reliability
**Gate question:** "No partial-failure risk? Error paths handled? Retries configured?"

**Contract criteria examples:**
- `REL-01`: All new async operations have a `try/catch` or `.catch()` that does not crash the process.
- `REL-02`: If the operation is multi-step (e.g., payment → notification → record update), either all steps are in a transaction, or a compensating/fallback path exists.
- `REL-03`: External API calls (LLM, WeChat Pay, AMap) have a timeout and at least 1 retry.
- `REL-04`: Idempotency key is checked before side-effect writes (payments, webhooks, registrations).

**Verification method:** Unit test for error injection, code review for catch blocks, `grep` for `setTimeout`/`retry` patterns.

#### Scalability
**Gate question:** "No N+1? No unbounded renders? No unbounded memory?"

**Contract criteria examples:**
- `SCA-01`: New repository methods that query by foreign key use `inArray` or a join, not a loop.
- `SCA-02`: New list endpoints accept `limit`/`offset` or cursor pagination; default page size ≤ 50.
- `SCA-03`: New in-memory caches (if any) have a TTL ≤ 1 hour and a max entry count.
- `SCA-04`: New WebSocket broadcasts do not send full object graphs to all connected clients.

**Verification method:** `EXPLAIN ANALYZE` on new queries, API test with large dataset, `grep` for cache configuration.

#### Security
**Gate question:** "Auth checks present? Fail-closed? No secrets in code? Input validated?"

**Contract criteria examples:**
- `SEC-01`: Every new route in `routes.ts` or a domain router has an explicit auth middleware or a comment explaining why it is public.
- `SEC-02`: Admin routes verify `req.session.isAdmin === true` (not truthy, not omitted).
- `SEC-03`: All user input entering the DB passes Zod `safeParse` or equivalent validation.
- `SEC-04`: No new `console.log` of user data, tokens, or session objects.

**Verification method:** `npm run guardrails`, auth test with missing session, Zod schema review.

#### Observability
**Gate question:** "Error paths logged with structured fields? Key decisions traceable? Audit-worthy actions recorded?"

**Contract criteria examples:**
- `OBS-01`: New `throw` or error-return paths use `logger.warn` or `logger.error` (not `console.error`).
- `OBS-02`: New mutations that change user state (profile, payment, matching) include `requestId` in log context.
- `OBS-03`: New admin write actions call `adminAuditLogger` with actor, target, and action type.
- `OBS-04`: New failure modes have a metric or are added to the alert coverage checklist in the PR description.

**Verification method:** `grep` diff for logger usage, check `adminAuditLogger` call sites, review PR description.

#### Maintainability
**Gate question:** "Correct layer placement? No cross-app imports? Shared via `@joyjoin/shared`?"

**Contract criteria examples:**
- `MNT-01`: New HTTP handlers live in `apps/server/src/routes/domains/` or a new domain router; not inline in `routes.ts`.
- `MNT-02`: New DB queries live in `apps/server/src/repositories/`; not added to `storage.ts`.
- `MNT-03`: Shared types/schemas are exported from `packages/shared/src/` and imported via `@joyjoin/shared`.
- `MNT-04`: No import from legacy top-level `shared/` directory.
- `MNT-05`: New logic files are < 1500 lines; new frontend components < 1200 lines.

**Verification method:** `npm run guardrails`, `find` + `wc -l` on new files, `grep` for legacy import patterns.

### 3.6 Minimum Viable Version (MVP) — No 20× Cost

The Anthropic article reports: Solo run = 20 min, $9. Full harness = 6 hr, $200. The 20× cost comes from:
- Multi-phase PGE loop with 3+ iterations
- Full Council Mode with isolated delegates
- Peer review + roundtable + consensus poll
- Playwright MCP end-to-end verification per sprint

JoyJoin's MVP Sprint Contract targets a **2–3× cost increase, not 20×**, by:

| Cost Driver | Anthropic Full Harness | JoyJoin MVP Contract |
|-------------|----------------------|---------------------|
| **Negotiation turns** | 3+ PGE iterations + Council + Roundtable | 1–2 turns (Implementer draft → Evaluator feedback → amend → accept) |
| **Agents involved** | Planner + Generator + Evaluator + 3 Council delegates | Implementer + Verifier (existing agents, no new spawn) |
| **Verification tooling** | Playwright MCP clicking through running app + DB state checks | Re-use existing `npm run harness:gate` + targeted `npm run test` + `grep` checks |
| **Contract granularity** | 27 criteria for a level editor | 5–10 criteria per task ( templated defaults + task-specific additions) |
| **Persistence** | Full transcript JSON | Single markdown file |
| **Pre-emption** | Heavy deliberation before *any* code | Lightweight contract before first edit; heavy deliberation only for HRC-tier tasks |

**MVP workflow (actual turns):**

```
Turn 1 — Implementer receives task from Supervisor
  └─ Reads approved plan, repo context, existing code
  └─ Writes draft Sprint Contract (5–10 min)
  └─ Saves to .git/.orchestration/sprint-contracts/sprint-contract.{taskId}.md
  └─ Returns turn summary with contract attached

Turn 2 — Verifier (Contract Evaluator)
  └─ Reads draft contract
  └─ Returns feedback: "AC-03 is vague — 'fast' needs a number. SCA-01 missing — you query users by pool_id."
  └─ No file edit; conversation-level response

Turn 3 — Implementer (amend, optional)
  └─ If feedback was minor, amends contract in < 5 min
  └─ If feedback was major and requires scope change, routes to Supervisor
  └─ Saves amended version

Turn 4 — Implementation begins
  └─ Implementer codes against accepted contract
  └─ Verifies against contract criteria as they go

Turn 5 — Harness Completion Gate
  └─ Runs existing `npm run harness:gate`
  └─ Gate reads active contract and tags findings with criterion IDs
  └─ Implementer fixes blocking items

Turn 6 — Verifier (post-implementation, optional for MVP)
  └─ Skipped for low-risk tasks; runs for auth/payment/matching changes
```

**Estimated cost:** +1–2 turns per task (~10–20 min of agent time, ~$0.50–$2.00 at GPT-5.4 mini/xhigh rates). For a task that would take 3 turns solo, this is ~1.3–1.7× cost, not 20×.

---

## 4. Concrete Example: Adding a Pool Refund API

### Task
> "Add a refund button to the admin payment page so operators can process refunds without backend access."

### Planner's Execution Plan (existing)
1. Add `POST /api/admin/payments/:id/refund` route
2. Add refund logic in `paymentService.ts`
3. Add refund button + modal in admin payment page
4. Add audit log entry

### Sprint Contract (negotiated)

```markdown
# Sprint Contract: admin-refund-2026-04-23

## Metadata
- **Task:** Add admin refund capability so operators can process refunds without backend access.
- **Implementing Agent:** Backend Engineer + Admin Operations Advisor (UI)
- **Contract Evaluator:** Verifier
- **Negotiation Status:** accepted
- **Created:** 2026-04-23T10:00:00Z
- **Accepted:** 2026-04-23T10:08:00Z

---

## 1. Goal
Operators with `operator` or `super_admin` role can initiate a WeChat Pay refund from the admin portal, and the system records the action with full audit trail.

## 2. Acceptance Criteria

| ID | Criterion | Verification Method | Threshold |
|----|-----------|---------------------|-----------|
| AC-01 | `POST /api/admin/payments/:id/refund` returns 200 with refundId on success | `curl` or Vitest against route | PASS |
| AC-02 | Route rejects non-admin sessions with 403 | Auth test with missing/bad session | PASS |
| AC-03 | Route rejects refunds on payments not in `success` state with 409 + clear error | State-transition test | PASS |
| AC-04 | Refund amount cannot exceed original payment amount | Validation test | PASS |
| AC-05 | Admin UI shows refund button only for payments in `success` state | Playwright MCP or code review | PASS |
| AC-06 | Refund action is recorded in `admin_audit_logs` with actor, targetPaymentId, amount | Grep + DB query | PASS |

## 3. Harness Pillar Criteria

### Reliability
- REL-01: Refund call to WeChat Pay has 30s timeout and 1 retry with exponential backoff.
- REL-02: If WeChat Pay refund fails after retry, the route returns 502 and does NOT mark the payment as refunded in DB.
- REL-03: Refund is idempotent — calling the endpoint twice for the same payment returns the same refundId (not a new refund).

### Scalability
- SCA-01: No N+1 — refund lookup uses `db.query.payments.findFirst` with indexed `id`.

### Security
- SEC-01: Route is behind `requireAdmin` middleware.
- SEC-02: Request body validated with Zod — `amount` is positive integer ≤ original amount.
- SEC-03: No WeChat Pay credentials logged or returned in error responses.

### Observability
- OBS-01: WeChat Pay failure logs `logger.error` with `requestId`, `paymentId`, and `wechatErrorCode`.
- OBS-02: Audit log entry includes `actorAdminId`, `paymentId`, `refundAmount`, `timestamp`.

### Maintainability
- MNT-01: Route lives in `apps/server/src/routes/domains/adminPayments.ts` (not inline in `routes.ts`).
- MNT-02: Refund logic lives in `apps/server/src/services/paymentService.ts` or new `refundService.ts`.
- MNT-03: No new code in `storage.ts`.

## 4. Out-of-Scope
- Automatic refund on event cancellation (future feature).
- Partial refund UI for split payments.
- User-facing refund status page.

## 5. Verification Method Summary
Verifier will run: `npm run test -w @joyjoin/server` scoped to payment routes, `npm run guardrails`, and inspect admin audit log table for the new entry pattern.

## 6. Negotiation Log
- **10:00** Implementer proposed: Initial draft with 4 ACs, missing idempotency and audit log.
- **10:05** Evaluator reviewed: "Missing REL-03 (idempotency) — duplicate refund is a real risk. Missing OBS-02 (audit log). Add SEC-02 (Zod validation). AC-03 needs a state check."
- **10:08** Implementer amended: Added REL-03, OBS-02, SEC-02, AC-03. Accepted.
```

### What the Evaluator caught pre-implementation
- **Idempotency:** The implementer initially forgot to guard against duplicate refund calls. Caught before code.
- **Audit logging:** The implementer initially planned to skip `adminAuditLogger` for "speed." Caught before code.
- **State validation:** The implementer assumed all payments were refundable. The Evaluator forced an explicit state gate.

**Cost of catching these post-implementation:** Rework of route logic, service logic, and possibly a migration fix.  
**Cost of catching them in contract:** 3 minutes of markdown editing.

---

## 5. Integration with Existing Orchestration

### 5.1 Skill Changes

**`task-creator` skill:** Add a `contractRequired` boolean to task output. Decision logic based on the complexity threshold (§3.1).

**`harness-completion-gate` skill:** Update gate script (`npm run harness:gate`) to:
1. Check for an active Sprint Contract in `.git/.orchestration/sprint-contracts/`
2. If found, tag each finding with the contract criterion ID it relates to
3. Report: `5/7 contract criteria passed; REL-03 (idempotency) not found in diff — blocking`

**New skill (optional, post-MVP):** `sprint-contract-authoring` — templates, examples, and negotiation etiquette. Not needed for MVP; inline in implementing agent definitions is enough.

### 5.2 Agent Definition Changes

**`backend-engineer.agent.md`:**
- Add to **Default workflow** (before step 4):
  > "4a. If `contractRequired: true`, write a Sprint Contract draft before editing files. Negotiate with Verifier. Do not begin implementation until the contract is accepted."
- Add to **Constraints**:
  > "DO NOT begin file edits on a `contractRequired` task before the Sprint Contract is accepted."

**`taro-mini-program-frontend-engineer.agent.md`:** Same pattern.

**`verifier.agent.md`:**
- Add a **Contract Evaluator mode** to the Default workflow:
  > "When evaluating a Sprint Contract draft (not a done-claim), review for: vagueness in criteria, missing edge cases, unrealistic verification methods, and gaps in the 5 Harness pillars. Return specific, actionable feedback — not general advice."
- Add handoff label:
  > "Accept Sprint Contract" — returns to Implementer with approval to proceed.

**`harness-runtime-controller.agent.md`:**
- No change to the existing PGE loop. The HRC's Sprint Contract remains for **pre-implementation architectural deliberation** (large, cross-domain tasks).
- Add note: "For implementation-phase contracts, see the lightweight Sprint Contract mechanism in `sprint-contract-implementation-phase.md`. HRC delegates should not confuse the two."

### 5.3 Supervisor Routing

Supervisor's **Routing (pick one)** gets a new path for contract negotiation:

```
1. Backend Engineer — write Sprint Contract draft for admin refund API (suggested model: GPT-5.4 xhigh)
2. Verifier — review and challenge the draft contract (suggested model: GPT-5.4 mini — verification is cheaper)
3. Backend Engineer — implement against accepted contract (suggested model: GPT-5.4 xhigh)
4. Auto-Eval — run dirty-worktree gate against contract criteria
```

### 5.4 Turn Summary Schema Update

Add optional fields to `agent_turn_summary` JSON:

```json
{
  "sprintContract": {
    "contractId": "admin-refund-2026-04-23",
    "status": "draft|proposed|accepted|rejected|amended",
    "criteriaCount": 10,
    "pillarCoverage": ["reliability", "scalability", "security", "observability", "maintainability"]
  }
}
```

---

## 6. Cost Model

| Scenario | Turns | Est. Cost (GPT-5.4 xhigh) | Quality Risk |
|----------|-------|--------------------------|--------------|
| **Solo** (current Direct lane for medium tasks) | 3 turns | ~$3 | Moderate — misalignment caught at end gate |
| **MVP Sprint Contract** (this proposal) | 4–5 turns | ~$4–$5 | Low — misalignment caught before code |
| **Full Harness Deliberation** (existing HRC) | 10–15 turns | ~$20–$50 | Very low — but overkill for bounded tasks |
| **Anthropic Full Harness** (article) | 50+ turns | ~$200 | Very low — reference benchmark |

**ROI:** The MVP adds ~$1–$2 per medium task. If it prevents one rework loop per 5 tasks, it pays for itself. Given that a single auth or payment rework can cost $10+ in agent time + human review time, the breakeven is immediate.

---

## 7. Migration Path

### Phase 1: Pilot (Week 1)
- Enable Sprint Contracts manually for 3–5 tasks in the **Kickoff** and **Harness** lanes.
- Use the `backend-engineer` and `taro-mini-program-frontend-engineer` agents as pilots.
- No script changes — purely markdown files + agent instruction updates.
- Measure: contract acceptance rate, criteria count, time to accept, post-implementation gate failure rate.

### Phase 2: Automation (Week 2–3)
- Update `task-creator` skill to auto-tag `contractRequired`.
- Update `backend-engineer.agent.md`, `verifier.agent.md`, and `harness-completion-gate` skill.
- Add contract path to Supervisor routing templates.
- Run for all tasks crossing the complexity threshold.

### Phase 3: Integration (Week 4)
- Update `npm run harness:gate` to read active contracts and tag findings.
- Update turn-summary schema to include `sprintContract` fields.
- Write the optional `sprint-contract-authoring` skill if patterns emerge.
- Document in `AGENTS.md` and `DEVELOPER_QUICK_REFERENCE.md`.

---

## 8. Open Questions

1. **Should the Contract Evaluator be allowed to veto scope?** If the implementer drafts a contract that is too large, should the Evaluator force a slice reduction, or escalate to Supervisor?
2. **How do we handle contract drift mid-implementation?** If the implementer discovers a blocker that invalidates a criterion, do they amend the contract mid-flight, or stop and re-negotiate?
3. **Should Playwright MCP be part of the MVP?** The article emphasizes clicking through the running app. JoyJoin's QA Agent already has Playwright MCP. Should the Contract Evaluator require a "preview" of the UI before accepting the contract, or is that too expensive for MVP?
4. **What is the human override path?** If implementer and evaluator deadlock after 2 cycles, does Supervisor auto-escalate to human, or try a third cycle with a different evaluator?

---

## 9. Bottom Line

JoyJoin should adopt a **lightweight Sprint Contract** in the implementation phase: a 1–2 turn negotiation between the implementing agent and the Verifier, producing a 5–10 criterion markdown file stored in `.git/.orchestration/sprint-contracts/`. It triggers only for tasks crossing a complexity threshold (new routes, multi-file changes, auth/stateful operations). It integrates with the existing 5 Harness pillars by translating generic gate questions into task-specific, testable criteria. The MVP adds ~30% cost, not 2000%, by reusing existing agents, scripts, and verification paths.

**The Sprint Contract does not replace the Harness Completion Gate.** It makes the gate **actionable from the first line of code**.
