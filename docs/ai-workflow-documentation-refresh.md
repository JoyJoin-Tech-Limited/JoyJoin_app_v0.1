# AI workflow documentation refresh (scope, lanes, and governance)

This document implements the repo’s agreed approach for **large documentation updates** across product docs, **`.github/skills/`**, and **`.github/agents/`**. It clarifies what **Workflow Governance Reviewer** (the agent file [`self-iteration.agent.md`](../.github/agents/self-iteration.agent.md)) is for—and what it is **not**.

## Direct answers

| Question | Answer |
|----------|--------|
| Is there an automated “self-iteration” job that rewrites all docs, agents, and skills? | **No.** There is no GitHub Actions workflow or script that bulk-updates those surfaces. |
| Can **Workflow Governance Reviewer** replace a full documentation sync? | **No.** It produces **governance reviewer packets** and minimal proposals for orchestration and portfolio issues—it does not replace [`docs-sync`](../.github/skills/docs-sync/SKILL.md) for canonical docs or skill-authoring passes for `.github/skills/`. |
| How do we still refresh everything in a controlled way? | **Explicit scope**, **split PRs by concern**, correct **lane** (below), and **`npm run orchestration:validate`** when `orchestration.yaml` or skill `routing.yml` files change. |

### Playbook vs line-by-line verification

This file plus entry-point links define **how** to run large refreshes and **where** Workflow Governance Reviewer fits. **Per-skill and per-agent body text** must still be validated against the codebase when you touch them—use **`docs-sync`** methodology and domain skills; do not assume a single meta-doc replaces reading `apps/` and `packages/` sources.

**Substantive iteration** (body text, examples, triggers, routing signals, handoff prompts) uses:

- **`docs-sync`** when documentation must match **current** code, APIs, and flows.
- **`skill-authoring-governance`** whenever skill files change materially.
- **Orchestration / portfolio edits** when agents, `orchestration.yaml`, or `manifest.json` change—always with **`npm run orchestration:validate`** before push.

Treat a repo-wide content pass as **multiple scoped PRs** (often one tier or domain at a time), not a single automated sweep—see **Scope tiers** below.

## Scope tiers (define before editing)

Use separate pull requests when more than one tier changes, so review and validation stay tractable.

| Tier | Typical paths | Primary audience |
|------|----------------|------------------|
| **A — Canonical product and engineering docs** | `docs/`, `DEVELOPER_QUICK_REFERENCE.md`, `PRODUCT_REQUIREMENTS.md`, module READMEs under `apps/` and `packages/` | All contributors; source-of-truth for behavior and architecture |
| **B — Skills and routing** | `.github/skills/**`, especially `routing.yml` files and [`skills/README.md`](../.github/skills/README.md) | AI-assisted delivery; must follow [`skill-authoring-governance`](../.github/skills/skill-authoring-governance/SKILL.md) |
| **C — Agents and orchestration** | [`.github/agents/`](../.github/agents/README.md), [`.github/orchestration.yaml`](../.github/orchestration.yaml), [`.github/agents/manifest.json`](../.github/agents/manifest.json), [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) | Orchestration contract and IDE agent inventory |

**Recommendation:** one PR per tier when changes are non-trivial; combine only when edits are tiny (typos, cross-links).

## Routing lanes (choose one primary lane per effort)

| Situation | Lane | Outputs |
|-----------|------|---------|
| Ambiguous goal, unclear ownership, or cross-cutting architecture | **Kickoff:** `Researcher` → `Planner` per [`AI_WORKFLOW_POLICY.md`](../.github/AI_WORKFLOW_POLICY.md) | Research brief, approval-first plan, model recommendation |
| Code or product behavior changed and docs must match reality | **`docs-sync`** skill: [`.github/skills/docs-sync/SKILL.md`](../.github/skills/docs-sync/SKILL.md) | Updated canonical docs; skills adjusted only where they reference stale paths or behavior |
| Edits to `.github/skills/` or `routing.yml` | Same implementation work, plus **skill authoring governance** and **`npm run orchestration:validate`** before push | Validated skill and routing metadata |
| Repeated orchestration misses, portfolio drift, or need for a formal **reviewer packet** (not a full doc rewrite) | **Workflow Governance Reviewer** ([`self-iteration.agent.md`](../.github/agents/self-iteration.agent.md)) | Reviewer packet; smallest proposed change set; **no autonomous merge** |

**Supervisor** may sequence these lanes but does **not** substitute for **`docs-sync`** or explicit skill edits when the goal is “documentation matches the codebase.”

## Workflow Governance Reviewer vs bulk documentation sync

- **Use Workflow Governance Reviewer** when you need a **governance artifact**: classification of a repeated workflow problem, validation notes, and explicit reviewer decisions for orchestration, hooks, or portfolio gaps.
- **Use `docs-sync`** when the goal is to **align documentation with the current codebase** (APIs, flows, architecture, onboarding).
- **Do not** invoke Workflow Governance Reviewer as a shorthand for “refresh all skills and agents”; that mixes roles and bypasses the doc-sync and skill-authoring checklists.

## Primary surfaces checklist (periodic review)

When running a deliberate **full refresh**, re-verify these entry points for consistency with each other and with code. Treat this as a **checklist**, not an assertion that any row is currently stale.

| Surface | Role |
|---------|------|
| [`PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md) | Product canon and terminology (mandatory rule box links to this refresh guide when workflow docs change together) |
| [`DEVELOPER_QUICK_REFERENCE.md`](../DEVELOPER_QUICK_REFERENCE.md) | Canonical engineering guardrails |
| [`docs/architecture/current-state.md`](./architecture/current-state.md) | Active architecture map |
| [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) | Unified brain entry for Copilot and contributors |
| [`.github/ORCHESTRATION.md`](../.github/ORCHESTRATION.md) | Human-readable orchestration graph |
| [`.github/orchestration.yaml`](../.github/orchestration.yaml) | Machine-readable orchestration contract |
| [`.github/skills/README.md`](../.github/skills/README.md) | Skill index |
| [`.github/skills/skill-taxonomy.md`](../.github/skills/skill-taxonomy.md) | Canonical skill classification (`ai-runtime` vs `internal`) |
| [`.github/agents/README.md`](../.github/agents/README.md) | Agent portfolio index |
| [`docs/architecture/skill-routing.md`](./architecture/skill-routing.md) | Skill routing architecture (if present) |

After changes to orchestration or routing metadata, run:

```bash
npm run orchestration:validate
node scripts/validate-skill-routing.mjs
```

## Related policy

- [`AI_WORKFLOW_POLICY.md`](../.github/AI_WORKFLOW_POLICY.md) — delivery lanes and planning
- [`ORCHESTRATION_GOVERNANCE.md`](../.github/ORCHESTRATION_GOVERNANCE.md) — change management for agents, skills, and validation
- [`repo-memory/candidates/README.md`](../repo-memory/candidates/README.md) — durable memory **candidates** (not a substitute for tier A–C doc maintenance)

**Discoverability:** This guide is cross-linked from [`.github/skills/README.md`](../.github/skills/README.md), [`.github/skills/docs-sync/SKILL.md`](../.github/skills/docs-sync/SKILL.md), [`.github/copilot-instructions.md`](../.github/copilot-instructions.md), [`.github/ORCHESTRATION.md`](../.github/ORCHESTRATION.md), [`.github/ORCHESTRATION_GOVERNANCE.md`](../.github/ORCHESTRATION_GOVERNANCE.md), [`.github/CONTRIBUTOR_AGENT_HARNESS.md`](../.github/CONTRIBUTOR_AGENT_HARNESS.md), [`.github/agents/README.md`](../.github/agents/README.md), [`.github/agents/supervisor.agent.md`](../.github/agents/supervisor.agent.md), [`.github/agents/self-iteration.agent.md`](../.github/agents/self-iteration.agent.md), [`DEVELOPER_QUICK_REFERENCE.md`](../DEVELOPER_QUICK_REFERENCE.md), [`docs/architecture/current-state.md`](./architecture/current-state.md), [`docs/architecture/skill-routing.md`](./architecture/skill-routing.md), and the **MANDATORY RULE FOR ALL CONTRIBUTORS** box at the top of [`PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md).
