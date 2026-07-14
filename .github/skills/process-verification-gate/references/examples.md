# Worked verification examples

Two full examples of the 5-pillar verification + lane-specific checks producing a ship/no-ship verdict.

## Example 1: Direct delivery — new metric

**Task:** Add Prometheus counter for pool card cache hit/miss.

**Verification:**
- Reliability: PASS — counter is additive only, no failure path
- Scalability: PASS — no query changes
- Security: PASS — no auth surface
- Observability: PASS — this IS the observability
- Maintainability: PASS — follows existing metric pattern
- Lane (Direct): Micro-plan matched diff
- **Verdict: SHIP**

## Example 2: HRC — payment flow change

**Task:** Add refund webhook handler.

**Verification:**
- Reliability: CONCERN — no idempotency key on webhook processing
- Scalability: PASS
- Security: PASS — signature verification present
- Observability: PASS — audit log + structured logging present
- Maintainability: PASS
- Lane (HRC): Sprint Contract AC #3 not fully met (retry policy missing)
- **Verdict: BLOCK** — add idempotency check + retry policy before merge
