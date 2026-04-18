# Unified AI tooling brain (Cursor + GitHub Copilot)

This document defines **one shared source of truth** for skills, agents, and contributor policy, explains **how MCP (Context7) is wired per IDE**, and records an **assessment** of Cursor-specific files versus Copilot-only usage.

## Shared brain (canonical locations)

Treat these paths as the **only** policy sources for *what* to build and *how* reviews and boundaries work. Both Cursor and GitHub Copilot should defer here; IDE-specific files only add *how the editor runs hooks and loads MCP*.

| Layer | Location | Role |
| --- | --- | --- |
| Contributor harness (conceptual) | [`.github/CONTRIBUTOR_AGENT_HARNESS.md`](./CONTRIBUTOR_AGENT_HARNESS.md) | How skills, agents, orchestration, hooks, and policy form the contributor workflow stack (not a single binary) |
| Contributor + Copilot chat instructions | `.github/copilot-instructions.md` | Default instructions for GitHub Copilot in this repo; **canonical** narrative for skills, agents, orchestration, PR review |
| Skills (rules by domain) | `.github/skills/**/*.md` | Index: `.github/skills/README.md` — routing metadata: `.github/skills/*/routing.yml` |
| Custom agents (workflows) | `.github/agents/*.agent.md` | Index: `.github/agents/README.md`; manifest: `.github/agents/manifest.json` |
| Orchestration contract | `.github/orchestration.yaml` + `.github/ORCHESTRATION.md` | Graph, tooling audit, session semantics |
| Planning policy | `.github/AI_WORKFLOW_POLICY.md` | Direct delivery vs kickoff vs operational lane |
| Skill router (ambiguous tasks) | `node scripts/skill-router.mjs "…"` | Deterministic skill hint from ask + optional paths |

**Do not fork** skills or agents into a second copy under `.cursor/` or `.vscode/`. Keep a single definition tree under `.github/`.

**Cursor Superpowers + JoyJoin:** See [`.github/SUPERPOWERS_JOYOIN_INTEGRATION.md`](./SUPERPOWERS_JOYOIN_INTEGRATION.md) for how plugin **process** skills (Superpowers) combine with repo **domain** skills and agents without duplicating content.

## Cursor-specific glue (what persists and why)

| Artifact | Purpose | Keep? |
| --- | --- | --- |
| `.cursor/rules/*.mdc` | Binds Cursor Agent to repo paths (`alwaysApply`, `agent_requestable`) — thin **pointers** to `.github/` | **Yes.** Cursor reads these; Copilot does not. They should stay **short** and reference canonical docs. |
| `.cursor/hooks.json` + `.cursor/hooks/*.mjs` | Same orchestration / auto-eval **entrypoints** as Copilot hooks, adapted to Cursor events | **Yes.** Shared logic lives in `scripts/`; hooks avoid duplicating policy. |
| Root `.mcp.json` | Cursor workspace MCP servers (`mcpServers`) | **Yes** for Context7; keep **minimal** and secret-free. Optional servers belong in **local** config (see below). |

**Assessment:** Dropping Cursor-only rules and hooks in favor of “Copilot brain only” would **break** Cursor users’ session/orchestration integration and force duplicate instructions into chat by hand. The right pattern is: **canonical policy in `.github/`, Cursor layers only delegate and wire tooling.** Do not delete `.cursor/rules` or hooks unless the team standardizes on a single IDE and accepts losing those integrations.

## GitHub Copilot–specific glue

| Artifact | Purpose |
| --- | --- |
| `.github/copilot-instructions.md` | Primary Copilot instructions (skills, agents, orchestration, review) |
| `.vscode/mcp.json` | **VS Code / Copilot MCP** servers — `servers` + optional `inputs` ([reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration)) |
| `.github/hooks/*.json` | Copilot hook event names (`SessionStart`, `UserPromptSubmit`, …) calling `scripts/orchestration-supervisor.mjs` |

Copilot does **not** read root `.mcp.json` (Cursor shape). It uses **`.vscode/mcp.json`** when using VS Code’s MCP integration.

## Context7 MCP (library docs)

- **Purpose:** Up-to-date library/framework documentation (e.g. Taro, React) via MCP instead of guessing APIs.
- **GitHub Copilot / VS Code:** Use **`.vscode/mcp.json`** (tracked). On first run, VS Code prompts for `CONTEXT7_API_KEY` via the configured `input` (stored securely for the profile). Use **MCP: List Servers** to verify `context7`.
- **Cursor:** Uses **root `.mcp.json`** (`mcpServers.context7`). Set **`CONTEXT7_API_KEY`** in your environment (e.g. export in shell, or load from a **local** env file before starting Cursor — do not commit secrets). Optional: add the key in Cursor’s MCP server UI if your build supports it.
- **Optional duplicate in `.env`:** `.env.example` documents `CONTEXT7_API_KEY=` for documentation parity; IDEs do not always auto-load `.env` into MCP child processes — see your IDE’s docs.

If an API key was ever committed to git, **rotate it** at the provider and rely on `inputs` / environment only.

## Hermes Agent MCP (Cursor + VS Code parity)

[Nous Hermes Agent](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp/) can run as an **MCP server** so clients such as Cursor and VS Code attach to it:

```bash
hermes mcp serve
```

**Tracked repo configs** (same logical wiring in both IDEs):

| IDE | File | Entry |
| --- | --- | --- |
| **Cursor** | [`.mcp.json`](../.mcp.json) | `mcpServers.hermes` → `command: "hermes"`, `args: ["mcp", "serve"]` |
| **VS Code / Copilot** | [`.vscode/mcp.json`](../.vscode/mcp.json) | `servers.hermes` → `type: "stdio"`, same command/args |

**Requirements:** the `hermes` CLI must be on your **`PATH`** (install per [Hermes docs](https://hermes-agent.nousresearch.com/)). If the binary lives elsewhere, override **locally** (user MCP config or untracked snippet)—do not commit home-directory paths.

**What this MCP exposes:** per [Running Hermes as an MCP server](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp/#running-hermes-as-an-mcp-server), tools for **Hermes messaging/session** surfaces (conversations, messages, channels, events)—**not** JoyJoin’s durable **`repo-memory/`** plane or **`.git/.orchestration/`** turn state. Treat Hermes as an optional **external agent bridge**; keep product/repo memory rules in **`repo-memory/`** and orchestration scripts unchanged.

**Copilot note:** if you instead configured MCP **inside** `~/.hermes/config.yaml` for **`hermes chat`**, that config makes **Hermes the client** to other MCP servers. The wiring above is for **Cursor/VS Code as clients to Hermes**—both patterns can coexist.

## Agent memory MCP (optional, local DB)

For **IDE-side** long-term recall (searchable store) that complements—but does **not** replace—**`repo-memory/`** review and promotion rules:

- **Package:** `@adamrdrew/agent-memory-mcp` (stdio via `npx`).
- **Tracked configs:** [`.mcp.json`](../.mcp.json) and [`.vscode/mcp.json`](../.vscode/mcp.json) include `agentMemory` with `MEMORY_DB_PATH` under **`.joyjoin/agent-memory-db`** (gitignored parent `.joyjoin/`).
- **First run:** create the workspace folder if needed; the server will use the path for local LanceDB-style storage.

This supports **agent memory** in chat; **skill iteration** for JoyJoin still flows through **turn summaries**, **Supervisor**, and **governance**—do not auto-edit `.github/skills/` without human review.

## Optional local-only MCP (extra servers, custom paths)

Beyond the tracked `context7` + `hermes` entries, machine-specific servers (extra paths, secrets, one-off tools) **should not** be committed. Add them in:

- **Cursor:** User-level MCP config or a **local** override if your Cursor version supports it — never commit secrets or `/Users/…` paths into the shared repo.

## Quick alignment checklist (contributors)

1. Prefer **`.github/copilot-instructions.md`** + **`.github/skills/README.md`** before ad-hoc patterns.
2. For “which skill applies?”, run `node scripts/skill-router.mjs "your task"` when unsure.
3. For **Copilot + VS Code**, confirm **`.vscode/mcp.json`** exists and Context7 starts after key setup.
4. For **Cursor**, confirm root **`.mcp.json`** Context7 (**`CONTEXT7_API_KEY`** in environment) and optional **Hermes** (`hermes` on `PATH` for `hermes mcp serve`).
5. When editing agents, skills, or orchestration, run `npm run orchestration:validate` before pushing (see `.github/ORCHESTRATION_GOVERNANCE.md`).

## VS Code: planning UI vs JoyJoin custom agents

These layers **coexist**. Repo custom agents do **not** remove Microsoft’s built-in **Plan** experience or **Agent** mode—they are chosen in **different UI places**.

### Built-in Copilot / VS Code (plan + todos in Chat)

Use these when you want **Microsoft’s** structured planning UI, session `plan.md`, and todo-style tracking **inside Chat**:

- Open Chat (**⌃⌘I** / **Ctrl+Alt+I**), open the **agent dropdown**, and choose **Plan**—or type **`/plan`** followed by your task ([Planning with agents in VS Code](https://code.visualstudio.com/docs/copilot/agents/planning)).
- For multi-step **implementation** after a plan, use **Agent** mode from the same dropdown ([Agent mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode)).
- Plans can be opened from session memory: command **Chat: Show Memory Files**, then **`plan.md`** (session-scoped; copy into `docs/proposals/` if you need a permanent record).

Optional: point the Plan agent at repo rules by keeping **`.github/copilot-instructions.md`** loaded; you can add a [custom agent](https://code.visualstudio.com/docs/copilot/customization/custom-agents) that mirrors JoyJoin’s `Researcher` → `Planner` language if you want both.

### JoyJoin repo agents (`Supervisor`, `Researcher`, `Planner`, …)

These are **repository-defined custom agents** under **`.github/agents/`**. They supply **workflow instructions and handoff buttons** in Copilot Chat when you **pick that agent** from your **custom agent** list—they are **not** a replacement for the **Plan** entry in the **built-in** agent dropdown.

| Goal | Suggestion |
| --- | --- |
| **Todo list / plan UI** in VS Code Chat | Use **Plan** + **`/plan`** (built-in), not `Supervisor` alone. |
| **Reroute work across JoyJoin specialists** after approval | Use **`Supervisor`** (repo custom agent). |
| **Broad kickoff: research then approval-first plan** | Use **`Researcher`** then **`Planner`** (repo), or combine with a built-in plan draft first—see `.github/AI_WORKFLOW_POLICY.md`. |

Durable artifacts belong in **`docs/proposals/`** (or similar); session **`plan.md`** is ephemeral unless exported.

### FAQ: Does **Supervisor** override VS Code’s pre-existing agents?

**No.**

- **Custom agents** (e.g. Supervisor) only change which **prompt, constraints, and handoff labels** Copilot applies **when you invoke that custom agent**. They do not uninstall, hide, or override **Plan**, **Agent**, **Ask**, or other **first-party** modes in the Chat UI.
- If you almost always open **Supervisor**, you are simply **not** selecting **Plan**—so you will not see Microsoft’s plan/todo workflow for that session. Switch the dropdown to **Plan** (or **`/plan`**) when you want that UX; use **Supervisor** when you need JoyJoin orchestration and routing.
- **Hooks** (`SessionStart`, `UserPromptSubmit`, …) still run from **`.github/hooks/`** regardless of which agent is selected, unless your editor or org policy disables them.

**Why it can feel like “no UI”:** the JoyJoin **Supervisor** agent is optimized for **text briefings** (executive briefing + **Turn status** + **Routing (pick one)** per [`.github/skills/orchestration-turn-reporting/SKILL.md`](./skills/orchestration-turn-reporting/SKILL.md)) and static **handoff buttons**, not for VS Code’s **Plan** timeline UI. That is a **product choice per mode**, not a bug caused by Supervisor overriding anything.
