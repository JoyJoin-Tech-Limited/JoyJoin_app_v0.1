---
name: harness-engineering-deliberation
description: >
  Full Harness Engineering deliberation protocol for production-grade multi-agent workflows.
  Combines PGE (Planner-Generator-Evaluator) iterative refinement, Council Mode with
  Harness-pillar delegates (Reliability, Scalability, Security/Observability), ACK-ALL consensus,
  explicit Harness Verification Gate, and optional Token Ring emergent consensus.
  Use when engineering quality must be pre-validated against reliability, scalability, security,
  observability, and maintainability before implementation. Trigger phrases: harness this,
  run harness deliberation, production harness, PGE pipeline, harness engineering review,
  token circulation, reliability scalability security review, full harness chamber,
  engineering quality gate, harness verification.
---

# Harness Engineering Deliberation

**Core rule:** The Harness deliberation chamber operates entirely **before** user-facing output — a **runtime layer** for refined, pre-agreed decisions, not a replacement for direct delivery on trivial tasks.

Use it when:
- Engineering quality must be **pre-validated** against the 5 Harness pillars
- A task touches **core engines** (matching, personality, payments, auth)
- A **cross-workspace change** has high blast radius + novelty
- A **new public API** or breaking contract needs rigorous review
- Explicit user request: "harness this," "production harness," "engineering quality gate"

Do **not** use it for: single-domain bug fixes <50 lines; copy/styling/color changes; documentation-only updates; tasks one specialist clearly owns with no pillar risk.

---

## The Harness Pipeline

- **pge-council (default):** Phase 0 Init → Phase 1 PGE Loop → Phase 2 Council → Phase 3 Peer Review → Phase 4 Roundtable → Phase 5a Consensus (ACK-ALL) → Phase 5b Harness Gate → Phase 6 Final Output
- **council-only:** Phase 0 → skip to Phase 2 → same as above
- **token-ring:** Phase 0 → Phase 7 Token Ring → Phase 5b → Phase 6

Phase 5b (Harness Verification Gate) and Phase 6 (Final Output + transcript persistence) run in **all modes**.

---

## Harness Delegate Roles

| Delegate | Base Agent | Harness Pillar | Focus Areas | Veto Power |
|----------|------------|----------------|-------------|------------|
| **Alpha** | Principal Software Engineer / Backend Engineer | **Reliability** | Atomicity, idempotency, retries, partial-failure handling, state-machine correctness, transaction boundaries | Architecture introducing unmitigated partial-failure risk |
| **Beta** | Principal Software Engineer / Backend Engineer | **Scalability** | Concurrency, N+1 avoidance, pagination, lock contention, horizontal scaling, memory/CPU bounds | Architecture with known scalability ceiling or performance cliff |
| **Gamma** | Verifier / Launch Readiness Agent | **Security & Observability** | Fail-closed defaults, auth boundaries, secret handling, structured logging, metrics, alerts, audit trails | Architecture weakening trust boundaries or removing observability |

**Note on Maintainability:** All three delegates assess maintainability/architecture fit; Gamma carries primary veto authority on code placement and domain boundary violations.

### Veto override rule

A veto can be overridden only with: **2/3 consensus** (both non-vetoing delegates agree) + **written justification** in the transcript + **risk acceptance signature** from the overriding party + **documented mitigation** for the vetoed concern.

---

## Phase Details

### Phase 0 — Harness Initialization

- Create `HarnessDeliberationState` object
- Execute **Context Reset**: load only the user's task, this system prompt, and a blank state
- Select operating mode: `pge-council` (default), `council-only`, or `token-ring`
- Select delegates based on task domain

### Phase 1 — PGE Loop (pge-council only)

- **Planner (Controller or Planner delegate):** create **Sprint Contract** — Goal + 3-point Acceptance Criteria + Technical Constraints
- **Generator (Alpha):** execute the contract; produce first-draft architectural proposal
- **Evaluator (Gamma):** compare draft against Acceptance Criteria → `VERDICT: ACCEPT` or `VERDICT: REJECT - [reason]`; on REJECT, append feedback to the contract and loop back to Generator. **Max iterations: 3**

### Phase 2 — Council Mode: Team Assembly

Spawn 3 delegates **in isolation**. Each returns a proposal JSON including `harnessPillarAssessment` for all 5 pillars.

### Phase 3 — Anonymous Peer Review

Proposals stripped to X/Y/Z. Each delegate reviews 2 they did NOT write. **Required per critique:** 1 strength, 1 actionable weakness, 1 Harness pillar concern.

### Phase 4 — Roundtable

Extract disagreements. Focused debate. Max 3 rounds. No repetition of prior consensus.

### Phase 5a — Consensus Poll (ACK-ALL)

All 3 delegates must respond `ACK`. Any `NACK` → return to Phase 4 with objection as new topic.

### Phase 5b — Harness Verification Gate

Explicit 5-pillar checklist. All must be `PASS`:

```
- [ ] reliability: partial failures handled? retries/timeouts? idempotency?
- [ ] scalability: N+1 avoided? pagination? concurrency safe? data bounds?
- [ ] security: fail-closed? secrets handled? trust boundaries?
- [ ] observability: logs/metrics/audit for new failure paths?
- [ ] maintainability: correct layer? domain boundaries? abstraction fit?
```

Any `CONCERN` or `FAIL` → return to Phase 4 with pillar as debate topic.

### Phase 6 — Final Output

- Final unified plan
- Locked Sprint Contract (if PGE ran)
- Harness transcript → `.git/.orchestration/harness/{sessionId}.json`
- Promote-worthy constraints → `repo-memory/candidates/harness-{sessionId}.json`
- Handoff to Supervisor or Planner

### Phase 7 — Token Ring (token-ring only)

**When to use:** Requirements are genuinely ambiguous; no Sprint Contract can be formed.

1. Token circulates Alpha → Beta → Gamma → Alpha; each agent appends a `HarnessDeliberationState` delta to token history
2. **Termination:** full cycle with no changes = unanimous agreement
3. **Max cycles:** 5 rotations; if not converged, escalate to human
4. After convergence → Phase 5b → Phase 6

---

## Trigger Conditions

The **Harness Runtime Controller** auto-activates when any of these are true:

| Criterion | Detection Signal |
|-----------|-----------------|
| Core engine change | Path matches `personality/`, `poolMatchingService.ts`, `payment-entitlement-authority` |
| Auth/security surface | Path matches `auth-session-and-safety-boundaries`, `admin-audit-and-rbac-governance` surfaces |
| Breaking public API | Path matches `routes/domains/*.ts` + schema change + public route |
| High blast radius + novelty | File not in existing track + >100 lines + touches ≥2 workspaces |
| Explicit Harness request | Prompt contains "harness", "reliability", "scalability", "security review", "observability gap", "production harness" |

**Anti-triggers:** single-file changes <50 lines; test-only or docs-only changes; copy or translation changes.

---

## Quick Examples

**"Harness the best approach for real-time social icebreaker state sync"** → `pge-council`. Alpha proposes WS + polling hybrid; Beta questions concurrency under 1000+ rooms; Gamma requires per-room structured trace logging. After 2 PGE iterations + 1 debate round: WS primary with polling fallback + per-room trace context + bounded room memory. Gate: all 5 pillars PASS.

**"What should our caching strategy be? Requirements are unclear."** → `token-ring`. Token circulates among Alpha (invalidation reliability), Beta (cache size scalability), Gamma (miss observability). After 3 cycles: Redis hot paths, 5-min TTL, hit/miss metrics, stale-while-revalidate for non-critical reads. Gate: all 5 pillars PASS.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| PGE loop exceeds 3 iterations | Sprint Contract is too vague or constraints conflict | Controller rewrites Sprint Contract with narrower scope |
| Delegates keep NACKing | Unresolved fundamental disagreement | Escalate to human; document dissents in transcript |
| Harness Gate repeatedly FAILs on one pillar | The architecture genuinely violates that pillar | Do not override; redesign or accept documented risk |
| Token Ring cycles indefinitely | Requirements are too broad | Split into smaller, scoped rings or switch to `pge-council` after narrowing |
| One delegate dominates | Prompt framing too narrow | Reword task to explicitly request minority perspective |

---

## Review Checklist

- [ ] Task meets at least one trigger condition (or explicit user request)
- [ ] Operating mode selected appropriately (`pge-council`, `council-only`, `token-ring`)
- [ ] 3 delegates selected with appropriate base agents and Harness pillar framing
- [ ] Phase 1 proposals are isolated (no cross-communication)
- [ ] Phase 2 critiques are anonymous and contain 1 strength + 1 weakness + 1 pillar concern each
- [ ] Phase 3 debates focus only on disagreements, not repeated consensus
- [ ] Phase 5a achieves unanimous ACK or documented escalation path
- [ ] Phase 5b Harness Gate achieves all 5 pillars PASS or documented risk acceptance
- [ ] Any veto recorded with justification, override conditions, and mitigation
- [ ] Final plan persisted to `.git/.orchestration/harness/{sessionId}.json`
- [ ] Promote-worthy constraints drafted to `repo-memory/candidates/` when applicable
- [ ] Handoff to Supervisor/Planner includes consensus context and Harness Gate verdict

---

## Related Skills

| Skill | When to hand off |
|-------|-----------------|
| `first-principles-velocity` | Bottleneck analysis; model tier selection |
| `orchestration-turn-reporting` | Turn-summary JSON for Controller and delegates |
| `harness-verification-gate` | Standalone rapid Harness re-check |
| `multi-agent-deliberation` | General design review when Harness pillars aren't primary |
| `server-domain-architecture` | Alpha/Beta canonical backend reference |
| `reliability-and-state-integrity` | Alpha reference: transactions, retries, idempotency |
| `database-query-optimization` | Beta reference: N+1, pagination, indexes |
| `auth-session-and-safety-boundaries` | Gamma reference: security posture |
| `platform-observability-and-ops` | Gamma reference: logging, metrics, tracing |
| `code-review` | Harness lens already embedded in PR reviews |
| `testing-and-regression-guardrails` | Lock outcomes in with invariant/regression tests |

## Canonical References

- `.github/agents/harness-runtime-controller.agent.md`
- `.github/skills/harness-verification-gate/SKILL.md`
- `.github/skills/multi-agent-deliberation/SKILL.md`
- `.github/orchestration.yaml`
- `.github/agents/manifest.json`
- `scripts/orchestration/orchestration-supervisor.mjs`
- `scripts/orchestration/orchestration-next-actions.mjs`
