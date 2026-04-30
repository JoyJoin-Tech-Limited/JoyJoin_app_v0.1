# Harness Pillar Details

## Full per-pillar checklist

### 1. Reliability
- [ ] No partial-failure risk (side effects before persistence?)
- [ ] Error paths handled (try/catch, fallback values, graceful degradation)
- [ ] Retries and timeouts configured for external calls
- [ ] Multi-step operations are atomic or have recovery logic
- [ ] Idempotency respected where needed (payments, webhooks, mutations)
- [ ] No race conditions on shared mutable state

### 2. Scalability
- [ ] No queries inside loops (N+1)
- [ ] No unbounded list renders without pagination or virtualisation
- [ ] No unbounded memory growth (caches have TTL, arrays have limits)
- [ ] Concurrency-safe (no global mutable state without locks)
- [ ] Database queries use appropriate indexes (no full table scans)

### 3. Security
- [ ] Auth/permission checks present on new routes or mutations
- [ ] Fail-closed defaults (deny by default, not allow by default)
- [ ] No secrets, credentials, or tokens in code or logs
- [ ] No sensitive data exposed in error messages or responses
- [ ] Trust boundaries respected (user vs admin, internal vs external)
- [ ] Input validation (Zod, type guards, or manual validation)

### 4. Observability
- [ ] Error paths are logged with structured fields
- [ ] Key decisions/actions are traceable (request IDs, correlation)
- [ ] New failure modes have metrics or alert coverage
- [ ] Audit-worthy actions recorded (auth, payments, data mutation)
- [ ] Logs use the project's logger (not raw `console.*` in server handlers)

### 5. Maintainability / Architecture Fit
- [ ] Code placed in correct layer (route, service, repository, shared)
- [ ] No cross-app imports (web cannot import from admin, etc.)
- [ ] Shared code imported via `@joyjoin/shared` (not legacy `shared/`)
- [ ] No drift from established patterns without documented justification
- [ ] Abstraction level is appropriate (not too thin, not too deep)
- [ ] File size is reasonable (< 1500 lines for logic, < 1200 for frontend)

## Sprint Contract JSON format

If an active Sprint Contract exists at `.git/.orchestration/sprints/sprint-contract.{taskId}.md`, the gate script reads it and cross-checks the diff against the contract's pillar criteria.

```json
{
  "harnessVerdict": {
    "reliability": "pass",
    "scalability": "pass"
  },
  "contractFindings": [
    { "criterionId": "REL-01", "status": "pass", "message": "..." },
    { "criterionId": "SEC-02", "status": "fail", "message": "..." }
  ]
}
```

Run contract-aware evaluation:
```bash
node scripts/evaluate-sprint-contract.mjs --contract=.git/.orchestration/sprints/sprint-contract.<taskId>.md
```

## Auto-eval integration

The Harness gate is also available as an auto-eval module:

```bash
node scripts/auto-eval.mjs --mode=manual-report
```

When the `harness-engineering` module is enabled, it runs the same checks as `npm run harness:gate`.

## Agent workflow steps

At the end of every implementation turn:

1. **Run `npm run harness:gate`** (or manual checklist if script unavailable)
2. **Review findings** — classify each as [blocking], [concern], or [nit]
3. **Fix all [blocking] items** before claiming completion
4. **Document [concern] items** in the turn summary with mitigation plan
5. **Include Harness verdict** in `agent_turn_summary`:

```json
{
  "harnessVerdict": {
    "reliability": "pass",
    "scalability": "pass",
    "security": "pass",
    "observability": "concern",
    "maintainability": "pass"
  },
  "harnessFindings": [
    { "pillar": "observability", "severity": "concern", "message": "..." }
  ]
}
```
