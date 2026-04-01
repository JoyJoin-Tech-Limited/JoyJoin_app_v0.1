# Onboarding Domain Guide

This folder is a documentation anchor for the onboarding domain.

The active onboarding implementation still lives across existing client entry points:
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/App.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useAuth.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useOnboardingProgress.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useOnboardingRoute.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/PersonalityTestPageV4.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/PersonalityTestResultPage.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/EssentialDataPage.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/ExtendedDataPage.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/FinalProfileReviewPage.tsx`

## Active onboarding architecture

JoyJoin onboarding is **server-driven and conditional**.

### Source of truth

- The client reads `nextStep` from `GET /api/auth/user`.
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/App.tsx` decides which routes are available for the current user state.
- The server computes `nextStep`; the client must not reconstruct the flow as a new source of truth.

### Active first-time flow

1. `/personality-test` — anonymous V4 personality test
2. `/personality-test/results` — result reveal and WeChat login handoff
3. `/onboarding/setup` — essential profile data
4. `/onboarding/extended` — interests carousel
5. `/onboarding/review` — final profile review
6. `/discover` — main app

### Important nuances

- `nextStep === 'guide'` currently routes users to discover behavior, not a blocking guide screen.
- `nextStep === 'onboarding'` is a legacy/fallback server value that redirects to `/personality-test`.
- `profileExtendedComplete` is **not** the same thing as `hasCompletedInterestsCarousel`.
- The dedicated guide page is backward-compat only; do not add new onboarding requirements to it.

## Ownership map

### Routing and access control
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/App.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/routes.ts`

### Auth and onboarding state readers
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useAuth.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useOnboardingProgress.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useOnboardingRoute.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useOnboardingCheckpoint.ts`

### Step-specific UI
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/PersonalityTestPageV4.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/PersonalityTestResultPage.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/EssentialDataPage.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/ExtendedDataPage.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/FinalProfileReviewPage.tsx`

## Where new onboarding files go

Because this app has not yet been reorganized into a full `features/onboarding` implementation, place new files by responsibility:

- **New onboarding page or route-level screen:** `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/`
- **Reusable onboarding UI used by a page:** `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/components/`
- **Onboarding-specific state, routing, or data-fetch hooks:** `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/` with `useOnboarding*` naming when appropriate
- **Pure utilities/constants shared across client and server:** `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/`
- **Server-owned onboarding decisions or persistence:** `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/`

## Guardrails

- Prefer server-returned `nextStep` over client-side inference.
- Do not add new logic to deprecated onboarding surfaces.
- If a change affects onboarding state semantics, update both this README and `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/docs/architecture/current-state.md`.
