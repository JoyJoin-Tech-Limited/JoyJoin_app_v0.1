# Onboarding Domain Guide

This folder is the documentation anchor for JoyJoin's active onboarding domain.

## Active module layout

The canonical onboarding client implementation now lives in `apps/user-client/src/features/onboarding/active/`:
- `flow.ts` — canonical `nextStep` → step/route mapping
- `useOnboardingOrchestrator.ts` — shared progress and route orchestration
- `pages/PersonalityTestPage.tsx`
- `pages/WeChatAuthGatePage.tsx`
- `pages/EssentialDataPage.tsx`
- `pages/ExtendedDataPage.tsx`
- `pages/FinalProfileReviewPage.tsx`

The surrounding entry points that consume this module are:
- `apps/user-client/src/App.tsx`
- `apps/user-client/src/hooks/useAuth.ts`
- `apps/user-client/src/hooks/useOnboardingProgress.ts`
- `apps/user-client/src/hooks/useOnboardingRoute.ts`
- `apps/user-client/src/pages/PersonalityTestResultPage.tsx`

## Active onboarding architecture

JoyJoin onboarding is **server-driven and conditional**.

### Source of truth

- The client reads `nextStep` from `GET /api/auth/user`.
- `apps/user-client/src/App.tsx` decides which routes are available for the current user state.
- `apps/server/src/routes/domains/auth.ts` owns the active `nextStep` response.
- The client must not reconstruct the flow as a new source of truth.

### Active first-time flow

1. `/personality-test` — anonymous V4 personality test
2. `/personality-test/results` — result reveal
3. `/personality-test/auth-gate` — WeChat login handoff
4. `/onboarding/setup` — essential profile data
5. `/onboarding/extended` — interests carousel
6. `/onboarding/review` — final profile review
7. `/discover` — main app

The pre-auth route sequence above is the active value-first entry path. After WeChat auth succeeds, onboarding authority switches to the server-owned `nextStep` returned by `GET /api/auth/user`.

### Important nuances

- `nextStep === 'guide'` currently routes users to discover behavior, not a blocking guide screen.
- `nextStep === 'onboarding'` is a legacy/fallback server value that redirects to `/personality-test`.
- `profileExtendedComplete` is **not** the same thing as `hasCompletedInterestsCarousel`.
- The personality test is only fully complete after the adaptive phase stops **and** both universal closing questions (`Q_PLAYFUL_SLIDER`, `Q_PLAYFUL_EMOJI`) have been answered.
- Legacy onboarding surfaces remain under `apps/user-client/src/legacy/onboarding/`; do not add new feature work there.

## Ownership map

### Routing and access control
- `apps/user-client/src/App.tsx`
- `apps/user-client/src/features/onboarding/active/flow.ts`
- `apps/user-client/src/features/onboarding/active/useOnboardingOrchestrator.ts`

### Auth and onboarding state readers
- `apps/user-client/src/hooks/useAuth.ts`
- `apps/user-client/src/hooks/useOnboardingProgress.ts`
- `apps/user-client/src/hooks/useOnboardingRoute.ts`
- `apps/user-client/src/features/onboarding/active/hooks/`

### Step-specific UI
- `apps/user-client/src/features/onboarding/active/pages/PersonalityTestPage.tsx`
- `apps/user-client/src/pages/PersonalityTestResultPage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/WeChatAuthGatePage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/EssentialDataPage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/ExtendedDataPage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/FinalProfileReviewPage.tsx`

## Where new onboarding files go

- **Active onboarding page, hook, or flow utility:** `apps/user-client/src/features/onboarding/active/`
- **Shared onboarding state reader used outside the feature module:** `apps/user-client/src/hooks/` with `useOnboarding*` naming when appropriate
- **Reusable onboarding UI used across non-onboarding pages:** `apps/user-client/src/components/`
- **Pure utilities/constants shared across client and server:** `packages/shared/src/`
- **Server-owned onboarding decisions or persistence:** `apps/server/src/routes/domains/` or `apps/server/src/repositories/`

## Guardrails

- Prefer server-returned `nextStep` over client-side inference.
- Do not add new logic to deprecated onboarding surfaces.
- If a change affects onboarding state semantics, update both this README and `docs/architecture/current-state.md`.
