# JoyJoin Agents

`.github/agents/` contains focused custom agents for recurring workflows in this repo.

These agents are the orchestration layer that sits above the repo's reusable skills. Each agent should have a narrow role, a minimal tool set, and a keyword-rich description so both humans and parent agents can discover it reliably.

## How to use these agents

**Contributors:** Pick the most specific agent that matches the workflow you need. If the task is broad engineering work, use a generalist agent. If the task is migration, debugging, prompt work, or product scoping, use the specialist.

**Agent authors:** Treat the frontmatter as the discovery contract. The `name` is the invocation name, and the `description` is the routing surface.

---

## Active agents

| Agent | Primary use | File |
|-------|-------------|------|
| `AI Engineer` | Runtime AI integration, fallback behavior, provider routing, and AI trace safety | [`ai-engineer.agent.md`](./ai-engineer.agent.md) |
| `Admin Operations Advisor` | Admin incident triage, RBAC/audit troubleshooting, runbook-guided remediation | [`admin-operations-advisor.agent.md`](./admin-operations-advisor.agent.md) |
| `Auto-Eval` | Dirty-worktree quality gate evaluation, manual reruns, and blocked-tool diagnosis | [`auto-eval.agent.md`](./auto-eval.agent.md) |
| `Backend Engineer` | Server-side implementation in `apps/server` | [`backend-engineer.agent.md`](./backend-engineer.agent.md) |
| `Database Schema & Migration Auditor` | Schema evolution, migration planning, rollout safety | [`database-schema-migration-auditor.agent.md`](./database-schema-migration-auditor.agent.md) |
| `debug` | Root-cause debugging, failing tests, runtime errors | [`debug.agent.md`](./debug.agent.md) |
| `Expert React Frontend Engineer` | Browser-first React work in `apps/user-client` | [`frontend engineer.md`](./frontend%20engineer.md) |
| `Launch Readiness Agent` | Go/no-go readiness, launch blockers, risk consolidation, and preflight review | [`launch-readiness.agent.md`](./launch-readiness.agent.md) |
| `SE: Product Manager` | Product scoping, GitHub issue authoring, success metrics | [`PM advisor.md`](./PM%20advisor.md) |
| `Mini-Program Parity Auditor` | Web versus mini-program parity audits and migration backlog creation | [`mini-program-parity-auditor.agent.md`](./mini-program-parity-auditor.agent.md) |
| `Product Manager` | PRD drafting, user-story shaping, scope clarification, and measurable product framing | [`product-manager.agent.md`](./product-manager.agent.md) |
| `QA Agent` | Smoke validation, regression checklist design, and verification-gap reporting | [`qa-agent.agent.md`](./qa-agent.agent.md) |
| `Taro Mini-Program Frontend Engineer` | Direct Taro UI implementation and refinement in `apps/mini-program` | [`taro-mini-program-frontend-engineer.agent.md`](./taro-mini-program-frontend-engineer.agent.md) |
| `principal SWE` | Architecture review, tradeoff analysis, senior implementation guidance | [`principal SWE.md`](./principal%20SWE.md) |
| `prompt engineer` | Prompt review, rewriting, examples, structure tightening | [`prompt engineer.md`](./prompt%20engineer.md) |
| `Taro Migration Specialist` | Broad web-to-mini-program migration and parity restoration | [`taro-migration-specialist.agent.md`](./taro-migration-specialist.agent.md) |

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

---

## Machine-readable inventory

Use [`manifest.json`](./manifest.json) as the lightweight registry for portfolio audits, tooling, or future validation scripts.