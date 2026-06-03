---
name: onboarding-state-architecture
description: >
  Server-driven nextStep from GET /api/auth/user, onboardingCheckpoint recovery,
  web + mini-program shared mapping, legacy quarantine. Triggers: stuck in onboarding,
  new step, nextStep wrong, routing loop, completion flags, profileEssentialComplete.
---

# Onboarding State Architecture

**Core rule:** `nextStep` returned by `GET /api/auth/user` is the single source of truth for onboarding progress. The client reads state and navigates accordingly — it never reconstructs onboarding progress independently.

## When to use this skill

- Adding or modifying an onboarding step or route
- Changing a completion flag on the `users` table
- Debugging a user stuck in the onboarding flow
- Reviewing client-side routing logic for authenticated users

## When NOT to use this skill

- Changing the personality assessment questions or archetype scoring (use `personality-system`)
- Working on the profile page after onboarding is complete (use `frontend-component-architecture`)
- Debugging auth login failures before `nextStep` is reached (use `auth-session-and-safety-boundaries`)

## Authority chain

```
GET /api/auth/user
  └─ routes/domains/auth.ts (computes nextStep; optional checkpoint bump)
       └─ useAuth.ts (exposes contract)
            └─ AuthenticatedRouter (gates routes)
                 ├─ packages/shared/src/onboarding.ts — shared helpers
                 └─ features/onboarding/active/ — web pages
```

**Mini-program:** parallel pages under `apps/mini-program/src/pages/onboarding/` must obey the same server `nextStep`.

## Grill-me stress-test

After modifying onboarding flow, run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — a one-question-per-turn interview that stress-tests nextStep computation, completion flags, restart idempotency, swipe-back recovery, and routing-loop prevention. Routing loops are the #1 support burden.

## Active onboarding steps

| nextStep value | Route | Completion signal |
|----------------|-------|-------------------|
| `personality-test` | `/personality-test` | `hasCompletedPersonalityTest` |
| `essential-data` | `/onboarding/setup` | `profileEssentialComplete` |
| `extended-data` | `/onboarding/extended` | `hasCompletedInterestsCarousel` |
| `profile-review` | `/onboarding/review` | `hasSeenProfileReview` |
| `discover` | `/discover` | `onboardingCheckpoint === 'discover'` |

**Extended data gate:** `extended-data` is driven by **`hasCompletedInterestsCarousel`** — do not use `profileExtendedComplete` as a substitute for routing logic.

For checkpoint recovery specifics, web + mini-program mapping details, legacy quarantine list, and routing loop troubleshooting — see [references/flow-details.md](references/flow-details.md).

## Quick examples

**User says:** "A user is stuck on the personality-test screen after completing it."
**Apply this skill by:** Checking that `POST /api/auth/complete-personality-test` correctly sets `hasCompletedPersonalityTest = true`, and that the client re-fetches `/api/auth/user` after completion so `nextStep` updates.
**Result:** Server state drives the step transition; the client follows the updated `nextStep`.

---

**User says:** "Add a `photo-upload` step after `essential-data`."
**Apply this skill by:** Adding a `nextStep` value to the server computation in `routes/domains/auth.ts`, adding a `hasCompletedPhotoUpload` flag to the `users` table, adding the route/page under `features/onboarding/active/pages/`, and updating `flow.ts` with the new step → route mapping.
**Result:** Step is fully server-driven; the client reads the new `nextStep` and routes accordingly.

## Troubleshooting

- **`nextStep` is stale — client shows old step after completing a step** — the client is not re-fetching `/api/auth/user` after the step completion call. Invalidate the auth query and re-fetch before navigating.
- **Routing loop — user is redirected back to a step they already completed** — the completion flag is not being persisted on the server (check the POST handler), or the `nextStep` computation in `auth.ts` is not reflecting the updated flag.
- **Client is deriving onboarding position from local flags** — remove client-side step reconstruction. All routing decisions must come from the `nextStep` value returned by `GET /api/auth/user`.
- **Legacy quarantine identifier (`hasCompletedRegistration`) appearing in new code** — remove it immediately; this will also fail the `npm run guardrails` check.

## Review checklist

- [ ] `nextStep` is computed server-side in `routes/domains/auth.ts` — never derived on the client
- [ ] New completion flag is a persisted column on the `users` table (or server-computed field documented here), not client-local state
- [ ] Client re-fetches `/api/auth/user` after each step completes before navigating
- [ ] New web pages are placed under `features/onboarding/active/pages/`; mini-program steps stay under `apps/mini-program/src/pages/onboarding/`
- [ ] `flow.ts` and `packages/shared/src/onboarding.ts` stay aligned for any new `nextStep` value
- [ ] No legacy identifiers (`hasCompletedRegistration`, `registration_sessions`, etc.) in **new** code
- [ ] Grill-me interview completed for any step addition, reorder, or restart change (see `references/grill-me-checklist.md`)
