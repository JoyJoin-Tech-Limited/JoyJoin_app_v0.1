# Utilization Ledger & Mapping

## Utilization ledger (optional JSON; recommended)

Include **`utilization`** on both `agent_turn_summary` and `supervisor_turn_report` when you can name how work broke down.

- **`utilization`:** array (max **30** rows per turn after normalization) of objects:
  - **`task`** — short label for the slice of work (e.g. "Pool API validation").
  - **`agents`** — JoyJoin agent names that **owned or executed** that slice this turn (e.g. `Backend Engineer`, `Researcher`). Use the names from [`.github/agents/manifest.json`](../../agents/manifest.json).
  - **`skills`** — repo skill ids from [`.github/skills/`](../) that were **actively applied** for that slice (e.g. `server-domain-architecture`, `first-principles-velocity`). Use **skill folder names**, not file paths.

**Supervisor:** When consolidating multiple children, either **merge** into one row per thematic task or **list** rows per child handoff—whichever makes gaps clearer. Prefer **skills** you know were co-loaded or decisive for the task, not every skill bound to the agent.

**Visible note:** Add a short **Utilization** subsection (bulleted table or compact list) when `utilization` is non-empty so humans see agent/skill coverage without opening JSON.

## Mapping (authoring aid)

| Briefing section | Typical JSON sources |
| --- | --- |
| Observation | `done`, key `decisions`, `learned`, `filesChanged` (plain descriptions) |
| Implication / Context | `blockers`, `unresolvedAssumptions`, `confidence.reason`, cross-agent context |
| Next Step | `nextSteps` buckets, `nextTurnImprovements`, or narrative next actions |
| Bottom Line | One-line synthesis of confidence + blockers + priority |
| **Utilization** (optional heading in visible note) | Summarize **`utilization`** rows: which **tasks** used which **agents** and **skills**—supports gap analysis |
