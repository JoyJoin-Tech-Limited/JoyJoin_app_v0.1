---
name: multi-agent-deliberation
description: >
  Structured 5-phase multi-agent deliberation protocol for high-stakes architecture and design
  decisions. Defines delegate roles (Alpha Architect, Beta UX Visionary, Gamma Code Realist),
  anonymous peer review, roundtable debate, ACK-ALL consensus with veto powers, and deliberation
  transcript persistence. Use when a task needs multiple perspectives before implementation.
  Trigger phrases: deliberate this, multi-agent review, architecture consensus, design review,
  get multiple perspectives, cross-workspace deliberation, team assembly, peer review, roundtable,
  consensus poll.
---

# Multi-Agent Deliberation

**Core rule:** Deliberation is an optional enrichment lane, not a replacement for direct delivery. Use it when a task is cross-domain, architecturally significant, or high-blast-radius. Small, bounded tasks stay on the direct-delivery lane.

---

## When to use this skill

- Cross-workspace changes touching ≥3 domains
- New public API surfaces or breaking contract changes
- UX-heavy features with Taro/WeChat runtime constraints
- Architecture changes affecting core engines (matching, personality, payments)
- High blast radius + novelty (new AI provider, new caching backend, new database)
- Explicit user request: "deliberate," "deliberation," "deliberate this," "get multiple perspectives," "design review"

## When NOT to use this skill

- Bug fixes in a single domain
- Copy, styling, or color changes
- Adding a regression or invariant test
- Documentation-only updates
- Tasks where one specialist clearly owns the entire scope

---

## The 5 Phases

### Phase 1 — Team Assembly (Isolated Proposals)

The Moderator spawns 3 delegates **in isolation**. Each delegate receives:
- The task description
- Their role framing (Alpha/Beta/Gamma)
- Relevant repo context (changed files, active skills)
- **No access** to other delegates' outputs

Each delegate returns a **proposal JSON**:
```json
{
  "role": "alpha|beta|gamma",
  "proposal": "Concise architectural/design/edge-case position",
  "keyAssumptions": ["..."],
  "riskAreas": ["..."],
  "recommendedApproach": "..."
}
```

### Phase 2 — Anonymous Peer Review (Blind Critique)

The Moderator **strips authorship** and presents proposals as:
- Proposal X
- Proposal Y
- Proposal Z

Each delegate receives the **2 proposals they did NOT write** and returns:
```json
{
  "critiques": [
    { "target": "Proposal X", "strength": "...", "weakness": "..." },
    { "target": "Proposal Y", "strength": "...", "weakness": "..." }
  ]
}
```

**Rule:** Every critique must contain exactly 1 strength and 1 actionable weakness.

### Phase 3 — Open Roundtable (Convergence)

The Moderator extracts **points of disagreement** from the critiques and routes a focused debate prompt:

> "The team disagrees on [X]. Alpha argues [position]. Beta argues [position]. Gamma argues [position]. Discuss only this disagreement. Do not repeat prior consensus."

**Rules:**
- Delegates cannot repeat what they already said
- Max 3 debate rounds
- The Moderator may synthesize intermediate convergence and ask for confirmation

### Phase 4 — Consensus Poll (ACK-ALL)

The Moderator presents a **synthesizer summary** of the converged position and polls each delegate:

```
Delegate [Name]: ACK or NACK: [Specific Reason]
```

**Exit condition:** All 3 delegates respond `ACK`.
**Loop condition:** Any `NACK` returns to Phase 3 with the specific objection as the new debate topic.

### Phase 5 — Refined Output

The Moderator writes:
1. **Final unified plan** — the agreed architecture/design/approach
2. **Deliberation transcript** — full session JSON persisted to `.git/.orchestration/deliberation/{sessionId}.json`
3. **Handoff** — to Supervisor (for implementation routing) or Planner (for execution planning)

---

## Delegate Roles

| Role | Base Agent | Framing | Veto Power |
|------|-----------|---------|------------|
| **Alpha (Architect)** | `Principal Software Engineer` or `Backend Engineer` | Scalability, data structures, Taro API performance, load times, memory usage, horizontal scaling | None (advisory) |
| **Beta (UX Visionary)** | `Taro Mini-Program Frontend Engineer` or `Expert React Frontend Engineer` | User delight, "wow" moments, smooth transitions, accessibility, premium aesthetics, brand alignment | **Veto over interactions that feel "cheap" or "slow"** |
| **Gamma (Code Realist)** | `Verifier` or `debug` | Edge cases, error handling, WeChat ecosystem limits, dependency management, skepticism, test coverage | **Veto over architecture that violates Taro/WeChat limits** |

### Veto override rule

A veto can be overridden only with:
- **2/3 consensus** (both non-vetoing delegates agree)
- **Written justification** in the deliberation transcript
- **Risk acceptance signature** from the overriding party

---

## Trigger Conditions

The **Supervisor** or **Planner** auto-routes to `Deliberation Moderator` when any of these are true:

| Criterion | Detection Signal |
|-----------|-----------------|
| Cross-workspace, ≥3 domains | Changed files span `apps/server/`, `apps/mini-program/`, `packages/shared/` |
| New public API or breaking contract | Path matches `routes/domains/*.ts` + schema change |
| UX-heavy with Taro constraints | Path matches `apps/mini-program/src/` + new route or component |
| Core engine change | Path matches `inference/`, `personality/`, `poolMatchingService.ts` |
| High blast radius + novelty | File not in any existing track definition + >100 lines changed |
| Explicit user request | Prompt contains "deliberate," "deliberation," "consensus," "multiple perspectives" |

**Anti-triggers** (never auto-route):
- Single-file changes <50 lines
- Test-only changes
- Documentation-only changes
- Copy or translation changes

---

## Quick Examples

**User:** "Deliberate the best approach for real-time social icebreaker state sync"
→ Moderator spawns Alpha (WebSocket architecture), Beta (UX transition smoothness), Gamma (Taro background/foreground edge cases). Alpha proposes WS + polling hybrid. Beta insists on animated state transitions. Gamma warns about Taro `useDidHide` disconnect race. After 2 debate rounds, consensus: polling primary with WS fallback for host actions. Beta ACKs with caveat: animate only host-driven transitions.

**User:** "Design the venue assignment scoring algorithm"
→ Moderator spawns Alpha (scoring math + caching), Beta (admin UI for venue config), Gamma (AMap API failure modes). Alpha proposes weighted multi-dimensional score. Beta requests visual score breakdown in admin. Gamma requires AMap timeout fallback with cached venues. Consensus: 4-dimension score (budget/cuisine/capacity/location) + admin Recharts radar chart + 3-second AMap timeout with fallback.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Delegates keep NACKing | Unresolved fundamental disagreement | Escalate to human decision; document dissents in transcript |
| One delegate dominates | Prompt framing too narrow | Reword task to explicitly request the minority perspective |
| Roundtable goes in circles | Debate scope too broad | Moderator narrows to a single decision with 2 explicit options |
| Beta vetos everything | Task is inherently low-quality | Check anti-triggers; may be wrong task for deliberation |
| Gamma vetos due to Taro limit | Limit is real and blocking | Document as hard constraint; design must adapt, not override |
| Deliberation takes too long | Task scope too large | Split into smaller deliberations per vertical slice |

## Review Checklist

- [ ] Task meets at least one trigger condition (or is explicit user request)
- [ ] 3 delegates selected with appropriate base agents and framing
- [ ] Phase 1 proposals are isolated (no cross-communication)
- [ ] Phase 2 critiques are anonymous and contain 1 strength + 1 weakness each
- [ ] Phase 3 debates focus only on disagreements, not repeated consensus
- [ ] Phase 4 achieves unanimous ACK or documented escalation path
- [ ] Any veto is recorded with justification and override conditions
- [ ] Final plan is persisted to `.git/.orchestration/deliberation/{sessionId}.json`
- [ ] Handoff to Supervisor/Planner includes consensus context

## Related Skills

| Skill | When to hand off |
|-------|-----------------|
| `first-principles-velocity` | Apply bottleneck analysis to deliberation scope; model tier selection |
| `orchestration-turn-reporting` | Turn-summary JSON format for Moderator and delegates |
| `server-domain-architecture` | Alpha's canonical reference for backend decisions |
| `mini-program-frontend-excellence` | Beta's canonical reference for Taro/WeChat UX |
| `testing-and-regression-guardrails` | Gamma's canonical reference for edge-case coverage |
| `platform-coordination-protocol` | Cross-platform impact when deliberation spans web + mini-program |
| `matching-domain` | When deliberation touches scoring math or matching algorithms |
| `reliability-and-state-integrity` | When deliberation involves transactions, retries, or state machines |
| `wow-elements` | When deliberation involves premium interactions, micro-animations, or emotional UX moments |

## Canonical References

- `.github/agents/deliberation-moderator.agent.md`
- `.github/orchestration.yaml` (handoff edges, agent bindings)
- `.github/agents/manifest.json`
- `scripts/orchestration-supervisor.mjs`
- `scripts/orchestration-next-actions.mjs`
- `AGENTS.md` (delivery lanes documentation)
