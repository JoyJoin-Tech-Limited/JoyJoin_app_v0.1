# Cursor subagents (custom agents)

In Cursor, **custom agents are [subagents](https://cursor.com/docs/agent/subagents)**. There is no separate top-level “Custom agents” menu; they show up when **Agent** runs the **Task** tool and when you invoke them with `/name` in the Agent input.

## Enable nested subagents

This repo’s [`.vscode/settings.json`](../../.vscode/settings.json) sets `chat.subagents.allowInvocationsFromSubagents` to **true** so one subagent can delegate to another (Planner / Supervisor-style flows).

If that still fails: **Cursor → Settings** → search `subagent`, ensure the workspace is **trusted**, then reload the window. You can mirror the same key in **User** `settings.json` if needed.

## Where definitions live

| Location | Purpose |
|----------|---------|
| **`.cursor/agents/*.md`** | Cursor-native subagents (YAML frontmatter + body). |
| **`~/.cursor/agents/*.md`** | Your personal subagents (all projects). |
| **[`.github/agents/`](../.github/agents/)** | Full JoyJoin Copilot-style personas; use those files as the source of truth or via thin pointers here. |

## How to use

1. Open **Chat** in **Agent** (Composer Agent mode).
2. Run **`/backend-engineer`** (or another `name` from frontmatter) or ask naturally to use that subagent.
3. See [Subagents](https://cursor.com/docs/agent/subagents) for `/name`, parallel runs, and model options.
