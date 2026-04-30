---
name: first-principles-velocity
description: >-
  First-principles and critical-path execution discipline for agents and humans: state the mission,
  invert failure modes, remove the single bottleneck, pair cheap models to shallow work and strong
  models to irreducible complexity, and keep velocity without thrash. Includes five JoyJoin themes:
  constraint-first design, end-to-end slice ownership, cycle time via smallest proof, ruthless deletion
  or quarantine, and direct escalation when blocked with evidence. Use when planning ambiguous work,
  routing specialists, prioritizing under constraints, or asking which model tier fits a task.
  Trigger phrases: first principles, critical path, main bottleneck, mission in one sentence,
  inversion, ruthless prioritization, cheap model for trivial step, when to use Opus, velocity without thrash,
  hard constraints, vertical slice, single owner, smallest proof, quarantine legacy, blocked with evidence.
---

# First-principles Velocity

## Purpose

Encode **how to think** before **how to code**: shrink the problem to its
load-bearing assumptions, find the **critical path**, and spend premium capacity
only where it moves the outcome.

Pair with `.github/agents/MODEL_CATALOG.md` for model-tier routing.

## When to use this skill

- Kicking off or reframing ambiguous work
- Choosing between one narrow handoff vs many parallel threads
- Deciding model tier for a step
- Supervisor or Planner is routing and needs a repeatable prioritization frame
- The bottleneck is unclear despite feeling "busy"

## Core moves

Repeat each turn or planning step:

1. **Mission in one sentence** — What must be true when we stop?
2. **Inversion** — What would make this fail even if executed perfectly on the wrong thing?
3. **Critical path** — One bottleneck that blocks truth or shipping.
4. **Single next action** — The smallest specialist step that removes that bottleneck.
5. **Model / cost** — Map the step to `MODEL_CATALOG.md`.

## Five execution themes

1. **Constraint-first design** — Name hard constraints before solution options.
2. **End-to-end slice ownership** — One lane owns truth for a vertical slice.
3. **Cycle time over headcount** — Compress idea → smallest runnable proof.
4. **Ruthless deletion** — Remove or quarantine duplicate paths and dead flags.
5. **Direct escalation** — Escalate in one step with evidence.

For inversion examples, smallest-proof guidance, quarantine patterns, escalation
rules, and model-tier routing tables, see
[`references/velocity-patterns.md`](./references/velocity-patterns.md).

## Quick examples

- **Reframe ambiguous request:** Mission = "Add payment retry." Inversion =
  "Users abandon because failure is silent." Next action = "Add idempotent retry
  with backoff to `createPayment`."
- **Choose model tier:** CSS tweak → mini/fast. Matching algorithm → Opus/premium.
  Single API route → standard.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Bottleneck keeps shifting | Mission not locked | Re-run inversion; stabilize before new work |
| Delegation feels slow | Hidden dependencies | Parallelizing dependent work is an anti-pattern |
| Model tier unclear | No catalog check | Consult `MODEL_CATALOG.md`; outcome first |
| Smallest proof skips safety | Scope shrink | Use smallest *validating* change |
| Escalation ignored | No evidence | Attach command output / failing check / file path |

## Review checklist

- [ ] Mission and "done" are explicit
- [ ] Bottleneck named (not a list of ten equal priorities)
- [ ] Next owner is one specialist or one lane
- [ ] Model tier matches task depth (see MODEL_CATALOG)
- [ ] Hard constraints stated before solution options
- [ ] Slice or ownership boundary is clear
- [ ] Next step is the smallest proof that fits policy
- [ ] Removals/quarantines called out or N/A
- [ ] If blocked, evidence attached for escalation

## Related files

- `.github/agents/MODEL_CATALOG.md`
- `docs/ai-workflow-documentation-refresh.md`
- [`references/velocity-patterns.md`](./references/velocity-patterns.md)
