---
name: first-principles-velocity
description: >-
  First-principles and critical-path execution discipline for agents and humans. Two layers:
  (1) the five-step requirement algorithm — question requirements, delete, simplify/optimize,
  accelerate, automate, in that order; (2) routing discipline — state the mission, invert failure
  modes, remove the single bottleneck, pair cheap models to shallow work and strong models to
  irreducible complexity. Use when deciding whether a requirement should exist at all, planning
  ambiguous work, routing specialists, prioritizing under constraints, or asking which model tier
  fits a task. Trigger phrases: first principles, 质疑需求, 这个需求该不该做, 需求站不站得住,
  先删再优化, 砍流程, 简化流程, 五步算法, delete before automate, critical path, main bottleneck,
  mission in one sentence, inversion, ruthless prioritization, cheap model for trivial step,
  when to use Opus, velocity without thrash, hard constraints, vertical slice, single owner,
  smallest proof, quarantine legacy, blocked with evidence.
---

# First-principles Velocity

## Purpose

Encode **how to think** before **how to code**, in two layers:

1. **Requirement layer — the five-step algorithm.** Decide whether a requirement or process should
   exist at all, before anyone optimizes it. Skipping this layer is how teams deliver perfect answers
   to the wrong question.
2. **Routing layer — critical-path discipline.** Shrink the problem to its load-bearing assumptions,
   find the **critical path**, and spend premium capacity only where it moves the outcome.

Pair with `.github/agents/MODEL_CATALOG.md` for model-tier routing.

## When to use this skill

- A requirement, feature, step, flag, or script is being proposed and nobody can say who asked for it
- Deciding whether to delete, simplify, speed up, or automate a flow (and in what order)
- Kicking off or reframing ambiguous work
- Choosing between one narrow handoff vs many parallel threads
- Deciding model tier for a step
- Supervisor or Planner is routing and needs a repeatable prioritization frame
- The bottleneck is unclear despite feeling "busy"

## The five-step requirement algorithm

**Order is the constraint.** 1 → 2 → 3 → 4 → 5, never skipped, never reordered, never substituted.

1. **Question requirements** — every requirement needs a named source, real evidence, and a stated
   loss if deleted. Any of the three missing → label `待证伪`, keep it out of the decision.
2. **Delete** — if you did not need to add back 10%, you did not delete hard enough. Five categories
   are **hard-forbidden** (payments/refunds, audit logs, compliance + WeChat-review copy, auth/privacy,
   data retention); everything else is a delete candidate by default.
3. **Simplify / optimize** — only after deletion. Never let "optimize" stand in for "delete".
4. **Accelerate** — every flow can be faster, but only in numbers (CI minutes, days to proof). Never
   trade away guardrails for speed.
5. **Automate** — **locked until steps 1–3 are done.** Automating a process that should not exist is
   the most expensive mistake in this algorithm.

Full step definitions, the hard-forbidden list, the five-line output anchor, and anti-patterns:
[`references/requirement-algorithm.md`](./references/requirement-algorithm.md).

## Core moves (routing layer)

Repeat each turn or planning step:

1. **Mission in one sentence** — What must be true when we stop?
2. **Inversion** — What would make this fail even if executed perfectly on the wrong thing?
3. **Critical path** — One bottleneck that blocks truth or shipping.
4. **Single next action** — The smallest specialist step that removes that bottleneck.
5. **Model / cost** — Map the step to `MODEL_CATALOG.md`.

## Three execution themes

Two former themes were folded into the algorithm because they duplicated it: **ruthless deletion**
is now Step 2, and **cycle time over headcount** is now Step 4. Keeping both as themes produced two
versions of the same rule that drifted apart.

1. **Constraint-first design (precondition)** — Name hard constraints before solution options; a
   requirement that cannot survive its constraints was never viable.
2. **End-to-end slice ownership** — One lane owns truth for a vertical slice.
3. **Direct escalation** — Escalate in one step with evidence.

For inversion examples, smallest-proof guidance, quarantine patterns, escalation
rules, and model-tier routing tables, see
[`references/velocity-patterns.md`](./references/velocity-patterns.md).

## Quick examples

- **Question a requirement:** "Add a gamified check-in streak." Source = nobody named; evidence =
  none; delete-loss = "might lift DAU". → `待证伪`, keep it out of the sprint.
- **Delete before automating:** "We need a bot to chase stale pool registrations." Step 2 first:
  the reminder flow has a scheduler already → delete the duplicate script instead of automating it.
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
| Everything gets "optimized", nothing gets deleted | Skipped Step 2 | Force a named delete item or a stated reason it cannot be deleted |
| Proposal automates a flow nobody uses | Step 5 unlocked too early | Apply the ordering lock; ask "should this process exist?" first |
| Speed claims with no numbers | Adjectives instead of baselines | Require CI minutes / days-to-proof / experiment duration |
| `待证伪` appears everywhere | Assumption treated as a pass | Core decisions need evidence; assumptions stay in secondary slots |

## Review checklist

- [ ] Mission and "done" are explicit
- [ ] Every requirement has a named source and evidence, or is labeled `待证伪`
- [ ] At least one concrete deletion item, or a stated reason deletion is impossible
- [ ] Simplification follows deletion rather than replacing it
- [ ] Acceleration targets are numeric; missing baselines marked `待验证`
- [ ] Automation is ordered after Steps 1–3 and names frequency, savings, and observability
- [ ] Deletions respect the five hard-forbidden categories or flag the conflict and review path
- [ ] Bottleneck named (not a list of ten equal priorities)
- [ ] Next owner is one specialist or one lane
- [ ] Model tier matches task depth (see MODEL_CATALOG)
- [ ] Hard constraints stated before solution options
- [ ] Slice or ownership boundary is clear
- [ ] Next step is the smallest proof that fits policy
- [ ] Removals/quarantines called out or N/A
- [ ] If blocked, evidence attached for escalation

## Related files

- [`references/requirement-algorithm.md`](./references/requirement-algorithm.md) — five-step algorithm, hard-forbidden deletion list, output anchor, anti-patterns
- `.github/agents/MODEL_CATALOG.md`
- `docs/ai/ai-workflow-documentation-refresh.md`
- [`references/velocity-patterns.md`](./references/velocity-patterns.md)

## Consumed by

- `.github/skills/commercialization-genius/SKILL.md` — mandatory 五步审计 block before the decision memo
- `.github/agents/product-manager.agent.md` — mapped into the six-section product artifact
- `.github/skills/draft-prd/SKILL.md` — requirement falsification and deletion posture in the PRD contract
