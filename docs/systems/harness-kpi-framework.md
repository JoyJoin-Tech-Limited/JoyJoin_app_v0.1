# JoyJoin Harness KPI Framework
## Implementation-Phase Gradable Quality Metrics

> **Version:** 1.0  
> **Date:** 2026-04-23  
> **Status:** Proposal — based on Anthropic "Harness design for long-running application development" (Mar 24, 2026) adapted to JoyJoin's 5 Harness Pillars  
> **Scope:** IMPLEMENTATION PHASE — measured while code is being written, not only at completion  

---

## 1. Philosophy: From Qualitative Checklist to Gradable Criteria

JoyJoin's Harness Completion Gate currently produces **PASS / CONCERN / FAIL** verdicts via static-analysis heuristics. This framework upgrades each pillar to a **numerically-graded rubric** (1–5 per criterion) with:

- **Concrete, observable criteria** — like Anthropic's "Design quality / Originality / Craft / Functionality"
- **Hard thresholds** — any criterion below its minimum causes a **sprint fail**
- **Hybrid measurement** — static analysis, runtime tests, and agent/LLM grading combined
- **Calibrated evaluators** — few-shot score breakdowns for each criterion

The goal is to catch quality drift **during** implementation, not only at the gate.

---

## 2. Scoring System

### Per-Criterion Scale: 1–5

| Score | Label | Meaning |
|-------|-------|---------|
| 5 | Excellent | Exceeds project standard; could be a teaching example |
| 4 | Good | Meets all requirements with no significant gaps |
| 3 | Acceptable | Meets minimum bar; minor gaps that don't block shipping |
| 2 | Weak | Below standard; must be fixed before merge |
| 1 | Critical | Dangerous or negligent; immediate rework required |

### Pillar Score
Each pillar's score is the **unweighted average** of its criteria (rounded to one decimal).  
**Example:** Reliability with criteria scored [5, 4, 3, 4] → pillar score = **4.0**

### Overall Harness Score
**Unweighted average of the 5 pillar scores**, rounded to one decimal.

### Verdict Rules

| Condition | Verdict | Action |
|-----------|---------|--------|
| All criteria ≥ 3, all pillars ≥ 3.5, overall ≥ 4.0 | **PASS** | Clear for merge |
| Any criterion = 2, or any pillar < 3.0 | **BLOCK** | Fix before merge |
| Any criterion = 1 | **SPRINT FAIL** | Immediate rework; task is not complete |
| All criteria ≥ 3, but one or more pillars 3.0–3.4, or overall 3.5–3.9 | **CONCERN** | Merge with documented follow-up ticket |

> **Hard threshold principle (from Anthropic):** If any single criterion falls below its minimum, the sprint fails — regardless of how well the others score. This prevents "average-quality" masking critical weaknesses.

---

## 3. The Five Pillars: Criteria, Rubrics, and Measurement

---

### Pillar 1: RELIABILITY

> *Does the code handle failure gracefully? Are state transitions safe?*

#### Criteria

| # | Criterion | Measurement | Weight in Pillar |
|---|-----------|-------------|------------------|
| R1 | **Error Path Coverage** | Static analysis + test coverage | 20% |
| R2 | **Idempotency & Safety** | Static analysis + code review | 20% |
| R3 | **Atomicity & Transaction Boundaries** | Static analysis + runtime test | 20% |
| R4 | **External Call Resilience** | Static analysis + config review | 20% |
| R5 | **State Machine Correctness** | Runtime test + manual review | 20% |

#### Rubric

**R1 — Error Path Coverage**
- 5: Every async call has structured error handling; catch blocks log with `req.requestId`; no unhandled Promise rejections
- 4: All major error paths handled; minor edge cases have TODOs with issue references
- 3: Error handling present on primary paths; some secondary paths use raw `throw` without context
- 2: Several error paths are silent or crash the process; missing try/catch on external calls
- 1: Happy-path only; errors will cause data corruption or unhandled exceptions in production

**R2 — Idempotency & Safety**
- 5: All mutation endpoints are idempotent (idempotency keys, natural keys, or UPSERT semantics); safe to retry
- 4: Critical mutations (payments, webhooks) are idempotent; others have documented non-idempotency risk
- 3: Most mutations safe on retry; a few lack explicit idempotency guards
- 2: Multiple mutations unsafe on retry; no idempotency keys on webhooks or payment flows
- 1: All mutations are naïve inserts/updates; retries will duplicate data or charge twice

**R3 — Atomicity & Transaction Boundaries**
- 5: Multi-step DB operations use explicit transactions (Drizzle `db.transaction`) with proper rollback
- 4: Transactions used for critical multi-step flows; single-step ops are transaction-free by design
- 3: Some multi-step flows have transactions; others use implicit auto-commit with compensating logic
- 2: Complex flows lack transaction boundaries; partial failure leaves DB in inconsistent state
- 1: No transaction usage anywhere; multi-step writes are guaranteed to corrupt on partial failure

**R4 — External Call Resilience**
- 5: All external calls (LLM, WeChat Pay, embedding API) have timeout, retry with exponential backoff, and circuit-breaker pattern
- 4: Timeouts and retries configured; circuit breaker not needed per domain reasoning (documented)
- 3: Timeouts present; retries missing or naive (no backoff)
- 2: External calls fire without timeouts; will hang under network degradation
- 1: No timeout, no retry, no fallback — external outage = platform outage

**R5 — State Machine Correctness**
- 5: State transitions are guarded by explicit preconditions; invalid transitions return 409 or 422 with clear messages
- 4: State machine mostly explicit; one or two transitions rely on implicit ordering
- 3: State transitions work in the happy path but lack guards against invalid transitions
- 2: State can be manipulated into invalid combinations via API calls
- 1: No state model; any client can set any state at any time

#### How Measured

| Criterion | Static | Runtime | Manual |
|-----------|--------|---------|--------|
| R1 | `harness-completion-gate.mjs` catches unhandled fetch/apiRequest | Unit tests for error branches | Agent spot-checks catch blocks |
| R2 | Regex scan for idempotency key usage | Integration test: retry same mutation twice | Code review of mutation endpoints |
| R3 | Regex scan for `db.transaction` | DB state assertion after forced failure | Review transaction scope appropriateness |
| R4 | Config file audit for timeout/retry values | Synthetic probe under degraded external | Review of external client initialization |
| R5 | — | State-machine invariant tests | Agent review of transition guards |

---

### Pillar 2: SCALABILITY

> *Will this code survive 10× user growth without architectural change?*

#### Criteria

| # | Criterion | Measurement | Weight in Pillar |
|---|-----------|-------------|------------------|
| S1 | **Query Efficiency** | Static analysis + query-plan review | 20% |
| S2 | **Pagination & Bounding** | Static analysis + runtime test | 20% |
| S3 | **Memory & Cache Safety** | Static analysis + config review | 20% |
| S4 | **Concurrency Safety** | Static analysis + runtime test | 20% |
| S5 | **Hot-Path Efficiency** | Runtime benchmark + code review | 20% |

#### Rubric

**S1 — Query Efficiency**
- 5: All list queries use appropriate indexes; no N+1; `EXPLAIN ANALYZE` confirms index usage
- 4: No N+1; one query flagged by `EXPLAIN` but justified (e.g., small lookup table)
- 3: No obvious N+1; some queries lack verified index coverage
- 2: N+1 queries present in loops; full table scans on hot paths
- 1: Every route hits the DB in O(n²) or worse; no indexing strategy

**S2 — Pagination & Bounding**
- 5: Every list endpoint has `limit`/`offset` or cursor pagination; frontend lists use VirtualList or bounded rendering
- 4: All API lists paginated; one frontend list unbounded but < 100 items expected
- 3: Most lists paginated; some admin/internal endpoints return unbounded sets
- 2: Multiple user-facing lists return unbounded data; will OOM client or timeout server
- 1: No pagination anywhere; `SELECT *` is the query pattern

**S3 — Memory & Cache Safety**
- 5: All caches have explicit TTL and max-size; no unbounded array growth; `setInterval` always paired with cleanup
- 4: Caches bounded; one interval lacks explicit cleanup but is in a long-lived service with documented lifecycle
- 3: Caches have TTL but no max-size; some arrays grow with user input
- 2: Unbounded caches or arrays; memory leaks via uncleared intervals or event listeners
- 1: Global mutable caches with no eviction; memory grows until process restart

**S4 — Concurrency Safety**
- 5: All shared mutable state uses proper locking, atomic operations, or is avoided entirely; race conditions impossible by design
- 4: Shared state is minimal and documented; optimistic locking used where needed
- 3: Most state is per-request; one or two global variables could race under load
- 2: Multiple global mutable variables used for coordination; races likely under concurrent load
- 1: Shared mutable state is the primary coordination mechanism; races are guaranteed

**S5 — Hot-Path Efficiency**
- 5: Hot paths (matching, auth, pool discovery) are benchmarked and meet latency SLOs; LLM calls are never on synchronous hot paths
- 4: Hot paths reviewed for efficiency; LLM calls are async or cached
- 3: Hot paths are reasonable; no obvious inefficiencies but no benchmarks
- 2: Hot paths do unnecessary work (e.g., full object serialization when only ID needed)
- 1: Synchronous LLM call on login path; matching runs O(n³) algorithm without optimization

#### How Measured

| Criterion | Static | Runtime | Manual |
|-----------|--------|---------|--------|
| S1 | `harness-completion-gate.mjs` N+1 detection; Drizzle query review | `EXPLAIN ANALYZE` on changed queries | DBA review for index strategy |
| S2 | Regex scan for `.limit()`, `VirtualList`, pagination params | Load test with 10× expected list size | Agent review of list endpoints |
| S3 | Regex scan for `setInterval`, cache initialization | Memory profiling under sustained load | Review cache config files |
| S4 | Static scan for global mutable variables | Load-test race condition probe | Code review of concurrency patterns |
| S5 | — | Benchmark script for changed hot paths | Agent review of synchronous LLM usage |

---

### Pillar 3: SECURITY

> *Does the code fail safely? Are trust boundaries respected?*

#### Criteria

| # | Criterion | Measurement | Weight in Pillar |
|---|-----------|-------------|------------------|
| SE1 | **Auth & Authorization Coverage** | Static analysis + runtime test | 20% |
| SE2 | **Fail-Closed Defaults** | Code review + static analysis | 20% |
| SE3 | **Input Validation** | Static analysis + fuzz test | 20% |
| SE4 | **Secret & Data Exposure** | Static analysis + secret scan | 20% |
| SE5 | **Trust Boundary Respect** | Code review + architecture check | 20% |

#### Rubric

**SE1 — Auth & Authorization Coverage**
- 5: Every new route has explicit auth middleware; admin routes have role checks; unauthenticated access is impossible by omission
- 4: All routes have auth; one internal route has relaxed auth with documented justification
- 3: All user-facing routes auth-gated; one or two admin/internal routes lack role checks
- 2: Multiple routes missing auth; some endpoints trust client-provided userId
- 1: No auth on new routes; any user can call admin or payment endpoints

**SE2 — Fail-Closed Defaults**
- 5: Default branch in every switch/if-chain denies access; missing env vars crash on startup (fail fast); permissions default to "deny"
- 4: Fail-closed in auth and payment flows; one non-critical feature defaults to allow with low blast radius
- 3: Mostly fail-closed; a few features default to permissive when config is missing
- 2: Multiple features default to open/allow when auth or config is missing
- 1: `if (isAdmin)` is the only guard; missing the check = full access

**SE3 — Input Validation**
- 5: All request inputs (body, query, params) validated with Zod schemas; schemas live in `packages/shared/src/api.ts`; no raw `req.body` access
- 4: Zod validation on all API inputs; one or two internal params use type guards with justification
- 3: Most inputs validated; some use manual validation or TypeScript-only typing
- 2: Multiple endpoints accept raw `req.body` without validation
- 1: No validation; SQL injection and type confusion are trivially achievable

**SE4 — Secret & Data Exposure**
- 5: No secrets in code (verified by `npm run guardrails` + secret scanner); no sensitive data in logs or error messages; stack traces stripped in production
- 4: Guardrails pass; one log line includes a non-secret identifier that could be considered sensitive (documented)
- 3: No hardcoded secrets; some error messages leak internal structure or user data
- 2: Secrets found in code or logs; error messages include stack traces with file paths
- 1: API keys committed to repo; production logs include passwords or session tokens

**SE5 — Trust Boundary Respect**
- 5: User data never flows into admin logic without transformation; internal APIs are not exposed externally; WebSocket auth mirrors HTTP auth
- 4: Clear separation of user/admin/internal surfaces; one edge case documented
- 3: Boundaries mostly respected; one internal helper reused in user-facing route without sanitization
- 2: Admin functions callable by users; internal endpoints exposed without additional auth
- 1: No trust boundaries; database connection string is accessible to frontend

#### How Measured

| Criterion | Static | Runtime | Manual |
|-----------|--------|---------|--------|
| SE1 | `harness-completion-gate.mjs` route auth detection | Integration test: call route without auth, expect 401/403 | Agent review of route registration |
| SE2 | Static scan for default-allow patterns | — | Agent review of permission logic |
| SE3 | `harness-completion-gate.mjs` Zod validation scan | Fuzz test with invalid payloads | Code review of schema completeness |
| SE4 | `npm run guardrails`; secret regex scan; `console.log` scan | — | Agent review of error response shapes |
| SE5 | Import boundary scan (cross-app detection) | Penetration test: can user call admin route? | Architecture review of data flow |

---

### Pillar 4: OBSERVABILITY

> *Can we debug production issues without adding new logging?*

#### Criteria

| # | Criterion | Measurement | Weight in Pillar |
|---|-----------|-------------|------------------|
| O1 | **Structured Logging Coverage** | Static analysis + log review | 20% |
| O2 | **Request Correlation** | Static analysis + runtime test | 20% |
| O3 | **Metrics & Alert Coverage** | Static analysis + config review | 20% |
| O4 | **Audit Trail Completeness** | Static analysis + code review | 20% |
| O5 | **Failure Mode Discoverability** | Runtime test + manual review | 20% |

#### Rubric

**O1 — Structured Logging Coverage**
- 5: Every error path logs via `logger.error/warn` with structured fields (`request_id`, `user_id`, `event_id`); no `console.*` in server handlers; log levels are appropriate
- 4: All errors logged; one or two `console.log` for analytics/debug with documented justification
- 3: Most errors logged; some catch blocks are silent or use `console.error`
- 2: Many error paths silent; `console.log` used for operational logging
- 1: No structured logging; `console.log` is the only observability; errors disappear in production

**O2 — Request Correlation**
- 5: Every async flow (including background jobs, WebSocket handlers) propagates `request_id`; child loggers used consistently
- 4: HTTP request chain fully correlated; one background job lacks correlation but is low-volume
- 3: HTTP handlers have `request_id`; async side effects lose correlation
- 2: Correlation ID exists on entry but not propagated to DB or external calls
- 1: No correlation IDs; debugging requires grep across unrelated requests

**O3 — Metrics & Alert Coverage**
- 5: New critical paths have Prometheus counters/histograms; new failure modes have alert rules in `infra/`; metrics have labels for dimensionality
- 4: Critical paths instrumented; alert rules added for new failure modes
- 3: Some metrics added; alerts not updated for new failure paths
- 2: No new metrics; operators cannot distinguish new failures from old
- 1: No metrics infrastructure used; operational awareness is purely reactive

**O4 — Audit Trail Completeness**
- 5: Every sensitive mutation (auth, payment, admin action, ban, refund) emits an audit log entry with actor, action, target, and before/after state
- 4: All sensitive mutations audited; one low-sensitivity mutation lacks audit with documented justification
- 3: Most sensitive mutations audited; some admin actions lack audit entries
- 2: Only payments audited; other sensitive actions are invisible
- 1: No audit logging; a malicious admin or breached account is undetectable

**O5 — Failure Mode Discoverability**
- 5: A new on-call engineer can identify the root cause of any failure in this code within 5 minutes using only logs and metrics; failure modes are documented
- 4: Most failures are discoverable within 10 minutes; edge cases may need code inspection
- 3: Common failures are discoverable; rare edge cases require adding temporary logging
- 2: Debugging most failures requires reproducing locally; logs are insufficient
- 1: Production failures are mysteries; fixing them requires guesswork and deploy-and-pray

#### How Measured

| Criterion | Static | Runtime | Manual |
|-----------|--------|---------|--------|
| O1 | `harness-completion-gate.mjs` catch-block + `console.*` scan | — | Agent review of log output samples |
| O2 | Regex scan for `request_id` propagation | Trace test: verify child span carries parent ID | Agent review of async flow wiring |
| O3 | Regex scan for metric increments | Grafana alert rule validation | Review of alert rule changes |
| O4 | `harness-completion-gate.mjs` audit log scan | — | Agent review of mutation endpoints |
| O5 | — | Synthetic failure injection test | On-call drill review |

---

### Pillar 5: MAINTAINABILITY

> *Can another engineer safely modify this code in 6 months?*

#### Criteria

| # | Criterion | Measurement | Weight in Pillar |
|---|-----------|-------------|------------------|
| M1 | **Layer Placement & Domain Boundaries** | Static analysis + import scan | 20% |
| M2 | **Pattern Consistency** | Static analysis + code review | 20% |
| M3 | **Code Size & Complexity** | Static analysis | 20% |
| M4 | **Shared Contract Hygiene** | Static analysis + typecheck | 20% |
| M5 | **Documentation & Intent** | Code review + static analysis | 20% |

#### Rubric

**M1 — Layer Placement & Domain Boundaries**
- 5: Routes delegate to services; services delegate to repositories; no query logic in routes; no HTTP logic in repositories; cross-app imports impossible
- 4: Correct layering; one minor violation with documented justification
- 3: Mostly correct; some business logic leaked into routes or repositories
- 2: SQL in route handlers; HTTP client code in repositories; cross-app imports present
- 1: All logic in one 2000-line route file; no separation of concerns

**M2 — Pattern Consistency**
- 5: Code follows established patterns exactly; any deviation is documented in an ADR or code comment with issue reference
- 4: Follows patterns; one minor deviation that improves readability
- 3: Mostly consistent; some naming or structure differs without justification
- 2: Multiple inconsistent patterns within the same PR; future refactors guaranteed
- 1: Every file uses a different style; no relationship to existing codebase

**M3 — Code Size & Complexity**
- 5: All files < 800 lines; functions < 50 lines; cyclomatic complexity < 10; no deep nesting
- 4: Files < 1200 lines (frontend) / 1500 lines (server); functions < 80 lines; complexity < 15
- 3: Files within warning limits; one or two functions are longer but focused
- 2: Multiple files exceed fail limits; functions are 200+ lines with multiple responsibilities
- 1: Files > 2500 lines; functions are 500+ lines; nesting depth > 5

**M4 — Shared Contract Hygiene**
- 5: All shared types/schemas in `packages/shared/src/`; imported via `@joyjoin/shared`; no legacy `shared/` root imports; Zod schemas exported for all API contracts
- 4: Shared contracts correct; one temporary type duplicated with TODO to consolidate
- 3: Mostly shared; some types duplicated across apps
- 2: Significant duplication; legacy `shared/` imports reintroduced
- 1: Types copy-pasted between apps; schema drift guaranteed

**M5 — Documentation & Intent**
- 5: Complex logic has inline comments explaining *why*, not *what*; every exported function has a JSDoc; every TODO has an issue reference
- 4: Most complex areas commented; exported functions documented
- 3: Some comments; basic JSDoc on public APIs
- 2: Minimal comments; tribal knowledge required to understand logic
- 1: No comments; no JSDoc; variable names are single letters; intent is indecipherable

#### How Measured

| Criterion | Static | Runtime | Manual |
|-----------|--------|---------|--------|
| M1 | `harness-completion-gate.mjs` cross-app + layer scan | — | Agent review of file placement |
| M2 | Lint + naming convention checks | — | Agent review against existing patterns |
| M3 | `harness-completion-gate.mjs` line count; complexity linter | — | Agent review of function decomposition |
| M4 | `harness-completion-gate.mjs` legacy import scan; typecheck | — | Agent review of shared package usage |
| M5 | Regex scan for TODO/FIXME without issue refs; JSDoc coverage tool | — | Agent review of comment quality |

---

## 4. Measurement Methods Deep Dive

### Static Analysis (Automated, Fast, ~2 seconds)

| Tool | What it checks | Integration |
|------|---------------|-------------|
| `harness-completion-gate.mjs` | Regex-based heuristics for all 5 pillars | Runs on every commit via pre-commit hook; runs in CI |
| `npm run guardrails` | Secrets, legacy identifiers, import boundaries | CI gate; local pre-push |
| `npm run typecheck` | Type safety, shared contract alignment | CI gate; local dev |
| Custom ESLint rules | Complexity, naming, pattern consistency | CI gate; IDE real-time |
| Secret scanner (TruffleHog / git-secrets) | Hardcoded credentials | CI gate |

### Runtime Tests (Medium Cost, ~10–60 seconds)

| Test Type | What it validates | Integration |
|-----------|-------------------|-------------|
| Unit tests | Error branches, idempotency, state transitions | `npm run test` in CI |
| Integration tests | Auth gating, input validation, pagination | `npm run test` in CI |
| DB query plan tests | `EXPLAIN ANALYZE` for changed queries | Manual or CI with test DB |
| Synthetic probes | End-to-end happy path + failure injection | GitHub Actions schedule |
| Load tests | Hot-path latency under concurrency | Staging only |

### Manual / Agent Grading (Highest Fidelity, ~1–2 minutes)

| Review Type | Who | When |
|-------------|-----|------|
| Agent turn-end Harness review | Implementation agent | Every turn, before claiming done |
| Code review (PR) | Peer engineer or `code-review` skill | Before merge |
| Architecture review | `Deliberation Moderator` or HRC | For high-blast-radius changes |
| Few-shot calibrated grading | LLM evaluator with examples | For ambiguous criteria (O5, M5) |

### Hybrid Scoring Formula

For each criterion, the final score is computed as:

```
criterion_score = min(static_score, runtime_score, manual_score)
```

**Rationale:** A criterion is only as strong as its weakest measurement. If static analysis passes but runtime tests fail, the criterion fails. This prevents "green CI, broken production" scenarios.

**Exception:** If a measurement method is N/A for a criterion (e.g., no runtime test for M5), it is excluded from the minimum:
```
criterion_score = min(applicable_scores)
```

---

## 5. The Harness Dashboard

### Concept

A per-session, per-PR, and per-sprint aggregated view of Harness scores. Inspired by Anthropic's evaluator dashboard, but adapted for a monorepo with multiple contributors and AI agents.

### Data Model

```typescript
interface HarnessCriterionScore {
  criterionId: string;        // e.g., "R1", "SE3"
  score: 1 | 2 | 3 | 4 | 5;
  staticScore?: 1 | 2 | 3 | 4 | 5;
  runtimeScore?: 1 | 2 | 3 | 4 | 5;
  manualScore?: 1 | 2 | 3 | 4 | 5;
  measuredBy: ('static' | 'runtime' | 'manual')[];
  findings: HarnessFinding[];
}

interface HarnessPillarScore {
  pillar: 'reliability' | 'scalability' | 'security' | 'observability' | 'maintainability';
  score: number;              // 1.0 – 5.0
  criteria: HarnessCriterionScore[];
  verdict: 'pass' | 'concern' | 'block' | 'sprint-fail';
}

interface HarnessSessionReport {
  sessionId: string;          // git commit hash or agent session ID
  timestamp: string;
  contributor: string;        // human username or agent name
  changedFiles: string[];
  pillars: HarnessPillarScore[];
  overallScore: number;       // 1.0 – 5.0
  overallVerdict: 'pass' | 'concern' | 'block' | 'sprint-fail';
  durationMs: number;
  diffUrl?: string;
}

interface HarnessDashboard {
  // Aggregate across sessions
  sprintAverage: number;
  trend: ('up' | 'down' | 'flat')[];  // per-pillar trend over last 10 sessions
  weakestPillar: string;
  mostCommonFailure: string;
  calibratedExamples: CalibratedExample[];
}
```

### Dashboard Views

#### 1. Session View (Per Task / Per PR)
```
┌─────────────────────────────────────────────────────────────┐
│  Harness Session Report  —  abc1234  —  Backend Engineer    │
├─────────────────────────────────────────────────────────────┤
│  Overall: 4.2 / 5.0  │  Verdict: PASS  │  Duration: 45s   │
├─────────────────────────────────────────────────────────────┤
│  Reliability      ████████████████████░░  4.2  ✅          │
│  Scalability      █████████████████████░░  4.4  ✅          │
│  Security         ██████████████████░░░░░  3.6  ⚠️  CONCERN │
│  Observability    █████████████████████░░  4.4  ✅          │
│  Maintainability  ███████████████████░░░░  4.0  ✅          │
├─────────────────────────────────────────────────────────────┤
│  Security concern: SE3 (Input Validation) = 3               │
│  → One query param lacks Zod validation (eventPools.ts:142) │
│  → Mitigation: add z.coerce.number() for page param         │
├─────────────────────────────────────────────────────────────┤
│  [View Details]  [Export JSON]  [Create Follow-up Ticket]   │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Sprint View (Aggregated)
```
┌─────────────────────────────────────────────────────────────┐
│  Sprint 24 Harness Quality Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│  Sessions: 47  │  Pass: 38 (81%)  │  Concern: 7  │  Block: 2 │
├─────────────────────────────────────────────────────────────┤
│  Pillar Trend (last 10 sessions)                            │
│  Reliability      ▁▃▅▆▆▇▇▇██  ↑ improving                  │
│  Scalability      ▆▆▆▇▇▇▇▇██  → stable                     │
│  Security         ▁▂▃▃▄▄▄▄▅▅  ↑ improving (was weakest)    │
│  Observability    ▅▆▆▇▇▇▇▇██  → stable                     │
│  Maintainability  ▃▄▅▅▆▆▇▇██  ↑ improving                  │
├─────────────────────────────────────────────────────────────┤
│  Top 3 recurring issues:                                    │
│  1. SE3 (Input Validation) — 8 occurrences                  │
│  2. O1 (Structured Logging) — 5 occurrences                 │
│  3. M3 (Code Size) — 4 occurrences                          │
├─────────────────────────────────────────────────────────────┤
│  [View Heatmap]  [Export Sprint Report]  [Calibration]      │
└─────────────────────────────────────────────────────────────┘
```

#### 3. Heatmap View (Per-File Quality)
```
File                                    R   S   SE  O   M   Overall
apps/server/src/routes/domains/auth.ts  5.0 4.0 4.8 4.6 4.4  4.56
apps/server/src/routes/domains/pool.ts  4.2 3.0 4.0 3.8 4.0  3.80 ⚠️
packages/shared/src/schema.ts           5.0 5.0 4.6 4.0 4.8  4.68
```

### Storage & Access

- **Per-session reports:** `.git/.orchestration/harness-reports/{sessionId}.json`
- **Sprint aggregates:** `repo-memory/generated/harness-sprint-{sprintNumber}.json`
- **CI artifact:** GitHub Actions uploads JSON report as artifact
- **Web view:** Optional future work — admin dashboard page at `/admin/harness-quality`

---

## 6. Calibrating the Evaluator

### Few-Shot Example Library

For criteria that require judgment (especially O5, M5, R5), we maintain a calibrated example library in `repo-memory/examples/harness-grading/`.

#### Example: R1 — Error Path Coverage

**Score 5 example:**
```typescript
// File: apps/server/src/routes/domains/payments.ts
app.post('/api/payments', async (req, res) => {
  const reqLogger = logger.child({ request_id: req.requestId });
  try {
    const result = await paymentService.createCharge(validatedInput);
    reqLogger.info('Payment created', { paymentId: result.id, userId: req.userId });
    res.json(result);
  } catch (error) {
    reqLogger.error('Payment creation failed', {
      error: error.message,
      userId: req.userId,
      amount: validatedInput.amount,
    });
    // Fail-closed: don't expose internal error to client
    res.status(500).json({ error: 'Payment processing failed. Support notified.' });
  }
});
```
**Why 5:** Structured logging with request ID, catch block handles all errors, client-safe message, no information leakage.

**Score 2 example:**
```typescript
// File: apps/server/src/routes/domains/events.ts (hypothetical bad example)
app.post('/api/events', async (req, res) => {
  const event = await db.insert(events).values(req.body).returning();
  res.json(event);
});
```
**Why 2:** No try/catch; unhandled DB errors will crash or leak internal details; no logging; raw `req.body`.

---

#### Example: SE3 — Input Validation

**Score 5 example:**
```typescript
// packages/shared/src/api.ts
export const CreateEventPoolSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  eventDate: z.coerce.date().min(new Date()),
  maxParticipants: z.coerce.number().int().min(2).max(50),
  venueId: z.string().uuid(),
});

// In route:
const body = CreateEventPoolSchema.parse(req.body);
```
**Why 5:** Zod schema in shared package, strict bounds, type coercion, used with `.parse()` (throws on invalid).

**Score 1 example:**
```typescript
app.post('/api/events', (req, res) => {
  const { title, date, max } = req.body;
  db.insert(events).values({ title, date, maxParticipants: max });
});
```
**Why 1:** No validation; any payload accepted; SQL injection possible via untrusted fields; type confusion guaranteed.

---

#### Example: M3 — Code Size & Complexity

**Score 5 example:**
```
poolMatchingService.ts
├── findCompatibleGroups()     28 lines, complexity 4
├── scorePair()                22 lines, complexity 3
├── calculateGroupDiversity()  35 lines, complexity 5
├── assignVenuesToGroups()     30 lines, complexity 4
└── [re-exported utilities]    12 lines each
Total: ~450 lines, max complexity 5
```
**Why 5:** Each function has a single responsibility; sizes are small; complexity is low.

**Score 1 example:**
```
legacyEventManager.ts
├── handleEverything()         680 lines, complexity 42
│   ├── nested if-else chain   depth 6
│   ├── inline SQL strings     12 occurrences
│   ├── duplicate logic        4 copy-paste blocks
│   └── no comments
Total: 2400 lines, max complexity 42
```
**Why 1:** Single function does everything; cyclomatic complexity is unmanageable; impossible to test or modify safely.

---

### Calibration Process

1. **Seed the library** with 3–5 scored examples per criterion (mixed good/bad).
2. **Human review panel** (2 senior engineers) independently scores 20 real PRs using the rubric.
3. **Compute inter-rater reliability** (Cohen's κ target: ≥ 0.75).
4. **Adjust rubric** where agreement is low.
5. **Train LLM evaluator** with the calibrated examples as few-shot prompts.
6. **Quarterly recalibration:** Add new examples from recent PRs; retire outdated ones.

---

## 7. Example Evaluation: "Add a new API route for event pool registration"

### Task Description
Add `POST /api/event-pools/:poolId/register` that:
1. Validates the user is authenticated
2. Checks the pool exists and is open
3. Validates the user has completed onboarding
4. Creates a `pool_registrations` record
5. Returns the registration with pool stats
6. Broadcasts `POOL_REGISTRATION_ADDED` via WebSocket

### Changed Files
- `apps/server/src/routes/domains/eventPools.ts` (new endpoint)
- `apps/server/src/repositories/poolRegistrationsRepo.ts` (new repo method)
- `packages/shared/src/api.ts` (Zod schema for request/response)

---

### Static Analysis Results

| Criterion | Finding | Severity |
|-----------|---------|----------|
| R1 | Unwrapped `db.insert()` call — no try/catch | concern |
| R3 | `db.insert` + `wsService.broadcast` — two steps, no transaction | concern |
| S1 | Single insert query, no loop — N+1 not applicable | pass |
| S2 | Returns single object, not a list — pagination N/A | pass |
| SE1 | Route has `requireAuth` middleware | pass |
| SE2 | Default branch returns 403 if not authenticated | pass |
| SE3 | `req.params.poolId` used directly without Zod coercion | concern |
| SE4 | No secrets in diff | pass |
| SE5 | No cross-app imports | pass |
| O1 | Catch block uses `console.error` instead of `logger.error` | concern |
| O2 | `request_id` present on entry but not passed to `wsService.broadcast` | concern |
| O4 | No audit log for pool registration mutation | concern |
| M1 | Route → service → repo layering correct | pass |
| M2 | Follows existing event pool route patterns | pass |
| M3 | File: 145 lines (well under limit) | pass |
| M4 | Zod schema added to `packages/shared/src/api.ts` | pass |
| M5 | JSDoc on new repo method; TODO without issue ref | nit |

---

### Runtime Test Results

- **Integration test:** Auth-less request → 401 ✅
- **Integration test:** Closed pool → 409 with clear message ✅
- **Integration test:** Incomplete onboarding → 403 ✅
- **Integration test:** Happy path → registration created, WS event fired ✅
- **Load test:** 100 concurrent registrations → no race conditions, all succeed ✅
- **DB query plan:** Single insert, single select — both use primary key index ✅

---

### Manual / Agent Review

**Agent notes:**
- R1: The unwrapped insert is inside an Express handler that has a top-level try/catch in the router wrapper — downgrading to nit after review.
- R3: WS broadcast is a side effect that should happen *after* transaction commit, not inside it. Current code is correct (broadcast outside tx) but lacks transaction. Recommend adding transaction around insert + any future state updates.
- SE3: `poolId` from params should be validated with `z.coerce.number()` or `z.string().uuid()`.
- O1: `console.error` must be `logger.error` with `request_id`.
- O2: `wsService.broadcast` should accept a `requestId` parameter or use async hooks.
- O4: Pool registration is not audit-critical (user self-service), but should be logged at `info` level with structured fields.

---

### Final Scores

| Pillar | Criteria | Scores | Pillar Score | Verdict |
|--------|----------|--------|--------------|---------|
| **Reliability** | R1: 4 (top-level handler catches) / R2: 3 (no idempotency key) / R3: 3 (no tx, but safe ordering) / R4: 5 (no external calls) / R5: 4 (state checks present) | 4, 3, 3, 5, 4 | **3.8** | CONCERN |
| **Scalability** | S1: 5 / S2: 5 / S3: 5 (no caches/intervals) / S4: 5 (no shared mutable state) / S5: 4 (no benchmark, but clearly fast) | 5, 5, 5, 5, 4 | **4.8** | PASS |
| **Security** | SE1: 5 / SE2: 5 / SE3: 2 (raw params) / SE4: 5 / SE5: 5 | 5, 5, 2, 5, 5 | **4.4** | BLOCK |
| **Observability** | O1: 2 (console.error) / O2: 3 (partial correlation) / O3: 3 (no new metrics) / O4: 3 (no audit, but info log OK) / O5: 4 (discoverable) | 2, 3, 3, 3, 4 | **3.0** | BLOCK |
| **Maintainability** | M1: 5 / M2: 5 / M3: 5 / M4: 5 / M5: 4 (one TODO without ref) | 5, 5, 5, 5, 4 | **4.8** | PASS |

**Overall Score:** 4.2  
**Overall Verdict:** BLOCK  
**Blocking reasons:**
1. SE3 = 2 (Input Validation): `req.params.poolId` lacks Zod validation
2. O1 = 2 (Structured Logging): `console.error` instead of `logger.error`

**Required fixes before merge:**
1. Add `z.object({ poolId: z.coerce.number() }).parse(req.params)`
2. Replace `console.error` with `reqLogger.error(...)`
3. Add `request_id` to `wsService.broadcast` call (or document why not)
4. (Recommended) Wrap insert in `db.transaction()` for future-proofing

**Post-fix re-evaluation:**
| Pillar | New Score | Verdict |
|--------|-----------|---------|
| Reliability | 4.0 | PASS |
| Scalability | 4.8 | PASS |
| Security | 4.8 | PASS |
| Observability | 4.0 | PASS |
| Maintainability | 4.8 | PASS |
| **Overall** | **4.48** | **PASS** |

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1–2)
- [ ] Extend `harness-completion-gate.mjs` to output per-criterion scores (1–5) instead of just pass/concern/fail
- [ ] Add criterion ID tags to all existing findings (R1, S2, SE3, etc.)
- [ ] Implement `min(applicable_scores)` logic for hybrid scoring
- [ ] Create `repo-memory/examples/harness-grading/` with seed examples

### Phase 2: Calibration (Week 3–4)
- [ ] Senior engineer panel scores 20 recent PRs using this rubric
- [ ] Compute inter-rater reliability; adjust rubric text where κ < 0.75
- [ ] Build LLM few-shot prompt template for automated criterion scoring
- [ ] Run LLM evaluator against human panel; target ≥ 85% agreement

### Phase 3: Dashboard (Week 5–6)
- [ ] JSON report format v2 with criterion-level breakdown
- [ ] CLI command: `npm run harness:dashboard -- --sprint=24`
- [ ] GitHub Actions artifact upload for per-PR reports
- [ ] Trend tracking across last 10 sessions

### Phase 4: Enforcement (Week 7+)
- [ ] CI blocks merge on any criterion = 1 or 2
- [ ] Pre-commit hook shows pillar scores in terminal
- [ ] Agent turn summary includes `harnessVerdict` with criterion scores
- [ ] Quarterly recalibration process documented

---

## 9. Quick Reference Card

```
╔════════════════════════════════════════════════════════════════╗
║           JOYJOIN HARNESS KPI — QUICK REFERENCE                ║
╠════════════════════════════════════════════════════════════════╣
║  Scale: 1–5 per criterion  │  Pillar: average of criteria     ║
║  Overall: average of 5 pillars                                 ║
╠════════════════════════════════════════════════════════════════╣
║  SPRINT FAIL: any criterion = 1                                ║
║  BLOCK:       any criterion = 2, or any pillar < 3.0           ║
║  CONCERN:     overall 3.5–3.9, or any pillar 3.0–3.4           ║
║  PASS:        all criteria ≥ 3, all pillars ≥ 3.5, overall ≥ 4 ║
╠════════════════════════════════════════════════════════════════╣
║  R = Reliability    │  S = Scalability    │  SE = Security    ║
║  O = Observability  │  M = Maintainability                   ║
╠════════════════════════════════════════════════════════════════╣
║  Measure: static (fast) + runtime (medium) + manual (slow)     ║
║  Score:   min(applicable measurements)                         ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Appendix A: Criterion-to-Checker Mapping

| Criterion | `harness-completion-gate.mjs` checker | Other tools |
|-----------|--------------------------------------|-------------|
| R1 | `checkReliability` — unwrapped fetch | Unit test coverage |
| R2 | — (needs new: idempotency key scan) | Integration test |
| R3 | `checkReliability` — multi-step DB without tx | DB assertion test |
| R4 | — (needs new: timeout config audit) | Config file review |
| R5 | — (manual only) | State-machine test |
| S1 | `checkScalability` — N+1 detection | `EXPLAIN ANALYZE` |
| S2 | `checkScalability` — missing `.limit()` | Integration test |
| S3 | `checkScalability` — setInterval, array spread | Memory profile |
| S4 | — (needs new: global mutable scan) | Load test |
| S5 | — | Benchmark script |
| SE1 | `checkSecurity` — route auth scan | Integration test |
| SE2 | — (manual) | — |
| SE3 | `checkSecurity` — Zod validation scan | Fuzz test |
| SE4 | `checkSecurity` — secret scan; `npm run guardrails` | — |
| SE5 | `checkMaintainability` — cross-app import scan | Penetration test |
| O1 | `checkObservability` — catch block logger; console.* scan | — |
| O2 | — (needs new: request_id propagation scan) | Trace test |
| O3 | — (needs new: metric increment scan) | Alert rule validation |
| O4 | `checkObservability` — audit log scan | — |
| O5 | — (manual) | Synthetic failure injection |
| M1 | `checkMaintainability` — cross-app, layer scan | — |
| M2 | ESLint naming rules | Code review |
| M3 | `checkMaintainability` — line count; complexity linter | — |
| M4 | `checkMaintainability` — legacy import scan; typecheck | — |
| M5 | — (needs new: TODO without ref scan; JSDoc coverage) | Code review |

---

## Appendix B: Calibration Example Template

```markdown
### Criterion: {ID} — {Name}

**Score: {N}**

**Code snippet:**
```typescript
// ...
```

**Score justification:**
- Point 1
- Point 2

**What would change the score:**
- To score {N+1}: ...
- To score {N-1}: ...
```
