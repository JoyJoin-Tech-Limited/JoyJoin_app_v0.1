---
name: task-creator
description: >
  Structure and route every new task or feature request in the JoyJoin project.
  Auto-classifies harness tier, determines Sprint Contract requirements, and
  outputs structured task metadata for downstream agents.
  Trigger phrases: build this, fix this, add this, change this, refactor this,
  implement this, optimize this, audit this, explore this, new feature,
  task breakdown, scope this.
---

# Task Creator Skill

## Purpose

**Entry-point skill for all implementation work.** Transforms vague or specific user requests into **structured, actionable task metadata** for downstream agents. Key responsibility: auto-classify the harness tier and Sprint Contract requirement **before** any implementation begins.

## When to Use

- User says "build", "fix", "add", "change", "refactor", "implement", "optimize", "audit", or "explore" anything
- User describes a feature, bug, or improvement without explicit task structure
- Before routing to any implementation specialist
- When the task scope is unclear and needs decomposition

## Output Format

See [`references/output-schema.md`](./references/output-schema.md) for the full JSON schema. Key fields:
- `taskId`, `mission`, `description`
- `affectedWorkspaces`, `affectedFiles`
- `harness` (tier, contractRequired, action, triggerWords)
- `modelRecommendation` (planner, generator, evaluator)
- `estimatedCost`
- `routing` (lane, nextAgent, reason)
- `acceptanceCriteria`, `outOfScope`

## Workflow

### Step 1: Parse User Intent

Extract: **Mission** (one sentence, plain language, no jargon), **Description** (expanded context), **Implicit scope** (likely affected files/workspaces).

### Step 2: Auto-Classify Harness Tier (MANDATORY)

**Run the auto-trigger silently:**

```bash
node scripts/harness-auto-trigger.mjs \
  --prompt="<user's exact request>" \
  --proposed-files=<files-you-plan-to-touch>
```

Incorporate the result into task metadata.

### Step 3: Determine Affected Workspaces

`apps/server/` → `server`; `apps/admin-client/` → `admin-client`; `apps/mini-program/` → `mini-program`; `packages/shared/` → `shared`.

### Step 4: Recommend Model Tiers

```bash
node scripts/select-model-tier.mjs \
  --tier=<detected-tier> \
  --task="<mission>"
```

### Step 5: Draft Acceptance Criteria

Pre-fill 2–3 criteria based on: the user's explicit requirements, the harness tier (Tier 2+ gets more detail), the affected domain (API routes get HTTP criteria, UI gets visual criteria).

### Step 6: Determine Routing

| Condition | Lane | Next Agent |
|-----------|------|------------|
| Tier 1, single workspace | `direct` | Narrowest specialist |
| Tier 2, single domain | `direct` | Specialist + Sprint Contract |
| Tier 2, cross-domain | `kickoff` | Researcher → Planner |
| Tier 3 | `harness` | Harness Runtime Controller |
| Ambiguous scope | `kickoff` | Researcher → Planner |
| Bug with unknown root cause | `debug` | `debug` agent |

## Integration with Supervisor

**The Supervisor should load this skill on every task before routing:** run the workflow above, use the output JSON for routing decisions, and include the full task metadata in handoff prompts.

### Supervisor Handoff Format

When routing to an implementation agent, include:

```
**Task Metadata (from Task Creator):**
- Mission: {mission}
- Tier: {harness.tier}
- Contract Required: {harness.contractRequired}
- Action: {harness.action}
- Affected Workspaces: {affectedWorkspaces}
- Acceptance Criteria: {acceptanceCriteria}

**Harness Context:**
{full harness JSON}
```

## Examples

See [`references/examples.md`](./references/examples.md) for three worked examples: Tier 1 typo fix, Tier 2 new feature (CSV export), Tier 3 core engine change (matching algorithm).

## Cross-Platform Awareness

When the task spans multiple client surfaces (mini-program and admin-client): set `routing.lane` to `parity` or `both`, include `Mini-Program Parity Auditor` in the workflow, and note `BOTH_REQUIRED` in the task metadata.

## Related Skills

- [`harness-session-guard`](../../skills/harness-session-guard/SKILL.md) — Agent-level harness classification protocol
- [`first-principles-velocity`](../../skills/first-principles-velocity/SKILL.md) — Mission → inversion → critical path → tier
- [`lane-selection-governance`](../../skills/lane-selection-governance/SKILL.md) — 4-gate lane selection heuristic
