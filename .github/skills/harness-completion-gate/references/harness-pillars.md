# Harness 5-Pillar Checklist (canonical)

This is the **single source of truth** for the Harness Engineering Framework's five-pillar evaluation. It backs the scripted gate `npm run harness:gate` (`scripts/harness/harness-completion-gate.mjs`) and is referenced by `code-review` and `process-verification-gate` so the criteria are maintained in exactly one place.

**Verdict convention:** evaluate each pillar and mark **PASS**, **CONCERN**, or **FAIL** with a one-line justification. Any FAIL is blocking; CONCERNs are non-blocking but must be documented.

## 1. Reliability
- [ ] No partial-failure risk (side effects before persistence?)
- [ ] Error paths handled (try/catch, fallback values, graceful degradation)
- [ ] Retries and timeouts configured for external calls
- [ ] Multi-step operations are atomic or have recovery logic
- [ ] Idempotency respected where needed (payments, webhooks, mutations)
- [ ] No race conditions on shared mutable state

## 2. Scalability
- [ ] No queries inside loops (N+1)
- [ ] No unbounded list renders without pagination or virtualisation
- [ ] No unbounded memory growth (caches have TTL, arrays have limits)
- [ ] Concurrency-safe (no global mutable state without locks)
- [ ] Database queries use appropriate indexes (no full table scans)

## 3. Security
- [ ] Auth/permission checks present on new routes or mutations
- [ ] Fail-closed defaults (deny by default, not allow by default)
- [ ] No secrets, credentials, or tokens in code or logs
- [ ] No sensitive data exposed in error messages or responses
- [ ] Trust boundaries respected (user vs admin, internal vs external)
- [ ] Input validation (Zod, type guards, or manual validation)

## 4. Observability
- [ ] Error paths are logged with structured fields
- [ ] Key decisions/actions are traceable (request IDs, correlation)
- [ ] New failure modes have metrics or alert coverage
- [ ] Audit-worthy actions recorded (auth, payments, data mutation)
- [ ] Logs use the project's logger (not raw `console.*` in server handlers)

## 5. Maintainability / Architecture Fit
- [ ] Code placed in correct layer (route, service, repository, shared)
- [ ] No cross-app imports (web cannot import from admin, etc.)
- [ ] Shared code imported via `@joyjoin/shared` (not legacy `shared/`)
- [ ] No drift from established patterns without documented justification
- [ ] Abstraction level is appropriate (not too thin, not too deep)
- [ ] File size is reasonable (< 1500 lines for logic, < 1200 for frontend)
