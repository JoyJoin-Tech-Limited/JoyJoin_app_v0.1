# Skill Quality Checklist

Full golden standard for evaluating any skill in `.github/skills/`.

---

## 1. YAML Frontmatter

- [ ] `name` is kebab-case — no spaces, no capitals, matches the folder name exactly
- [ ] `description` is under 1024 characters
- [ ] `description` explains **what the skill does** and **when to use it**
- [ ] `description` includes at least 3 explicit trigger phrases
- [ ] No XML angle brackets (`<`, `>`) in frontmatter values
- [ ] No reserved names (`claude`, `anthropic`, etc.) in `name`
- [ ] Optional metadata fields (license, version, etc.) are appropriate if used

---

## 2. File Structure and Naming

- [ ] Folder name is kebab-case
- [ ] `SKILL.md` exists and is named exactly `SKILL.md`
- [ ] No `README.md` inside the skill folder
- [ ] Detailed reference material lives in `references/` when needed
- [ ] Scripts, if any, live in `scripts/` and are documented

---

## 3. Progressive Disclosure

- [ ] Core instructions remain concise — `SKILL.md` is not a handbook
- [ ] Detailed examples, checklists, and reference material move to `references/`
- [ ] Links from `SKILL.md` to `references/` use relative paths

---

## 4. Instructions Quality

- [ ] "When to use this skill" section is present with concrete scenarios
- [ ] Guidance is step-by-step and actionable, not high-level prose
- [ ] Error handling or fail-safe behavior is described where relevant
- [ ] At least one realistic quick example is included (`## Quick examples`)
- [ ] Troubleshooting section is present with 3–5 common issues and fixes
- [ ] MCP/tool usage is correct if the skill depends on external tools

---

## 5. Patterns and Methodology

- [ ] An appropriate sequential workflow or pattern is used where relevant
- [ ] The pattern is clearly explained and consistently followed throughout the skill

---

## 6. Testing and Validation

- [ ] Trigger examples are included (phrases that would naturally invoke the skill)
- [ ] A review checklist (`## Review checklist`) is present for validating correct application
- [ ] For code-review skills: per-pillar Harness Engineering Framework evaluation is included
  (reliability, scalability, security, observability, maintainability) with a
  Pass / Fail / Needs attention verdict per pillar

---

## 7. Technical Correctness

- [ ] No XML angle brackets in frontmatter
- [ ] No reserved names in `name` field
- [ ] All `references/` links use relative paths
- [ ] File paths referenced in the skill are correct and exist in the repo
- [ ] No hard-coded absolute paths (runner paths, machine-specific paths, etc.)

---

## 8. Distribution Readiness

- [ ] Skill is self-contained — a reader can act on it without needing other context
- [ ] MCP dependency is documented if the skill requires an MCP server or external tool
- [ ] Skill is listed in `.github/skills/README.md` under an appropriate category
