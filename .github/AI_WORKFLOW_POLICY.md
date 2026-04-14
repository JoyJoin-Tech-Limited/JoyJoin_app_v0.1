# JoyJoin AI Workflow Policy

**Status:** Active contributor policy  
**Last updated:** 2026-04-14  
**Scope:** Repo-level AI-assisted delivery workflow, agent usage, and approval boundaries

## Document relationships

This policy defines how contributors should use AI in this repository.

| Document | Role |
|---|---|
| **`AI_WORKFLOW_POLICY.md`** (this file) | Repo-level contributor policy for choosing the right delivery lane, escalation path, and approval boundary for AI-assisted work. |
| [`ORCHESTRATION.md`](./ORCHESTRATION.md) | Human-readable description of the current native handoff graph, runtime surfaces, support-agent audit, and tooling sufficiency notes. |
| [`ORCHESTRATION_GOVERNANCE.md`](./ORCHESTRATION_GOVERNANCE.md) | Change-management rules for agents, skills, hooks, orchestration scripts, and their validation surfaces. |
| [`../docs/ai-agent-harness-separation-strategy.md`](../docs/ai-agent-harness-separation-strategy.md) | Current shipped runtime AI architecture, invariants, and separation boundaries. |
| [`../docs/AI_INTEGRATION_PLAN.md`](../docs/AI_INTEGRATION_PLAN.md) | Product AI roadmap, rollout gates, and future-phase sequencing. |
| [`../docs/AI_EXECUTION_ROADMAP.md`](../docs/AI_EXECUTION_ROADMAP.md) | 30-60-90 engineering roadmap for improving AI delivery workflow, orchestration validation, and operational readiness. |

This policy does **not** approve new runtime AI product behavior by itself. Product AI changes still require the runtime architecture docs, the right domain skills, and explicit rollout gates.

## Core policy

1. **Skills are the rules.** Skills capture repo boundaries, domain invariants, and placement rules. Agents package workflows around those rules; they do not replace them.
2. **Use the smallest lane that preserves clarity.** Do not force broad planning onto a bounded task, and do not skip planning when the scope is genuinely cross-cutting or ambiguous.
3. **No hidden autonomous execution.** Native orchestration is a guidance-and-handoff layer. `Researcher`, `Planner`, `Supervisor`, and the support agents are explicit workflow tools, not a silent background executor.
4. **Keep repo workflow separate from runtime AI product authority.** Agent orchestration under `.github/` governs contributor workflow. Runtime AI behavior in `apps/server` remains bounded by deterministic product authority, fallback requirements, and typed contracts.
5. **Prefer truth over implied certainty.** If scope, ownership, or runtime state is unclear, record that uncertainty and escalate. Do not let stale context, guessed file scope, or ambiguous routing masquerade as verified state.
6. **Treat repo memory as advisory retrieval, not authority.** Runtime `memoryContext` can surface useful prior decisions, but durable publication still requires review through `repo-memory/candidates/` before promotion into `repo-memory/promoted/`.

## Delivery lanes

JoyJoin uses three delivery lanes.

| Lane | Use when | Required output |
|---|---|---|
| **Direct delivery** | The task is bounded, the affected surfaces are already known, and the implementation path is straightforward. | Minimal implementation or doc change plus local validation appropriate to the risk. |
| **Kickoff lane** (`Researcher` -> `Planner`) | The task is broad, ambiguous, cross-workspace, architecture-shaping, or likely to branch into multiple specialists. | A verified research brief followed by an approval-first execution plan before implementation starts. |
| **Operational lane** (`Auto-Eval`, `QA Agent`, `Launch Readiness Agent`, `Supervisor`) | The task is dominated by dirty-worktree review, release risk, regression investigation, launch readiness, or blocker routing. | Findings, verification evidence, and explicit go/no-go or next-step guidance. |

## How to choose the lane

Use **direct delivery** when all of the following are true:

- The task is small enough that the affected code or docs are obvious up front.
- The change does not need a new architecture decision before implementation.
- A single specialist or a single contributor can execute it without multi-stage routing.

Use the **kickoff lane** when any of the following are true:

- The request spans multiple workspaces, domains, or contributor audiences.
- The work touches agents, skills, hooks, orchestration contracts, contributor policy, or shared platform governance.
- The user is asking for a plan, proposal, roadmap, or architectural recommendation before code changes.
- The task needs repo research, external references, or explicit ambiguity capture before implementation is safe.

Use the **operational lane** when any of the following are true:

- Auto-Eval is blocking guarded tools or a dirty worktree needs deterministic review.
- The request is primarily about validation, QA coverage, release blockers, or launch risk.
- The work needs incident-style triage, blocker routing, or remediation sequencing.

Use `Supervisor` inside the operational lane when the next move is rerouting rather than execution itself:

- The task needs to go back to `Researcher` or `Planner` because new ambiguity or scope drift appeared midstream.
- The next best specialist is an audited frontend support agent such as `Expert React Frontend Engineer`, `Taro Mini-Program Frontend Engineer`, `Taro Migration Specialist`, or `Mini-Program Parity Auditor`.
- The work is branding-sensitive UI delivery that should stay attached to existing frontend agents plus `design-system-governance` and `joyjoin-brand-guidelines`, not a new branding-only lane.

## Mandatory escalation rules

The following are non-optional workflow boundaries.

### Route through `Researcher` -> `Planner`

- Broad requests with unclear file scope or multiple plausible solution shapes
- Changes to `.github/agents/`, `.github/skills/`, `.github/orchestration.yaml`, hook behavior, or orchestration runtime scripts
- Cross-platform or cross-workspace work where discovery matters as much as implementation
- Any request that is explicitly approval-first

### Route through `QA Agent`

- Stateful user journeys, auth, onboarding, payment, matching, or icebreaker-session changes
- AI-backed user flows where fallback behavior, prompt boundaries, or trace coverage matter
- Work that needs a concrete regression checklist rather than only local unit-level validation

### Route through `Launch Readiness Agent`

- Production rollout, release sign-off, or launch blocker review
- Changes that materially depend on observability, environment assumptions, security posture, or operational runbooks
- AI-backed changes that need a rollout-risk view beyond local correctness

### Route through `Auto-Eval`

- Whenever guarded tools are blocked by the dirty-worktree gate
- After substantial edits in a dirty worktree when local sign-off matters
- Before treating a local change as ready for downstream review or handoff

## Required execution rules

1. Load the relevant skill or skills before making architectural or domain decisions.
2. Keep changes aligned with active-flow docs and current runtime ownership.
3. Update contributor-facing docs when workflow behavior, governance expectations, or canonical references change.
4. Validate the change at the right level for the risk: contract checks, targeted tests, QA review, launch review, or a combination.
5. Leave explicit findings when validation is partial; do not imply end-to-end confidence you did not establish.
6. Keep `.git/.orchestration/` operational-only. If the work produces a durable memory candidate, stage it into `repo-memory/candidates/` instead of treating runtime state as a publication surface.

## Runtime AI boundaries that still apply

Contributor workflow policy does not weaken runtime product rules.

- Deterministic product authority remains server-owned. Examples: `poolMatchingService.ts`, onboarding `nextStep`, and the social-icebreaker phase lifecycle.
- User-facing AI requires a typed contract, fallback behavior, and observability metadata.
- Planning-only AI roadmap items remain planning-only until the documented rollout gates are cleared.
- Repo orchestration docs must never be cited as approval to ship new runtime AI capabilities.

## Portfolio expansion policy

The default answer to portfolio growth is restraint.

- Do not add a new agent until there is repeated workflow demand, a clear handoff boundary, explicit skill links, and tooling that is at least sufficient for the promised job.
- Do not add a new skill until the repo has repeated, stable domain knowledge that is not already captured by an existing skill or canonical doc.
- Keep `Researcher` and `Planner` mostly skill-light unless an orchestration-specific ruleset proves repeatedly necessary.
- Prefer documenting a rule first, validating the workflow, and only then deciding whether deterministic enforcement should be added.

## Working checklist

1. Pick the correct delivery lane.
2. Load the relevant skills.
3. Use `Researcher` -> `Planner` before coding if the task is broad or approval-first.
4. Keep runtime AI, repo orchestration, and product roadmap docs in their own lanes.
5. Validate at the right depth for the actual risk.
6. Escalate to QA or launch review when the change outgrows local confidence.