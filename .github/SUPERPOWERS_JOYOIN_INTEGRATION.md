# Superpowers + JoyJoin agents and skills (Cursor & Copilot)

This document explains how **Cursor Superpowers plugin skills** (e.g. brainstorming, systematic debugging, verification-before-completion) fit together with **JoyJoin’s repo-native** `.github/skills/`, **`.github/agents/`**, and **orchestration**—without duplicating or forking policy.

## Mental model: two complementary layers

| Layer | Where it lives | What it governs |
| --- | --- | --- |
| **JoyJoin skills** | `.github/skills/**` | **Product and engineering truth** for this repo: domains, boundaries, placement, review standards, orchestration reporting. **Single source of truth** for Copilot and for any assistant that reads the repo. |
| **JoyJoin agents** | `.github/agents/*.agent.md` | **Workflow roles** (Researcher, Planner, Supervisor, specialists) and handoffs. Same files power Copilot custom agents and Cursor subagent stubs under `.cursor/agents/`. |
| **Superpowers (Cursor plugin)** | Installed plugin skills (e.g. `~/.cursor/plugins/.../skills/`) | **Process and discipline**: when to brainstorm, how to debug systematically, TDD discipline, verification-before-completion, etc. **Cursor-only** unless you paste or summarize into chat elsewhere. |
| **Repo orchestration** | Hooks, `scripts/orchestration-supervisor.mjs`, `.git/.orchestration/` | **Deterministic** session context, kickoff hints, turn summaries—not a replacement for JoyJoin skills. |

**Do not** copy Superpowers skill bodies into `.github/skills/`. **Do** reference them from Cursor rules or personal workflow when a task benefits from process-first discipline.

## Recommended order (smooth integration)

1. **Planning check** — [`.github/AI_WORKFLOW_POLICY.md`](./AI_WORKFLOW_POLICY.md) (lane: direct, kickoff, operational).
2. **Optional (Cursor + Superpowers)** — If the task is **ambiguous or creative**, invoke relevant **Superpowers** skills **first** (e.g. brainstorming before implementation) per their skill priority rules.
3. **JoyJoin skill load** — Use [`.github/skills/README.md`](./skills/README.md) or `node scripts/skill-router.mjs "…"` for **domain** skills.
4. **Agent pick** — [`.github/agents/README.md`](./agents/README.md): for broad kickoff, either **`Supervisor` first** (sequences `Researcher` → `Planner` when needed) or `Researcher` → `Planner` directly; **`Supervisor`** also for approval or midstream rerouting; specialists by surface.
5. **Turn reporting** — When using repo agents with execute + recorder, follow [`.github/skills/orchestration-turn-reporting/SKILL.md`](./skills/orchestration-turn-reporting/SKILL.md).

**Copilot (VS Code)** does not load Cursor Superpowers. Use **JoyJoin skills + agents +** built-in **Plan** / **Agent** modes; process habits (brainstorming, etc.) must be **applied manually** or via instructions in **`.github/copilot-instructions.md`**.

## Cursor wiring

| Mechanism | Role |
| --- | --- |
| [`.cursor/rules/joyjoin-workflow.mdc`](../.cursor/rules/joyjoin-workflow.mdc) | Points to **canonical** `.github/` policy; keep short. |
| [`.cursor/rules/joyjoin-agents.mdc`](../.cursor/rules/joyjoin-agents.mdc) | When user names a persona (`Supervisor`, `Planner`, …), load matching `.github/agents/*.agent.md`. |
| [`.cursor/agents/*.md`](../.cursor/agents/) | Thin stubs (`/supervisor`, …) delegating to `.github/agents/`. |

Optional: add a **requestable** Cursor rule snippet that says: *“When Superpowers skills apply (brainstorming, debugging, verification), invoke them before large edits; still obey JoyJoin skills for domain.”* Avoid duplicating Superpowers text in-repo.

## Long-term memory and “skill iteration” (three different things)

| Mechanism | Purpose |
| --- | --- |
| **JoyJoin `repo-memory/`** | **Durable, reviewable** project memory (promotion pipeline, conflicts with `.git/.orchestration/` advisory state). See `repo-memory/README.md`. |
| **Orchestration turn summaries** | **Last-N-turn** operational loop under `.git/.orchestration/` for agent workflow improvement—not general knowledge base. |
| **MCP: `@adamrdrew/agent-memory-mcp`** (optional in `.mcp.json`) | **Local** agent memory store (embeddings / search) for the **IDE agent**; gitignored under `.joyjoin/`. Complements but does **not** replace `repo-memory` publication rules. |
| **MCP: Hermes `hermes mcp serve`** | **Hermes messaging/session** bridge (conversations, channels, events)—**not** JoyJoin repo memory. See [`.github/AI_TOOLING_UNIFIED_BRAIN.md`](./AI_TOOLING_UNIFIED_BRAIN.md). |

**Automated skill iteration** in the JoyJoin sense means: **explicit turn JSON**, **Supervisor consolidation**, **last-five summaries**, and **governance** (`ORCHESTRATION_GOVERNANCE.md`)—not automatic rewriting of `.github/skills/` without human review.

## Hermes CLI and Cursor (PATH)

Tracked [`.mcp.json`](../.mcp.json) uses `"command": "hermes"`. The binary must be on the **environment PATH** Cursor inherits.

- If MCP fails to start Hermes on **macOS** (GUI app), `hermes` may be missing from PATH even when it exists at `~/.local/bin/hermes`. **Fix:** add `export PATH="$HOME/.local/bin:$PATH"` to the environment Cursor launches with, **or** use a **user-level** MCP override with the **full path** to `hermes` (do not commit machine-specific paths to the repo).

Install / upgrade: [Hermes installation](https://hermes-agent.nousresearch.com/docs/getting-started/installation).
