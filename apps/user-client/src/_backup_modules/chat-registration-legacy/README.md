# Legacy Chat Registration System — HISTORICAL BACKUP ONLY

> ⚠️  **DO NOT USE** — These files are NOT active runtime code.  They exist
> purely as a historical reference.  The onboarding flow has moved to a
> server-driven `nextStep` architecture; all routing is handled by the
> `AuthenticatedRouter` switch in `apps/user-client/src/App.tsx`.

## What is this?

This folder contains the **legacy AI chat-based registration system
(小悦对话注册)** that has been retired.  It is kept for historical reference
only.

## System Overview

### This folder (HISTORICAL — do not use)
- **AI Chat Interface** - Conversational registration with Xiaoyue AI
- **Status**: ❌ DEPRECATED — Not routed, not imported, not in active use

### Active system (current)
The active onboarding flow is a **server-driven, state-based sequence**:
1. **V4 Personality Test** (`/personality-test`) — anonymous pre-auth
2. **WeChat Auth** — happens after test, at `PersonalityTestResultPage`
3. **Essential Data** (`/onboarding/setup`) — `EssentialDataPage`
4. **Extended Data** (`/onboarding/extended`) — `ExtendedDataPage` (interest carousel)
5. **Profile Review** (`/onboarding/review`) — `FinalProfileReviewPage`
6. **Discover** (`/discover`) — onboarding complete

Navigation between steps is controlled by `nextStep` returned from
`GET /api/auth/user`.  See `apps/user-client/src/App.tsx`
(`AuthenticatedRouter`) and `docs/onboarding-flow.md` for the authoritative
reference.

Note: `DuolingoOnboardingPage` (mentioned in earlier version of this README)
was also retired — it is no longer an active step.

## Files in this backup

### Pages
- `ChatRegistrationPage.tsx` — AI chat registration (user-client)
- `ChatRegistrationPage.tsx` — AI chat registration (admin-client backup)

## Restore considerations

Only restore these files if the product team explicitly decides to reintroduce
conversational registration.  This would require significant re-integration
work given the current server-driven architecture.

---
*Originally moved to backup: 2026-01-20*
*README updated to reflect current architecture: 2026-03-18*

