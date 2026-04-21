# JoyJoin Agents

`.github/agents/` contains focused custom agents for recurring workflows in this repo. **Cursor and GitHub Copilot share this tree** with `.github/skills/`; do not duplicate agent definitions outside `.github/`. See `.github/AI_TOOLING_UNIFIED_BRAIN.md`. **How the layers fit together** (skills + agents + orchestration + hooks): [`.github/CONTRIBUTOR_AGENT_HARNESS.md`](../CONTRIBUTOR_AGENT_HARNESS.md). **Shared chat-visible turn narrative:** [`AGENT_TURN_VISIBLE_FORMAT.md`](./AGENT_TURN_VISIBLE_FORMAT.md).

These agents are the orchestration layer that sits above the repo's reusable skills. Each agent should have a narrow role, a minimal tool set, and a keyword-rich description so both humans and parent agents can discover it reliably.

Read [`../AI_WORKFLOW_POLICY.md`](../AI_WORKFLOW_POLICY.md) when deciding whether a task belongs in direct delivery, the kickoff lane, or the operational lane. Read [`../ORCHESTRATION_GOVERNANCE.md`](../ORCHESTRATION_GOVERNANCE.md) before changing the portfolio, handoffs, or agent-governance surfaces. For a coordinated refresh of product docs, skills, and agents, see [`../../docs/ai-workflow-documentation-refresh.md`](../../docs/ai-workflow-documentation-refresh.md).

## How to use these agents

**Contributors:** Pick the most specific agent that matches the workflow you need. If the task is broad or ambiguous, either start with **`Supervisor`** (it can sequence `Researcher` → `Planner` when kickoff applies) or start with `Researcher` then `Planner` directly. Execution-ready plans should end with a model recommendation section before handoff. **Model catalog (names, multipliers):** [`MODEL_CATALOG.md`](./MODEL_CATALOG.md). After a complete kickoff, use `Supervisor` for midstream routing or rerouting—not as an extra bounce on top of an already-approved plan that names the next specialist. If the task is migration, debugging, prompt work, or workflow governance, use the specialist.

**Agent authors:** Treat the frontmatter as the discovery contract. The `name` is the canonical invocation name, and the `description` is the routing surface.

All active agents now follow the shared turn-reporting protocol:
- emit a compact end-of-turn JSON summary
- use the last 5 relevant summaries and supervisor feedback to refine the next turn
- keep persistent summary state under `.git/.orchestration/`, not `repo-memory/`
- let `Supervisor` consolidate child summaries into one turn-end report for the workflow

---

## Session kickoff agents

These agents sit ahead of the core handoff graph. Use them at the start of broad requests to gather context and turn it into an approval-first plan before handing work to the core implementation agents.

| Agent | Portfolio role | Primary use | File |
|-------|----------------|-------------|------|
| `Researcher` | Kickoff research | Gathers relevant files, verified repo context, external references, and open ambiguities before planning | [`researcher.agent.md`](./researcher.agent.md) |
| `Planner` | Kickoff planning | Converts the research brief into an approval-first execution plan and model recommendation for execution | [`planner.agent.md`](./planner.agent.md) |

---

## Core orchestration agents

These are the v1 agents wired into the native handoff graph documented in [`../ORCHESTRATION.md`](../ORCHESTRATION.md) and the machine-readable contract in [`../orchestration.yaml`](../orchestration.yaml).

| Agent | Portfolio role | Primary use | File |
|-------|----------------|-------------|------|
| `Supervisor` | Orchestrator | Routes the next specialist across the core handoff graph and selected kickoff, debug, or frontend support rerouting lanes after approval or from concrete blocker findings | [`supervisor.agent.md`](./supervisor.agent.md) |
| `Auto-Eval` | Quality gate | Dirty-worktree evaluation, manual reruns, and local quality sign-off | [`auto-eval.agent.md`](./auto-eval.agent.md) |
| `Product Manager` | Product scope | PRDs, feature briefs, issue-ready backlog artifacts, acceptance criteria, and measurable product framing | [`product-manager.agent.md`](./product-manager.agent.md) |
| `Backend Engineer` | Implementation | Server-side implementation in `apps/server` | [`backend-engineer.agent.md`](./backend-engineer.agent.md) |
| `AI Engineer` | Implementation | Runtime AI integration, fallback behavior, provider routing, and AI trace safety | [`ai-engineer.agent.md`](./ai-engineer.agent.md) |
| `QA Agent` | Verification | Smoke validation, regression checklist design, and verification-gap reporting | [`qa-agent.agent.md`](./qa-agent.agent.md) |
| `Launch Readiness Agent` | Release review | Go or no-go readiness, launch blockers, risk consolidation, and preflight review | [`launch-readiness.agent.md`](./launch-readiness.agent.md) |

## Audited support agents

These agents are still part of the active portfolio, but they are not in the v1 native handoff graph by default. They are catalogued in the orchestration contract with skill links and tooling sufficiency notes so future expansion stays deliberate. `Supervisor` can still route into them via its visible briefing and manual agent selection even when they are not exposed as native Copilot handoff buttons.

| Agent | Current scope | File |
|-------|---------------|------|
| `Admin Operations Advisor` | Admin incident triage, RBAC or audit troubleshooting, and runbook-guided remediation | [`admin-operations-advisor.agent.md`](./admin-operations-advisor.agent.md) |
| `Database Schema & Migration Auditor` | Schema evolution, migration planning, and rollout safety | [`database-schema-migration-auditor.agent.md`](./database-schema-migration-auditor.agent.md) |
| `Mini-Program Parity Auditor` | Web versus mini-program parity audits and migration backlog creation | [`mini-program-parity-auditor.agent.md`](./mini-program-parity-auditor.agent.md) |
| `Taro Mini-Program Frontend Engineer` | Direct Taro UI implementation and refinement in `apps/mini-program` with premium, brand-governed, native-quality execution | [`taro-mini-program-frontend-engineer.agent.md`](./taro-mini-program-frontend-engineer.agent.md) |
| `Taro Migration Specialist` | Broad web-to-mini-program migration and parity restoration | [`taro-migration-specialist.agent.md`](./taro-migration-specialist.agent.md) |
| `Expert React Frontend Engineer` | Browser-first React work in `apps/user-client` | [`frontend engineer.md`](./frontend%20engineer.md) |
| `debug` | Bug and issue investigation, regressions, failing tests, and root-cause debugging | [`debug.agent.md`](./debug.agent.md) |
| `Principal Software Engineer` | Architecture review, tradeoff analysis, and senior implementation guidance | [`principal SWE.md`](./principal%20SWE.md) |
| `Prompt Engineer` | Prompt review, repo-resident prompt maintenance, safety-aware structure tightening, and example cleanup | [`prompt engineer.md`](./prompt%20engineer.md) |
| `Repo Memory Steward` | Semi-automated **candidate** notes (`memory:draft-candidate`, `memory:query`, `memory:validate`); does not promote without explicit human approval | [`repo-memory-steward.agent.md`](./repo-memory-steward.agent.md) |
| `Workflow Governance Reviewer` | Proposal-only portfolio review, orchestration drift triage, reviewer-packet drafting, and reviewed memory-candidate drafts (not a bulk doc-sync substitute—see [`docs/ai-workflow-documentation-refresh.md`](../../docs/ai-workflow-documentation-refresh.md)) | [`self-iteration.agent.md`](./self-iteration.agent.md) |
| `Verifier` | Skeptical completion check after “done” claims — targeted tests/commands, verified vs claimed | [`verifier.agent.md`](./verifier.agent.md) |
| `Game Design Agent` | Post-match, pre-event **IcebreakerRunPlan** compilation, safety/energy-curve curation, and dev-ready handoff artifacts | [`game-design-agent.agent.md`](./game-design-agent.agent.md) |
| `Game Development Agent` | Bind plans to **shipped phase templates** (`socialIcebreakerPhaseRegistry`), server advance rules, parity, and tests | [`game-development-agent.agent.md`](./game-development-agent.agent.md) |
| `MiniScript Story Agent` | **迷你剧本杀** JSON contracts, `/api/miniscript/generate`, style/genre enums, and mini-program-first story UX alignment | [`miniscript-story-agent.agent.md`](./miniscript-story-agent.agent.md) |
| `Icebreaker Auction Phase Agent` | Virtual-coin `auction` phase: lots generation, bid/close-lot routes, advance guard, recap lines | [`icebreaker-auction-phase-agent.agent.md`](./icebreaker-auction-phase-agent.agent.md) |
| `Lie Detective Icebreaker Agent` | `lie_detective` secrecy (`isLie`), votes/reveals, `social-lie-detective-v1` | [`lie-detective-icebreaker-agent.agent.md`](./lie-detective-icebreaker-agent.agent.md) |
| `Personality Dice Icebreaker Agent` | `personality_dice` roster-sized challenges, `social-personality-dice-v1`, tone/safety | [`personality-dice-icebreaker-agent.agent.md`](./personality-dice-icebreaker-agent.agent.md) |

See [`../ORCHESTRATION.md`](../ORCHESTRATION.md) for the broader portfolio audit, linked skills, and the tooling sufficiency recommendations for each of these agents.

---

## Required frontmatter

Every agent should include:

```yaml
---
name: "Exact Agent Name"
description: "Use when ... trigger phrases ..."
tools: [read, search]
argument-hint: "Describe the task input the agent expects."
agents: []
---
```

### Rules

- `name` is the canonical invocation name and must match any documented subagent references exactly, including case.
- `description` is the discovery surface. Start with `Use when ...` and include natural trigger phrases that a parent agent or contributor would actually say.
- Prefer the smallest tool set that still lets the agent do its job.
- Use `tools: []` for conversational or analysis-only agents that do not need tool access.
- Add `argument-hint` whenever the task benefits from a precise input contract.
- Use `agents: []` to explicitly block subagent delegation when an agent should stay self-contained.
- When an agent exposes subagents, keep the frontmatter `agents:` allowlist exactly aligned with `.github/agents/manifest.json`.

---

## File naming policy

- New agents should use the `.agent.md` suffix.
- Several current files still use legacy plain `.md` names. Keep them stable until there is an explicit migration, because external instructions may already reference their current names.
- Do not rely on filename alone for invocation. The `name` field is the source of truth.

---

## Authoring checklist

- The agent has one clear role.
- The frontmatter `name` is present and exact.
- The `description` is specific and trigger-rich.
- The tool list is minimal and intentional.
- The body includes clear constraints and an approach.
- The output format is explicit when the workflow needs structured results.
- Any allowed subagents are listed deliberately rather than left ambiguous.
- If the agent participates in orchestration, the handoffs and portfolio role also match [`../orchestration.yaml`](../orchestration.yaml).

---

## Machine-readable inventory

Use [`manifest.json`](./manifest.json) as the machine-readable inventory for canonical agent names and subagent allowlists, and [`../orchestration.yaml`](../orchestration.yaml) for the orchestration graph, hooks, skill bindings, and tooling audit.
