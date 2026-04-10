---
name: docs-sync
description: Comprehensive documentation updater. Scans code changes, maps to documentation files, and updates reference docs. Use when user says "update docs", "sync documentation", "document recent changes", "refresh reference docs", or after significant code changes that affect architecture, APIs, or user guides.
---

# Docs Sync

**Core rule:** Documentation updates must track the active codebase — never revive legacy sections, never reference deprecated flows, and never fabricate state that doesn't exist in production code. When in doubt, omit rather than guess.

---

## Routing metadata

**Use when**
- User says "update docs", "sync documentation", "document recent changes", or "refresh reference docs"
- A PR changes an API, adds/removes a route, renames a module, or alters a user-facing flow
- An architecture decision was made that is not yet reflected in canonical docs
- A skill, quick-reference table, or onboarding guide is visibly stale
- The team wants to ensure docs match the current codebase before a release or onboarding sprint

**Do not use when**
- The task is to write new product requirements — that belongs in `PRODUCT_REQUIREMENTS.md` via a product decision, not a code-change sync
- The change is purely internal (private function rename, test helper refactor, style tweak) with no API, architecture, or flow impact
- Documentation is already accurate and up-to-date for the changed area

**Strong triggers**
- "update docs"
- "sync documentation"
- "document recent changes"
- "refresh reference docs"
- "docs are out of date"
- `DEVELOPER_QUICK_REFERENCE.md`
- `docs/onboarding-flow.md`
- `docs/architecture/`
- `docs/api/`
- `.github/skills/`
- `apps/server/src/README.md`
- `packages/shared/src/README.md`

**Related files**
- `DEVELOPER_QUICK_REFERENCE.md`
- `PRODUCT_REQUIREMENTS.md`
- `docs/` (entire directory)
- `docs/architecture/current-state.md`
- `docs/onboarding-flow.md`
- `.github/skills/README.md`
- `apps/server/src/README.md`
- `apps/user-client/src/features/onboarding/README.md`
- `packages/shared/src/README.md`

---

## When to use this skill

Use this skill when:
- A PR has merged or is under review and its changes are not yet documented
- An API, route, or data model has changed and reference docs are stale
- An onboarding, matching, or icebreaker flow has been modified
- A new shared component, variant, or token has been added
- Architecture has shifted (e.g. a new domain added to `routes/domains/`, a new repo in the monorepo)
- A contributor asks why something is done a certain way and the docs don't explain it
- Skills in `.github/skills/` reference paths, symbols, or behaviours that no longer exist

---

## Hard guardrail: active documentation only

> **Only document what exists in the active codebase today.**

- Update `DEVELOPER_QUICK_REFERENCE.md` and canonical `docs/architecture/` files **before** updating supplementary references or skills.
- Never add documentation for a legacy flow to the active section. If a legacy flow must be mentioned, place it only in the "legacy quarantine" section of the relevant doc, and label it clearly as non-canonical.
- Never cross-reference a deprecated route, component, or API in new or updated doc sections — even as a historical note — unless the legacy section is the explicit subject.
- If a doc section describes something that was removed, mark it `<!-- REMOVED -->` or delete it. Do not leave stale content describing removed behaviour as if it is current.
- The `QUICK_REFERENCE.md` file (legacy) is **not canonical**. Always update `DEVELOPER_QUICK_REFERENCE.md` instead.
- Canonical docs are: `DEVELOPER_QUICK_REFERENCE.md`, `docs/architecture/current-state.md`, `docs/onboarding-flow.md`, and other active files under `docs/architecture/` that describe current production behaviour.
- Supplemental references to update after canonical docs include skills under `.github/skills/`, `apps/server/src/README.md`, `packages/shared/src/README.md`, and other per-module READMEs.

---

## Core goal

Ensure that every significant code change is reflected in documentation so that:
1. New contributors can navigate the codebase using docs alone
2. AI agents load accurate skill context and avoid outdated patterns
3. The canonical guardrails in `DEVELOPER_QUICK_REFERENCE.md` stay aligned with enforcement rules in `scripts/check-guardrails.mjs`
4. Skill routing metadata (`SKILL.md` trigger phrases, related files) remains accurate so the right skill loads at the right time

---

## Scanning process

Follow this workflow for every docs-sync task:

**Step 1 — Identify change scope**
- Get the list of changed files (from PR diff, `git diff`, or user description)
- Classify each change: API route, data model, UI component, onboarding flow, matching logic, icebreaker logic, infra/config, or internal-only refactor

**Step 2 — Collect changed symbols and paths**
- List new/renamed/removed: routes, exported functions, DB columns, shared components, environment variables, npm scripts, and monorepo packages
- Note any renamed or relocated modules

**Step 3 — Map to documentation targets**
- Use `references/mapping.md` to determine which doc files are impacted by each change category
- Prefer canonical targets first: `DEVELOPER_QUICK_REFERENCE.md` → `docs/architecture/` → `docs/` top-level → `.github/skills/` → workspace READMEs
- If no existing doc covers the change, proceed to the "If no documentation target exists" section below

**Step 4 — Extract doc-relevant impacts**
For each changed area, answer:
- Does the public interface (route, function signature, env var) change?
- Does the user-visible flow (onboarding, matching, icebreaker) change?
- Does the architecture change (new domain, new workspace, new shared primitive)?
- Do any guardrail identifiers change?

If all answers are no, the change is likely internal and no doc update is needed.

**Step 5 — Draft minimal targeted updates**
- For each impacted doc, write the smallest diff that makes the doc accurate
- Use the existing doc's format and heading structure — do not reformat
- Update tables, code blocks, step sequences, and file-path references as needed
- Do not rewrite sections that are accurate — only the stale parts

**Step 6 — Present a documentation impact summary**
- List every doc file that would be changed and why (see Output format below)
- Ask the user to confirm before applying changes

**Step 7 — Apply after confirmation**
- Apply approved changes, one file at a time
- Commit with a message like `docs: sync [area] after [change description]`

---

## When documentation updates are unnecessary

Skip doc updates when the change is:

- **Internal refactor only** — private function renamed, internal variable type changed, code moved within the same module without changing the public interface
- **Formatting or whitespace only** — Prettier/ESLint auto-fix with no logic change
- **Test-only change** — new or modified tests unless a test documents a newly enforced architectural invariant (in which case update the relevant skill's review checklist)
- **Comment-only change** — inline code comment added/edited without changing behaviour
- **Config tweak that has no user or contributor impact** — e.g. Vite alias added for an existing path, TypeScript `strict` option already reflected in tsconfig docs
- **Dependency bump with no API-surface change** — library upgraded but the library's API usage is unchanged in this repo
- **Purely cosmetic UI change** — colour, font size, spacing tweak with no component API or design token change

When skipping, state why: "No API or architecture impact — doc update not needed."

---

## Prioritization

| Priority | Description | Examples |
|----------|-------------|---------|
| **Required** | Canonical docs are wrong and will cause active mistakes | Route renamed but `DEVELOPER_QUICK_REFERENCE.md` still references old path; guardrail list missing a new banned identifier; onboarding step added but `docs/onboarding-flow.md` not updated |
| **Recommended** | Docs are incomplete but not actively misleading | New shared component exists but not listed in `packages/shared/src/README.md`; new domain added to `routes/domains/` but `server-domain-architecture` skill not updated; new env var not in `.env.example` comments |
| **Optional** | Minor accuracy improvement with low usage impact | Inline code comment in a skill example references a renamed variable; supplementary `references/` file could benefit from a new row in a table |

Always address **Required** updates first. Present **Recommended** updates for confirmation. Offer **Optional** updates but do not apply without explicit approval.

---

## Output format

Present a documentation impact summary using this structure:

```
## Documentation impact summary

### Changed area: [e.g. "Added `photo-upload` onboarding step"]

**Priority:** Required / Recommended / Optional

**Impacted docs:**
| File | Section | Change needed |
|------|---------|---------------|
| `DEVELOPER_QUICK_REFERENCE.md` | Active onboarding steps table | Add row for `photo-upload` step |
| `docs/onboarding-flow.md` | Step sequence | Insert step between extended-data and profile-review |
| `.github/skills/onboarding-state-architecture/SKILL.md` | Active onboarding steps | Add `nextStep` value and route |

**Proposed edits:**
[Show the specific before/after diff for each file]

---
Confirm to apply? (Reply "apply" to proceed or "skip [file]" to skip individual files.)
```

---

## If no documentation target exists

If a code change has clear doc impact but no existing doc section covers it:

1. Identify the closest canonical doc as the best home (prefer `DEVELOPER_QUICK_REFERENCE.md` or `docs/architecture/current-state.md` for architecture-level changes)
2. Propose a new section with a suggested heading and short content
3. Ask for explicit approval before creating the new section
4. If the change warrants an entirely new doc file, propose the path and structure but do not create it without approval

Never silently create new doc files. New docs require intentional decision, not automatic generation.

---

## Common documentation impact patterns

| Code change | Canonical doc to update | Notes |
|------------|------------------------|-------|
| New API route added | `DEVELOPER_QUICK_REFERENCE.md`, `docs/api/` if present, relevant domain skill | Use exact route path, HTTP method, and auth requirement |
| Route renamed or removed | Same as above | Mark removed routes — do not leave stale references |
| New `nextStep` onboarding value | `docs/onboarding-flow.md`, `onboarding-state-architecture` skill | Update step table and authority chain |
| New `users` table flag | `DEVELOPER_QUICK_REFERENCE.md` (guardrail table if it is a banned identifier), `backend-models-standards` notes | Add flag name and meaning |
| New shared component | `packages/shared/src/README.md`, `frontend-component-architecture` skill | Include export path and intended use |
| New design token or CVA variant | `design-system-governance` skill, `docs/button-design.md` if button-related | Note the token name and usage constraint |
| New environment variable | `.env.example` comment, `DEVELOPER_QUICK_REFERENCE.md` Key Commands section if it affects dev workflow | Never commit actual values |
| New banned legacy identifier | `DEVELOPER_QUICK_REFERENCE.md` legacy guardrail list, `scripts/check-guardrails.mjs` enforcement | Both must stay in sync |
| New domain in `routes/domains/` | `server-domain-architecture` skill, `apps/server/src/README.md` | Note what the domain owns |
| New repository in `repositories/` | `server-domain-architecture` skill | Note ownership |
| New monorepo workspace | `monorepo-workspace-governance` skill, root `DEVELOPER_QUICK_REFERENCE.md` | Add workspace name, script convention |
| Matching weight or signal change | `matching-domain` skill, `docs/MATCHING_ALGORITHM_REFERENCE.md` | Never expose raw weights in public docs |
| Icebreaker phase or action change | `social-icebreaker-domain` skill | Note host vs player authority |
| New Prometheus metric or log field | `platform-observability-and-ops` skill, `docs/observability.md` | Include metric name and labels |
| Drizzle schema change | `backend-models-standards` notes, migration docs if present | Note column type, constraints, and migration path |

See `references/mapping.md` for the full source-to-doc mapping guide.

---

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
- **Skill routing metadata is stale (file path no longer exists)** — update the `SKILL.md` **Related files** section and trigger list. Stale skill metadata causes wrong skill routing, which degrades agent quality across the entire task set.
- **A legacy doc contradicts the canonical doc** — add a notice at the top of the legacy doc pointing to the canonical source, and mark the conflicting section as deprecated. Do not silently delete legacy docs without confirmation.
- **Unsure if a change warrants a Required or Recommended update** — default to Required if the stale doc could cause a contributor to write incorrect code or an AI agent to take a wrong action. Default to Recommended if it would merely be incomplete.
- **User asks to "document the old flow for reference"** — decline. The docs-sync skill only maintains active-flow documentation. Legacy context belongs in commit history and PR descriptions, not in canonical docs.

---

## Review checklist

- [ ] Only active-flow behaviour is documented; no legacy flow has been added or revived in canonical docs
- [ ] `DEVELOPER_QUICK_REFERENCE.md` is updated before any supplementary doc or skill
- [ ] Every new or renamed route, exported symbol, env var, and DB column is reflected in the appropriate doc
- [ ] Guardrail lists in `DEVELOPER_QUICK_REFERENCE.md` and `scripts/check-guardrails.mjs` are consistent
- [ ] Skill `SKILL.md` routing metadata (trigger phrases, related files) reflects current file paths
- [ ] No doc file contains a reference to a removed component, route, or API that could be mistaken for active
- [ ] All doc changes use the existing file's heading structure and format — no reformatting without approval
- [ ] Proposed updates were presented for confirmation before being applied
- [ ] Changes are the minimal diff needed — no unnecessary rewrites of accurate content
- [ ] Commit message follows `docs: sync [area] after [change]` pattern
