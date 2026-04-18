# Contribution Guidelines

1. Follow coding standards.
2. Write meaningful commit messages.
3. Document your code properly.

### Unified brain (Cursor and GitHub Copilot)

- **Single source of truth:** Skills, custom agents, orchestration, and this file are shared by Cursor and GitHub Copilot. Do not maintain a second copy of skills or agents outside `.github/` (see `.github/AI_TOOLING_UNIFIED_BRAIN.md`).
- **Planner vs Supervisor vs turn JSON:** Pre-execution plans and **model recommendations** belong to **`Planner`** (and this policy); **`Supervisor`** consolidates **`supervisor_turn_report`** and routing; see **Division of responsibility** in `.github/AI_WORKFLOW_POLICY.md`.
- **Cursor Superpowers plugin:** Not available in GitHub Copilot. In Cursor, Superpowers process skills complement JoyJoin skills—see `.github/SUPERPOWERS_JOYOIN_INTEGRATION.md`.
- **Ambiguous or cross-cutting tasks:** Run `node scripts/skill-router.mjs "your question"` and follow the suggested skill; routing metadata lives in `.github/skills/*/routing.yml`.
- **Library and framework APIs (Taro, React, Prisma, etc.):** Prefer **Context7 via MCP** for current docs instead of relying on stale training data—after configuring MCP (`.vscode/mcp.json` for VS Code / Copilot; root `.mcp.json` for Cursor), use the Context7 tools when the task depends on accurate API or config details.
- **Secrets:** Never commit API keys. Use `.env` (gitignored) for `CONTEXT7_API_KEY` where your IDE passes env to MCP, or VS Code `inputs` in `.vscode/mcp.json`. See `.env.example`.

### Skills

- Reusable project skills live under `.github/skills/`.
- Start with `.github/skills/README.md` to find the relevant skill for architecture, reliability, testing, observability, monorepo governance, and core product domains.
- For **critical-path prioritization** and **model tier vs task depth**, use `.github/skills/first-principles-velocity/SKILL.md` with `.github/agents/MODEL_CATALOG.md` (Planner / Supervisor already reference the catalog).
- These skills complement the canonical source-of-truth docs in this file, `DEVELOPER_QUICK_REFERENCE.md`, and active architecture docs; they do not replace them.
- When creating or updating files under `.github/skills/`, follow the skill authoring standard in `.github/skills/skill-authoring-governance/SKILL.md`. Ensure correct frontmatter, trigger phrases, progressive disclosure, examples, troubleshooting, and a review checklist are present where appropriate.

### Agents

- Focused workflow agents live under `.github/agents/`.
- Start with `.github/agents/README.md` to choose the right agent for debugging, frontend delivery, platform parity, prompt work, product scoping, or **post-claim verification** (`Verifier` — skeptical “done” checks; complements `QA Agent`).
- Skills define the rules and boundaries; agents help execute a workflow within those boundaries.

### VS Code: built-in Plan UI vs JoyJoin custom agents (e.g. Supervisor)

- **GitHub Copilot’s Plan agent** (Chat → agent dropdown → **Plan**, or **`/plan`**): provides Microsoft’s planning and todo-style flow in Chat; see [Planning with agents in VS Code](https://code.visualstudio.com/docs/copilot/agents/planning). This is **separate** from repo custom agents.
- **JoyJoin `Supervisor` and other `.github/agents/` entries** are **repository custom agents**: they add workflow instructions and handoffs when you select them. They **do not** replace or disable Plan / Agent mode; if you only open Supervisor, use **Plan** or **`/plan`** when you want that planning UI.
- Full comparison and FAQ (*“Does Supervisor override VS Code agents?”*): `.github/AI_TOOLING_UNIFIED_BRAIN.md`.

### Orchestration

- The native agent orchestration contract lives in `.github/orchestration.yaml`.
- `.github/agents/manifest.json` is the machine-readable inventory for canonical agent names and subagent allowlists.
- Tracked `.vscode/mcp.json` configures **GitHub Copilot / VS Code** MCP servers (e.g. Context7) using the `servers` schema; Cursor continues to use root `.mcp.json` for MCP. Details: `.github/AI_TOOLING_UNIFIED_BRAIN.md`.
- Optional local `.vscode/settings.json` (often gitignored) can enable nested subagents or other VS Code settings for support-lane workflows that delegate a second level.
- Use `.github/ORCHESTRATION.md` for the human-readable graph, support-agent coverage, and tooling sufficiency audit.
- Use `.github/AI_WORKFLOW_POLICY.md` to decide when work should stay in direct delivery, when it should use the kickoff lane (`Researcher` -> `Planner`, or **`Supervisor` first** to sequence that kickoff automatically), and when it should escalate into QA or launch review.
- Every task starts with an explicit planning check. For bounded work, a compact micro-plan or execution checklist is enough. For broad, ambiguous, cross-cutting, or approval-first work, use the kickoff lane. Do not skip planning entirely.
- If staying in direct delivery, state the goal, likely file or surface scope, and intended validation path before editing.
- When a plan or micro-plan is ready for execution, end it with `## Model Recommendation for Execution`, including the recommended model, a short justification, and the estimated premium request cost based on complexity, scope size, and token load.
- Use `.github/ORCHESTRATION_GOVERNANCE.md` when changing agents, skills, hooks, orchestration scripts, or their contributor-facing documentation so the contract and discovery surfaces stay in sync.
- For broad, ambiguous, or multi-step work, either start with **`Supervisor`** (it routes `Researcher` then `Planner` when kickoff applies) or invoke `Researcher` then `Planner` directly—both are valid; do not skip the research-and-plan steps when the kickoff lane is required.
- Prefer implementation on a task-specific branch or isolated worktree. If work happens in a dirty or shared worktree, keep the task scope narrow and preserve unrelated changes.
- `Auto-Eval` remains the deterministic dirty-worktree gate. `Supervisor` is the routing surface across the core v1 agent graph and may be the **first** hop for kickoff sequencing or for **midstream** rerouting after approval.
- Repo-managed local hooks live under `.githooks/`; contributors who want the local commit-time gate should set `git config core.hooksPath .githooks`.

### Turn Reporting

- When acting as a repo custom agent under `.github/agents/`, read `.git/.orchestration/context.json` when it exists and use the last 5 relevant summaries plus supervisor feedback to refine the current turn.
- Use `.github/skills/orchestration-turn-reporting/SKILL.md` as the canonical schema for turn-end summary JSON and supervisor consolidation. **Visible** turn summaries use the **executive briefing** shape (header, Observation, Implication / Context, Next Step, optional Bottom Line); **Supervisor** adds **Turn status** and **Routing (pick one)** as defined in that skill. When possible, include optional **`utilization`** in JSON (task → agents → skills) and a short **Utilization** block in the visible note for coverage / gap analysis.
- End every completed agent turn with a compact JSON summary that captures: what was delivered, files changed, decisions, blockers, what was learned, 1-2 self-suggested improvements for the next turn, categorized next steps, confidence, and unresolved assumptions.
- If the active agent has execute access and is responsible for persistence, append the summary through `node scripts/orchestration-supervisor.mjs record-summary`.
- If the active agent does not have execute access, or a parent agent is brokering persistence, still emit the JSON summary and let the caller record it.
- `Supervisor` must consolidate child summaries into one turn-end report with key bullets, cross-agent insights, per-agent feedback, and actionable task-level recommendations.
- `Supervisor` ends each visible turn with the **executive briefing** plus **Turn status** and, when Ready with multiple paths, **Routing (pick one)**—typically **3–5** **Role — action** lines (plain language), ordered by value; see `.github/skills/orchestration-turn-reporting/SKILL.md` and `.github/agents/supervisor.agent.md`.
- Recorded turn summaries may include **`turnStatus`** (`ready` | `blocked` | `done`) for clearer closure and routing; summaries **do not** auto-edit skill files—promote durable lessons via normal skill or `repo-memory` changes.
- Turn summaries are operational workflow state only. Keep them under `.git/.orchestration/`; never treat them as durable repo memory.

## Pull Request Review Standard

When reviewing pull requests, evaluate not only local correctness but also:
- **Reliability** — partial-failure risk, atomicity, idempotency
- **Scalability** — concurrency safety, query efficiency, data-size bounds
- **Security** — auth gates, fail-closed behaviour, trust boundaries, secret handling
- **Observability** — structured logs, metrics, tracing, and audit records for significant actions
- **Maintainability / architecture fit** — correct code placement, domain boundary respect, pattern consistency
- **Regression risk** — adequate test coverage for the change

The **Harness Engineering Framework** is the default review lens for these dimensions. Apply it to every PR, not just high-risk changes.

**Start with:** `.github/skills/code-review/SKILL.md`
**Then load** domain-specific skills from `.github/skills/README.md` for the areas affected by the change.

---

## Debugging Tips

- Always reproduce and understand the bug before attempting a fix.
- Prefer red-green-refactor when a reliable automated test, assertion, or reproduction script can express the bug first.
- Write the smallest failing test first when feasible.
- If a failing test first is not practical, record why and add the narrowest regression test immediately after the fix.
- Use targeted logging or print statements when they help isolate the failure.