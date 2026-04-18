# Docs-Sync Validation Checklist

Use this checklist to verify a documentation update is complete and correct before committing.

---

## Active-flow integrity

- [ ] No legacy identifier, deprecated route, or removed component was added to any active-flow documentation section
- [ ] `DEVELOPER_QUICK_REFERENCE.md` supersedes `QUICK_REFERENCE.md` — only the canonical file was updated
- [ ] No reference to the 14-archetype V1/V2 system, `/chats`, direct messaging, `圈子`, or `shared/` root imports was introduced
- [ ] If a banned legacy identifier was added to the codebase, it was also added to the guardrail list in `DEVELOPER_QUICK_REFERENCE.md` and enforced in `scripts/check-guardrails.mjs`

---

## Coordinated multi-tier refresh (optional)

Use when the change set spans `docs/`, `.github/skills/`, and `.github/agents/` in one initiative:

- [ ] [`docs/ai-workflow-documentation-refresh.md`](../../../../docs/ai-workflow-documentation-refresh.md) was consulted for scope tiers and lanes
- [ ] `npm run orchestration:validate` and/or `node scripts/validate-skill-routing.mjs` were run if orchestration or `routing.yml` files changed

---

## Canonical priority

- [ ] `DEVELOPER_QUICK_REFERENCE.md` was updated (or confirmed accurate) before any supplementary doc
- [ ] `docs/architecture/current-state.md` was updated if the authority chain or file placement changed
- [ ] Domain-specific `docs/` files (e.g. `onboarding-flow.md`, `MATCHING_ALGORITHM_REFERENCE.md`) were updated before skills
- [ ] Skill `SKILL.md` files were updated last, after canonical docs

---

## Coverage

- [ ] Every new public API route is documented with HTTP method, path, and auth requirement
- [ ] Every renamed or removed route has been removed from all documentation targets
- [ ] Every new `users` table flag or completion signal is listed in the correct onboarding step table
- [ ] Every new environment variable is described in `.env.example` and `DEVELOPER_QUICK_REFERENCE.md`
- [ ] Every new shared UI component is listed in `packages/shared/src/README.md`
- [ ] Every new Prometheus metric or structured log field is listed in `docs/observability.md` or the observability skill
- [ ] Every new monorepo workspace or domain in `routes/domains/` is listed in the relevant skill and quick reference

---

## Skill routing accuracy

- [ ] All `SKILL.md` **Related files** entries reference paths that currently exist in the repo
- [ ] All `SKILL.md` trigger phrases use current identifiers (no renamed symbols, no deprecated routes)
- [ ] `.github/skills/README.md` table is up to date — new skills are listed, removed skills are removed

---

## Minimal-diff discipline

- [ ] Only the stale sections were updated — accurate sections were not reformatted or rewritten
- [ ] Tables were extended with new rows, not recreated from scratch
- [ ] No summary rewrites, no content expansions unrelated to the code change
- [ ] No accidental inclusion of internal implementation details (e.g. private function names, SQL query internals)

---

## Commit and approval

- [ ] Documentation impact summary was presented for confirmation before changes were applied
- [ ] All Required updates are applied; Recommended updates were either applied or explicitly deferred
- [ ] Commit message follows `docs: sync [area] after [change]` pattern
- [ ] No secrets, credentials, or environment-specific values were committed to any documentation file
