---
name: skill-authoring-governance
description: >-
  Governing skill for writing, reviewing, auditing, and improving repo skills
  under .github/skills/. Use when creating a new skill, writing a skill,
  updating this skill doc, auditing our skills, reviewing skill quality,
  bringing a skill up to standard, normalizing skill metadata, or improving
  skill documentation. Ensures consistency, clarity, triggerability,
  progressive disclosure, and technical correctness across the repo's skill
  system. Also applies when reviewing a PR that adds or changes skill docs.
---

# Skill Authoring Governance

**Core rule:** This is the governing skill for the `.github/skills/` system. It defines how skills are written, structured, reviewed, and maintained so the system stays consistent, concise, and trustworthy for both human contributors and AI assistants. Core principles: **consistency, clarity, triggerability, progressive disclosure, technical correctness**.

## When to use this skill

- Creating a brand-new skill from scratch
- Revising or extending an existing skill
- Updating **many** skills in one effort — also follow [`docs/ai/ai-workflow-documentation-refresh.md`](../../../docs/ai/ai-workflow-documentation-refresh.md) for scope tiers, PR splitting, and validation alongside this skill
- Auditing one or more skills against the repo's standard
- Normalizing inconsistent frontmatter, structure, examples, or checklists
- Reviewing a PR that adds or changes skill docs
- Improving weak, outdated, or low-quality skills

## What good skills must include

| Element | Requirement |
|---------|-------------|
| YAML frontmatter | `name` in kebab-case matching the folder; `description` under 1024 chars with "what it does", "when to use it", and explicit trigger phrases; no XML |
| File structure | `SKILL.md` at root of kebab-case folder; no `README.md` inside; detailed material in `references/` |
| Use cases | Explicit "When to use this skill" section with concrete scenarios |
| Actionable guidance | Step-by-step instructions, not prose summaries |
| Examples | Quick examples section; deeper examples in `references/examples.md` |
| Troubleshooting | Common failure modes with concrete fixes |
| Review checklist | Short checklist for verifying correct application of the skill |
| References | Relative paths only |
| Progressive disclosure | `SKILL.md` stays concise; depth moves to `references/`. Hard limit: 100 lines. |

See [`references/governance-details.md`](./references/governance-details.md) for the full description discipline guide, script guidelines, sequential workflow, output mode templates, and full audit framework.

## Common failure modes

| Failure | Fix |
|---------|-----|
| `name` uses Title Case or spaces | Use kebab-case matching the folder name |
| `description` explains what a skill covers but not when to use it | Add explicit use cases and trigger phrases |
| No trigger phrases in `description` | Add 3–5 short phrases that naturally precede loading the skill |
| `SKILL.md` is too long (becomes a handbook) | Move detailed reference material to `references/`. Hard rule: if `SKILL.md` exceeds 100 lines, excess must live in `references/`. |
| No examples | Add `## Quick examples` and/or `references/examples.md` |
| No troubleshooting section | Add `## Troubleshooting` with 3–5 common issues |
| No review checklist | Add `## Review checklist` with 4–8 actionable items |
| References use absolute or broken paths | Use relative paths from the skill folder root |
| Generic advice instead of operational guidance | Replace with concrete steps, file paths, and patterns |
| No deterministic utility scripts for repeatable operations | Add `scripts/` helper when the same code would be generated repeatedly or errors need explicit handling |
| Code-review skill lacks Harness framework evaluation | Add per-pillar checklist and compliance verdict section |

## Quick examples

- **Create a new skill**: start with frontmatter, add a concrete "When to use this skill" section, then add quick examples, troubleshooting, and a review checklist before moving any long material to `references/`.
- **Audit an existing skill**: check folder/file naming first, then frontmatter, then whether the skill is actionable and includes examples, troubleshooting, and validation.
- **Review a PR that changes a skill**: verify the changed skill still matches the checklist in [`references/checklist.md`](./references/checklist.md) and that new requirements did not bloat `SKILL.md`.

## Troubleshooting

**A skill reads well but is hard to trigger**
Add explicit trigger phrases to the frontmatter `description` and concrete scenarios under "When to use this skill".

**A skill is accurate but too long**
Keep the core rule and workflow in `SKILL.md`, then move examples, checklists, or large reference material into `references/`.

**An audit result feels subjective**
Tie findings back to the checklist in [`references/checklist.md`](./references/checklist.md) so each pass/fail item is objective and repeatable.

## Review checklist

Before merging a skill PR, verify:

- [ ] `name` is kebab-case and matches the folder name
- [ ] `description` is under 1024 chars, includes trigger phrases, explains both what and when, and follows the description-first discipline
- [ ] No `README.md` inside the skill folder
- [ ] `SKILL.md` is concise — detailed material is in `references/` if needed; hard limit 100 lines
- [ ] "When to use this skill" section is present with concrete use cases
- [ ] At least one quick example is included
- [ ] Troubleshooting section is present
- [ ] Review checklist is present
- [ ] All `references/` links use relative paths

## Related files

- [`docs/ai/ai-workflow-documentation-refresh.md`](../../../docs/ai/ai-workflow-documentation-refresh.md) — coordinated refresh of docs + skills + agents (lanes, `docs-sync`, orchestration validation)
- [`.github/skills/README.md`](../README.md) — skill index and authoring conventions
- [`.github/copilot-instructions.md`](../../copilot-instructions.md) — repo-wide Copilot instructions
- [`references/checklist.md`](./references/checklist.md) — full golden standard checklist
- [`references/examples.md`](./references/examples.md) — practical examples for skill writing and auditing
- [`references/governance-details.md`](./references/governance-details.md) — full audit framework, description discipline, script guidelines, output mode templates
