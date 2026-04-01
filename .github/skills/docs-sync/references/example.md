# Docs-Sync Worked Example

## Scenario: Adding a `photo-upload` onboarding step

### Context

A PR added a new onboarding step that allows users to upload a profile photo before reaching the profile-review screen. The changes include:

- New `nextStep` value: `'photo-upload'`
- New `users` table flag: `hasCompletedPhotoUpload` (boolean, default false)
- New POST endpoint: `POST /api/auth/complete-photo-upload`
- New page component: `apps/user-client/src/features/onboarding/active/pages/PhotoUploadPage.tsx`
- Updated `flow.ts` mapping: `'photo-upload'` → `/onboarding/photo-upload`
- Updated `nextStep` computation in `apps/server/src/routes/domains/auth.ts`

### Step 1 — Classify the change

- New onboarding step (flow change) ✓
- New API route ✓
- New database column ✓
- New page component ✓

All four categories have documentation implications.

### Step 2 — Map to documentation targets

Using `references/mapping.md`:

| Change | Canonical doc | Section |
|--------|--------------|---------|
| New `nextStep` value | `docs/onboarding-flow.md` | Step sequence |
| New `nextStep` value | `onboarding-state-architecture` SKILL.md | Active onboarding steps table |
| New `users` column | `DEVELOPER_QUICK_REFERENCE.md` | (add to server-owned completion semantics if needed) |
| New POST endpoint | `DEVELOPER_QUICK_REFERENCE.md` / `docs/api/` | Route table |
| New page component | `apps/user-client/src/features/onboarding/README.md` | Module structure |

### Step 3 — Documentation impact summary

```
## Documentation impact summary

### Changed area: Added `photo-upload` onboarding step

**Priority:** Required

**Impacted docs:**
| File | Section | Change needed |
|------|---------|---------------|
| `docs/onboarding-flow.md` | Step sequence table | Insert `photo-upload` between `extended-data` and `profile-review` |
| `.github/skills/onboarding-state-architecture/SKILL.md` | Active onboarding steps | Add row: nextStep=`photo-upload`, route=`/onboarding/photo-upload`, component=`PhotoUploadPage.tsx`, completion=`hasCompletedPhotoUpload` |
| `apps/user-client/src/features/onboarding/README.md` | Active pages list | Add `PhotoUploadPage.tsx` entry |
```

### Step 4 — Proposed edits

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

### Step 5 — What this example avoids

- ❌ Not touching `QUICK_REFERENCE.md` (legacy, superseded by `DEVELOPER_QUICK_REFERENCE.md`)
- ❌ Not adding the step to `apps/user-client/src/legacy/onboarding/` — that directory is quarantined
- ❌ Not reintroducing `hasCompletedRegistration` or any other deprecated identifier
- ❌ Not documenting the internal Drizzle migration file — implementation detail, not a public surface
- ❌ Not reformatting the entire onboarding step table — only the new row is added

### Step 6 — Confirmation and apply

After presenting the impact summary, the user confirms which files to update. Changes are applied file by file, then committed:

```
docs: sync onboarding-flow and skill after photo-upload step addition
```

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
2. If found in any active doc section, mark the reference for removal
3. If found only in a legacy/deprecated section, confirm the section should remain or be deleted

### Proposed edit

**Priority:** Required (stale route references cause confusion about the current API surface)

Find every occurrence of `/api/legacy/registration` in documentation. Either remove the reference or move it to an explicitly-labeled "removed routes" section.

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
