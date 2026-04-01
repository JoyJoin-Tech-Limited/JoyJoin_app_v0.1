---
name: Onboarding State Architecture
description: Server-driven nextStep model, active onboarding module ownership, routing authority, and legacy quarantine rules. Use when working on onboarding routing, completion flags, or any onboarding-related page.
---

# Onboarding State Architecture

**Core rule:** `nextStep` returned by `GET /api/auth/user` is the single source of truth for onboarding progress. The client reads state and navigates accordingly — it never reconstructs onboarding progress independently.

## When to use this skill

- Adding or modifying an onboarding step or route
- Changing a completion flag on the `users` table
- Debugging a user stuck in the onboarding flow
- Reviewing client-side routing logic for authenticated users

## Authority chain

```
GET /api/auth/user
  └─ apps/server/src/routes/domains/auth.ts (computes nextStep)
       └─ apps/user-client/src/hooks/useAuth.ts (exposes contract)
            └─ apps/user-client/src/App.tsx → AuthenticatedRouter (gates routes)
                 └─ apps/user-client/src/features/onboarding/active/
                      ├─ flow.ts (nextStep → route mapping)
                      └─ useOnboardingOrchestrator.ts (progress hook)
```

## Active onboarding steps

| nextStep value | Route | Component | Completion signal (source) |
|----------------|-------|-----------|----------------------------|
| `personality-test` | `/personality-test` | `PersonalityTestPage.tsx` | `hasCompletedPersonalityTest` (`users` table flag) |
| `essential-data` | `/onboarding/setup` | `EssentialDataPage.tsx` | `profileEssentialComplete` (server-computed field from `/api/auth/user`) |
| `extended-data` | `/onboarding/extended` | `ExtendedDataPage.tsx` | `hasCompletedInterestsCarousel` (`users` table flag) |
| `profile-review` | `/onboarding/review` | `FinalProfileReviewPage.tsx` | `hasSeenProfileReview` (`users` table flag) |
| `guide` / `discover` | `/discover` | `DiscoverPage.tsx` | `hasSeenGuide` (`users` table flag) |

All active onboarding pages live under `apps/user-client/src/features/onboarding/active/pages/`.

## Server-owned completion semantics

- Completion flags (`hasCompletedPersonalityTest`, `hasCompletedInterestsCarousel`, `hasSeenProfileReview`, etc.) are set server-side via API calls
- `profileEssentialComplete` is not a persisted `users` table flag — it is a server-computed completion signal returned by `/api/auth/user`
- The client must not set these flags locally or compute its own onboarding position
- After each step completes, re-fetch `/api/auth/user` and use the updated `nextStep`

## Legacy quarantine

- Legacy onboarding surfaces stay under `apps/user-client/src/legacy/onboarding/`
- Do not add new routes, CTAs, or features to legacy onboarding pages
- `GuidePage` is retained for backward compatibility only — `guide` routes directly to `DiscoverPage`
- `ProfileSetupPage` in `legacy/` is unused — do not revive it
- Do not reintroduce `hasCompletedRegistration`, `needsRegistration`, or `registration_sessions` in new code

## nextStep compatibility values

| Value | Meaning |
|-------|---------|
| `onboarding` | Legacy fallback — `AuthenticatedRouter` redirects to `/personality-test` |
| `personality-test` | Pre-essential-data state; allows personality test + setup routes |
| `guide` | Currently routes directly to `DiscoverPage` (inline coach marks) |

These are handled for existing users. Do not create new features that depend on the `onboarding` fallback value.

## Client navigation pattern

```typescript
const { nextStep } = useAuth();
// Use server value — never compute your own
if (nextStep !== 'discover') {
  setLocation(getStepRoute(nextStep)); // from flow.ts
}
```

## Common mistakes to avoid

- Deriving `nextStep` from local flags instead of the server response
- Adding logic to `AuthenticatedRouter` that branches on `hasCompletedRegistration` (legacy field)
- Creating a new page in `apps/user-client/src/legacy/onboarding/pages/`
- Calling `POST /api/guide/complete` as part of a new onboarding step — `guide` is not a blocking step
- Reconstructing step order from `users` table flags on the client side

## Related files

- `apps/user-client/src/App.tsx` — `AuthenticatedRouter` switch
- `apps/user-client/src/hooks/useAuth.ts` — auth state including `nextStep`
- `apps/user-client/src/features/onboarding/active/flow.ts` — `nextStep` → route mapping
- `apps/user-client/src/features/onboarding/active/useOnboardingOrchestrator.ts` — progress hook
- `apps/user-client/src/features/onboarding/README.md` — module boundary docs
- `apps/server/src/routes/domains/auth.ts` — `nextStep` computation
- `apps/server/src/routes/domains/onboarding.ts` — onboarding completion endpoints
- `docs/onboarding-flow.md` — detailed flow documentation
- `docs/architecture/current-state.md` — authority chain and file placement
