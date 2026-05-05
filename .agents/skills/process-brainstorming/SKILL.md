---
name: process-brainstorming
description: >
  Divergent-thinking discipline before converging on a solution. Use when a task is
  ambiguous, creative, or has multiple plausible approaches. Forces constraint-first
  ideation, option evaluation against JoyJoin lanes, and a clear handoff to either
  lane-selection or direct implementation. Trigger phrases: brainstorm this, explore
  options, divergent thinking, creative approaches, ambiguous task, multiple solutions,
  how should we approach this, ideation phase.
---

# Process: Brainstorming

## Purpose

Prevent premature convergence. When a task is ambiguous, force explicit divergent thinking **before** choosing a lane or writing code. This skill ensures brainstorming produces actionable options rather than open-ended speculation.

---

## When to use this skill

- The task has no single obvious solution
- You are exploring a new feature direction, UX concept, or architecture approach
- You need to evaluate 2+ plausible implementation strategies
- The user says "I'm not sure how to build this" or "What are our options?"

## When NOT to use this skill

- The task is bounded with a clear file and known fix (use direct delivery)
- The task requires rigorous engineering validation (use HRC directly)
- You are mid-implementation and need code review (use `code-review`)

---

## The brainstorming protocol

### Step 1: Constraint inventory (2 minutes)

Before generating options, list the hard constraints:

1. **Auth / safety boundary** — does this touch user data, payments, or trust boundaries?
2. **Platform limits** — Taro/WeChat runtime constraints, browser compatibility
3. **Deterministic authority** — matching engine, personality system, scoring rules
4. **Latency / cost ceiling** — API response time, LLM token budget, build size
5. **Cross-platform parity** — must both web and mini-program ship together?

> If any constraint is unknown, route to `Researcher` before brainstorming.

### Step 2: Generate exactly 3 options

Force at least 3 distinct approaches. Label each:

| Option | Label | Description |
|---|---|---|
| A | **Conservative** | Uses only existing patterns, minimal risk, longest timeline |
| B | **Balanced** | Introduces one new abstraction or pattern, moderate risk |
| C | **Aggressive** | Novel approach, highest upside, highest risk |

For each option, specify:
- Affected files/workspaces
- Estimated complexity (files changed, tests needed)
- Lane implication (Direct / DM / HRC)

### Step 3: Evaluate against JoyJoin lanes

Map each option to the lane it would require:

```
Option A → Direct delivery (uses existing patterns)
Option B → DM (new abstraction, cross-workspace impact)
Option C → HRC (novel state machine or auth boundary)
```

If the highest-value option requires HRC but the user wants speed, explicitly flag the trade-off.

### Step 4: Recommend and handoff

State a clear recommendation with justification:

> **Recommended:** Option B (Balanced)
> **Why:** Option A is too slow for the sprint goal; Option C introduces unmitigated partial-failure risk in the icebreaker state machine. Option B adds the needed abstraction without touching auth or matching.
> **Next step:** Run `Deliberation Moderator` for the cross-workspace architecture review.

---

## Examples

### Example 1: Ambiguous feature

**User:** "We need a better way to show pool card momentum."

**Brainstorm output:**
- Constraint: Must work in both web and mini-program; cannot add LLM calls to list route
- Option A (Conservative): Static badge text based on registration count only
- Option B (Balanced): AI-generated headlines cached out-of-band, read from cache in list route
- Option C (Aggressive): Real-time WebSocket updates to cards as users register
- Recommendation: Option B → DM lane (cross-workspace: server cache + mini-program UI)

### Example 2: Architecture exploration

**User:** "Should we move matching logic to a worker queue?"

**Brainstorm output:**
- Constraint: Matching is deterministic authority; must not introduce eventual consistency bugs
- Option A: Keep synchronous, optimize queries
- Option B: Async worker with immediate optimistic response + reconciliation
- Option C: Full event-sourced matching pipeline
- Recommendation: Option A for now; Option B needs HRC for partial-failure analysis

---

## Troubleshooting

**Brainstorming produces too many options**
> Force exactly 3. Label them Conservative / Balanced / Aggressive. If you cannot find a third, state why and proceed with 2.

**All options seem equally good**
> Apply the inversion test: "Which option fails worst if we guess wrong?" Pick the one with the most graceful failure mode.

**User wants to skip brainstorming and just build**
> If the task is genuinely ambiguous, push back: "Before implementation, let's constrain the solution space so we don't rebuild." If the user insists, document the assumed constraints and proceed with direct delivery.

---

## Review checklist

- [ ] Hard constraints were listed before options were generated
- [ ] Exactly 3 options (Conservative / Balanced / Aggressive) were produced
- [ ] Each option maps to a lane (Direct / DM / HRC / Kickoff)
- [ ] Recommendation includes explicit justification
- [ ] Handoff names the next agent or lane
