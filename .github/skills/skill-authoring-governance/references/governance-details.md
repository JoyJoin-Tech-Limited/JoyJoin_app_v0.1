# Governance Details

## Description discipline

The `description` field is **the only thing your agent sees** when deciding which skill to load. It is surfaced in the system prompt alongside all other installed skills.

**Goal:** Give the agent just enough info to know:
1. What capability this skill provides
2. When/why to trigger it (specific keywords, contexts, file types)

**Format:** max 1024 chars; first sentence = what it does; second sentence = "Use when [triggers]".

**Good example:**
```
Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when user mentions PDFs, forms, or document extraction.
```

**Bad example:**
```
Helps with documents.
```

## When to add scripts

Add utility scripts when:
- The operation is deterministic (validation, formatting, code generation)
- The same code would be generated repeatedly
- Errors need explicit handling

Scripts save tokens and improve reliability versus generated code.

## Sequential workflow

Follow this order for any skill task:

1. **Gather requirements** — ask the user (or yourself) about:
   - What task or domain does the skill cover?
   - What specific use cases should it handle?
   - Does it need executable scripts or just instructions?
   - Any reference materials to include?
2. **Draft the skill** — create:
   - `SKILL.md` with correct frontmatter and concise instructions
   - `references/` directory if content exceeds 100 lines or has distinct domains
   - `scripts/` directory if deterministic operations are needed
3. **Review with user** — present the draft and ask:
   - Does this cover your use cases?
   - Anything missing or unclear?
   - Should any section be more or less detailed?
4. **Identify request type** — new skill, update to existing, audit, normalization, or PR review
5. **Verify structure and frontmatter** — folder name, `SKILL.md` exists, no `README.md`, frontmatter fields correct
6. **Verify content quality** — use cases present, guidance is actionable, no padding
7. **Verify patterns and methodology** — sequential workflow or other appropriate pattern is used and explained
8. **Verify validation material** — examples exist, troubleshooting section present, review checklist present
9. **Produce output** — new files, patch recommendations, or audit findings (see Output modes below)

## Full audit framework

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

## Output modes

### New skill creation
Produce: `SKILL.md` with correct frontmatter, all required sections, and a `references/` directory if examples or checklists are too detailed for the core file.

### Existing skill improvement
Produce: targeted patches to weak or missing sections. Do not rewrite sections that are already compliant. Document what changed and why.

### Repo-wide audit
Produce: an audit report per skill listing compliant and non-compliant items per checklist area. See [`references/examples.md`](./references/examples.md) for the audit report format.

### PR review for skill changes
Produce: inline comments or a review summary noting which checklist items pass or fail. Flag missing trigger phrases, missing review checklists, or bloated `SKILL.md` files.

## Script guidelines

- Scripts must be deterministic and well-documented.
- Place scripts in a `scripts/` folder within the skill directory.
- Reference scripts from `SKILL.md` with relative paths.
- Prefer scripts over generated code when the same logic would be repeated.

## Output mode templates

### New skill
```
SKILL.md
├── YAML frontmatter (name, description)
├── Core rule
├── When to use this skill
├── Instructions (step-by-step)
├── Quick examples
├── Troubleshooting
├── Review checklist
└── references/ (if >100 lines)
```

### Audit report
```
## Audit: [skill-name]

### [Checklist area] — [PASS / FAIL / PARTIAL]
- [item] — [verdict + evidence]

### Overall verdict: [verdict] — [N] items to fix before merge
```

### PR review for skill changes
```
- [ ] Frontmatter: [pass/fail]
- [ ] Structure: [pass/fail]
- [ ] Content quality: [pass/fail]
- [ ] Bloated SKILL.md: [yes/no — move to references/ if yes]
```
