# Shared Package Boundaries

This package holds contracts and logic that are intentionally shared across multiple apps.

## What belongs here

### Canonical data contracts
- `packages/shared/src/schema.ts` — database schema and shared model types
- `packages/shared/src/wsEvents.ts` — websocket event contracts
- `packages/shared/src/eventDetail.ts` — event detail contract surface
- `packages/shared/src/types/` — stable shared types, including AI metadata

### Shared product vocabularies and constants
- `packages/shared/src/constants.ts`
- `packages/shared/src/interests.ts`
- `packages/shared/src/districts.ts`
- `packages/shared/src/occupations.ts`
- `packages/shared/src/industryTaxonomy.ts`

### Shared domain engines
- `packages/shared/src/personality/` — archetypes, adaptive engine, compatibility references
- `packages/shared/src/socialIcebreaker.ts` — Social Icebreaker contracts and phase config
- `packages/shared/src/ai/` and `packages/shared/src/types/aiMeta.ts` — AI-facing shared contracts
- `packages/shared/src/gamification.ts` — XP/level system (shared by web and mini-program)
- `packages/shared/src/achievements.ts` — Achievement definitions, rarity types, and haptic patterns (shared by web and mini-program)

### Shared UI tokens
- `packages/shared/src/archetypeColors.ts` — Archetype HSL color token definitions; both web (`@joyjoin/shared/archetypeColors`) and mini-program (`@shared/archetypeColors`) import from this single source

### Legal copy (Chinese)
- `packages/shared/src/legal/joyjoinTermsZh.ts` — canonical 用户协议 / 隐私政策 text for web (`TermsPage`) and mini-program terms page; update here only.

### Shared cross-platform flow helpers
- `packages/shared/src/onboarding.ts` — `nextStepToOnboardingStep`, `buildOnboardingProgress`, and related step-mapping utilities
- `packages/shared/src/api.ts` — typed API helpers and DTOs for onboarding/profile, pricing, coupons, payments, notifications, blind-box events, and pool-group details (shared across web and mini-program)
- `packages/shared/src/centerTabRouting.ts` — shared center CTA label/destination/badge rules used by the web bottom nav and the mini-program custom tab bar
- `packages/shared/src/hongKongTime.ts` — shared Hong Kong time comparison and formatting helpers used by both clients

### Truly shared UI primitives
- `packages/shared/src/ui/`

Only put UI here when it is reusable across multiple apps without carrying user-client-only or admin-client-only behavior.

## What does not belong here

- App-specific pages, hooks, or route logic
- Server-only services that depend on secrets, sessions, or storage internals
- User-client-only presentation components
- Admin-only screens or business rules
- New legacy compatibility wrappers when the active contract can be updated directly

## Where new shared files go

- **New DB table or shared model type:** update `packages/shared/src/schema.ts`
- **New cross-app type or response contract:** add under `packages/shared/src/types/`
- **New shared constant/taxonomy:** place in the existing closest domain file rather than inventing a near-duplicate
- **New personality or matching reference data used by multiple apps:** place under `packages/shared/src/personality/`
- **New UI color token or theme definition:** place in `packages/shared/src/archetypeColors.ts` or a new token file under `packages/shared/src/`
- **New achievement definition:** add to `packages/shared/src/achievements.ts`
- **New onboarding step-mapping or flow helper shared across platforms:** place in `packages/shared/src/onboarding.ts`
- **New typed API helper used by both web and mini-program:** place in `packages/shared/src/api.ts`
- **New shared UI primitive:** place under `packages/shared/src/ui/`

## Export boundary

`packages/shared/src/index.ts` is the public barrel for general shared exports.

When adding a new shared contract, export it intentionally. Do not assume every internal helper should be public.

## Rule of thumb

Put code here only if at least two apps or layers should depend on the same definition.

If the code is owned by a single runtime, keep it in that runtime and import shared contracts from this package instead.
