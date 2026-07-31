# Docs-Sync Worked Example

## Scenario: Adding a `photo-upload` onboarding step

### Context

A PR added a new onboarding step that allows users to upload a profile photo before reaching the profile-review screen. The changes include:

- New `nextStep` value: `'photo-upload'`
- New `users` table flag: `hasCompletedPhotoUpload` (boolean, default false)
- New POST endpoint: `POST /api/auth/complete-photo-upload`
- New page component: `apps/mini-program/src/pages/onboarding/photo-upload/index.tsx`
- Updated `flow.ts` mapping: `'photo-upload'` → `/onboarding/photo-upload`
- Updated `nextStep` computation in `apps/server/src/routes/domains/auth.ts`

### Step 1 — Inventory

- Agent memory: searched for "onboarding", "photo", "nextStep" → found a memory caching the active onboarding step list (stale — missing `photo-upload`)
- Docs: `README.md`, `AGENTS.md`, `docs/onboarding-flow.md`, `DEVELOPER_QUICK_REFERENCE.md`, `onboarding-state-architecture` SKILL.md
- All files read and tagged `[assessed / needs-edit / skip]`

### Step 2 — Impact analysis

- New onboarding step (flow change) ✓
- New API route ✓
- New database column ✓
- New page component ✓

All four categories have documentation and memory implications.

### Step 3 — Map to targets (using `mapping.md`)

| Change | Agent memory | Canonical doc / skill | Section |
|--------|-------------|----------------------|---------|
| New `nextStep` value | Update cached step list | `docs/onboarding-flow.md` | Step sequence |
| New `nextStep` value | — | `onboarding-state-architecture` SKILL.md | Active onboarding steps table |
| New `users` column | — | `DEVELOPER_QUICK_REFERENCE.md` | Server-owned completion semantics |
| New POST endpoint | — | `DEVELOPER_QUICK_REFERENCE.md` / `docs/api/` | Route table |
| New page component | — | `apps/mini-program/README.md` | Module structure |

### Step 4 — Edits

**Agent memory (via MCP `agentMemory`)**
- `update` the cached onboarding-step memory to include `photo-upload` with absolute date `2026-04-30`

**`docs/onboarding-flow.md` — step sequence (before)**
```
| `extended-data`   | `/onboarding/extended` | `ExtendedDataPage.tsx` | `hasCompletedInterestsCarousel` |
| `profile-review`  | `/onboarding/review`   | `FinalProfileReviewPage.tsx` | `hasSeenProfileReview` |
```

**After**
```
| `extended-data`   | `/onboarding/extended`       | `ExtendedDataPage.tsx`         | `hasCompletedInterestsCarousel` |
| `photo-upload`    | `/onboarding/photo-upload`   | `PhotoUploadPage.tsx`          | `hasCompletedPhotoUpload`       |
| `profile-review`  | `/onboarding/review`         | `FinalProfileReviewPage.tsx`   | `hasSeenProfileReview`          |
```

**`.github/skills/onboarding-state-architecture/SKILL.md` — Active onboarding steps (before)**
```markdown
| `extended-data` | `/onboarding/extended` | `ExtendedDataPage.tsx` | `hasCompletedInterestsCarousel` (`users` table flag) |
| `profile-review` | `/onboarding/review` | `FinalProfileReviewPage.tsx` | `hasSeenProfileReview` (`users` table flag) |
```

**After**
```markdown
| `extended-data` | `/onboarding/extended` | `ExtendedDataPage.tsx` | `hasCompletedInterestsCarousel` (`users` table flag) |
| `photo-upload` | `/onboarding/photo-upload` | `PhotoUploadPage.tsx` | `hasCompletedPhotoUpload` (`users` table flag) |
| `profile-review` | `/onboarding/review` | `FinalProfileReviewPage.tsx` | `hasSeenProfileReview` (`users` table flag) |
```

### Step 5 — Self-checklist and summary

Checklist (see [`checklist.md`](./checklist.md) for full 10-step gate):
- [x] All files from inventory assessed or edited
- [x] Agent memory updated; no stale step list remains
- [x] `AGENTS.md` paths match code
- [x] New route in `DEVELOPER_QUICK_REFERENCE.md` and `docs/api/`
- [x] New env var (none in this change)
- [x] No relative time strings
- [x] Only active flow documented

Summary output:
```markdown
## Sync complete

### Memory changes
- Update: cached onboarding step list — added `photo-upload` (2026-04-30)

### Documentation changes
- `docs/onboarding-flow.md` — inserted `photo-upload` step sequence
- `onboarding-state-architecture` SKILL.md — added active step row
- `DEVELOPER_QUICK_REFERENCE.md` — added `nextStep` value and completion flag

### Unhandled
- None
```

### What this example avoids

- ❌ Not touching `QUICK_REFERENCE.md` (legacy, superseded by `DEVELOPER_QUICK_REFERENCE.md`)
- ❌ Not adding the step to `archived/workspaces/user-client/src/legacy/onboarding/` — that directory is quarantined
- ❌ Not reintroducing `hasCompletedRegistration` or any other deprecated identifier
- ❌ Not documenting the internal Drizzle migration file — implementation detail, not a public surface
- ❌ Not reformatting the entire onboarding step table — only the new row is added
- ❌ Not leaving agent memory with a stale onboarding step list

---

## Scenario: Removing a deprecated route

### Context

A PR removed the `/api/legacy/registration` route that had been kept for backward compatibility. No active clients call it.

### Classification

- Route removal ✓
- No UI change ✓
- No DB schema change ✓

### Impact assessment

1. Search all `docs/` and `.github/skills/` for the string `/api/legacy/registration`
2. Search agent memory for the same string (MCP `agentMemory` `search`)
3. If found in any active doc section, mark for removal
4. If found in agent memory, `delete` or `update` it
5. If found only in a legacy/deprecated section, confirm the section should remain or be deleted

### Proposed edit

**Priority:** Required (stale route references cause confusion about the current API surface)

Find every occurrence of `/api/legacy/registration` in documentation and memory. Remove or update each.

**Commit message:**
```
docs: remove /api/legacy/registration references after route deletion
```

---

## Anti-pattern: what NOT to do

**Do not:**
```markdown
<!-- In docs/onboarding-flow.md — BAD example -->
## Legacy registration flow (for reference)
Users previously went through /registration → /onboarding/setup, but this was replaced.
The old guide step still exists at /guide for backward compatibility.
```

**Why this is wrong:**
- Adds legacy flow content to an active-flow doc
- Describes `/guide` as a current feature rather than a deprecated stub
- Will mislead contributors and AI agents that load this file as context

**Do instead:**
- Remove or do not add the legacy section
- If historical context is genuinely needed, put it in the PR description or git commit message, not in canonical docs
