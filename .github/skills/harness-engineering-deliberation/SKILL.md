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

**Core rule:** The Harness deliberation chamber operates entirely **before** user-facing output. It is a **runtime layer** that governs how agents reach refined, pre-agreed decisions — not a replacement for direct delivery on trivial tasks.

Use it when:
- Engineering quality must be **pre-validated** against the 5 Harness pillars
- A task touches **core engines** (matching, personality, payments, auth)
- A **cross-workspace change** has high blast radius + novelty
- A **new public API** or breaking contract needs rigorous review
- Explicit user request: "harness this," "production harness," "engineering quality gate"

Do **not** use it for:
- Single-domain bug fixes <50 lines
- Copy, styling, or color changes
- Documentation-only updates
- Tasks where one specialist clearly owns the scope and no pillar risk exists

---

## The Harness Pipeline

```
Phase 0: Harness Initialization
    ↓
[Mode: pge-council]       [Mode: council-only]      [Mode: token-ring]
    ↓                            ↓                         ↓
Phase 1: PGE Loop         Skip to Phase 2           Phase 7: Token Ring
    ↓                            ↓                         ↓
Phase 2: Council Mode ←———→  Phase 2: Council    →→→   Phase 5b: Harness Gate
    ↓                            ↓
Phase 3: Peer Review           Phase 3: Peer Review
    ↓                            ↓
Phase 4: Roundtable            Phase 4: Roundtable
    ↓                            ↓
Phase 5a: Consensus (ACK-ALL)  Phase 5a: Consensus
    ↓                            ↓
Phase 5b: Harness Verification Gate (all modes)
    ↓
Phase 6: Final Output + Transcript Persistence
```

---

## Harness Delegate Roles

| Delegate | Base Agent | Harness Pillar | Focus Areas | Veto Power |
|----------|------------|----------------|-------------|------------|
| **Alpha** | Principal Software Engineer / Backend Engineer | **Reliability** | Atomicity, idempotency, retries, partial-failure handling, state-machine correctness, transaction boundaries | Architecture introducing unmitigated partial-failure risk |
| **Beta** | Principal Software Engineer / Backend Engineer | **Scalability** | Concurrency, N+1 avoidance, pagination, lock contention, horizontal scaling, memory/CPU bounds | Architecture with known scalability ceiling or performance cliff |
| **Gamma** | Verifier / Launch Readiness Agent | **Security & Observability** | Fail-closed defaults, auth boundaries, secret handling, structured logging, metrics, alerts, audit trails | Architecture weakening trust boundaries or removing observability |

**Note on Maintainability:** All three delegates assess maintainability/architecture fit, but Gamma (Security & Observability) carries primary veto authority on code placement and domain boundary violations.

### Veto override rule

A veto can be overridden only with:
- **2/3 consensus** (both non-vetoing delegates agree)
- **Written justification** in the Harness transcript
- **Risk acceptance signature** from the overriding party
- **Documented mitigation** for the vetoed concern

---

## Phase Details

### Phase 0 — Harness Initialization

- Create `HarnessDeliberationState` object
- Execute **Context Reset**: load only the user's task, this system prompt, and a blank state
- Select operating mode: `pge-council` (default), `council-only`, or `token-ring`
- Select delegates based on task domain

### Phase 1 — PGE Loop (pge-council only)

**Planner (Controller or Planner delegate):**
- Create **Sprint Contract**: Goal + 3-point Acceptance Criteria + Technical Constraints

**Generator (Alpha delegate):**
- Execute Sprint Contract. Produce first-draft architectural proposal.

**Evaluator (Gamma delegate):**
- Compare draft against Acceptance Criteria.
- `VERDICT: ACCEPT` or `VERDICT: REJECT - [reason]`
- If `REJECT`, append feedback to Sprint Contract and loop back to Generator.
- **Max iterations:** 3.

### Phase 2 — Council Mode: Team Assembly

Spawn 3 delegates **in isolation**. Each returns a proposal JSON including `harnessPillarAssessment` for all 5 pillars.

### Phase 3 — Anonymous Peer Review

Proposals stripped to X/Y/Z. Each delegate reviews 2 they did NOT write.

**Required per critique:** 1 strength, 1 actionable weakness, 1 Harness pillar concern.

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

**Protocol:**
1. Token circulates Alpha → Beta → Gamma → Alpha.
2. Each agent appends to token history with a `HarnessDeliberationState` delta.
3. **Termination:** Full cycle with no changes = unanimous agreement.
4. **Max cycles:** 5 rotations. If not converged, escalate to human.
5. After convergence → Phase 5b → Phase 6.

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

**Anti-triggers:**
- Single-file changes <50 lines
- Test-only or docs-only changes
- Copy or translation changes

---

## Quick Examples

**User:** "Harness the best approach for real-time social icebreaker state sync"
→ Controller selects `pge-council`. Planner creates Sprint Contract. Alpha proposes WS + polling hybrid. Beta questions concurrency under 1000+ concurrent rooms. Gamma requires structured trace logging per room. After 2 PGE iterations and 1 debate round, consensus: WS primary with polling fallback + per-room trace context + bounded room memory. Harness Gate: all 5 pillars PASS.

**User:** "What should our caching strategy be? Requirements are unclear."
→ Controller selects `token-ring`. Token circulates among Alpha (cache invalidation reliability), Beta (cache size scalability), Gamma (observability for cache misses). After 3 cycles, emergent consensus: Redis for hot paths with 5-minute TTL + structured cache-hit/miss metrics + stale-while-revalidate for non-critical reads. Harness Gate: all 5 pillars PASS.

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
| `first-principles-velocity` | Apply bottleneck analysis to deliberation scope; model tier selection |
| `orchestration-turn-reporting` | Turn-summary JSON format for Controller and delegates |
| `harness-verification-gate` | Post-deliberation or standalone rapid Harness sanity check |
| `multi-agent-deliberation` | General-purpose architecture/design review when Harness pillars are not the primary concern |
| `server-domain-architecture` | Alpha/Beta canonical reference for backend decisions |
| `reliability-and-state-integrity` | Alpha's canonical reference for transactions, retries, idempotency |
| `database-query-optimization` | Beta's canonical reference for N+1, pagination, index strategy |
| `auth-session-and-safety-boundaries` | Gamma's canonical reference for security posture |
| `platform-observability-and-ops` | Gamma's canonical reference for logging, metrics, tracing |
| `code-review` | The Harness Framework review lens already embedded in PR reviews |
| `testing-and-regression-guardrails` | Lock in Harness deliberation outcomes with invariant/regression tests |

## Canonical References

- `.github/agents/harness-runtime-controller.agent.md`
- `.github/skills/harness-verification-gate/SKILL.md`
- `.github/skills/multi-agent-deliberation/SKILL.md`
- `.github/skills/code-review/SKILL.md`
- `.github/orchestration.yaml`
- `.github/agents/manifest.json`
- `scripts/orchestration-supervisor.mjs`
- `scripts/orchestration-next-actions.mjs`
