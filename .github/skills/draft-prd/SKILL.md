---
name: draft-prd
description: >-
  Draft product requirements, feature briefs, issue-ready backlog artifacts,
  user stories, acceptance criteria, scope boundaries, and success metrics using
  the active JoyJoin product canon. Use when shaping a new feature or proposal
  before implementation. Trigger phrases: "draft a PRD", "feature brief",
  "acceptance criteria", "write a backlog item", "scope this feature",
  "product requirement".
---

# Draft PRD

## Purpose

This skill helps turn a feature idea into a scoped product artifact that fits the
active JoyJoin product canon. It is for planning and requirements writing, not for
syncing implementation docs after code changes.

## When to use this skill

Use this skill when you are:

- drafting a PRD, proposal, or feature brief
- turning a scoped idea into an issue-ready backlog artifact
- defining user stories, scope boundaries, non-goals, or acceptance criteria
- writing success metrics or rollout questions for a planned feature
- updating a proposal doc before engineering implementation starts

## Core rules

1. Start from current canon.
   Use `PRODUCT_REQUIREMENTS.md`, `DEVELOPER_QUICK_REFERENCE.md`, and `docs/README.md`
   so the draft stays aligned with active terminology and shipped behavior.

2. Separate current state from proposal.
   Make it explicit what exists today, what is proposed, and what remains open.

3. Scope the problem before the solution.
   The artifact should explain the user problem, target user, constraints, and
   success measures before drifting into implementation detail.

4. Keep backlog-ready details explicit.
   If the artifact will become tracked work, include acceptance criteria and the
   dependencies or assumptions needed to make the issue actionable.

5. Keep engineering assumptions testable.
   If a draft mentions routes, schema, AI, or cross-platform behavior, note them as
   hypotheses or impact areas unless they are already confirmed by the active codebase.

6. Write success metrics that can actually be measured.
   Avoid vague wins like "better engagement" without defining the observable signal.

## Recommended structure

Use a compact planning shape:

1. Problem statement
2. Target users and scenario
3. Goals and non-goals
4. User stories or primary flows
5. Acceptance criteria when the work should become tracked backlog
6. Constraints, risks, dependencies, and open questions
7. Success metrics

## Quick examples

- **New feature idea**: turn a brief ask into a proposal with scope, non-goals, risks, and a measurable success section.
- **Issue-ready backlog item**: convert a scoped request into a concise backlog artifact with acceptance criteria and explicit dependencies.
- **Before engineering kickoff**: tighten the problem statement so implementation does not start from ambiguous goals.

## Troubleshooting

**The draft mixes shipped behavior and proposal ideas together**
Split the document into current state, proposed change, and open questions.

**The PRD is really an implementation plan**
Move file paths, technical sequencing, and migration mechanics to engineering docs or follow-up notes.

**Acceptance criteria are vague or not testable**
Rewrite them as specific observable outcomes rather than broad intentions.

**Success metrics are too vague**
Rewrite them as observable product signals with a defined unit, threshold, or comparison window.

**The draft copies old terminology from archived docs**
Re-check `PRODUCT_REQUIREMENTS.md` and rewrite using the active canon.

## Review checklist

- [ ] The draft uses active JoyJoin terminology and current product canon
- [ ] Current state and proposed state are clearly separated
- [ ] Goals and non-goals are explicit
- [ ] User stories or flows are specific enough to guide follow-up design and engineering
- [ ] Acceptance criteria are included when the artifact should become tracked backlog
- [ ] Success metrics are measurable rather than aspirational
- [ ] Open questions, dependencies, and risks are visible instead of buried

## Related files

- `PRODUCT_REQUIREMENTS.md`
- `DEVELOPER_QUICK_REFERENCE.md`
- `docs/README.md`
- `docs/proposals/`
