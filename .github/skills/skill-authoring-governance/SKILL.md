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

## Purpose

This is the governing skill for the `.github/skills/` system. It defines how skills are written, structured, reviewed, and maintained so the system stays consistent, concise, and trustworthy for both human contributors and AI assistants.

Core principles: **consistency, clarity, triggerability, progressive disclosure, technical correctness**.

---

## When to use this skill

- Creating a brand-new skill from scratch
- Revising or extending an existing skill
- Auditing one or more skills against the repo's standard
- Normalizing inconsistent frontmatter, structure, examples, or checklists
- Reviewing a PR that adds or changes skill docs
- Improving weak, outdated, or low-quality skills

---

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
| Progressive disclosure | `SKILL.md` stays concise; depth moves to `references/` |

---

## Sequential workflow

Follow this order for any skill task:

1. **Identify request type** — new skill, update to existing, audit, normalization, or PR review
2. **Verify structure and frontmatter** — folder name, `SKILL.md` exists, no `README.md`, frontmatter fields correct
3. **Verify content quality** — use cases present, guidance is actionable, no padding
4. **Verify patterns and methodology** — sequential workflow or other appropriate pattern is used and explained
5. **Verify validation material** — examples exist, troubleshooting section present, review checklist present
6. **Produce output** — new files, patch recommendations, or audit findings (see Output modes below)

---

## Audit framework

When auditing a skill or the full skills system, evaluate against these areas:

1. YAML frontmatter
2. File structure and naming
3. Progressive disclosure
4. Instructions quality
5. Patterns and methodology
6. Testing and validation
7. Technical correctness
8. Distribution readiness

For the full golden checklist, see [`references/checklist.md`](./references/checklist.md).

When auditing code-review or operational-quality skills, also check against **Harness Engineering Framework pillars**: reliability, scalability, security, observability, and maintainability. A skill that teaches code review should require explicit evaluation against each pillar and produce a per-pillar compliance verdict (Pass / Fail / Needs attention).

---

## Output modes

### New skill creation
Produce: `SKILL.md` with correct frontmatter, all required sections, and a `references/` directory if examples or checklists are too detailed for the core file.

### Existing skill improvement
Produce: targeted patches to weak or missing sections. Do not rewrite sections that are already compliant. Document what changed and why.

### Repo-wide audit
Produce: an audit report per skill listing compliant and non-compliant items per checklist area. See [`references/examples.md`](./references/examples.md) for the audit report format.

### PR review for skill changes
Produce: inline comments or a review summary noting which checklist items pass or fail. Flag missing trigger phrases, missing review checklists, or bloated `SKILL.md` files.

---

## Quick examples

- **Create a new skill**: start with frontmatter, add a concrete "When to use this skill" section, then add quick examples, troubleshooting, and a review checklist before moving any long material to `references/`.
- **Audit an existing skill**: check folder/file naming first, then frontmatter, then whether the skill is actionable and includes examples, troubleshooting, and validation.
- **Review a PR that changes a skill**: verify the changed skill still matches the checklist in [`references/checklist.md`](./references/checklist.md) and that new requirements did not bloat `SKILL.md`.

---

## Common failure modes

| Failure | Fix |
|---------|-----|
| `name` uses Title Case or spaces | Use kebab-case matching the folder name |
| `description` explains what a skill covers but not when to use it | Add explicit use cases and trigger phrases |
| No trigger phrases in `description` | Add 3–5 short phrases that naturally precede loading the skill |
| `SKILL.md` is too long (becomes a handbook) | Move detailed reference material to `references/` |
| No examples | Add `## Quick examples` and/or `references/examples.md` |
| No troubleshooting section | Add `## Troubleshooting` with 3–5 common issues |
| No review checklist | Add `## Review checklist` with 4–8 actionable items |
| References use absolute or broken paths | Use relative paths from the skill folder root |
| Generic advice instead of operational guidance | Replace with concrete steps, file paths, and patterns |
| Code-review skill lacks Harness framework evaluation | Add per-pillar checklist and compliance verdict section |

## Troubleshooting

**A skill reads well but is hard to trigger**
Add explicit trigger phrases to the frontmatter `description` and concrete scenarios under "When to use this skill".

**A skill is accurate but too long**
Keep the core rule and workflow in `SKILL.md`, then move examples, checklists, or large reference material into `references/`.

**An audit result feels subjective**
Tie findings back to the checklist in [`references/checklist.md`](./references/checklist.md) so each pass/fail item is objective and repeatable.

---

## Review checklist

Before merging a skill PR, verify:

- [ ] `name` is kebab-case and matches the folder name
- [ ] `description` is under 1024 chars, includes trigger phrases, explains both what and when
- [ ] No `README.md` inside the skill folder
- [ ] `SKILL.md` is concise — detailed material is in `references/` if needed
- [ ] "When to use this skill" section is present with concrete use cases
- [ ] At least one quick example is included
- [ ] Troubleshooting section is present
- [ ] Review checklist is present
- [ ] All `references/` links use relative paths

---

## Related files

- [`.github/skills/README.md`](../README.md) — skill index and authoring conventions
- [`.github/copilot-instructions.md`](../../copilot-instructions.md) — repo-wide Copilot instructions
- [`references/checklist.md`](./references/checklist.md) — full golden standard checklist
- [`references/examples.md`](./references/examples.md) — practical examples for skill writing and auditing
