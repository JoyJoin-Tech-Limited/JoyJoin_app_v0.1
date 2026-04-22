---
name: process-systematic-debugging
description: >
  Structured root-cause analysis protocol for bugs and unexpected behavior. Use when
  a bug is non-obvious, intermittent, or spans multiple layers. Replaces "try random
  fixes" with reproduce → isolate → hypothesize → verify. Integrates with the debug
  agent. Trigger phrases: systematic debug, root cause analysis, debug this properly,
  why is this broken, intermittent bug, reproduce this bug, find the root cause,
  structured debugging.
---

# Process: Systematic Debugging

## Purpose

Prevent "fix-and-hope" debugging. When a bug is non-obvious, force a structured protocol that isolates the root cause before any code change. This skill is the cross-tool equivalent of systematic debugging discipline.

---

## When to use this skill

- The bug is intermittent or hard to reproduce
- The bug spans multiple layers (frontend → API → database)
- A previous "quick fix" failed or caused a regression
- The user says "this keeps breaking" or "I don't understand why this happens"

## When NOT to use this skill

- The bug is a clear typo with an obvious fix (use direct delivery)
- The bug was already isolated and just needs a one-line change
- You need general code review rather than bug diagnosis (use `code-review`)

---

## The debugging protocol

### Phase 1: Reproduce

**Goal:** Make the bug deterministic.

1. **Identify the exact trigger** — user action, API call, state condition, or timing
2. **Document reproduction steps** — numbered, minimal, no ambiguity
3. **Determine frequency** — 100% reproducible, intermittent, or race-condition
4. **Identify environment** — local dev, staging, production, specific device/browser

> If you cannot reproduce: add targeted logging, narrow the scope, or ask the user for more context. Do not proceed to Phase 2 without at least one reproduction path.

### Phase 2: Isolate

**Goal:** Find the narrowest code path that triggers the bug.

1. **Binary search the stack** — add logging at layer boundaries (client → API → service → DB)
2. **Identify the last known good state** — git commit, deployed version, or feature flag state
3. **Create a minimal reproduction** — strip unrelated code, data, or UI until the bug still triggers
4. **Check recent changes** — `git log --oneline --since="1 week ago" -- <affected-files>`

### Phase 3: Hypothesize

**Goal:** Form 2–3 testable explanations.

For each hypothesis, specify:
- **Mechanism:** What code path or state transition causes the symptom?
- **Evidence:** What logging or test would confirm or refute this?
- **Fix scope:** One file, one function, or architectural change?

Example hypotheses:
1. *Race condition in icebreaker advance guard* → evidence: concurrent `advance` calls from host + reconnect
2. *Cache TTL mismatch* → evidence: `pool_ai_copy.expires_at` is older than the cron interval
3. *Missing null check in archetype aggregation* → evidence: `GROUP BY` returns `null` for users without archetype

### Phase 4: Verify

**Goal:** Confirm the root cause before fixing.

1. **Write the smallest failing test** that captures the bug (if feasible)
2. **Add targeted logging** to confirm the hypothesis
3. **Run the reproduction** against the hypothesized mechanism
4. **Document why other hypotheses were rejected**

> If no hypothesis is confirmed, return to Phase 2 with narrower isolation.

### Phase 5: Fix and Validate

1. **Apply the narrowest safe fix**
2. **Run the failing test** → it should pass
3. **Run guardrails and typecheck**
4. **Run the full reproduction path** end-to-end
5. **Add a regression test** if one does not exist

---

## Integration with the `debug` agent

When the `debug` agent is spawned, it loads this skill automatically. The agent should:

1. Follow Phases 1–4 before proposing any fix
2. End Phase 4 with a structured hypothesis + evidence summary
3. Only enter Phase 5 after the user or Supervisor confirms the hypothesis

---

## Examples

### Example 1: Intermittent API failure

**Symptom:** `GET /api/event-pools` returns 500 for ~5% of requests.

**Phase 1:** Reproduce with high-volume load test; failure correlates with pools that have >20 registrations.

**Phase 2:** Isolate to `GROUP BY` archetype aggregation query; fails when `users.primaryArchetype` is null for some registrants.

**Phase 3:** Hypothesis — `coalesce` in aggregation returns null, causing downstream mapping to throw.

**Phase 4:** Verify by adding null-check logging; confirmed.

**Phase 5:** Fix: `coalesce(users.primaryArchetype, users.archetype, '未设置')`; add regression test with null archetype data.

---

## Troubleshooting

**Cannot reproduce the bug**
> Add structured logging at every layer boundary. If still unreproducible, document the symptoms, frequency, and affected users. Do not apply speculative fixes.

**Multiple hypotheses seem equally likely**
> Design an experiment that distinguishes them with one test. If impossible, pick the hypothesis with the narrowest fix scope and test it first.

**Bug disappears after adding logging (Heisenbug)**
> Switch to non-invasive tracing: database query logs, network timestamps, or external request recording. Avoid `console.log` that changes timing.

---

## Review checklist

- [ ] Reproduction steps are documented and deterministic
- [ ] Bug is isolated to the narrowest code path
- [ ] At least 2 testable hypotheses were formed
- [ ] Root cause was verified before any fix was applied
- [ ] Fix is the narrowest safe change
- [ ] Regression test was added or existing test was updated
- [ ] Guardrails and typecheck pass after the fix
