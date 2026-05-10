---
name: omo-orchestration-bridge
description: >-
  Bridge Oh My OpenAgent (OMO) discipline-agent workflows into Kimi Code CLI.
  Maps OMO commands (ultrawork, /start-work, resume boulder) to Kimi-native
  Agent tool orchestration using existing .github/agents/ definitions and
  .sisyphus/ boulder state. Triggers: ultrawork, /start-work, resume boulder,
  omo, atlas, prometheus, sisyphus, oracle, team mode, parallel agents,
  boulder workflow, plan execution.
---

# omo-orchestration-bridge

**Core rule:** OMO is an OpenCode plugin; Kimi Code CLI is a different runtime. This skill translates OMO patterns into Kimi-native actions using the Agent tool, existing `.github/agents/` definitions, and `.sisyphus/` state. No OpenCode installation required.

## When to use this skill

- User says `ultrawork`, `/start-work`, `resume boulder`, or any OMO trigger phrase
- Need to run Prometheus-style planning before implementation
- Need Atlas-style task delegation to specialist subagents
- Need parallel discipline agents (Team Mode emulation)
- Need Oracle-style compliance verification against a plan
- Need to read or update `.sisyphus/boulder.json` state

## When NOT to use this skill

- Simple single-file edits → use Direct delivery, no OMO overhead
- OpenCode-specific features (hash-anchored edits, LSP tools) → unavailable in Kimi

## OMO-to-Kimi mapping

| OMO Pattern | Kimi Equivalent |
|-------------|-----------------|
| `ultrawork` / `ulw` | Skill trigger → IntentGate classification → auto-orchestrate |
| Prometheus (planner) | `Agent` with `subagent_type="plan"` reading `.github/agents/prometheus.agent.md` |
| Atlas (work manager) | Primary agent reads plan + `boulder.json`, delegates via `Agent` tool |
| Sisyphus (task worker) | `Agent` with `subagent_type="coder"` and full task spec |
| Oracle (auditor) | `Agent` with `subagent_type="explore"` doing read-only verification |
| Team Mode (parallel) | Multiple `Agent` calls with `run_in_background=true` |
| IntentGate | Pre-flight: classify intent as research / implement / investigate / fix |
| Todo Enforcer | Primary agent uses `SetTodoList` + idle-check before every delegation |
| Ralph Loop | Self-referential: after subagent returns, ask "is this 100% done?" |

## Trigger quick-reference

| Trigger | Kimi Action |
|---------|-------------|
| `ultrawork` / `ulw` | Classify intent → plan → delegate → execute → audit |
| `/start-work` | Prometheus generates plan → Momus reviews → Atlas delegates |
| `resume boulder` | Read `boulder.json` → find next pending → delegate |
| `atlas` | Primary agent plays work manager role |
| `prometheus` | Spawn `plan` subagent to generate `.sisyphus/plans/` |
| `sisyphus` | Spawn `coder` subagent with full task spec |
| `oracle` | Spawn `explore` subagent for read-only compliance audit |
| `team mode` | Launch ≤4 parallel `Agent` calls with `run_in_background=true` |

## Quick examples

- **Start a new boulder**: Read `.github/agents/prometheus.agent.md` → generate plan → save to `.sisyphus/plans/` → init `boulder.json` → delegate Task 1 to Sisyphus subagent.
- **Resume existing boulder**: Read `.sisyphus/boulder.json` → find next unchecked task → delegate to Sisyphus with full spec from plan.
- **Run Oracle audit**: Read plan → compare completed tasks against acceptance criteria → search for Must NOT Have violations → report APPROVE/REJECT per task.

## Troubleshooting

**"OMO plugin not found"**
OMO cannot be installed as a plugin in Kimi Code CLI. Use this skill instead — it provides the same workflow patterns via Kimi-native tools.

**Subagent loses context between tasks**
Use `resume` with the same `agent_id` instead of creating fresh subagents. Append session IDs to `boulder.json.session_ids`.

**Plan file is stale after edits**
Only mark checkboxes (`- [x]`) in plan files. Never rewrite task specs during execution — update `boulder.json` state instead.

**Parallel agents overload context**
Team Mode emulation uses background agents. Limit to 3-4 parallel subagents. Use `TaskOutput` to poll results.

**Intent misclassification**
When ambiguous, default to Prometheus planning (kickoff lane) rather than Direct delivery.

## Review checklist

Before completing an OMO-bridged task:

- [ ] `boulder.json` state matches actual progress
- [ ] Plan checkboxes reflect completed work
- [ ] Evidence files saved to `.sisyphus/evidence/`
- [ ] Subagent sessions resumed (not recreated) for follow-ups
- [ ] Oracle audit run for Tier 2+ work before sign-off
- [ ] Ralph Loop check performed: "Is this 100% done?"
- [ ] All parallel subagents terminated or completed

## Related files

- [references/agent-registry.md](references/agent-registry.md) — Agent-to-subagent mapping and prompt templates
- [references/boulder-protocol.md](references/boulder-protocol.md) — `boulder.json` schema, plan format, state rules
- [references/discipline-workflows.md](references/discipline-workflows.md) — Full Prometheus→Atlas→Sisyphus→Oracle workflows
- `.github/agents/` — Canonical agent definitions (source of truth)
- `.sisyphus/` — Boulder state, plans, evidence directory
