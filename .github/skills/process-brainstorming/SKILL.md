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

Prevent premature convergence. When a task is ambiguous, force explicit divergent thinking **before** choosing a lane or writing code, producing actionable options rather than open-ended speculation.

---

## When to use this skill

- The task has no single obvious solution
- Exploring a new feature direction, UX concept, or architecture approach
- Evaluating 2+ plausible implementation strategies
- The user says "I'm not sure how to build this" or "What are our options?"

## When NOT to use this skill

- Bounded task with a clear file and known fix (use direct delivery)
- Task requires rigorous engineering validation (use HRC directly)
- Mid-implementation code review (use `code-review`)

---

## The brainstorming protocol

### Step 1: Constraint inventory (2 minutes)

Before generating options, list the hard constraints:

1. **Auth / safety boundary** — user data, payments, trust boundaries?
2. **Platform limits** — Taro/WeChat runtime constraints, browser compatibility
3. **Deterministic authority** — matching engine, personality system, scoring rules
4. **Latency / cost ceiling** — API response time, LLM token budget, build size
5. **Cross-platform parity** — must both web and mini-program ship together?

> If any constraint is unknown, route to `Researcher` before brainstorming.

### Step 2: Generate exactly 3 options

Force 3 distinct approaches:

| Option | Label | Description |
|---|---|---|
| A | **Conservative** | Existing patterns only, minimal risk, longest timeline |
| B | **Balanced** | One new abstraction or pattern, moderate risk |
| C | **Aggressive** | Novel approach, highest upside, highest risk |

For each: affected files/workspaces, estimated complexity (files changed, tests needed), lane implication (Direct / DM / HRC).

### Step 3: Evaluate against JoyJoin lanes

Map each option to its required lane. If the highest-value option requires HRC but the user wants speed, explicitly flag the trade-off.

### Step 4: Recommend and handoff

State a clear recommendation with justification:

> **Recommended:** Option B (Balanced)
> **Why:** A is too slow for the sprint goal; C introduces unmitigated partial-failure risk in the icebreaker state machine. B adds the needed abstraction without touching auth or matching.
> **Next step:** Run `Deliberation Moderator` for the cross-workspace architecture review.

---

## Example

**User:** "We need a better way to show pool card momentum."

- Constraint: must work in both web and mini-program; cannot add LLM calls to list route
- Option A (Conservative): static badge text based on registration count only
- Option B (Balanced): AI-generated headlines cached out-of-band, read from cache in list route
- Option C (Aggressive): real-time WebSocket updates to cards as users register
- Recommendation: B → DM lane (cross-workspace: server cache + mini-program UI)

*(Same shape for architecture explorations: e.g., "move matching to a worker queue?" → constraint: deterministic authority, no eventual-consistency bugs → A: keep synchronous, optimize queries; B: async worker + optimistic response; C: event-sourced pipeline → recommend A for now; B needs HRC.)*

---

## Troubleshooting

**Too many options**
> Force exactly 3 (Conservative / Balanced / Aggressive). If you cannot find a third, state why and proceed with 2.

**All options seem equally good**
> Inversion test: "Which option fails worst if we guess wrong?" Pick the most graceful failure mode.

**User wants to skip brainstorming and just build**
> If genuinely ambiguous, push back: "Before implementation, let's constrain the solution space so we don't rebuild." If the user insists, document the assumed constraints and proceed with direct delivery.

---

## Review checklist

- [ ] Hard constraints were listed before options were generated
- [ ] Exactly 3 options (Conservative / Balanced / Aggressive) were produced
- [ ] Each option maps to a lane (Direct / DM / HRC / Kickoff)
- [ ] Recommendation includes explicit justification
- [ ] Handoff names the next agent or lane
