# Multi-Agent Deliberation Protocol

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

## Anonymous peer review rules

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

## Roundtable debate format

The Moderator extracts **points of disagreement** from the critiques and routes a focused debate prompt:

> "The team disagrees on [X]. Alpha argues [position]. Beta argues [position]. Gamma argues [position]. Discuss only this disagreement. Do not repeat prior consensus."

**Rules:**
- Delegates cannot repeat what they already said
- Max 3 debate rounds
- The Moderator may synthesize intermediate convergence and ask for confirmation

## ACK-ALL consensus with veto powers

The Moderator presents a **synthesizer summary** of the converged position and polls each delegate:

```
Delegate [Name]: ACK or NACK: [Specific Reason]
```

**Exit condition:** All 3 delegates respond `ACK`.
**Loop condition:** Any `NACK` returns to Phase 3 with the specific objection as the new debate topic.

## Deliberation transcript persistence

The Moderator writes:
1. **Final unified plan** — the agreed architecture/design/approach
2. **Deliberation transcript** — full session JSON persisted to `.git/.orchestration/deliberation/{sessionId}.json`
3. **Handoff** — to Supervisor (for implementation routing) or Planner (for execution planning)

## Transcript format template

```json
{
  "sessionId": "...",
  "timestamp": "...",
  "task": "...",
  "phases": [
    { "phase": 1, "proposals": [...] },
    { "phase": 2, "critiques": [...] },
    { "phase": 3, "debateRounds": [...] },
    { "phase": 4, "acknowledgments": [...] }
  ],
  "finalPlan": "...",
  "vetos": [],
  "dissents": []
}
```

## Trigger conditions

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
