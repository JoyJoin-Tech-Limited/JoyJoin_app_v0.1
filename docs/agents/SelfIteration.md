---
name: "SelfIteration"
description: "Docs-only operating procedure for a proposal-only SelfIteration-lite workflow that reviews JoyJoin's agents, skills, prompts, and repo memory using existing orchestration, validation, and human approval boundaries."
status: "Active docs-only workflow"
type: "Operating procedure and future meta-agent specification"
execution: "Manual workflow over existing repo agents and validators; not registered in .github/agents/manifest.json"
approval: "Human approval required before any durable change or memory publication"
triggers:
  - "Periodic portfolio review"
  - "Recurring orchestration drift"
  - "Repeated routing or prompt misses"
  - "Repeated negative feedback on agent behavior"
  - "Tooling sufficiency gaps that block promotion"
outputs:
  - "Iteration brief"
  - "Draft change proposal"
  - "Validation checklist"
  - "Memory candidate"
constraints:
  - "Proposal-only changes"
  - "No autonomous scheduling or merge authority"
  - "Cannot modify its own approval boundaries"
  - "Cannot publish repo memory directly without review"
---

# SelfIteration-lite Operating Procedure

> **Current mode:** `SelfIteration` is not an executable custom agent. In JoyJoin today, it is a docs-only operating procedure for a human-invoked, proposal-only improvement loop over the existing agent, skill, prompt, and memory substrate.

This file defines what `SelfIteration` means now, not a hypothetical autonomous future. If the repo eventually promotes `SelfIteration` into an executable helper, that promotion must satisfy the governance bar in `.github/ORCHESTRATION_GOVERNANCE.md` and remain outside merge or memory-publication authority.

## What It Is Now

`SelfIteration-lite` is a structured review workflow for improving:

- agent discovery and handoff surfaces under `.github/agents/`
- orchestration contract and docs under `.github/orchestration.yaml` and `.github/ORCHESTRATION.md`
- skill quality and routing metadata under `.github/skills/`
- prompt or instruction quality where repeated failures show the current wording is weak
- repo memory candidates when a pattern has been validated and is general enough to keep

It is not a standing runtime actor. It does not watch the repo, schedule itself, open PRs on its own, publish memory on its own, or rewrite its own governance boundaries.

## Why This Exists

The repo already has the primitives needed for controlled self-improvement:

- `Researcher` for grounded evidence gathering
- `Planner` for approval-first scoping
- `Supervisor` for explicit routing when multiple specialists are involved
- `Auto-Eval` for dirty-worktree and validation context
- deterministic validators such as `npm run orchestration:validate`, `npm run orchestration:check`, and `npm run skill-routing:check`

What was missing was a clear operating procedure for when to use those pieces together to improve the agent-and-skill system itself. `SelfIteration-lite` fills that gap without introducing a new autonomous control-plane actor.

## Quick Trigger Checklist

Run `SelfIteration-lite` if any of these are true:

- the same failure pattern has happened more than once
- routing, docs, frontmatter, or validation drift is becoming a recurring issue
- contributors keep needing the same boundary or governance reminder
- a support agent or new skill proposal needs evidence before promotion

Skip `SelfIteration-lite` if the issue is only:

- a one-off typo, wording fix, or formatting cleanup
- an isolated miss with no repeat pattern yet
- a speculative idea that is not backed by evidence

## When To Run It

Run `SelfIteration-lite` when one or more of these are true:

- the same agent or skill failure mode repeats across sessions
- routing picks the wrong skill or fails to load the right one often enough to be a pattern
- orchestration docs, frontmatter, contract files, and validation surfaces drift out of sync
- contributors keep needing repo-memory reminders for the same decision boundary
- a support agent looks valuable enough for promotion, but the repo needs a structured evidence review first
- a proposed new agent or skill feels plausible, but the team has not yet proved it deserves to exist

Do not run it for one-off formatting issues, isolated typos, or speculative ideas that do not have evidence behind them.

## What It Must Never Do

`SelfIteration-lite` must not:

- modify `.github/orchestration.yaml`, agent docs, or skill docs without a normal reviewed change
- publish repo memory directly as if a proposal were already validated
- recommend creating a new agent when a documentation, routing, or validation fix is the smaller correct intervention
- treat one bad run as proof of a portfolio gap
- propose changes to its own approval rules, merge behavior, or privileged execution boundaries

## Current Execution Model

Use the existing portfolio instead of inventing a new runtime.

### Recommended lane

1. `Researcher`
2. `Planner`
3. Optional specialist or `Supervisor`
4. Human review
5. Deterministic validation

### Typical specialist choices

| Need | Best next lane |
| --- | --- |
| Agent docs, frontmatter, discovery wording | direct repo edit or agent-customization workflow |
| Skill content or routing drift | `skill-authoring-governance` plus `docs-sync` |
| Contract, validation, or hook drift | direct repo edit plus orchestration validation |
| Broader workflow rerouting | `Supervisor` |
| Dirty-worktree quality report | `Auto-Eval` |
| Prompt quality issue isolated to wording | `prompt engineer` only after the evidence is specific |

## Runbook

### Step 1: Capture the trigger

Write down the exact trigger in one sentence.

Good examples:

- "The same skill-routing false positive happened across three related asks."
- "A support agent looks promotable, but the tooling sufficiency audit still says partial."
- "The orchestration contract and human docs are drifting repeatedly."

Bad examples:

- "Make the agents smarter."
- "We should have more automation."

### Step 2: Gather evidence before proposing anything

Collect only the smallest set of evidence needed to prove the issue is real.

Preferred evidence sources:

- relevant agent docs under `.github/agents/`
- relevant skills under `.github/skills/`
- `.github/orchestration.yaml`
- `.github/ORCHESTRATION.md` and `.github/ORCHESTRATION_GOVERNANCE.md`
- validator scripts and outputs
- repo memory entries when they show repeated prior decisions
- explicit user or reviewer feedback tied to a repeated pattern

If the evidence is weak or contradictory, stop and record the issue as observational only.

### Step 3: Classify the problem correctly

Use the smallest truthful category:

| Category | Meaning | Typical fix |
| --- | --- | --- |
| Documentation drift | The repo rule exists but the docs or discovery surface are stale | Update docs or frontmatter |
| Routing weakness | The right skill exists but the routing metadata is weak | Update `routing.yml` or routing tests |
| Validation gap | The rule exists but nothing fails when it drifts | Add or tighten deterministic validation |
| Tooling sufficiency gap | The workflow is real but the tool surface is still incomplete | Record the gap; do not over-promote the agent |
| Real portfolio gap | Repeated evidence shows the repo lacks a stable boundary or workflow primitive | Consider a new skill or new support agent |

Default toward documentation, routing, or validation fixes before creating a new agent or skill.

### Step 4: Produce the smallest proposal

Every `SelfIteration-lite` cycle should produce one of these:

- a docs-only correction
- a routing metadata improvement
- a deterministic validator or regression test
- a small agent or skill wording improvement
- a "do nothing yet" finding with explicit reasons

If the output includes a durable memory candidate, the deliverable is still only a reviewed markdown draft until someone stages it into `repo-memory/candidates/` and promotes it through the normal review path.

If the proposal touches multiple categories, split it into separate reviewable chunks.

### Step 5: Validate before recommending memory

Run only the validators that match the surface changed.

Common checks:

```bash
npm run orchestration:validate
npm run orchestration:check
npm run skill-routing:check
node scripts/auto-eval.mjs --mode manual-report
```

Memory should only be proposed when:

- the pattern is durable rather than incident-specific
- the proposed wording is backed by successful validation or repeated accepted reviews
- the memory will reduce future mistakes rather than duplicate the docs verbatim

Even then, `SelfIteration-lite` still does not publish the note itself. The follow-up path is: reviewed draft -> `npm run memory:stage-candidate` -> human review -> `npm run memory:promote`.

### Step 6: End with a reviewer packet

Every cycle should finish with a concise packet containing:

1. Trigger
2. Evidence reviewed
3. Classification
4. Proposed change
5. Validation run or reason validation was deferred
6. Memory candidate or explicit "no memory candidate"

If any of those are missing, the cycle is incomplete.

## Output Template

Use this structure for the final deliverable of a `SelfIteration-lite` pass:

```md
## SelfIteration-lite Summary

### Trigger
[one sentence]

### Evidence
- [file, validation result, or feedback source]

### Classification
[documentation drift | routing weakness | validation gap | tooling sufficiency gap | real portfolio gap]

### Proposal
- [smallest concrete change]

### Validation
- [command run or reason not yet run]

### Memory Candidate
- [reviewed markdown draft suitable for `repo-memory/candidates/`]
or
- none

### Reviewer Decision Needed
- [approve / revise / defer]
```

## Promotion Gate For A Future Executable Agent

`SelfIteration` should remain docs-only until the repo can prove all of the following:

- repeated accepted value from manual `SelfIteration-lite` cycles
- low false-positive rate in identifying real portfolio gaps
- strong provenance for evidence, proposals, and memory candidates
- explicit hard-stop rules around self-core modification and approval boundaries
- sufficient tooling for telemetry collection, draft packaging, validation, and auditability
- a clear answer to where the helper sits: audited support lane, not core graph by default

The first promotion target, if evidence eventually justifies one, is a proposal-only executable helper. It is not a fully autonomous meta-agent.

## Relationship To The Future Spec

The older abstract `SelfIteration` concept is still useful as a long-term design envelope:

- telemetry-backed portfolio improvement
- proposal-only outputs
- no self-approval or self-merge
- evidence-backed memory staging only

But the repo should treat those ideas as design constraints, not as proof that a runnable agent is warranted now.

## Review Checklist

- [ ] The trigger describes a repeated pattern, not a one-off annoyance
- [ ] The evidence is specific and repo-grounded
- [ ] The issue is classified before any solution is proposed
- [ ] The proposal is smaller than the problem statement suggests whenever possible
- [ ] Deterministic validation matches the surfaces touched
- [ ] Any memory candidate is validated, durable, and non-duplicative
- [ ] The cycle ends with a reviewer decision rather than an implicit rollout