# Contributor agent harness (JoyJoin)

There is no single executable binary that runs “the agent” for contributor workflows. Instead, a **layered harness** ties behavior together:

| Layer | Location | Role |
| --- | --- | --- |
| **Skills** | `.github/skills/`, optional `.cursor/skills/` | Domain rules, review lenses, [orchestration turn reporting](./skills/orchestration-turn-reporting/SKILL.md), [first-principles velocity](./skills/first-principles-velocity/SKILL.md) (critical path + [model catalog](./agents/MODEL_CATALOG.md)) |
| **Agents** | `.github/agents/*.md` | Personas, constraints, handoffs — index: [`agents/README.md`](./agents/README.md) |
| **Orchestration** | [`orchestration.yaml`](./orchestration.yaml), [`ORCHESTRATION.md`](./ORCHESTRATION.md), `scripts/orchestration-supervisor.mjs`, `record-summary`, `.git/.orchestration/` | Graph, normalization, session persistence |
| **Hooks** | `.cursor/hooks.json`, `.github/hooks/` | Session / prompt / post-tool entrypoints into supervisor tooling |
| **Policy** | [`AI_WORKFLOW_POLICY.md`](./AI_WORKFLOW_POLICY.md), [`copilot-instructions.md`](./copilot-instructions.md) | Lanes, review expectations |
| **Doc refresh playbook** | [`../docs/ai/ai-workflow-documentation-refresh.md`](../docs/ai/ai-workflow-documentation-refresh.md) | Coordinated updates across product docs, skills, agents, and orchestration (lanes, `docs-sync`, validation) |

**Product / runtime AI** (icebreaker, match explanation, LLM-backed features) uses separate patterns. See [`docs/ai-agent-harness-separation-strategy.md`](../docs/ai-agent-harness-separation-strategy.md) — not the same stack as contributor orchestration.

**Turn narrative (chat-visible):** [`agents/AGENT_TURN_VISIBLE_FORMAT.md`](./agents/AGENT_TURN_VISIBLE_FORMAT.md).

**Unified tooling context:** [`AI_TOOLING_UNIFIED_BRAIN.md`](./AI_TOOLING_UNIFIED_BRAIN.md).
