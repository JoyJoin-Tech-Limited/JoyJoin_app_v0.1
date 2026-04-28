# OpenCode custom agents (JoyJoin)

These agents are migrated from the Kimi Code agent portfolio (`.github/agents/`) to OpenCode format.

## Agent inventory

| Agent file | Alias | Role |
|---|---|---|
| `supervisor.md` | supervisor | Route next specialist, sequence Researcher→Planner |
| `researcher.md` | researcher | Gather repo context, prepare research briefs |
| `planner.md` | planner | Build approval-first execution plans |
| `backend-engineer.md` | backend-engineer | Server routes, domain services, repositories |
| `ai-engineer.md` | ai-engineer | LLM-backed features, prompts, fallbacks |
| `frontend-engineer.md` | frontend-engineer | Web UI (`apps/user-client`) |
| `taro-engineer.md` | taro-engineer | Mini-program UI (`apps/mini-program`) |
| `verifier.md` | verifier | Skeptical completion checker |
| `auto-eval.md` | auto-eval | Dirty-worktree quality gate |
| `qa-agent.md` | qa-agent | Verification checklists, test gap analysis |
| `product-manager.md` | product-manager | PRDs, user stories, scope |
| `debug.md` | debug | Bug investigation and resolution |

## Invocation

- **@mention** in chat: `@supervisor`, `@researcher`, etc.
- **Automatically** by other agents via the Task tool.
- Select from the agent dropdown in the OpenCode UI.

## Source of truth

Full agent definitions and orchestration contracts remain in `.github/agents/`. These OpenCode stubs are derived from those canonical sources and kept in sync manually.

## Skills

Skills are auto-discovered by OpenCode from `.agents/skills/` (Claude-compatible format). See `.agents/skills/` for the full skill inventory.
