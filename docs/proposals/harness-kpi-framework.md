# Harness KPI Framework and Grading Rubrics

> **Status:** Draft proposal  
> **Scope:** 5-Pillar scoring, tier thresholds, measurement methods, scorecard format, and effectiveness KPIs for the Harness Engineering Framework  
> **Author:** Harness KPI and Grading Designer  
> **Related:** `harness-completion-gate` skill, `sprint-contract-implementation-phase.md`, `harness-design-implementation-phase-mapping.md`

---

## 1. Purpose

This document translates JoyJoin's 5 Harness Pillars into **quantifiable, gradable criteria** that can be scored consistently across tasks, agents, and tiers. It provides:

- A **1–5 scoring rubric** per pillar with observable, reproducible criteria.
- **Hard thresholds** tied to the 3-tier harness model (Tier 1 / Tier 2 / Tier 3).
- **Measurement method tags** (static analysis, code review, runtime test) so evaluators know what tooling to apply.
- A **Harness Scorecard** template for recording per-task results.
- **Top-level effectiveness KPIs** to track whether the Harness framework is actually reducing defect escape and rework over time.

This document does not replace the Harness Completion Gate or Sprint Contracts. It **feeds into them** by giving the gate and the contract evaluator a shared scoring language.

---

## 2. Scoring Rubric: 1–5 Scale per Pillar

Each pillar is decomposed into **5 gradable sub-criteria** (A–E). The overall pillar score is the **minimum** of its sub-criterion scores. This enforces the Anthropic principle: a sprint fails if any hard threshold is missed.

| Score | Meaning | General Rule |
|-------|---------|--------------|
| **1** | Critical failure | Criterion is missing, dangerously wrong, or actively harmful. |
| **2** | Partial / superficial | Criterion is present but incomplete, inconsistent, or untested. |
| **3** | Adequate / meets minimum | Criterion is present, correct, and verifiable. No obvious gaps. |
| **4** | Good / thorough | Criterion is well-designed, tested, and documented. Edge cases considered. |
| **5** | Excellent / exemplary | Criterion is best-in-class: resilient, observable, and maintainable under stress. |

---

### 2.1 Pillar 1 — Reliability

| Sub-Criterion | Score 1 | Score 2 | Score 3 | Score 4 | Score 5 |
|---------------|---------|---------|---------|---------|---------|
| **A. Error path coverage** | No try/catch or error handling. Unhandled rejections crash the process. | Some paths handled; inconsistent (e.g., async missing `.catch`). | All new async operations have try/catch or `.catch()` that prevents crash. | Error paths return structured, client-safe responses. Fallback values defined. | Error paths are exhaustively tested (injected failures). Graceful degradation verified under load. |
| **B. Atomicity / recovery** | Multi-step writes are split with no recovery. Partial failure corrupts state. | Transaction wrapper present but missing rollback logic or wrong scope. | Multi-step DB writes wrapped in transaction, OR compensating path documented and implemented. | Transaction boundaries match business boundaries. Compensating actions are idempotent. | Distributed saga pattern or outbox pattern used for cross-service consistency. Recovery is self-healing. |
| **C. External call resilience** | No timeout or retry on external APIs (LLM, WeChat Pay, AMap). | Timeout present but no retry, OR retry without backoff/circuit breaker. | Timeout + at least 1 retry with exponential backoff configured for all external calls. | Circuit breaker or bulkhead pattern added. Degraded-mode fallback verified. | Chaos-tested: external failure injected in CI; system stays within SLO. |
| **D. Idempotency** | No idempotency guard on mutating operations (payments, webhooks, registrations). | Idempotency key accepted but not checked against datastore. | Idempotency key checked before side-effect writes. Duplicate requests return same result. | Idempotency is enforced at DB layer (unique constraint) + application layer. Race-safe. | Idempotency is observable: metrics track deduplication rate; alerts fire on collision anomalies. |
| **E. Race condition safety** | Shared mutable state modified without locks/atomic operations. | Lock present but wrong granularity (too coarse or too narrow). | No race conditions on shared mutable state. Appropriate concurrency primitives used. | State mutations are versioned or use optimistic locking. Conflicts have resolution paths. | Race-safety verified with concurrent load tests. No lost updates under contention. |

**Measurement methods:** A=RT/CR, B=CR/RT, C=SA/CR/RT, D=CR/RT, E=CR/RT

---

### 2.2 Pillar 2 — Scalability

| Sub-Criterion | Score 1 | Score 2 | Score 3 | Score 4 | Score 5 |
|---------------|---------|---------|---------|---------|---------|
| **A. N+1 query elimination** | Queries inside loops (N+1) or no batch loading. | Some batching but inconsistent (e.g., one path batched, another not). | No N+1 in new code. `inArray`, joins, or DataLoader used where applicable. | Query patterns reviewed with `EXPLAIN ANALYZE`. Indexes support the access pattern. | Query plans are regression-tested in CI. N+1 detection is automated (lint or test). |
| **B. Pagination / bounding** | Unbounded list renders or unbounded API responses. No limit parameter. | Limit parameter exists but default is unbounded or very large (>100). | All new list endpoints paginate (limit/offset or cursor) with default ≤50 items. | Cursor pagination for high-churn lists. Client-side virtualisation for large renders. | Load-tested with 10× expected dataset size. Latency p99 within budget. |
| **C. Memory bounding** | Unbounded array growth, unbounded cache, or unbounded stream buffering. | Bounds exist but are very large or not enforced under pressure. | Caches have TTL ≤1 hr and max entry count. Arrays have explicit size caps. | Memory pressure tested. Eviction policies are LRU or LFU, not random. | Resource limits are enforced by the runtime (e.g., backpressure, stream throttling). |
| **D. Concurrency safety** | Global mutable state without locks. Shared caches not thread/process-safe. | Global state is read-only but writes are not synchronised. | No global mutable state without synchronisation. Concurrency primitives match use case. | Stateless design preferred. Shared state is externalised (DB, Redis) with atomic ops. | Horizontal-scaling safe: no in-memory affinity that breaks under replica scaling. |
| **E. Database index fitness** | New queries perform full table scans on large tables. | Index exists but is partial or on wrong column order. | Queries use appropriate indexes. Foreign key lookups are indexed. | Composite indexes match query patterns. Covering indexes used for hot paths. | Index usage is monitored in production. Missing-index alerts fire automatically. |

**Measurement methods:** A=SA/CR/RT, B=SA/CR/RT, C=SA/CR, D=CR/RT, E=SA/CR/RT

---

### 2.3 Pillar 3 — Security

| Sub-Criterion | Score 1 | Score 2 | Score 3 | Score 4 | Score 5 |
|---------------|---------|---------|---------|---------|---------|
| **A. Auth / permission gates** | New route or mutation has no auth check. | Auth check present but uses truthy comparison (`if (user)`) or omits role check. | Explicit auth middleware on route. Admin routes check `=== true`. Permission checks match role matrix. | Auth is enforced at router composition level (not per-handler). Deny-by-default is structural. | Auth coverage is regression-tested. Removing auth middleware breaks tests. |
| **B. Fail-closed defaults** | Default branch allows access. Missing auth = allowed. | Fail-closed in code but not in configuration or infra. | Deny by default. Missing permission = rejection. No implicit allow paths. | Fail-closed is validated by property-based test (fuzz missing fields/headers). | Security posture is continuously scanned (dependency audit, secret scan, SAST). |
| **C. Secret hygiene** | Secrets, credentials, or tokens committed in code or logs. | Secrets in env vars but referenced unsafely (e.g., logged on startup). | No secrets in code or logs. Env-only injection. `npm run guardrails` passes. | Secrets are rotated automatically or on leak detection. No long-lived tokens in source. | Secret access is audited. Least-privilege IAM / DB roles enforced. |
| **D. Sensitive data in errors** | User passwords, tokens, or PII returned in error responses or logs. | Some sanitisation but inconsistent (e.g., stack traces leak internal paths). | No sensitive data in error messages or client responses. Stack traces stripped in production. | Error responses use opaque codes; full context is log-only and access-controlled. | Data classification labels enforced. PII fields are auto-redacted from logs by policy. |
| **E. Input validation** | No validation on user input. Raw input passed to DB or shell. | Validation present but manual/regex-based, not exhaustive. | All user input validated with Zod `safeParse` or equivalent. Types enforced at boundary. | Validation schemas are shared across server and client (single source of truth). | Fuzzing / property-based testing verifies validation boundaries. Injection tested in CI. |

**Measurement methods:** A=SA/CR/RT, B=CR/RT, C=SA/AG, D=SA/CR/RT, E=SA/CR/RT

---

### 2.4 Pillar 4 — Observability

| Sub-Criterion | Score 1 | Score 2 | Score 3 | Score 4 | Score 5 |
|---------------|---------|---------|---------|---------|---------|
| **A. Structured error logging** | Errors logged with `console.error` or not logged at all. | `logger.error` used but missing context fields (no requestId, no userId). | All new error/throw paths use `logger.warn` or `logger.error` with structured fields. | Log context includes requestId, userId, action type, and correlation IDs. | Log volume is budgeted. High-cardinality fields are sampled. Alerts are actionable. |
| **B. Traceability / correlation** | No requestId propagation. Logs cannot be correlated across services. | requestId present in some logs but missing in DB queries or external calls. | `requestId` propagated through all new async flows. Logs are queryable by trace. | Distributed tracing spans added for external calls. Trace ID in response headers for debugging. | Trace sampling is adaptive (error traces always kept). Latency breakdown is automatic. |
| **C. Metrics / alert coverage** | New failure mode has no metric or alert. | Metric added but no alert threshold defined. | New failure modes have a counter or histogram metric. Alert threshold documented. | Alert is wired to on-call channel. Runbook linked in alert description. | SLO-based alerting (error budget burn rate). Alert fatigue is monitored and tuned. |
| **D. Audit logging** | Audit-worthy actions (auth, payment, admin writes) are not recorded. | Audit log present but missing actor, target, or timestamp. | `adminAuditLogger` called for all admin writes. Actor, target, action, timestamp recorded. | Audit log is append-only and tamper-evident. Access is role-restricted. | Audit events are streamed to long-term store. Compliance queries run in <30s. |
| **E. Logger discipline** | `console.log` / `console.warn` used in server request handlers. | Console usage in non-handler code (e.g., build scripts, CLI tools). | No `console.*` in server request handlers or service code. Project logger used everywhere. | Logger is injected via DI or context; no global import anti-pattern. | Logger middleware auto-injects context. Developers cannot accidentally use `console.log`. |

**Measurement methods:** A=SA/CR/RT, B=SA/CR/RT, C=CR/SA, D=CR/RT, E=SA/AG

---

### 2.5 Pillar 5 — Maintainability / Architecture Fit

| Sub-Criterion | Score 1 | Score 2 | Score 3 | Score 4 | Score 5 |
|---------------|---------|---------|---------|---------|---------|
| **A. Layer placement** | Business logic inline in route handler or wrong app entirely. | Logic split but wrong layer (e.g., DB query in component). | Code placed in correct layer: route → service → repository → shared. | Layer boundaries are enforced by lint or folder convention. No bypass patterns. | Architecture decision record (ADR) exists for layer exceptions. Reviewers are trained on boundaries. |
| **B. Cross-app import hygiene** | App imports source from another app (e.g., user-client imports from admin-client). | Cross-app import is indirect (via symlink or relative path trick). | No cross-app imports. Reusable logic lives in `packages/shared`. | Import boundaries are enforced by `npm run guardrails` and CI. | Dependency graph is visualised. Cyclic dependencies blocked at build time. |
| **C. Shared package usage** | Import from legacy top-level `shared/` directory. | Shared code duplicated instead of imported from `@joyjoin/shared`. | Shared code imported via `@joyjoin/shared` or `@shared/*`. Legacy `shared/` unused. | Shared package exports are intentional (listed in `package.json` exports). | Shared package has its own test suite and versioning policy. Consumers pin to compatible range. |
| **D. Pattern consistency** | New code diverges wildly from established patterns without justification. | Minor drift (e.g., different naming convention, different error shape). | Follows established patterns. Any deviation is documented with justification. | Patterns are self-documenting (template files, codegen, or lint rules). | Tech-debt budget exists for pattern migration. New patterns require RFC approval. |
| **E. File size / abstraction** | File >2000 lines or function >200 lines. God objects. | File within hard limit but still does too much (low cohesion). | File size <1500 lines (logic) or <1200 lines (frontend). Functions are focused. | Abstraction level matches complexity. No premature abstraction; no duplication >2×. | Complexity metrics (cyclomatic, cognitive) are tracked. Refactoring is data-driven. |

**Measurement methods:** A=SA/CR, B=SA/AG, C=SA/AG, D=CR, E=SA/CR

---

## 3. Hard Thresholds per Tier

The 3-tier model from `harness-design-implementation-phase-mapping.md` is extended with numeric score thresholds.

| Tier | Trigger Conditions | Pillar Score Threshold | Evaluator Mix | Max QA Iterations |
|------|-------------------|----------------------|---------------|-------------------|
| **Tier 1: Direct Delivery** | ≤50 lines, 1 workspace, no new routes, no behavior change, no auth/payment/matching surface | **All pillars ≥3** | **Automated only** (`npm run guardrails` + `npm run typecheck` + `npm run test` scoped). No QA Agent Sprint Evaluation. | 0 |
| **Tier 2: Sprint Contract Loop** | >50 lines OR new API route OR UI change OR cross-file dependency OR stateful operation | **All pillars ≥3; any pillar <3 → FAIL** | **Automated + QA Agent** (contract review + Sprint Evaluation with hard thresholds). Verifier optional. | 3 |
| **Tier 3: Full Harness Lane** | Core engine (matching, personality, auth, payment) OR >100 lines OR cross-workspace OR migration | **All pillars ≥4; any pillar <4 → FAIL** | **Automated + QA Agent Sprint Evaluation + Harness Completion Gate + Verifier skeptical check** | 3 (QA) + 1 (Verifier) |

### Threshold Rules (applies to all tiers)

1. **Sub-criterion minimum rule:** The pillar score is the minimum of its A–E sub-criteria. A single sub-criterion at score 1 drags the entire pillar to 1.
2. **Any FAIL on a required criterion → REJECT.** `PARTIAL` is only acceptable if the Sprint Contract explicitly labels that criterion as `partial_allowed`.
3. **Blocking vs. Concern:**
   - **Blocking:** Score 1 or 2 on any sub-criterion (Tier 1/2), or score ≤3 on any sub-criterion (Tier 3). Must be fixed before merge.
   - **Concern:** Score 3 on a Tier 3 task, or a score 4 where a 5 was achievable with minor effort. Documented in turn summary; fix in follow-up sprint.
4. **Auto-fail conditions (any tier):**
   - Secrets in diff.
   - New route with no auth middleware.
   - `console.log` of user data or session objects.
   - N+1 query with no pagination/bounding.
   - File size exceeds 1500 lines (logic) / 1200 lines (frontend) without explicit exemption.

---

## 4. Measurement Methods Reference

Each sub-criterion is tagged with one or more measurement methods. Evaluators must apply the cheapest method that can confidently rule out scores 1 and 2.

| Method | Abbreviation | What it covers | Tools / Commands |
|--------|-------------|----------------|------------------|
| **Static Analysis** | SA | Pattern detection without execution: imports, file size, logger usage, secret grep, auth middleware presence | `npm run guardrails`, `grep`, `wc -l`, `eslint`, `ripgrep`, `tsc --noEmit` |
| **Code Review** | CR | Human or agent review of logic, design decisions, edge cases, abstraction quality | File diff review, architecture fit check, pattern consistency |
| **Runtime Test** | RT | Executed tests: unit, integration, API, Playwright, load | `npm run test -w @joyjoin/server`, `curl`, Playwright MCP, Vitest, `k6` |
| **Automated Gate** | AG | Deterministic script that runs the Harness Completion Gate | `npm run harness:gate`, `scripts/auto/auto-eval.mjs --mode=manual-report` |

### Method selection heuristic

```
Can SA detect a violation?     → Run SA first (cheapest, <5s).
Does SA pass but logic looks risky? → Run CR.
Does CR pass but behavior is stateful? → Run RT.
Is this Tier 3 or a Sprint Contract task? → Run AG for final verdict.
```

---

## 5. Harness Scorecard Format

The scorecard is the canonical record of a task's Harness evaluation. It is produced by the evaluator (QA Agent, Verifier, or Auto-Eval) and referenced in turn summaries.

### 5.1 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "HarnessScorecard",
  "type": "object",
  "required": ["scorecardId", "taskId", "tier", "evaluatedAt", "evaluator", "pillars", "verdict"],
  "properties": {
    "scorecardId": { "type": "string", "description": "Unique ID for this scorecard" },
    "taskId": { "type": "string", "description": "Links to task-creator / Planner task ID" },
    "sprintContractId": { "type": "string", "description": "Optional link to Sprint Contract" },
    "tier": { "type": "string", "enum": ["1", "2", "3"] },
    "evaluatedAt": { "type": "string", "format": "date-time" },
    "evaluator": { "type": "string", "enum": ["Auto-Eval", "QA Agent", "Verifier", "Harness Runtime Controller"] },
    "pillars": {
      "type": "object",
      "properties": {
        "reliability": {
          "type": "object",
          "properties": {
            "score": { "type": "integer", "minimum": 1, "maximum": 5 },
            "subCriteria": {
              "type": "object",
              "properties": {
                "errorPathCoverage": { "type": "integer", "minimum": 1, "maximum": 5 },
                "atomicityRecovery": { "type": "integer", "minimum": 1, "maximum": 5 },
                "externalCallResilience": { "type": "integer", "minimum": 1, "maximum": 5 },
                "idempotency": { "type": "integer", "minimum": 1, "maximum": 5 },
                "raceConditionSafety": { "type": "integer", "minimum": 1, "maximum": 5 }
              }
            },
            "evidence": { "type": "array", "items": { "type": "string" } },
            "blockers": { "type": "array", "items": { "type": "string" } },
            "concerns": { "type": "array", "items": { "type": "string" } }
          }
        },
        "scalability": { "$ref": "#/properties/pillars/properties/reliability" },
        "security": { "$ref": "#/properties/pillars/properties/reliability" },
        "observability": { "$ref": "#/properties/pillars/properties/reliability" },
        "maintainability": { "$ref": "#/properties/pillars/properties/reliability" }
      }
    },
    "verdict": {
      "type": "string",
      "enum": ["PASS", "FAIL", "CONCERN"],
      "description": "FAIL = any blocking issue. CONCERN = no blockers but non-blocking concerns exist."
    },
    "iteration": { "type": "integer", "description": "Evaluator iteration count (1 = first pass)" },
    "notes": { "type": "string", "description": "Free-form evaluator notes" }
  }
}
```

### 5.2 Markdown Template (human-readable)

```markdown
# Harness Scorecard: {taskId}

| Field | Value |
|-------|-------|
| **Scorecard ID** | {scorecardId} |
| **Task** | {taskDescription} |
| **Tier** | {1/2/3} |
| **Evaluator** | {Auto-Eval / QA Agent / Verifier} |
| **Evaluated At** | {ISO timestamp} |
| **Iteration** | {1/2/3} |
| **Verdict** | **{PASS / FAIL / CONCERN}** |

---

## Reliability — Score: {1-5}

| Sub-Criterion | Score | Evidence |
|---------------|-------|----------|
| A. Error path coverage | {1-5} | {method + result} |
| B. Atomicity / recovery | {1-5} | {method + result} |
| C. External call resilience | {1-5} | {method + result} |
| D. Idempotency | {1-5} | {method + result} |
| E. Race condition safety | {1-5} | {method + result} |

**Blockers:** {list or "None"}
**Concerns:** {list or "None"}

---

## Scalability — Score: {1-5}
## Security — Score: {1-5}
## Observability — Score: {1-5}
## Maintainability — Score: {1-5}

*(Same sub-criterion table format as Reliability)*

---

## Summary

- **Minimum pillar score:** {1-5}
- **Hard threshold met?** {Yes / No}
- **Recommended action:** {Merge / Fix blockers / Re-evaluate after fixes}
```

---

## 6. Top-Level Effectiveness KPIs

These KPIs are tracked per sprint week or per release cycle to measure whether the Harness framework is improving engineering outcomes.

### KPI 1: Harness Gate Failure Rate

| | |
|---|---|
| **Definition** | % of tasks that fail the Harness Completion Gate on first evaluation (before any rework). |
| **Formula** | `First-pass failures / Total evaluated tasks × 100` |
| **Target** | Tier 1: <5%; Tier 2: <15%; Tier 3: <10% (Tier 3 has more pre-flight deliberation, so failures should be lower). |
| **Measurement** | Count `verdict: FAIL` where `iteration: 1` in scorecard JSON. |
| **Action threshold** | If Tier 2 failure rate >25% for 2 consecutive weeks, inspect Sprint Contract quality (are contracts too vague?). |

### KPI 2: Bug Escape Rate

| | |
|---|---|
| **Definition** | % of production bugs (P0/P1) that can be traced to a missing or insufficient Harness pillar check. |
| **Formula** | `Bugs with root cause = "missing Harness coverage" / Total P0+P1 bugs × 100` |
| **Target** | <10% of production bugs escape through Harness gaps. |
| **Measurement** | Post-mortem template includes a field: "Which Harness pillar would have caught this?" If answer is "None," the bug was not escapable via Harness. |
| **Action threshold** | If >20% of bugs map to a specific pillar (e.g., Security), that pillar's rubric is tightened. |

### KPI 3: Rework Rate

| | |
|---|---|
| **Definition** | % of tasks requiring >1 implementation iteration (QA Agent or Verifier rejection). |
| **Formula** | `Tasks with max(iteration) > 1 / Total tasks with Sprint Contract × 100` |
| **Target** | Tier 2: <30%; Tier 3: <20%. |
| **Measurement** | Read `iteration` field from scorecard JSON. |
| **Action threshold** | If rework rate >40%, inspect Sprint Contract negotiation quality (are evaluators catching issues pre-implementation?). |

### KPI 4: Sprint Contract Acceptance Rate

| | |
|---|---|
| **Definition** | % of Sprint Contracts accepted by QA Agent on first review (no amendment cycle). |
| **Formula** | `Contracts accepted without amendment / Total contracts reviewed × 100` |
| **Target** | >60% (some amendment is healthy; 100% means contracts are not being challenged). |
| **Measurement** | Read negotiation log in Sprint Contract markdown. Count drafts with 0 amendment cycles. |
| **Action threshold** | If <30%, contracts are too low-quality or evaluators are too picky. Inspect feedback themes. |

### KPI 5: Mean Time to Harness Pass (MTTHP)

| | |
|---|---|
| **Definition** | Median wall-clock time (or agent turns) from first implementation claim to Harness PASS. |
| **Formula** | `Median(turns or hours from "claim done" to first PASS verdict)` |
| **Target** | Tier 1: <5 min; Tier 2: <30 min; Tier 3: <2 hr. |
| **Measurement** | Timestamp diff between `agent_turn_summary.claimedDoneAt` and `scorecard.evaluatedAt` where `verdict: PASS`. |
| **Action threshold** | If Tier 2 MTTHP >1 hr, evaluate whether QA Agent is re-running full suites on minor fixes (should cache grades). |

---

## 7. Filled Example: "Add POST /api/pools/:id/register"

### Task Classification

| Field | Value |
|-------|-------|
| **Task** | Add `POST /api/pools/:id/register` endpoint |
| **Tier** | **2** (new API route, stateful operation, multi-file change: route + service + repository + shared type) |
| **Sprint Contract** | `sprint-contract.pool-register-2026-04-23.md` |
| **Evaluator** | QA Agent → Auto-Eval |

### Sprint Contract Criteria (excerpt)

| ID | Criterion | Threshold |
|----|-----------|-----------|
| AC-01 | `POST /api/pools/:id/register` returns 201 with registration record on success | PASS |
| AC-02 | Duplicate registration returns 409 (idempotency) | PASS |
| AC-03 | Route rejects unauthenticated requests with 401 | PASS |
| AC-04 | Route rejects registration on full pool with 409 + clear error | PASS |
| AC-05 | Pool capacity check and registration write are atomic | PASS |
| AC-06 | Registration action is logged with `requestId` and `poolId` | PASS |

---

### Harness Scorecard

```json
{
  "scorecardId": "hsc-pool-register-2026-04-23",
  "taskId": "TASK-4821",
  "sprintContractId": "pool-register-2026-04-23",
  "tier": "2",
  "evaluatedAt": "2026-04-23T11:45:00Z",
  "evaluator": "QA Agent",
  "pillars": {
    "reliability": {
      "score": 4,
      "subCriteria": {
        "errorPathCoverage": 4,
        "atomicityRecovery": 4,
        "externalCallResilience": 5,
        "idempotency": 4,
        "raceConditionSafety": 3
      },
      "evidence": [
        "A: All async paths have try/catch; 4xx/5xx return structured JSON (RT: unit test)",
        "B: Registration + capacity decrement wrapped in Drizzle transaction (CR: code review)",
        "C: No external API calls in this route — N/A, scored 5 by convention",
        "D: Idempotency key checked via unique(pools_registrations, [userId, poolId]) (RT: duplicate test)",
        "E: Capacity check and insert are in transaction, but no explicit row-level lock on pool row (CR)"
      ],
      "blockers": [],
      "concerns": [
        "E: Under high contention, two concurrent registrations could both read capacity=1 before either decrements. Recommend SELECT FOR UPDATE on pool row inside transaction."
      ]
    },
    "scalability": {
      "score": 4,
      "subCriteria": {
        "nPlusOneElimination": 5,
        "paginationBounding": 5,
        "memoryBounding": 5,
        "concurrencySafety": 3,
        "databaseIndexFitness": 4
      },
      "evidence": [
        "A: Single insert + update; no loops (SA: grep)",
        "B: Endpoint returns single object; no list (SA)",
        "C: No caches or unbounded arrays (SA)",
        "D: Same concern as Reliability-E: pool row is hot under contention (CR)",
        "E: Composite index on (user_id, pool_id) for idempotency check; pool.id is PK (SA: schema review)"
      ],
      "blockers": [],
      "concerns": [
        "D: Recommend adding explicit row lock or optimistic locking on pool capacity to prevent oversell under load."
      ]
    },
    "security": {
      "score": 4,
      "subCriteria": {
        "authPermissionGates": 4,
        "failClosedDefaults": 4,
        "secretHygiene": 5,
        "sensitiveDataInErrors": 5,
        "inputValidation": 4
      },
      "evidence": [
        "A: Route uses requireAuth middleware; session checked before handler (SA: grep)",
        "B: Deny by default; no implicit allow paths (CR)",
        "C: No secrets in diff; guardrails passed (SA: npm run guardrails)",
        "D: Error responses contain only opaque code + message; no user data leaked (CR)",
        "E: Zod schema validates poolId as positive integer; body shape enforced (SA: grep)"
      ],
      "blockers": [],
      "concerns": [
        "A: Consider rate-limiting this endpoint per-user to prevent registration spam."
      ]
    },
    "observability": {
      "score": 4,
      "subCriteria": {
        "structuredErrorLogging": 4,
        "traceabilityCorrelation": 4,
        "metricsAlertCoverage": 3,
        "auditLogging": 5,
        "loggerDiscipline": 5
      },
      "evidence": [
        "A: logger.info on success; logger.warn on 409 conflict; logger.error on 500 (SA: grep)",
        "B: requestId propagated via Express middleware; included in log context (CR)",
        "C: No new metric added for registration failure rate. Existing pool metrics cover success only (CR)",
        "D: Not an admin write — N/A for adminAuditLogger. User action is auditable via request logs (CR)",
        "E: Zero console.* usage in new server code (SA: npm run guardrails)"
      ],
      "blockers": [],
      "concerns": [
        "C: Add a counter metric for registration failures by reason (capacity, duplicate, auth) to enable SLO alerting."
      ]
    },
    "maintainability": {
      "score": 5,
      "subCriteria": {
        "layerPlacement": 5,
        "crossAppImportHygiene": 5,
        "sharedPackageUsage": 5,
        "patternConsistency": 5,
        "fileSizeAbstraction": 5
      },
      "evidence": [
        "A: Route in routes/domains/pools.ts; logic in poolService.ts; query in poolRepository.ts (SA: find)",
        "B: No cross-app imports; only @joyjoin/shared and local src/ imports (SA: guardrails)",
        "C: Shared DTO imported from @joyjoin/shared; schema unchanged (SA: grep)",
        "D: Follows existing pool domain patterns. No drift (CR)",
        "E: route file 45 lines; service file 110 lines; repository file 80 lines (SA: wc -l)"
      ],
      "blockers": [],
      "concerns": []
    }
  },
  "verdict": "PASS",
  "iteration": 1,
  "notes": "Strong implementation. Two concerns (race condition on capacity, missing failure metric) are non-blocking for Tier 2 but should be fixed before this endpoint scales to high-traffic pools. Recommend follow-up ticket."
}
```

---

### Evaluation Walkthrough

| Step | Method | Result | Time |
|------|--------|--------|------|
| 1. Static Analysis | `npm run guardrails` + `grep` + `wc -l` | No secrets, no cross-app imports, no legacy shared/ imports, file sizes OK | ~30s |
| 2. Code Review | QA Agent reads diff | Transaction present, auth middleware present, layer placement correct, idempotency via unique constraint | ~3 min |
| 3. Runtime Test | `npm run test -w @joyjoin/server -- pools/register` | 201 success, 409 duplicate, 409 capacity, 401 unauthenticated all pass | ~45s |
| 4. Automated Gate | `npm run harness:gate` | All pillars pass at minimum threshold | ~15s |
| 5. Verdict | QA Agent applies Tier 2 threshold (all ≥3) | **PASS** — minimum pillar score is 4 (Scalability), above Tier 2 threshold. | — |

**Post-pass action:** File follow-up ticket for "Add SELECT FOR UPDATE on pool capacity check" and "Add registration failure counter metric."

---

## 8. Integration with Existing Artifacts

| Artifact | How this framework integrates |
|----------|------------------------------|
| `harness-completion-gate` skill | The gate script produces a scorecard JSON as output. The "blocking / concern / nit" mapping maps to scores 1–2 / 3 / 4–5. |
| `sprint-contract-implementation-phase.md` | Sprint Contract criteria IDs (REL-01, SCA-01, etc.) map to sub-criterion rows in this rubric. The scorecard references the contract ID. |
| `harness-design-implementation-phase-mapping.md` | Tier definitions and evaluator roles are preserved. Score thresholds are added as the numeric layer on top. |
| `agent_turn_summary` JSON | Include `"harnessScorecardId": "hsc-..."` and `"harnessVerdict": "PASS"` in the summary. |

---

## 9. Migration Path

1. **Week 1:** Scorecards are produced manually by QA Agent and Verifier using this rubric as reference. No script changes.
2. **Week 2:** Add `harnessScorecardId` to `agent_turn_summary` schema. Store scorecard JSON in `.git/.orchestration/scorecards/`.
3. **Week 3:** Update `npm run harness:gate` to emit a partial scorecard (static-analysis scores only). QA Agent adds runtime and code-review scores.
4. **Week 4:** Begin tracking the 5 top-level KPIs in a weekly report. Adjust rubric weights if a pillar is consistently over- or under-scoring.

---

## 10. Bottom Line

This KPI framework gives JoyJoin's Harness Engineering Framework **teeth**: every task gets a 1–5 score per pillar, every tier has a hard numeric threshold, and every evaluation leaves a machine-readable scorecard. The 5 top-level KPIs tell us whether the framework is working — or whether we are just adding ceremony.
