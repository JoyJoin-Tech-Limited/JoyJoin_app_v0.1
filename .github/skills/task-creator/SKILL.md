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

The Task Creator is the **entry-point skill** for all implementation work. It transforms vague or specific user requests into **structured, actionable task metadata** that downstream agents can consume directly.

**Key responsibility:** Auto-classify the harness tier and Sprint Contract requirement **before** any implementation begins.

## When to Use

- User says "build", "fix", "add", "change", "refactor", "implement", "optimize", "audit", or "explore" anything
- User describes a feature, bug, or improvement without explicit task structure
- Before routing to any implementation specialist (Backend Engineer, Frontend Engineer, etc.)
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

Extract from the user's request:
- **Mission:** One sentence, plain language, no jargon
- **Description:** Expanded context
- **Implicit scope:** What files/workspaces are likely affected

### Step 2: Auto-Classify Harness Tier (MANDATORY)

**Run the auto-trigger silently:**

```bash
node scripts/harness-auto-trigger.mjs \
  --prompt="<user's exact request>" \
  --proposed-files=<files-you-plan-to-touch>
```

**Incorporate the result into task metadata.**

### Step 3: Determine Affected Workspaces

From file paths or domain knowledge:
- `apps/server/` → `server`
- `apps/user-client/` → `user-client`
- `apps/admin-client/` → `admin-client`
- `apps/mini-program/` → `mini-program`
- `packages/shared/` → `shared`

### Step 4: Recommend Model Tiers

```bash
node scripts/select-model-tier.mjs \
  --tier=<detected-tier> \
  --task="<mission>"
```

### Step 5: Draft Acceptance Criteria

Pre-fill 2–3 acceptance criteria based on:
- The user's explicit requirements
- The harness tier (Tier 2+ gets more detailed criteria)
- The affected domain (API routes get HTTP criteria, UI gets visual criteria)

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

**The Supervisor should load this skill on every task before routing.**

When Supervisor receives a user request:
1. Load `task-creator` skill
2. Run the workflow above
3. Use the output JSON for routing decisions
4. Include the full task metadata in handoff prompts

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

See [`references/examples.md`](./references/examples.md) for three worked examples:
- Tier 1: Typo fix
- Tier 2: New feature (CSV export)
- Tier 3: Core engine change (matching algorithm)

## Cross-Platform Awareness

When the task involves both web and mini-program:
- Set `routing.lane` to `parity` or `both`
- Include `Mini-Program Parity Auditor` in the workflow
- Note `BOTH_REQUIRED` in the task metadata

## Related Skills

- [`harness-session-guard`](../../skills/harness-session-guard/SKILL.md) — Agent-level harness classification protocol
- [`first-principles-velocity`](../../skills/first-principles-velocity/SKILL.md) — Mission → inversion → critical path → tier
- [`lane-selection-governance`](../../skills/lane-selection-governance/SKILL.md) — 4-gate lane selection heuristic
