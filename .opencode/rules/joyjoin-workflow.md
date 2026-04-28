---
description: JoyJoin workflow, orchestration, and engineering standards (adapted from Cursor rules for OpenCode)
globs: "**/*"
alwaysApply: true
---
# JoyJoin workflow (OpenCode)

- **Single brain with Copilot:** Policy, skills, and agents live under `.github/` (see `.github/AI_TOOLING_UNIFIED_BRAIN.md`).
- **Skills** are auto-discovered by OpenCode from `.agents/skills/`. Load domain skills when relevant to the task.
- Canonical contributor instructions: `.github/copilot-instructions.md`.
- Planning policy (direct delivery vs kickoff lane): `.github/AI_WORKFLOW_POLICY.md`.
- Orchestration graph, agent portfolio: `.github/ORCHESTRATION.md` and `.github/orchestration.yaml`.
- Pull requests: use Harness-style dimensions; start reviews with `.agents/skills/code-review/SKILL.md`.
- CI runs guardrails and orchestration validation on `main` and PRs. After changing orchestration or agents, run `npm run orchestration:validate` locally.
- For ambiguous tasks, run `node scripts/skill-router.mjs "your question"` to pick a skill.
- **Secrets:** Never commit API keys. Use `.env` (gitignored).

## Agent portfolio

This repo's agents are available in `.opencode/agents/` and `.github/agents/`. Key agents:
- **Supervisor** — orchestration and routing
- **Researcher** → **Planner** — kickoff lane for broad/ambiguous work
- **Backend Engineer** — server implementation in `apps/server`
- **AI Engineer** — LLM-backed features
- **Frontend Engineer** — web UI in `apps/user-client`
- **Taro Engineer** — mini-program UI in `apps/mini-program`
- **Verifier** — skeptical completion checks
- **Auto-Eval** — dirty-worktree quality gate
- **QA Agent** — verification checklists
- **debug** — bug investigation

## Every task starts with a planning check

For bounded work, a compact micro-plan is enough.
For broad, ambiguous, cross-cutting, or approval-first work, use the kickoff lane (`Researcher` → `Planner`).
Do not skip planning entirely.

## Import rules

- Import shared code via `@joyjoin/shared` or `@shared/*`.
- Do not import across apps.
- Do not import from legacy `shared/` directory.

## Turn reporting

When acting as a repo agent, follow the executive briefing format from `.github/skills/orchestration-turn-reporting/SKILL.md`.
