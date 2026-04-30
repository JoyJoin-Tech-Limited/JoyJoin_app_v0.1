# Docs-Sync Validation Checklist

Use this checklist to verify a documentation and memory update is complete and correct before committing.

---

## Step 1: Inventory completeness

- [ ] Agent memory was queried (MCP `recall`, `list_recent`, or `search`) for topics related to the session
- [ ] Every `docs/*.md` file was listed and read
- [ ] `README.md` and `AGENTS.md` were read
- [ ] Root-level stray `.md` files were caught via `find`
- [ ] An internal file list exists with `[assessed / needs-edit / skip]` tags

---

## Step 2: Impact coverage

- [ ] Every code change in the session was mapped to at least one knowledge layer
- [ ] Cross-project changes were flagged and downstream project docs checked
- [ ] Agent memory layer was evaluated for stale facts, relative times, and contradictions

---

## Step 3: Editing discipline

- [ ] `docs/` were edited before `AGENTS.md`; `AGENTS.md` before agent memory
- [ ] Merge was preferred over append (existing entries updated rather than duplicated)
- [ ] Delete was preferred over keep (completed plans, overturned decisions, expired context removed)
- [ ] Absolute dates used everywhere (`2026-04-30`); no relative time
- [ ] Audience separation maintained: `AGENTS.md` for AIs, `docs/` for humans, memory for cross-session context
- [ ] Global agent config only touched for cross-project principles, never daily project details

---

## Step 4: Active-flow integrity

- [ ] No legacy identifier, deprecated route, or removed component was added to any active-flow documentation section
- [ ] `DEVELOPER_QUICK_REFERENCE.md` supersedes `QUICK_REFERENCE.md` — only the canonical file was updated
- [ ] No reference to the 14-archetype V1/V2 system, `/chats`, direct messaging, `圈子`, or `shared/` root imports was introduced
- [ ] If a banned legacy identifier was added to the codebase, it was also added to the guardrail list in `DEVELOPER_QUICK_REFERENCE.md` and enforced in `scripts/check-guardrails.mjs`

---

## Step 5: Agent memory integrity

- [ ] Memory index has no broken links; every memory description matches its content
- [ ] No contradictions between agent memory, `AGENTS.md`, and `docs/`
- [ ] Stale memories were updated or deleted (not left to rot)
- [ ] Relative time strings were converted to absolute dates or removed
- [ ] Completed todos / overturned decisions were removed from memory

---

## Step 6: Canonical priority

- [ ] `DEVELOPER_QUICK_REFERENCE.md` was updated (or confirmed accurate) before any supplementary doc
- [ ] `docs/architecture/current-state.md` was updated if the authority chain or file placement changed
- [ ] Domain-specific `docs/` files (e.g. `onboarding-flow.md`, `MATCHING_ALGORITHM_REFERENCE.md`) were updated before skills
- [ ] Skill `SKILL.md` files were updated last, after canonical docs

---

## Step 7: Coverage

### Universal coverage
- [ ] Every new public API route is documented with HTTP method, path, and auth requirement
- [ ] Every renamed or removed route has been removed from all documentation targets **and** agent memory
- [ ] Every new `users` table flag or completion signal is listed in the correct onboarding step table
- [ ] Every new environment variable is described in `.env.example` and `DEVELOPER_QUICK_REFERENCE.md`
- [ ] Every new shared UI component is listed in `packages/shared/src/README.md`
- [ ] Every new Prometheus metric or structured log field is listed in `docs/observability.md` or the observability skill
- [ ] Every new monorepo workspace or domain in `routes/domains/` is listed in the relevant skill and quick reference

### High-miss-rate docs (explicitly verify these)
- [ ] **`PRODUCT_REQUIREMENTS.md`** was assessed: if the change affects a user-facing screen family, feature capability, or data flow, the relevant subsection was updated
- [ ] **`docs/mini-program-product-reference.md`** was assessed: if the change touches the mini-program, the page inventory, user flow, or platform-parity table was updated

---

## Step 8: Skill routing accuracy

- [ ] All `SKILL.md` **Related files** entries reference paths that currently exist in the repo
- [ ] All `SKILL.md` trigger phrases use current identifiers (no renamed symbols, no deprecated routes)
- [ ] `.github/skills/README.md` table is up to date — new skills are listed, removed skills are removed

---

## Step 9: Minimal-diff discipline

- [ ] Only the stale sections were updated — accurate sections were not reformatted or rewritten
- [ ] Tables were extended with new rows, not recreated from scratch
- [ ] No summary rewrites, no content expansions unrelated to the code change
- [ ] No accidental inclusion of internal implementation details (e.g. private function names, SQL query internals)

---

## Step 10: Commit and approval

- [ ] Documentation impact summary was presented for confirmation before changes were applied
- [ ] All Required updates are applied; Recommended updates were either applied or explicitly deferred
- [ ] Commit message follows `docs: sync [area] after [change]` pattern
- [ ] No secrets, credentials, or environment-specific values were committed to any documentation file
- [ ] If orchestration or skill `routing.yml` changed, `npm run orchestration:validate` and `node scripts/validate-skill-routing.mjs` were run
