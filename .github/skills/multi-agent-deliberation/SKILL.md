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

## The 5 Phases

1. **Team Assembly** — Moderator spawns 3 delegates in isolation; each returns a proposal JSON
2. **Anonymous Peer Review** — Proposals are stripped of authorship; each delegate critiques the 2 they did not write
3. **Open Roundtable** — Moderator extracts disagreements and routes a focused debate (max 3 rounds)
4. **Consensus Poll (ACK-ALL)** — Moderator polls delegates; unanimous ACK exits, any NACK returns to Phase 3
5. **Refined Output** — Final unified plan, deliberation transcript, and handoff to Supervisor or Planner

See [references/protocol.md](references/protocol.md) for full delegate role descriptions, veto powers, anonymous review rules, roundtable format, transcript template, and auto-routing trigger conditions.

## Quick examples

- **Route a cross-domain feature:** "Deliberate real-time icebreaker state sync" → Alpha proposes WS + polling hybrid, Beta insists on animated transitions, Gamma warns about Taro background disconnect. Consensus: polling primary with WS fallback for host actions.
- **Design a scoring algorithm:** "Deliberate venue assignment scoring" → Alpha proposes weighted 4-dimension score, Beta requests admin radar chart, Gamma requires AMap timeout fallback. Consensus: 4-dimension score + Recharts radar + 3-second AMap timeout with fallback.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Delegates keep NACKing | Unresolved fundamental disagreement | Escalate to human decision; document dissents in transcript |
| One delegate dominates | Prompt framing too narrow | Reword task to explicitly request the minority perspective |
| Roundtable goes in circles | Debate scope too broad | Moderator narrows to a single decision with 2 explicit options |
| Beta vetos everything | Task is inherently low-quality | Check anti-triggers; may be wrong task for deliberation |
| Gamma vetos due to Taro limit | Limit is real and blocking | Document as hard constraint; design must adapt, not override |
| Deliberation takes too long | Task scope too large | Split into smaller deliberations per vertical slice |

## Review checklist

- [ ] Task meets at least one trigger condition or is an explicit user request
- [ ] 3 delegates selected with appropriate base agents and framing
- [ ] Phase 1 proposals are isolated (no cross-communication)
- [ ] Phase 2 critiques are anonymous and contain 1 strength + 1 weakness each
- [ ] Phase 4 achieves unanimous ACK or documented escalation path
- [ ] Final plan is persisted to `.git/.orchestration/deliberation/{sessionId}.json`

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
