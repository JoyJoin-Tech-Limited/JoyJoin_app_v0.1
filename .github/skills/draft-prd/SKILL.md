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

Turn a feature idea into a scoped product artifact that fits the active JoyJoin
product canon. For planning and requirements writing, not post-implementation docs.

## When to use this skill

- Drafting a PRD, proposal, or feature brief
- Turning a scoped idea into an issue-ready backlog artifact
- Defining user stories, scope boundaries, non-goals, or acceptance criteria
- Writing success metrics or rollout questions for a planned feature
- Updating a proposal doc before engineering kickoff

## Core rules

1. **Start from current canon.** Use `PRODUCT_REQUIREMENTS.md`,
   `DEVELOPER_QUICK_REFERENCE.md`, and `docs/README.md` for active terminology.
2. **Separate current state from proposal.** Make it explicit what exists today,
   what is proposed, and what remains open.
3. **Scope the problem before the solution.** Explain the user problem, target
   user, constraints, and success measures before implementation detail.
4. **Keep backlog-ready details explicit.** Include acceptance criteria and
   dependencies when the artifact becomes tracked work.
5. **Keep engineering assumptions testable.** Note routes, schema, AI, or
   cross-platform behavior as hypotheses unless confirmed by the active codebase.
6. **Write measurable success metrics.** Avoid vague wins like "better engagement"
   without an observable signal, unit, and threshold.

## Recommended structure

Use a compact planning shape:

1. Problem statement
2. Target users and scenario
3. Goals and non-goals
4. User stories or primary flows
5. Acceptance criteria
6. Constraints, risks, dependencies, and open questions
7. Success metrics

For the full template with acceptance-criteria examples, scope-boundary samples,
and success-metric formulas, see [`references/prd-template.md`](./references/prd-template.md).

## Quick examples

- **New feature idea** → proposal with scope, non-goals, risks, and a measurable
  success section.
- **Issue-ready backlog item** → concise artifact with acceptance criteria and
  explicit dependencies.
- **Before engineering kickoff** → tightened problem statement so implementation
  does not start from ambiguous goals.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Mixes shipped and proposal ideas | Split into current state, proposed change, open questions |
| PRD is an implementation plan | Move file paths and sequencing to engineering docs |
| Acceptance criteria are vague | Rewrite as specific observable outcomes |
| Success metrics are too vague | Add unit, threshold, and comparison window |
| Copies old terminology | Re-check `PRODUCT_REQUIREMENTS.md` and use active canon |

## Review checklist

- [ ] Uses active JoyJoin terminology and current product canon
- [ ] Current state and proposed state are clearly separated
- [ ] Goals and non-goals are explicit
- [ ] User stories or flows are specific enough to guide follow-up work
- [ ] Acceptance criteria are included when the artifact becomes tracked backlog
- [ ] Success metrics are measurable rather than aspirational
- [ ] Open questions, dependencies, and risks are visible instead of buried

## Related files

- `PRODUCT_REQUIREMENTS.md`
- `DEVELOPER_QUICK_REFERENCE.md`
- `docs/README.md`
- `docs/proposals/`
- [`references/prd-template.md`](./references/prd-template.md)
