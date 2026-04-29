---
name: docs-sync
description: >
  Comprehensive documentation updater. Scans code changes, maps to documentation files, and
  updates reference docs. Use when user says "update docs", "sync documentation", "document
  recent changes", "refresh reference docs", or after significant code changes that affect
  architecture, APIs, or user guides.
---

# Docs Sync

**Core rule:** Documentation updates must track the active codebase — never revive legacy sections, never reference deprecated flows, and never fabricate state that doesn't exist in production code. When in doubt, omit rather than guess.

## When to use this skill

- A PR has merged or is under review and its changes are not yet documented
- Running a **coordinated refresh** across canonical docs, `.github/skills/`, and `.github/agents/` (pair with `docs/ai-workflow-documentation-refresh.md` for scope and PR splitting)
- An API, route, or data model has changed and reference docs are stale
- An onboarding, matching, or icebreaker flow has been modified
- A new shared component, variant, or token has been added
- Architecture has shifted (e.g. a new domain added to `routes/domains/`)
- Skills in `.github/skills/` reference paths, symbols, or behaviours that no longer exist

## Do not use when

- Writing new product requirements — belongs in `PRODUCT_REQUIREMENTS.md` via product decision, not code-change sync
- Change is purely internal (private function rename, test helper refactor) with no API, architecture, or flow impact
- Documentation is already accurate and up-to-date for the changed area

## Hard guardrail: active documentation only

> **Only document what exists in the active codebase today.**

- Update `DEVELOPER_QUICK_REFERENCE.md` and canonical `docs/architecture/` files **before** updating supplementary references or skills.
- Never add documentation for a legacy flow to the active section. If a legacy flow must be mentioned, place it only in the "legacy quarantine" section.
- Never cross-reference a deprecated route, component, or API in new or updated doc sections.
- If a doc section describes something that was removed, mark it `<!-- REMOVED -->` or delete it.
- The `QUICK_REFERENCE.md` file (legacy) is **not canonical**. Always update `DEVELOPER_QUICK_REFERENCE.md` instead.

## Priority classification

| Priority | When | Example |
|----------|------|---------|
| **Required** | Canonical docs are wrong and will cause active mistakes | Route renamed but `DEVELOPER_QUICK_REFERENCE.md` still references old path |
| **Recommended** | Docs are incomplete but not actively misleading | New shared component exists but not listed in `packages/shared/src/README.md` |
| **Optional** | Minor accuracy improvement with low usage impact | Inline code comment in a skill example references a renamed variable |

Always address **Required** updates first. Present **Recommended** updates for confirmation. Offer **Optional** updates but do not apply without explicit approval.

## Output format

See [`references/example.md`](./references/example.md) for the documentation impact summary template.

## Common documentation impact patterns

See [`references/mapping.md`](./references/mapping.md) for the full source-to-doc mapping guide including:
- New API route → `DEVELOPER_QUICK_REFERENCE.md`, `docs/api/`, relevant domain skill
- Route renamed/removed → Update all occurrences; mark removed routes
- New `nextStep` onboarding value → `docs/onboarding-flow.md`, `onboarding-state-architecture` skill
- New shared component → `packages/shared/src/README.md`, `frontend-component-architecture` skill
- New design token → `design-system-governance` skill
- New env var → `.env.example` comment, `DEVELOPER_QUICK_REFERENCE.md`
- New banned legacy identifier → `DEVELOPER_QUICK_REFERENCE.md` guardrail list, `scripts/check-guardrails.mjs`
- New domain in `routes/domains/` → `server-domain-architecture` skill, `apps/server/src/README.md`
- Matching weight or signal change → `matching-domain` skill
- Icebreaker phase or action change → `social-icebreaker-domain` skill
- New Prometheus metric → `platform-observability-and-ops` skill, `docs/observability.md`
- Drizzle schema change → `backend-models-standards` notes, migration docs

## If no documentation target exists

If a code change has clear doc impact but no existing doc section covers it:

1. Identify the closest canonical doc as the best home (prefer `DEVELOPER_QUICK_REFERENCE.md` or `docs/architecture/current-state.md`)
2. Propose a new section with a suggested heading and short content
3. Ask for explicit approval before creating the new section
4. If the change warrants an entirely new doc file, propose the path and structure but do not create it without approval

Never silently create new doc files. New docs require intentional decision, not automatic generation.

## Quick examples

**User says:** "We added a new `photo-upload` onboarding step."
**Apply this skill by:** Updating `docs/onboarding-flow.md` step sequence, updating the `Active onboarding steps` table in `onboarding-state-architecture` SKILL.md, adding the new `nextStep` value to `DEVELOPER_QUICK_REFERENCE.md`, and ensuring the new completion flag is listed in `backend-models-standards`.
**Result:** All three canonical references reflect the new step; a contributor reading any of them will understand the full picture.

---

**User says:** "We renamed `/api/matching/pools` to `/api/pools`."
**Apply this skill by:** Checking all doc files that reference the old route path, updating each occurrence to the new path, and confirming that `DEVELOPER_QUICK_REFERENCE.md` and the `matching-domain` skill reflect the change.
**Result:** No stale route references remain in any canonical doc.

---

**User says:** "We removed the `hasCompletedRegistration` field from the `users` table."
**Apply this skill by:** Adding `hasCompletedRegistration` to the banned-identifier guardrail list in `DEVELOPER_QUICK_REFERENCE.md` if not already present, verifying `scripts/check-guardrails.mjs` enforces the ban, and removing any remaining references from active documentation.
**Result:** The legacy identifier is fully quarantined in both docs and CI enforcement.

---

**User says:** "Update docs after refactoring `poolMatchingService.ts`."
**Apply this skill by:** First classifying the change — if only internal function names changed with no public interface change, no doc update is needed. If scoring weights, thresholds, or the public function signature changed, update `matching-domain` SKILL.md and `docs/MATCHING_ALGORITHM_REFERENCE.md` accordingly.
**Result:** Minimal targeted update; no unnecessary churn.

## Troubleshooting

- **Doc and code disagree on a route path** — trust the code (the route registered in `apps/server/src/routes.ts` or `routes/domains/`), update the doc to match. Never update the code to match an outdated doc.
- **Multiple docs reference the same stale info** — update the canonical source first, then update derivative references. Do not update derivative references independently; they will diverge again.
- **Skill routing metadata is stale** — update the `SKILL.md` **Related files** section and trigger list. Stale skill metadata causes wrong skill routing.
- **A legacy doc contradicts the canonical doc** — add a notice at the top of the legacy doc pointing to the canonical source, and mark the conflicting section as deprecated.
- **Unsure if a change warrants Required or Recommended** — default to Required if the stale doc could cause incorrect code or wrong agent action. Default to Recommended if merely incomplete.
- **User asks to "document the old flow for reference"** — decline. Docs-sync only maintains active-flow documentation. Legacy context belongs in commit history and PR descriptions.

## Review checklist

- [ ] Only active-flow behaviour is documented; no legacy flow has been added or revived
- [ ] `DEVELOPER_QUICK_REFERENCE.md` is updated before any supplementary doc or skill
- [ ] Every new or renamed route, exported symbol, env var, and DB column is reflected in the appropriate doc
- [ ] Guardrail lists in `DEVELOPER_QUICK_REFERENCE.md` and `scripts/check-guardrails.mjs` are consistent
- [ ] Skill `SKILL.md` routing metadata reflects current file paths
- [ ] No doc file contains a reference to a removed component, route, or API that could be mistaken for active
- [ ] All doc changes use the existing file's heading structure and format
- [ ] Proposed updates were presented for confirmation before being applied
- [ ] Changes are the minimal diff needed — no unnecessary rewrites of accurate content
- [ ] Commit message follows `docs: sync [area] after [change]` pattern
- [ ] If orchestration or skill `routing.yml` changed, `npm run orchestration:validate` and `node scripts/validate-skill-routing.mjs` were run
