# JoyJoin AI Workflow Policy

**Status:** Active contributor policy  
**Last updated:** 2026-04-17  
**Scope:** Repo-level AI-assisted delivery workflow, agent usage, and approval boundaries

## Document relationships

This policy defines how contributors should use AI in this repository.

| Document | Role |
|---|---|
| **`AI_WORKFLOW_POLICY.md`** (this file) | Repo-level contributor policy for choosing the right delivery lane, escalation path, and approval boundary for AI-assisted work. |
| [`ORCHESTRATION.md`](./ORCHESTRATION.md) | Human-readable description of the current native handoff graph, runtime surfaces, support-agent audit, and tooling sufficiency notes. |
| [`ORCHESTRATION_GOVERNANCE.md`](./ORCHESTRATION_GOVERNANCE.md) | Change-management rules for agents, skills, hooks, orchestration scripts, and their validation surfaces. |
| [`AI_TOOLING_UNIFIED_BRAIN.md`](./AI_TOOLING_UNIFIED_BRAIN.md) | Cursor vs Copilot shared policy, MCP wiring (Context7, Hermes, optional agent memory), and IDE glue. |
| [`SUPERPOWERS_JOYOIN_INTEGRATION.md`](./SUPERPOWERS_JOYOIN_INTEGRATION.md) | Cursor **Superpowers** plugin + JoyJoin skills/agents/memory (Copilot does not load Superpowers). |
| [`../docs/ai-agent-harness-separation-strategy.md`](../docs/ai-agent-harness-separation-strategy.md) | Current shipped runtime AI architecture, invariants, and separation boundaries. |
| [`../docs/AI_INTEGRATION_PLAN.md`](../docs/AI_INTEGRATION_PLAN.md) | Product AI roadmap, rollout gates, and future-phase sequencing. |
| [`../docs/AI_EXECUTION_ROADMAP.md`](../docs/AI_EXECUTION_ROADMAP.md) | 30-60-90 engineering roadmap for improving AI delivery workflow, orchestration validation, and operational readiness. |

This policy does **not** approve new runtime AI product behavior by itself. Product AI changes still require the runtime architecture docs, the right domain skills, and explicit rollout gates.

## Core policy

1. **Skills are the rules.** Skills capture repo boundaries, domain invariants, and placement rules. Agents package workflows around those rules; they do not replace them.
2. **Planning is mandatory; depth is proportional.** Every task starts with an explicit planning check. For bounded work, a compact micro-plan or execution checklist is enough. For broad, ambiguous, cross-cutting, or approval-first work, use the kickoff lane. Do not skip planning entirely.
3. **No hidden autonomous execution.** Native orchestration is a guidance-and-handoff layer. `Researcher`, `Planner`, `Supervisor`, and the support agents are explicit workflow tools, not a silent background executor.
4. **Keep repo workflow separate from runtime AI product authority.** Agent orchestration under `.github/` governs contributor workflow. Runtime AI behavior in `apps/server` remains bounded by deterministic product authority, fallback requirements, and typed contracts.
5. **Prefer truth over implied certainty.** If scope, ownership, or runtime state is unclear, record that uncertainty and escalate. Do not let stale context, guessed file scope, or ambiguous routing masquerade as verified state.
6. **Treat repo memory as advisory retrieval, not authority.** Runtime `memoryContext` can surface useful prior decisions, but durable publication still requires review through `repo-memory/candidates/` before promotion into `repo-memory/promoted/`.
7. **Keep the turn-summary loop explicit.** When acting through repo agents, review the last 5 relevant operational summaries, emit a structured end-of-turn JSON summary, and let `Supervisor` consolidate child summaries into a task-level turn report.
8. **Make execution-ready plans cost-aware.** Any plan or micro-plan that is ready for implementation should end with a short model recommendation that balances quality, scope, complexity, and token efficiency.
9. **Apply execution discipline across lanes.** Use [`.github/skills/first-principles-velocity/SKILL.md`](./skills/first-principles-velocity/SKILL.md) so work names **hard constraints** before solution design where it matters, clarifies **vertical-slice ownership** when multiple surfaces are involved, prefers the **smallest validating proof** (tests and repo guardrails—without skipping migrations, auth, or review), records **removals or quarantines** when retiring paths, and **escalates blockers with evidence** (structured turns per [`.github/skills/orchestration-turn-reporting/SKILL.md`](./skills/orchestration-turn-reporting/SKILL.md), `turnStatus` when applicable). See also [`.github/ORCHESTRATION.md`](./ORCHESTRATION.md) *Execution discipline*.

## Delivery lanes

JoyJoin uses three delivery lanes.

| Lane | Use when | Required output |
|---|---|---|
| **Direct delivery** | The task is bounded, the affected surfaces are already known, and the implementation path is straightforward. | A compact micro-plan plus the implementation or doc change, and local validation appropriate to the risk. |
| **Kickoff lane** (`Researcher` -> `Planner`) | The task is broad, ambiguous, cross-workspace, architecture-shaping, or likely to branch into multiple specialists. | A verified research brief followed by an approval-first execution plan before implementation starts. |
| **Harness lane** (`Harness Runtime Controller`) | Engineering quality must be pre-validated against reliability, scalability, security, observability, maintainability; core engine changes; explicit Harness request. | A Harness consensus-locked plan with Sprint Contract, pillar verdicts, and explicit Harness Verification Gate before implementation. |
| **Operational lane** (`Auto-Eval`, `QA Agent`, `Launch Readiness Agent`, `Supervisor`) | The task is dominated by dirty-worktree review, release risk, regression investigation, launch readiness, or blocker routing. | Findings, verification evidence, and explicit go/no-go or next-step guidance. |

**Supervisor as a first hop:** You may invoke **`Supervisor` first** instead of `Researcher`. When the planning check implies the **kickoff lane** and there is no fresh research brief plus approval-ready plan already in context, Supervisor **sequences** `Researcher` → `Planner`—it does not replace them. For **direct delivery**, Supervisor routes to the narrowest specialist without running that sequence.

## Planning check

Every task begins with an explicit planning check.

- State the goal, likely file or surface scope, and intended validation path before editing.
- For bounded work, a micro-plan can be as small as 1-3 concrete steps.
- If the planning check exposes ambiguity, multiple plausible solution shapes, or cross-cutting impact, route through `Researcher` -> `Planner`.
- "Start coding and figure it out later" is out of policy even when the task looks small.

## Model recommendation for execution-ready plans

Any approval-first plan or direct-delivery micro-plan that is ready for implementation should end with `## Model Recommendation for Execution`.

Include:

- **Recommended Model:** The model name.
- **Justification:** 1-2 sentences covering complexity, scope size, list depth, and token load.
- **Estimated Premium Request Cost:** The cost multiplier in premium-request units.

Use these heuristics:

- **Task complexity:** More intricate logic, edge cases, or system-level changes should lean toward stronger models.
- **Scope size:** More files, more coordination, or broader impact should push the recommendation upward.
- **List or iteration depth:** Longer checklists or nested passes need more precision and should factor into the recommendation.
- **Expected token load:** Larger execution context or heavier reasoning should raise the model recommendation.

Use these model baselines — **canonical table:** [`.github/agents/MODEL_CATALOG.md`](./agents/MODEL_CATALOG.md).

## Division of responsibility: Planner vs Supervisor vs turn-report JSON

Use this split so model recommendations, routing, and persistence stay in the right layer.

| Concern | Owner | What to produce |
| --- | --- | --- |
| **Pre-execution planning** — steps, agents, dependencies, approval gates, deterministic checks | **`Planner`** (kickoff lane) or a **direct-delivery micro-plan** | Approval-first plan ending with **`## Model Recommendation for Execution`** (model name, justification, cost band). Same catalog as [`.github/agents/MODEL_CATALOG.md`](./agents/MODEL_CATALOG.md) and [`.github/agents/planner.agent.md`](./agents/planner.agent.md). |
| **Model choice for fresh delegation** — no up-to-date plan on file | **`Supervisor`** only when issuing a **new** delegation brief midstream | **`### Model Assignment`** block; must stay aligned with Planner’s catalog—do not invent a parallel table. |
| **Reusing a plan** | **`Supervisor`** (or implementer) | **Cite** the existing **`## Model Recommendation for Execution`** from the approved plan instead of re-selecting a model. |
| **Per-turn operational truth** — what each agent did | **Each agent** | **`agent_turn_summary`** JSON; `record-summary` when applicable. Optional **`turnStatus`**: `ready` \| `blocked` \| `done` (see orchestration-turn-reporting skill). |
| **Cross-agent consolidation** — insights across agents for the workflow | **`Supervisor`** | **`supervisor_turn_report`** JSON + visible note (**executive briefing**: Observation / Implication / Next Step / optional Bottom Line; **Turn status**; **Routing (pick one)** when applicable). See [`.github/skills/orchestration-turn-reporting/SKILL.md`](./skills/orchestration-turn-reporting/SKILL.md). **Does not** replace Planner’s plan or the policy model table. |
| **Durable skill or repo-memory updates** | **Humans / reviewed PRs** | Turn reports **do not** auto-edit `.github/skills/`; promote lessons through normal governance. |
| **Per-next-step execution model** (which model to use when **implementing** a listed handoff) | **`Supervisor`** | When **Routing (pick one)** lines include implementation work, add a **short model hint per step** (or at least for the highest-priority implementation step) using the **same catalog** as Planner—e.g. trivial follow-up → GPT-5 mini / GPT-5.4 mini; complex multi-file → Opus tier. **Planner** still owns the **approval-first plan**-level recommendation; Supervisor refines **routing-time** execution hints. |

**Do not** fork the canonical model catalog; if the pool of models or multipliers changes, update **[`.github/agents/MODEL_CATALOG.md`](./agents/MODEL_CATALOG.md)** in the same PR as **this policy**, **`planner.agent.md`**, and **`supervisor.agent.md`**.

## Threshold model

Every planning check should classify the work into one of four thresholds.

- **Minimal bounded addition** — stays inside one existing skill-owned boundary, one primary specialist, and one validation path. No new shared contract, sibling-platform review, or cross-domain ownership change is required.
- **Bounded refactor** — cleans up repeated exceptions or boundary drift inside one owned surface. It may touch several files, but it stays inside the same primary skill boundary and does not require a new execution lane.
- **Higher-level frontend revamp** — crosses app or shared UI boundaries, web or mini-program parity boundaries, route or loading architecture, or design-system rules across multiple frontend surfaces.
- **Higher-level backend revamp** — crosses route, domain, repository, or storage boundaries, shared API contracts, execution or state-integrity assumptions, or rollout and observability obligations across multiple server surfaces.

A task has crossed into a higher threshold when any of the following becomes true:

- The change now needs a new shared DTO, API contract, or sibling-platform review.
- The change no longer fits inside one owning skill boundary or one specialist lane.
- Validation now requires QA, launch review, or a dirty-worktree gate that was not part of the original plan.
- The fix is spreading through compatibility branches or repeated exceptions instead of staying local.

When a task crosses threshold, stop treating it as the original lane by inertia. Use `Supervisor` to reroute approved work, or reopen `Researcher` -> `Planner` if the new scope is still unclear.

## How to choose the lane

Use **direct delivery** when all of the following are true:

- The planning check classifies the work as a **minimal bounded addition** or **bounded refactor**.
- The task is small enough that the affected code or docs are obvious up front.
- The change does not need a new architecture decision before implementation.
- A single specialist or a single contributor can execute it without multi-stage routing.
- A compact plan can be stated before editing: what will change, what will be validated, and why kickoff planning is unnecessary.

Use the **kickoff lane** when any of the following are true:

- The planning check already classifies the work as a **higher-level frontend revamp** or **higher-level backend revamp**.
- The request spans multiple workspaces, domains, or contributor audiences.
- The work touches agents, skills, hooks, orchestration contracts, contributor policy, or shared platform governance.
- The user is asking for a plan, proposal, roadmap, or architectural recommendation before code changes.
- The task needs repo research, external references, or explicit ambiguity capture before implementation is safe.

Use the **operational lane** when any of the following are true:

- Auto-Eval is blocking guarded tools or a dirty worktree needs deterministic review.
- The request is primarily about validation, QA coverage, release blockers, or launch risk.
- The request is about repeated agent, skill, orchestration, hook, prompt, or repo-memory governance drift and the right outcome is a proposal-only reviewer packet; use `Workflow Governance Reviewer` in the audited support lane.
- The work needs incident-style triage, blocker routing, or remediation sequencing.

Use `Supervisor` inside the operational lane when the next move is rerouting rather than execution itself:

- The task needs to go back to `Researcher` or `Planner` because new ambiguity or scope drift appeared midstream.
- An approved task started as bounded work but crossed into a higher threshold and now needs a different specialist or validation path.
- The next best specialist is an audited support agent such as `debug`, `Expert React Frontend Engineer`, `Taro Mini-Program Frontend Engineer`, `Taro Migration Specialist`, or `Mini-Program Parity Auditor`.
- The work is branding-sensitive or crafted-polish UI delivery that should stay attached to existing frontend agents plus `design-system-governance`, `joyjoin-brand-guidelines`, and `wow-elements`, not a new branding-only or motion-only lane.

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

1. Start with the planning check: define scope, lane, and validation depth before editing.
2. Load the relevant skill or skills before making architectural or domain decisions.
3. End every execution-ready plan or micro-plan with a model recommendation and estimated premium-request cost.
4. Keep changes aligned with active-flow docs and current runtime ownership.
5. Update contributor-facing docs when workflow behavior, governance expectations, or canonical references change.
6. Validate the change at the right level for the risk: contract checks, targeted tests, QA review, launch review, or a combination.
7. Leave explicit findings when validation is partial; do not imply end-to-end confidence you did not establish.
8. Keep `.git/.orchestration/` operational-only. If the work produces a durable memory candidate, stage it into `repo-memory/candidates/` instead of treating runtime state as a publication surface.
9. Use the turn-reporting loop for agent work: read the last 5 relevant summaries from `.git/.orchestration/context.json`, emit a structured summary, and treat recorder acknowledgement as the persistence source of truth.

## Branch isolation and worktree safety

- Preferred default: perform implementation on a task-specific branch or isolated worktree.
- If work must happen in a dirty or shared worktree, keep the task scope narrow and preserve unrelated changes.
- Do not mix unrelated fixes, policy edits, and feature work into one branch or review packet unless the user explicitly wants a bundled change.
- Before handoff or review, identify which files belong to the current task and which changes pre-dated it.
- Branch isolation reduces review risk, but it does not replace `Auto-Eval`, local hooks, or GitHub workflows.

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

### Systematic expansion (agents and skills)

When you **do** extend the portfolio, follow a consistent sequence so capabilities stay coherent:

1. **Evidence** — Repeated real workflows that the current agent/skill set handles awkwardly (not one-off convenience).
2. **Skill first when the gap is rules** — New boundaries, placement, or invariants belong in **`.github/skills/`** with `routing.yml` and README index updates unless the gap is purely procedural.
3. **Agent when the gap is workflow** — New routing, handoffs, or role boundaries belong in **`.github/agents/`** with manifest + `orchestration.yaml` updates per [`.github/ORCHESTRATION_GOVERNANCE.md`](./ORCHESTRATION_GOVERNANCE.md).
4. **Contract + docs together** — Machine-readable graph and human docs must match the same change.
5. **Validation** — `npm run orchestration:validate`; for skills, `node scripts/validate-skill-routing.mjs` and `node scripts/test-skill-routing.mjs` where applicable.
6. **Model / policy tables** — If execution guidance changes, update **[`.github/agents/MODEL_CATALOG.md`](./agents/MODEL_CATALOG.md)**, **this file**, and **`planner.agent.md`** / **`supervisor.agent.md`** references in the same PR when the model catalog is affected.

### Custom orchestration outside the IDE

The in-repo graph (hooks, `Supervisor`, turn summaries) is **guidance and handoff**, not a peer-to-peer multi-agent runtime. You **can** add **custom orchestration** around it: e.g. CI jobs, `scripts/orchestration-supervisor.mjs`, scheduled workflows, or external runners that aggregate multiple human or API sessions—provided you keep **deterministic authority** and **repo-memory** rules in [`.github/ORCHESTRATION_GOVERNANCE.md`](./ORCHESTRATION_GOVERNANCE.md) and [`../docs/ai-agent-harness-separation-strategy.md`](../docs/ai-agent-harness-separation-strategy.md). New automation must not imply hidden autonomous execution without an explicit approval boundary.

## Working checklist

1. Perform the planning check, then pick the correct delivery lane.
2. Load the relevant skills.
3. If staying in direct delivery, write a compact micro-plan before coding.
4. End execution-ready plans with a model recommendation section.
5. Use `Researcher` -> `Planner` before coding if the task is broad or approval-first.
6. Keep runtime AI, repo orchestration, and product roadmap docs in their own lanes.
7. Validate at the right depth for the actual risk.
8. Escalate to QA or launch review when the change outgrows local confidence.