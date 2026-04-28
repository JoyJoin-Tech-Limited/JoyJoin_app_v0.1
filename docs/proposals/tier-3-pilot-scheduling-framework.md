# Tier 3 Pilot — Scheduling Framework

> **Status:** Design complete — awaiting first core engine task  
> **Date:** 2026-04-23  
> **Scope:** Harness Runtime Controller (HRC) deliberation for Tier 3 tasks

---

## 1. When to Trigger Tier 3

A task **must** use Tier 3 (full Harness Lane) when ANY of the following are true:

| Trigger | Examples |
|---------|----------|
| **Core engine change** | Matching algorithm, personality scoring, archetype chemistry |
| **Auth/session rewrite** | WeChat auth flow, session middleware, token rotation |
| **Payment flow change** | Refund logic, WeChat Pay integration, event pack credits |
| **Major refactor** | >5 core files + >300 lines, or restructuring a domain |
| **Cross-boundary architecture** | New microservice boundary, database sharding, API versioning |
| **Security-critical** | Encryption changes, secret handling, RBAC restructuring |

**Rule of thumb:** If a bug in this task could take down the platform or corrupt user data, it's Tier 3.

---

## 2. Tier 3 Workflow (PGE + Council)

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Planner   │────▶│ HRC Deliberation │────▶│  Generator  │
│  (Supervisor│     │ (3 perspectives)  │     │  (Specialist│
│   + max)    │     │                   │     │   Engineer) │
└─────────────┘     └─────────────────┘     └─────────────┘
                                                    │
                                                    ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Council   │◀────│ Sprint Contract   │◀────│  Contract   │
│  (Consensus │     │  (locked)         │     │   Draft     │
│   Vote)     │     │                   │     │             │
└─────────────┘     └─────────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  Evaluator  │
│  (QA Agent  │
│   + Verifier│
│   skeptical)│
└─────────────┘
```

### 2.1 Phase 1: Planner → HRC Deliberation

**Duration:** 10–20 minutes  
**Models:** max tier for all deliberation agents  
**Output:** Sprint Contract draft v1

1. **Supervisor** (as Planner proxy) defines the task and routes to HRC
2. **HRC** assembles 3 deliberation agents:
   - **Alpha Architect** — structural/authority perspective
   - **Beta UX Visionary** — user impact perspective
   - **Gamma Code Realist** — implementation feasibility perspective
3. Each agent writes an independent assessment (5 min each, parallel)
4. **Roundtable debate** — agents critique each other's assessments
5. **ACK-ALL consensus** — all 3 must agree on contract structure

### 2.2 Phase 2: Contract Draft → Lock

**Duration:** 5–10 minutes  
**Models:** standard for Generator, max for Verifier  
**Output:** Locked Sprint Contract

1. **Specialist Engineer** (Generator) writes contract based on HRC consensus
2. **Verifier** reviews with max model (architectural skepticism)
3. Max 2 negotiation cycles (same as Tier 2)
4. Contract status → `accepted` and `locked: true`

### 2.3 Phase 3: Implementation

**Duration:** Varies by task  
**Models:** standard for Generator  
**Constraint:** No contract amendments without HRC re-deliberation

1. Generator implements against locked contract
2. Any blocker that invalidates a criterion → **must** escalate to HRC
3. Mid-flight changes require consensus vote (not just Supervisor approval)

### 2.4 Phase 4: Council Evaluation

**Duration:** 10–15 minutes  
**Models:** max for Evaluator, standard for QA Agent  
**Output:** Scorecard + verdict

1. **QA Agent** runs automated verification (same as Tier 2)
2. **Verifier** (as Council member) performs skeptical review
3. **Council vote:** PASS requires 2/3 approval
4. Any REJECT → back to Generator with Council feedback
5. Max 3 iterations total (including contract negotiation)

---

## 3. Scheduling Criteria

Tier 3 tasks should be **scheduled**, not ad-hoc:

| Criterion | Recommendation |
|-----------|---------------|
| **Batching** | Group related core engine changes into a single Tier 3 sprint |
| **Timing** | Avoid Tier 3 during release week (high stress, low deliberation quality) |
| **Preparation** | Require a pre-deliberation research phase (Researcher agent, 1 cycle) |
| **Stakeholders** | Human review required before Council vote for payment/auth changes |
| **Documentation** | Tier 3 outcomes must be documented in `docs/architecture/` |

### 3.1 Scheduling Checklist

- [ ] Task meets Tier 3 trigger criteria (verified by `select-harness-tier.mjs`)
- [ ] No release deadline within 48 hours
- [ ] Pre-deliberation research complete (if domain is unfamiliar)
- [ ] Human stakeholder notified (for payment/auth/security)
- [ ] Dedicated time block allocated (min 60 minutes for full cycle)
- [ ] Scorecard will be written (not skipped)

---

## 4. Cost Model

| Phase | Estimated Time | Model Tier | Est. Cost |
|-------|---------------|------------|-----------|
| HRC Deliberation | 15 min | max × 3 agents | ~$8–$12 |
| Contract negotiation | 10 min | standard + max | ~$2–$4 |
| Implementation | varies | standard | baseline |
| Council evaluation | 15 min | max + standard | ~$5–$8 |
| **Total overhead** | **40 min** | | **$15–$25** |

**Target:** Keep Tier 3 to <5% of all tasks. Blended cost across all tiers should stay at 1.3–1.8×.

---

## 5. First Tier 3 Pilot Candidates

| Priority | Task | Why Tier 3 |
|----------|------|-----------|
| 1 | Matching algorithm v3 update | Core engine — wrong match = bad UX |
| 2 | Personality assessment question bank refresh | Affects all users, archetype authority |
| 3 | WeChat Pay v3 → v4 migration | Payment flow, regulatory risk |
| 4 | Session middleware rewrite | Auth boundary, security-critical |
| 5 | Event pool matching → async queue | Architectural boundary change |

**Recommended first pilot:** Matching algorithm v3 update (well-understood domain, clear success criteria, high impact).

---

## 6. Post-Pilot Review Template

After each Tier 3 pilot, answer:

1. **Did HRC deliberation catch issues that Tier 2 would miss?** (yes/no + examples)
2. **Was the 40-minute overhead justified by quality gain?** (1–5 scale)
3. **Did Council vote change the outcome vs. simple QA evaluation?** (yes/no)
4. **What would you change about the deliberation protocol?** (free text)
5. **Should this task class always be Tier 3, or could it be Tier 2?** (Tier 2 / Tier 3 / case-by-case)

Store responses in `.git/.orchestration/tier3-reviews/` for meta-analysis.
