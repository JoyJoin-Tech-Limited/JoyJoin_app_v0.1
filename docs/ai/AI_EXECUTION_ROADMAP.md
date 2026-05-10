# JoyJoin AI Execution Roadmap

> **Status:** Active 30-60-90 engineering roadmap  
> **Last updated:** 2026-04-13  
> **Scope:** Repo-level AI delivery workflow, orchestration validation, and operational readiness

## Document relationships

This roadmap is about **how JoyJoin executes AI-assisted engineering work**, not about user-facing AI capability sequencing.

| Document | Role |
|---|---|
| **`AI_EXECUTION_ROADMAP.md`** (this file) | 30-60-90 execution roadmap for policy, governance, validation, and tooling improvements around AI-assisted delivery. |
| [`AI_INTEGRATION_PLAN.md`](./AI_INTEGRATION_PLAN.md) | Product AI roadmap for shipped and planned user-facing AI capabilities. |
| [`ai-agent-harness-separation-strategy.md`](./ai-agent-harness-separation-strategy.md) | Current-state runtime AI architecture and invariants. |
| [`../.github/AI_WORKFLOW_POLICY.md`](../.github/AI_WORKFLOW_POLICY.md) | Active contributor policy for choosing lanes and escalation paths. |
| [`../.github/ORCHESTRATION_GOVERNANCE.md`](../.github/ORCHESTRATION_GOVERNANCE.md) | Governance rules for changing agents, skills, hooks, and orchestration surfaces. |

## Strategic goal

Over the next 90 days, JoyJoin should make AI-assisted delivery more reliable without expanding the default agent graph prematurely.

The target state is:

- contributor workflow is explicit and easy to choose
- orchestration state is truthful and test-covered
- verification and release agents have better operational evidence
- portfolio growth happens only when repeated workflow demand justifies it

## What this roadmap is deliberately not

- It is **not** approval to ship new runtime AI product features.
- It is **not** a request to grow the core handoff graph immediately.
- It is **not** a justification for creating orchestration-specific skills before there is repeated evidence that they are needed.

## 0-30 days: Stabilize policy and state truthfulness

**Primary objective:** Convert recent orchestration work from "implemented and promising" to "clearly governed and less misleading under edge cases."

### Deliverables

1. Publish the contributor policy and governance docs under `.github/`.
2. Publish this execution roadmap and wire all three documents into the existing discovery surfaces.
3. Tighten the kickoff recommendation heuristic so the runtime behavior matches the documented contract more closely.
4. Remove or narrow any changed-file fallback that can present historical scope as current dirty-worktree truth.
5. Define clearing rules for persisted kickoff recommendation state when the prompt narrows or the session context changes.

### Owners

- Platform or workflow owner for policy and orchestration logic
- Backend maintainer for runtime-script changes
- Repo maintainer for contributor-surface updates

### Exit criteria

- Contributors can find the policy, governance, and roadmap docs from the main entrypoint docs.
- The kickoff recommendation behavior no longer depends on a coarse fallback that is broader than the written contract.
- Persisted orchestration context does not imply stale scope is current truth.

## 31-60 days: Add deterministic regression coverage

**Primary objective:** Make the orchestration layer testable enough that policy and docs are backed by real guardrails.

### Deliverables

1. Add stateful tests for `SessionStart`, `UserPromptSubmit`, persisted context updates, and recommendation clearing.
2. Expand validation so cross-registry invariants are checked explicitly across agent files, `manifest.json`, and `.github/orchestration.yaml`.
3. Add a contributor-facing review template or checklist for promoting an audited support agent into the core graph.
4. Document which orchestration behaviors are guaranteed by tests versus advisory by policy only.

### Owners

- Backend maintainer for hook and runtime tests
- Repo maintainer for validation scripts and docs
- QA or workflow owner for promotion-checklist review

### Exit criteria

- Stateful orchestration behavior is covered by regression tests rather than only dry-run checks.
- Contract validation can catch obvious graph or registry drift before contributors discover it manually.
- Promotion into the core graph requires written evidence instead of informal judgment.

## 61-90 days: Improve operational completeness before expanding the graph

**Primary objective:** Raise the quality of the operational lane before considering more native handoffs.

### Deliverables

1. Improve `QA Agent` support with a more stable end-to-end or browser-driven verification surface.
2. Improve `Launch Readiness Agent` support with better CI-status and observability inputs where practical.
3. Reassess `Admin Operations Advisor` and other audited support agents only after the operational evidence surface improves.
4. Decide whether any orchestration-specific skill is justified from observed workflow repetition. The default assumption remains "probably not yet."

### Owners

- QA or platform owner for browser and flow-validation improvements
- Release or infra owner for CI and observability integrations
- Repo maintainer for portfolio audit and follow-up decisions

### Exit criteria

- Risky changes can be reviewed with stronger evidence than shell-only checks.
- Launch readiness has enough operational context to do more than local file review.
- Any proposal to expand the core graph is backed by measured workflow need, not novelty.

## Success signals

By the end of the 90-day window, the repo should be able to demonstrate the following:

- No known stale-kickoff recommendation paths remain untested.
- Contributor-facing workflow docs point to one another cleanly and do not contradict the contract.
- Governance changes routinely update docs, contract files, and validation surfaces together.
- New agent or skill proposals come with evidence of repeated demand and a clearer ownership story.

## Risks to watch

| Risk | Why it matters | Mitigation |
|---|---|---|
| Expanding the graph too early | More native handoffs create cognitive load before the current operational lane is fully credible. | Keep the graph small until QA and launch surfaces are stronger. |
| Stale advisory state | Contributors may over-trust the runtime context if it presents old scope as current truth. | Favor explicit unknown state and add stateful regression coverage. |
| Policy drift from implementation | Docs lose authority if runtime behavior changes without synchronized updates. | Treat contract, docs, and validation as one change set. |
| Skill sprawl | Too many narrowly scoped skills reduce routing quality and create duplicate rules. | Add skills only after repeated evidence and stable boundaries. |

## Near-term decision rule

For the next quarter, JoyJoin should default to this sequence:

1. Strengthen policy and governance clarity.
2. Fix truthfulness and test gaps in the orchestration runtime.
3. Improve QA and launch tooling.
4. Only then decide whether the portfolio or handoff graph should grow.