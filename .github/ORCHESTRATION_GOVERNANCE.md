# JoyJoin Orchestration Governance

**Status:** Active governance reference  
**Last updated:** 2026-04-14  
**Scope:** How JoyJoin changes agents, skills, hooks, orchestration contracts, and workflow-validation surfaces

## Purpose

This document governs changes to the repo's AI-assisted workflow system.

Use it when modifying any of the following:

- `.github/agents/`
- `.github/skills/`
- `.github/orchestration.yaml`
- `.github/ORCHESTRATION.md`
- `.github/hooks/README.md`
- `repo-memory/`
- `.github/copilot-instructions.md`
- orchestration, auto-eval, and repo-memory runtime scripts under `scripts/`
- validation or regression tests that lock in orchestration behavior

This is a governance document, not a runtime-product AI architecture document. For shipped product AI behavior and invariants, use [`../docs/ai-agent-harness-separation-strategy.md`](../docs/ai-agent-harness-separation-strategy.md). For contributor workflow policy, use [`AI_WORKFLOW_POLICY.md`](./AI_WORKFLOW_POLICY.md).

## Governance principles

1. **Keep the core graph small.** The default orchestration graph should stay understandable to contributors and auditable in docs. Audited support agents should remain outside the forced handoff graph until the need is proven.
2. **Skills define boundaries.** Agents may recommend workflows, but stable architectural and domain rules belong in skills and canonical docs.
3. **Change the contract and the docs together.** If behavior changes in the machine-readable contract or runtime scripts, the human-readable docs and discovery surfaces must move in the same change.
4. **Prefer documented policy before automation.** Do not add a new deterministic guard or automatic routing behavior until the expected workflow is already written down and socially legible.
5. **Runtime state must stay truthful.** Advisory orchestration state may be incomplete, but it must not overstate certainty or preserve stale recommendations as if they were current truth.
6. **Promotion requires evidence.** New agents, new skills, or deeper handoffs need repeated workflow value, explicit ownership, and sufficient tooling support.

## Governed surfaces

| Surface | Source of truth | Notes |
|---|---|---|
| Agent portfolio | `.github/agents/*.agent.md` or existing legacy agent files | Frontmatter is the discovery contract. |
| Agent inventory | `.github/agents/manifest.json` | Lightweight registry used for audits and validation. |
| Native orchestration contract | `.github/orchestration.yaml` | Machine-readable handoff graph, hook config, skill bindings, and tooling audit. |
| Human-readable orchestration guide | `.github/ORCHESTRATION.md` | Contributor-facing explanation of the current graph and runtime surfaces. |
| Contributor workflow policy | `.github/AI_WORKFLOW_POLICY.md` | Lane selection, escalation rules, and approval boundaries. |
| Governance rules | `.github/ORCHESTRATION_GOVERNANCE.md` | This document. |
| Hook behavior docs | `.github/hooks/README.md` | Explains what runs and how hooks behave. |
| Durable repo memory | `repo-memory/README.md`, `repo-memory/candidates/README.md`, `repo-memory/promoted/`, `repo-memory/generated/` | Reviewable memory plane outside `.git`; publication remains explicit and fail-closed. |
| Shared contributor instructions | `.github/copilot-instructions.md` | Entry-point guidance for contributors and Copilot. |
| Runtime implementation | `scripts/orchestration-supervisor.mjs`, `scripts/orchestration-lib.mjs`, `scripts/memory-*.mjs`, `scripts/auto-eval*.mjs` | Deterministic behavior must match the documented contract. |
| Regression coverage | orchestration-related tests in `apps/server/src/__tests__/` and `scripts/` validators | Lock in behavior that contributors depend on. |

## Change types and required sync

| Change type | Required updates | Minimum validation |
|---|---|---|
| Add or materially change an agent | Agent file, `.github/agents/README.md`, `manifest.json`, and `orchestration.yaml` when handoffs, skill links, or audit status change | `npm run orchestration:validate` |
| Add or materially change a skill | Skill `SKILL.md`, routing metadata, `.github/skills/README.md`, and routing validation coverage | `node scripts/validate-skill-routing.mjs` and `node scripts/test-skill-routing.mjs` |
| Change the handoff graph, kickoff behavior, or tooling sufficiency status | `.github/orchestration.yaml`, `.github/ORCHESTRATION.md`, and any impacted agent docs or contributor guidance | `npm run orchestration:validate` and targeted hook/runtime checks |
| Change orchestration or auto-eval hook behavior | Runtime scripts, `.github/hooks/README.md`, `.github/ORCHESTRATION.md`, and contributor-facing guidance when behavior changes are visible to users | `npm run orchestration:validate` and targeted hook/runtime checks |
| Change repo-memory retrieval or publication flow | `.github/orchestration.yaml`, `.github/ORCHESTRATION.md`, `repo-memory/README.md`, `repo-memory/candidates/README.md`, and the relevant runtime scripts/tests | `npm run memory:validate`, `npm run memory:build-index`, `npm run orchestration:validate`, and targeted hook/runtime checks |
| Change contributor workflow policy | `.github/AI_WORKFLOW_POLICY.md`, affected entrypoint docs, and any governance references that would otherwise drift | Review for policy consistency |
| Change governance rules | This file plus any linked discovery docs whose expectations change as a result | Review for contract and policy consistency |

## Proposal flow

Use this sequence for any non-trivial workflow-governance change.

1. **Research the current state.** Start from the active contract, README surfaces, and any existing validation tests.
2. **Decide whether the work is policy, contract, or implementation.** Many changes touch more than one layer; be explicit about which layer is authoritative.
3. **Plan first when the change is broad.** Use `Researcher` -> `Planner` for cross-cutting orchestration, governance, or portfolio work.
4. **Edit the contract and the docs together.** Avoid landing machine-readable changes that leave contributor-facing docs inaccurate.
5. **Validate deterministically.** Run the validation commands that match the surfaces you changed.
6. **Review against the Harness framework.** Reliability, scalability, security, observability, maintainability, and regression risk still apply to workflow infrastructure.

## Promotion policy for new agents

An agent may move into the core handoff graph only when all of the following are true:

- The repo has repeated evidence that the workflow is frequent enough to justify native visibility.
- The upstream and downstream handoff boundaries are clear and documented.
- The agent has explicit skill links or a justified reason to stay skill-light.
- The tooling sufficiency status is at least `sufficient`, or a written extension plan exists and the graph still remains safe without it.
- The machine-readable contract, human-readable docs, and validation surfaces have all been updated together.

If those conditions are not met, keep the agent in the audited support portfolio.

## SelfIteration boundary

`SelfIteration` is an audited support agent, not part of the core handoff graph.

- It is proposal-only and user-invocable, not a background scheduler.
- It has no merge authority.
- It has no durable memory publication authority.
- It cannot change its own approval boundaries autonomously.
- Any reviewed memory draft still follows the normal path: `npm run memory:stage-candidate` -> human review -> `npm run memory:promote`.

## Creation policy for new skills

Create a new skill only when all of the following are true:

- The repo has recurring domain decisions that are not already covered by existing skills or canonical docs.
- The ownership boundary is stable enough to describe clearly.
- The skill can define concrete triggers, examples, troubleshooting notes, and a review checklist.
- Routing metadata can be written precisely enough that the skill will be discoverable for the right asks and quiet for the wrong ones.

If the need is narrow and orchestration-specific, prefer documenting the rule first and wait for repeated evidence before adding a dedicated skill.

## Truthful runtime-state rule

The orchestration runtime under `.git/.orchestration/` is advisory state, not product data. Governance changes must preserve that distinction.

- If current scope cannot be derived truthfully, record it as unknown rather than backfilling with misleading context.
- Recommendation state should clear when follow-up prompts narrow the task enough that the earlier broad recommendation is no longer true.
- `memoryContext` inside `.git/.orchestration/context.json` is advisory retrieval state only; durable memory publication still lives under `repo-memory/`.
- `turnSummaryState` inside `.git/.orchestration/context.json` is operational workflow state only; keep it bounded to compact last-5 projections instead of unbounded transcript history.
- Full turn-summary entries belong in `.git/.orchestration/events.jsonl`; the bounded context cache is for active-session refinement, not archival truth.
- When repo-memory hits are stale against the configured validation-age threshold or conflict with current workflow-relevant changed paths, `memoryContext` should surface that as advisory caution rather than clean guidance.
- Dirty-worktree and changed-file summaries must describe the actual current state, not a convenient historical approximation.
- Stateful behavior should be covered by tests, not only by dry-run validations with runtime writes disabled.

## Validation expectations

Minimum commands for orchestration-governance work:

```bash
npm run memory:validate
npm run memory:build-index
npm run orchestration:validate
env ORCHESTRATION_DISABLE_RUNTIME_WRITES=1 node scripts/orchestration-supervisor.mjs record-summary --json '{"type":"agent_turn_summary","agentName":"Supervisor","done":["example"],"filesChanged":[],"decisions":[],"blockers":[],"learned":["example"],"nextTurnImprovements":["tighten scope"],"nextSteps":{"bugFix":[],"enhancement":[],"validation":[]},"confidence":{"score":0.5,"reason":"example"},"unresolvedAssumptions":[]}'
env ORCHESTRATION_DISABLE_RUNTIME_WRITES=1 node scripts/orchestration-supervisor.mjs copilot-hook user-prompt-submit <<< '{"prompt":"Add a new API endpoint with caching"}'
node scripts/orchestration-supervisor.mjs workflow pull-request
node scripts/auto-eval.mjs --mode manual-report
```

Add targeted tests when the change affects persisted context, hook behavior, or cross-registry invariants.

## Review checklist

- The change keeps the core graph small and legible.
- Skills remain the stable source of domain boundaries.
- The machine-readable contract and human-readable docs stay in sync.
- Runtime state remains truthful and testable.
- Tooling sufficiency claims still match reality.
- Validation covers the surfaces that were actually changed.