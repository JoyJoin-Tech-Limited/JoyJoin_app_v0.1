---
name: post-implementation-review
description: >-
  Blanket post-implementation review workflow. After every implementation agent
  completes, spawn a parallel review swarm (Auto-Eval + QA Agent + Verifier +
  PM Advisor + conditional Visual Designer + conditional User Satisfaction
  Auditor) using a DETERMINISTIC CHECKLIST.
  Converge findings into a unified PASS / PARTIAL / FAIL verdict. Only BLOCKING
  items trigger fix loops; CONCERN and NIT are logged but non-blocking.
  Trigger phrases: "post-implementation review", "review swarm", "blanket review",
  "done check", "implementation review", "post-impl review".
---

# Post-Implementation Review

## Core Principle: Structured Inspection, Not Creative Critique

The #1 cause of review inconsistency is free-form prose critique — LLM agents invent new criteria each time. This skill replaces it with a **deterministic checklist**: every agent evaluates the same items, with the same severity, every time.

**Canonical checklist:** `review-checklist-manifest.json` (co-located). Protocol steps, turn-summary schema, per-agent roles, and rationale live in [`references/protocol-details.md`](references/protocol-details.md).

## When to use this skill

- An implementation agent has recorded `turnStatus: done`
- You need a uniform, deterministic review covering correctness, quality, harness compliance, product fit, documentation, and visual design
- You want to catch blocking issues **once** without nit-chasing

**Do NOT use when:** the turn modified 0 files, `skipReview: true`, or the agent is not an implementation agent.

## Coordination Pattern: Parallel Swarm → Convergence

Supervisor detects `turnStatus: done` → loads the checklist manifest → runs a parallel swarm (each agent runs their fixed checklist) → converges by counting BLOCKING items only.

| Swarm agent | Checklist |
|---|---|
| Auto-Eval | deterministic gate (scripted, no LLM judgment) |
| QA Agent | structured test checklist |
| Verifier | claim-evidence checklist |
| PM Advisor | criteria-match checklist (only if criteria exist) |
| Visual Designer | design audit checklist (UI changes only) |
| User Satisfaction Auditor | user-perspective satisfaction audit US-01…US-06 (user-facing frontend changes only; only US-04 — emotional peak without ceremony — is BLOCKING; all others CONCERN) |

Convergence verdict:
- 0 blocking + 0 concerns → **PASS**
- 0 blocking + 1–3 concerns → **PARTIAL** (log, no fix loop)
- ≥1 blocking → **FAIL** (fix loop)

**Cost control (swarm size):** ≤3 files AND ≤30 lines → Auto-Eval + Verifier (2). Larger non-UI → 4 agents. UI-affecting → + Visual Designer (5). User-facing emotional peaks or onboarding/discovery surfaces → + User Satisfaction Auditor (6). Sprint Contract present → always full swarm.

## Severity System (prevents over-polishing)

Every checklist item has a fixed severity. **The verdict depends ONLY on blocking items.**

| Severity | Requires fix? | Affects verdict? | Examples |
|----------|---------------|------------------|----------|
| BLOCKING | Yes | FAIL if ≥1 | harness:gate fails, missing auth, claimed files don't exist |
| CONCERN | No (logged) | No | test gap, dead code, inconsistent copy |
| NIT | No (logged) | No | style preference, naming suggestion, spacing tweak |

Concerns and nits are recorded but **do NOT trigger the fix loop** — this prevents 画龙点睛 (over-polishing).

## Consistency guards

- Max 3 free-form findings per agent (forces checklist discipline)
- Disallow new BLOCKING items on re-review of the same code
- Review fingerprint = hash(changed files + checklist version); same fingerprint → same expected result
- Every finding cites a checklist item ID (e.g., "VF-03")

## Delta Review — NOT IMPLEMENTED (stateless today)

Intended design: persist each review to `.git/.orchestration/reviews/<summary-id>.json` (48h TTL) so re-reviews re-check only previously-failed items + new files, and flag a regression when a previously-passed item fails. **Status as of 2026-08-13: nothing creates or reads that directory — every review runs full/stateless.** `delta_review_rules.enabled` in the checklist manifest is `false` to match reality. Treat any "delta review" claim as unimplemented; wiring it is a separate engineering task.

## Adaptive escalation ladder

| Change class | Max fix iterations | At limit |
|--------------|--------------------|----------|
| Trivial (≤3 files, ≤30 lines) | 1 | Human escalation |
| Standard (>3 files or >30 lines) | 2 | Sprint Evaluation or human |

Auto-promote after max iterations when: the same blocking issue resurrects, >2 distinct blocking issues in the first review, reviewer disagreement on severity, or the verdict is still FAIL.

## Review checklist

- [ ] Swarm size matched the cost-control table (Sprint Contract → always full swarm)
- [ ] Every finding cites a checklist item ID from `review-checklist-manifest.json`
- [ ] Verdict driven ONLY by blocking-item count (concerns/nits logged, non-blocking)
- [ ] Free-form findings ≤3 per agent; no new blocking items introduced on re-review
- [ ] Fix loop triggered only on ≥1 blocking; escalated per the ladder at the iteration cap
- [ ] Turn summary includes the `postImplementationReview` block (see `references/protocol-details.md`)

## Related skills

- `harness-completion-gate` — 5-pillar gate (Auto-Eval item AE-01)
- `orchestration-turn-reporting` — executive briefing format
- `agent-coordination-patterns` — parallel swarm and convergence
- `code-review` — structured PR review lens
- `testing-and-regression-guardrails` — QA verification patterns
- `frontend-design-audit` — design audit for UI changes (Visual Designer)
- `user-satisfaction-audit` — user-perspective satisfaction audit for user-facing frontend changes (User Satisfaction Auditor)
