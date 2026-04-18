---
name: first-principles-velocity
description: >-
  First-principles and critical-path execution discipline for agents and humans: state the mission,
  invert failure modes, remove the single bottleneck, pair cheap models to shallow work and strong
  models to irreducible complexity, and keep velocity without thrash. Includes five JoyJoin themes:
  constraint-first design, end-to-end slice ownership, cycle time via smallest proof, ruthless deletion
  or quarantine, and direct escalation when blocked with evidence. Use when planning ambiguous work,
  routing specialists, prioritizing under constraints, or asking which model tier fits a task.
  Trigger phrases: first principles, critical path, main bottleneck, mission in one sentence,
  inversion, ruthless prioritization, cheap model for trivial step, when to use Opus, velocity without thrash,
  hard constraints, vertical slice, single owner, smallest proof, quarantine legacy, blocked with evidence.
---

# First-principles velocity (execution discipline)

## Purpose

Encode **how to think** before **how to code**: shrink the problem to its load-bearing assumptions, find the **critical path**, and spend premium capacity only where it moves the outcome.

Pair with:

- [`.github/agents/MODEL_CATALOG.md`](../../agents/MODEL_CATALOG.md) — **which model tier** (cost vs capability, dimensions, escalation ladder)
- [`orchestration-turn-reporting`](../orchestration-turn-reporting/SKILL.md) — **how** to report turns (executive briefing)
- [`../agents/supervisor.agent.md`](../../agents/supervisor.agent.md) — **Critical-path orchestration** section
- [`docs/ai-workflow-documentation-refresh.md`](../../../docs/ai-workflow-documentation-refresh.md) — **only when** the mission is a large coordinated documentation refresh (scope tiers, kickoff vs `docs-sync` vs governance lanes)

**Agent wiring:** Loaded in [`orchestration.yaml`](../orchestration.yaml) `skill_bindings` for **`Researcher`**, **`Planner`**, **`Supervisor`**, **`Auto-Eval`**, **`Product Manager`**, **`Backend Engineer`**, **`AI Engineer`**, **`QA Agent`**, **`Verifier`**, **`Launch Readiness Agent`**, **`Database Schema & Migration Auditor`**, **`Mini-Program Parity Auditor`**, **`Taro Mini-Program Frontend Engineer`**, **`Taro Migration Specialist`**, **`Expert React Frontend Engineer`**, **`debug`**, and **`Principal Software Engineer`** so planning, implementation, verification, and release-facing agents share the same execution frame.

**Orthogonal to “core moves” below:** The core moves (mission → inversion → critical path → next action → model tier) stay the spine. The five themes add **constraints**, **ownership**, **proof size**, **pruning**, and **escalation**—without replacing domain skills.

---

## Five execution themes (JoyJoin)

Use these together with the core moves. Load **domain** skills for enforcement detail (schema, auth, payments, migrations, etc.).

### 1. Constraint-first design

Name **hard constraints before** solution options: data model and invariants, auth and safety boundaries, payment or entitlement rules, platform/runtime limits (e.g. mini-program, WeChat), latency or cost ceilings.

- Pair with: [`backend-models-standards`](../backend-models-standards/SKILL.md), [`auth-session-and-safety-boundaries`](../auth-session-and-safety-boundaries/SKILL.md), [`payment-entitlement-authority`](../payment-entitlement-authority/SKILL.md), [`llm-runtime-safety-and-integration`](../llm-runtime-safety-and-integration/SKILL.md) when relevant; [`platform-coordination-protocol`](../platform-coordination-protocol/SKILL.md) for cross-surface work; performance or mini-program skills when the constraint is UX or runtime.

### 2. End-to-end ownership of the critical slice

One lane should own **truth for a vertical slice** (API contract, client surfaces that consume it, tests, and operational signals where applicable). Hand off only at **real** boundaries (e.g. shared types, sibling platform review)—not “everyone touches the PR.”

- Pair with: [`server-domain-architecture`](../server-domain-architecture/SKILL.md), [`platform-coordination-protocol`](../platform-coordination-protocol/SKILL.md), [`frontend-component-architecture`](../frontend-component-architecture/SKILL.md), [`testing-and-regression-guardrails`](../testing-and-regression-guardrails/SKILL.md), [`platform-observability-and-ops`](../platform-observability-and-ops/SKILL.md).

### 3. Cycle time over headcount

Compress **idea → smallest runnable proof**: targeted tests, repo guardrails (`orchestration:validate`, skill-routing checks), then smoke or E2E when policy warrants—not a bigger plan or more agents by default.

- Pair with: [`testing-and-regression-guardrails`](../testing-and-regression-guardrails/SKILL.md), [`e2e-test-runner`](../e2e-test-runner/SKILL.md) when a journey check is in scope. **Smallest proof** never means skipping migrations, auth, or review—see anti-patterns below.

### 4. Ruthless deletion / option value

Prefer **remove or quarantine** duplicate paths, dead flags, and “maybe later” branches that create drag. Large removals stay **reviewed** and aligned with invariants (matching, payments, onboarding state, etc.).

- Pair with: [`monorepo-workspace-governance`](../monorepo-workspace-governance/SKILL.md), [`onboarding-state-architecture`](../onboarding-state-architecture/SKILL.md) for legacy quarantine rules, [`code-review`](../code-review/SKILL.md), [`database-migration-safety`](../database-migration-safety/SKILL.md) when schema or data paths retire.

### 5. Direct escalation when blocked

When the critical path is stuck (ambiguous spec, missing env, flaky gate, policy decision), escalate in **one step** with **evidence** (command output, failing check name, file path)—not status-only chat. Align blocked turns with [`orchestration-turn-reporting`](../orchestration-turn-reporting/SKILL.md) and `.github/AI_WORKFLOW_POLICY.md` (truth over implied certainty).

---

## When to use this skill

- Kicking off or reframing ambiguous work (goal, constraints, definition of done)
- Choosing between **one narrow handoff** vs many parallel threads
- Deciding **model tier** for a step (trivial → mini; standard → Sonnet / GPT-5.4 xhigh; heavy coordination → Opus)
- Supervisor or Planner is routing and you need a **repeatable prioritization frame**
- You feel “busy” but the bottleneck is unclear

---

## Mechanism: model tier (JoyJoin)

| Layer | Where it lives | What it does |
| --- | --- | --- |
| **Catalog** | [`MODEL_CATALOG.md`](../../agents/MODEL_CATALOG.md) | Names, **premium multipliers**, suitability |
| **Planner** | `planner.agent.md` | `## Model Recommendation for Execution` before implementation |
| **Supervisor** | `supervisor.agent.md` | Model assignment + **per-step hints** on routing lines |
| **Cursor subagents** | `.cursor/agents/*.md` `model:` | e.g. `fast` on [`verifier`](../../agents/verifier.agent.md) stub — **not** duplicated in Copilot YAML |

**Rule:** Optimize for **outcome** first; use **cheaper** tiers only when the task is truly shallow or verification-like; **escalate** tier when logic, coordination, or stakes rise.

---

## Core moves (repeat each turn or planning step)

1. **Mission in one sentence** — What must be true when we stop?
2. **Inversion** — What would make this fail even if we execute perfectly on the wrong thing?
3. **Critical path** — One **bottleneck** (dependency, unknown, or risk) that blocks truth or shipping.
4. **Single next action** — The **smallest** specialist/agent step that removes that bottleneck (aligns with Supervisor).
5. **Model / cost** — Map the step to [`MODEL_CATALOG.md`](../../agents/MODEL_CATALOG.md); do not default to cheapest for non-trivial work.

---

## Anti-patterns

- Parallelizing **dependent** work to “go faster”
- Premium models for **trivial** edits (violates catalog intent)
- Cheapest models for **multi-file architecture** or **high-stakes** decisions without explicit waiver
- Long chat transcripts instead of **structured** briefs + JSON per `orchestration-turn-reporting`
- **Speed theater:** “Smallest change” that skips migrations, auth boundaries, or review—use **smallest validating** change instead
- **Options before constraints** — designing screens or APIs before naming non-negotiable platform or data rules
- **Blocked without evidence** — escalation that does not include what failed and where to reproduce

---

## Review checklist

- [ ] Mission and “done” are explicit
- [ ] Bottleneck named (not a list of ten equal priorities)
- [ ] Next owner is one specialist or one lane
- [ ] Model tier matches task depth (see MODEL_CATALOG)
- [ ] Turn summary / briefing uses orchestration skill when agents record work
- [ ] Hard **constraints** stated before solution options (theme 1)
- [ ] **Slice** or ownership boundary is clear for implementation and verification (theme 2)
- [ ] Next step is the **smallest proof** that fits policy—not scope shrink by skipping safety (theme 3)
- [ ] Removals/quarantines called out or N/A (theme 4)
- [ ] If **blocked**, evidence attached for escalation (theme 5)

