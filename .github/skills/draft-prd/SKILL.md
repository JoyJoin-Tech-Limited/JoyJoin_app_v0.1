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

1. **Falsify the requirement before scoping it.** Every PRD names who asked (person, file path, or ticket), the observable evidence, and what breaks if the need is dropped. Any of the three missing → label **待证伪** and keep it out of the main scope. A perfect answer to the wrong question is the most expensive PRD failure.
2. **Decide what gets deleted, merged, or replaced.** A PRD that only adds is incomplete. Hard-forbidden deletions: payment/refund/reconciliation paths, audit logs, compliance or WeChat-review copy (including fail-closed AIGC labels), auth/session/privacy boundaries, data-retention records — reduce those instead, and flag the governance path.
3. **Start from current canon.** Use `PRODUCT_REQUIREMENTS.md`,
   `DEVELOPER_QUICK_REFERENCE.md`, and `docs/README.md` for active terminology.
4. **Separate current state from proposal.** Make it explicit what exists today,
   what is proposed, and what remains open.
5. **Scope the problem before the solution.** Explain the user problem, target
   user, constraints, and success measures before implementation detail.
6. **Keep backlog-ready details explicit.** Include acceptance criteria and
   dependencies when the artifact becomes tracked work.
7. **Keep engineering assumptions testable.** Note routes, schema, AI, or
   cross-platform behavior as hypotheses unless confirmed by the active codebase.
8. **Write measurable success metrics.** Avoid vague wins like "better engagement"
   without an observable signal, unit, and threshold. Anything claimed as faster needs a
   number (CI minutes, days to proof); with no baseline, write 待验证 instead of an adjective.

Steps 1–2 come from the five-step requirement algorithm in
[`first-principles-velocity/references/requirement-algorithm.md`](../first-principles-velocity/references/requirement-algorithm.md);
the remaining steps (simplify → accelerate → automate) land in rules 5–7. Automation
proposals are locked until the requirement and the deletion decision are both settled.

## Recommended structure

Use a compact planning shape:

1. Problem statement — **with the requirement source and evidence, or 待证伪**
2. Target users and scenario
3. Goals and non-goals — **plus what this deletes, merges, or replaces**
4. User stories or primary flows — **smallest shape: fewest surfaces, states, flags**
5. Acceptance criteria — **sequenced by smallest verifiable output**
6. Constraints, risks, dependencies, and open questions — name automations only when steps 1–3 justified them
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
| Nobody can say who asked for this | Return to step 1 of the requirement algorithm; label 待证伪 or attach a source + evidence |
| PRD only adds scope, deletes nothing | Name the behavior this retires, merges, or replaces — or state why nothing can be removed |
| Deletion touches payment/audit/compliance/auth/retention | Restore it, reduce instead of remove, and flag the governance path |
| Automates a manual step nobody justified | Drop it or mark it locked until the requirement and deletion decision are settled |
| PRD is an implementation plan | Move file paths and sequencing to engineering docs |
| Acceptance criteria are vague | Rewrite as specific observable outcomes |
| Success metrics are too vague | Add unit, threshold, and comparison window |
| Copies old terminology | Re-check `PRODUCT_REQUIREMENTS.md` and use active canon |

## Review checklist

- [ ] Requirement source and evidence present, or explicitly labeled 待证伪
- [ ] Non-goals plus an explicit delete/merge/replace answer
- [ ] Deletions avoid the five hard-forbidden categories, or the governance path is flagged
- [ ] Solution shape is the smallest one that delivers the same user outcome
- [ ] Acceptance criteria are sequenced by smallest verifiable output
- [ ] Automations justified by steps 1–3, with frequency and owner
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
- [`first-principles-velocity/references/requirement-algorithm.md`](../first-principles-velocity/references/requirement-algorithm.md)
