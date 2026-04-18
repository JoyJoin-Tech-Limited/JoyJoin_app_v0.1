# Cursor subagents (custom agents)

In Cursor, **custom agents are [subagents](https://cursor.com/docs/agent/subagents)**. There is no separate top-level “Custom agents” menu; they show up when **Agent** runs the **Task** tool and when you invoke them with `/name` in the Agent input.

## Enable nested subagents

This repo’s [`.vscode/settings.json`](../../.vscode/settings.json) sets `chat.subagents.allowInvocationsFromSubagents` to **true** so one subagent can delegate to another (Planner / Supervisor-style flows).

If that still fails: **Cursor → Settings** → search `subagent`, ensure the workspace is **trusted**, then reload the window. You can mirror the same key in **User** `settings.json` if needed.

## Where definitions live

| Location | Purpose |
|----------|---------|
| **`.cursor/agents/*.md`** | Cursor-native subagents (YAML frontmatter + body). Kickoff lane: `researcher.md`, `planner.md`; routing: `supervisor.md`. |
| **`~/.cursor/agents/*.md`** | Your personal subagents (all projects). |
| **[`.github/agents/`](../.github/agents/)** | Full JoyJoin Copilot-style personas; use those files as the source of truth or via thin pointers here. |

## How to use

1. Open **Chat** in **Agent** (Composer Agent mode).
2. Run **`/supervisor`**, **`/researcher`**, **`/planner`**, **`/verifier`**, **`/backend-engineer`**, or another `name` from a file in this folder (e.g. `.cursor/agents/supervisor.md`), or ask naturally to use that subagent.
3. Repo-wide personas also live under `.github/agents/*.agent.md`; Cursor stubs here can point at those files (see `supervisor.md`, `researcher.md`, `planner.md`, `backend-engineer.md`).
4. See [Subagents](https://cursor.com/docs/agent/subagents) for `/name`, parallel runs, and model options.

### Cursor vs Claude Code agent files

- **Supported in `.cursor/agents/*.md` frontmatter** (per [Cursor subagents](https://cursor.com/docs/agent/subagents)): `name`, `description`, `model`, `readonly`, `is_background`. Use **`.github/agents/*.agent.md`** for the full JoyJoin persona; keep Cursor stubs thin.
- **Not the same as Claude Code’s** subagent extras (`skills:` / `memory` / hook blocks in the agent markdown): those are **Claude Code** features. JoyJoin **skills** still live under `.github/skills/` and `.cursor/skills/` and are loaded by Cursor’s [Skills](https://cursor.com/docs/context/skills) mechanism—not by preloading into a subagent YAML list here.

### Model field and cost

- **`model: inherit`** (default): Same model as the parent Agent session—use when the subagent needs **full** reasoning (e.g. Supervisor routing).
- **`model: fast`**: Smaller/faster model—good for search, verification, high-volume narrow tasks; Cursor documents this as **cost-efficient** for those workloads.
- **Specific model ID**: When you need a fixed capability regardless of parent.

**Token usage:** Each subagent has its **own** context and token meter; parallel subagents multiply total usage. Choosing `fast` for shallow subagents reduces **their** per-call cost; it does not change the fact that parent + child each consume tokens. See [Performance and cost](https://cursor.com/docs/agent/subagents#performance-and-cost) in Cursor’s docs.

### Kickoff lane (`Researcher` → `Planner`)

- **`/researcher`** → `.cursor/agents/researcher.md` → **`.github/agents/researcher.agent.md`**. Enriched stub: first-principles habits + **executive briefing** skeleton for visible notes + research brief spine.
- **`/planner`** → `.cursor/agents/planner.md` → **`.github/agents/planner.agent.md`**. Enriched stub: five themes / constraints + **`## Model Recommendation for Execution`** + executive briefing skeleton.

For **broad / unclear** work you may run **`/researcher`** then **`/planner`**, or **`/supervisor` first** (it can sequence the same when kickoff applies — see `.github/AI_WORKFLOW_POLICY.md`).

### Supervisor

- **Entry:** **`/supervisor`** → `.cursor/agents/supervisor.md` → full contract in **`.github/agents/supervisor.agent.md`**. Enriched stub: critical-path habits + **Turn status** + **Routing (pick one)** visible-note skeleton.
- For **midstream rerouting** after kickoff, use **`/supervisor`** when the next move is coordination across specialists rather than more research/planning.

### Verifier

- Thin entry: **`/verifier`** → `.cursor/agents/verifier.md` (`model: fast`) → full persona in **`.github/agents/verifier.agent.md`**.
- Use for a **skeptical completion pass** after something is marked done (targeted tests/commands). **GitHub Copilot / VS Code** loads **`verifier.agent.md`** from `.github/agents/` the same way as other custom agents—no `model` field there; Cursor uses the stub’s **`fast`** default for cost-efficient runs.
