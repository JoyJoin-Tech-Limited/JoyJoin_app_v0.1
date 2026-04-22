# Skill: Documentation Discipline

Keep docs synchronized with code changes and write docs that stay useful over time.

## When to Use

- Adding a new feature that needs user-facing or developer-facing docs
- Changing an API, schema, or architectural boundary
- Creating a new skill, agent, or runbook
- Updating READMEs after workflow changes
- Auditing docs for staleness

## Core Principles

1. **Docs are code**: They live in the repo, get reviewed in PRs, and must be kept in sync.
2. **One source of truth**: Do not duplicate the same information in multiple files. Link instead.
3. **Audience-aware**: Write differently for end-users, developers, and AI agents.
4. **Executable where possible**: Examples should be copy-paste runnable. Commands should be exact.
5. **Temporal markers**: Always include a last-updated date or version anchor.

## Protocol

### Step 1: Identify the Doc Surface
- Determine who needs to know about the change:
  - **End users** → `docs/runbooks/`, `docs/guides/`
  - **Developers** → `docs/architecture/`, `README.md`, `DEVELOPER_QUICK_REFERENCE.md`
  - **AI agents** → `AGENTS.md`, skill files, agent prompts
  - **Ops** → `docs/ops/`, `infra/`, runbooks

### Step 2: Update or Create
- If a doc exists for the topic, update it. Do not create a parallel doc.
- If no doc exists, create one in the appropriate directory per repo conventions.
- Cross-link to related docs using relative paths.
- Include a `Last updated: YYYY-MM-DD` line.

### Step 3: Validate Accuracy
- Run any commands in the doc to verify they work.
- Check that file paths and variable names match the current codebase.
- Verify links to other docs are not broken.
- Run `npm run orchestration:validate` if orchestration docs changed.
- Run `npm run guardrails` if AGENTS.md or skill files changed.

### Step 4: Sync Downstream
- If you update a canonical doc (e.g., `DEVELOPER_QUICK_REFERENCE.md`), check if other docs repeat the same info and should be deduplicated.
- If you add a new skill, update `.github/skills/README.md` if it has an index.
- If you add a new agent, update `.github/agents/README.md` if it has a roster.

## Anti-Patterns to Avoid

- **Docs as an afterthought**: Do not write docs after all code is done. Write them as you go.
- **Copy-paste staleness**: Do not copy a section from one doc to another. Use a link.
- **Vague commands**: Avoid "run the build script" — write `npm run build:server`.
- **Missing audience**: Do not mix end-user instructions with internal API details in the same doc.
- **No date stamp**: Undated docs are assumed stale. Always include `Last updated`.

## Output Format

End your turn with:
- Docs created or updated
- Audience for each doc
- Validation steps performed
- Any stale docs flagged for future cleanup

## Related Files

- `.github/skills/docs-sync/SKILL.md` — comprehensive doc sync after large changes
- `.github/skills/skill-authoring-governance/SKILL.md` — when creating or editing skills
- `.github/skills/orchestration-turn-reporting/SKILL.md` — when updating agent/skill metadata
