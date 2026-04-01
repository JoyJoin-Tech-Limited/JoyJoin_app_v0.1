# Shared Package Boundaries

This package holds contracts and logic that are intentionally shared across multiple apps.

## What belongs here

### Canonical data contracts
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/schema.ts` — database schema and shared model types
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/wsEvents.ts` — websocket event contracts
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/eventDetail.ts` — event detail contract surface
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/types/` — stable shared types, including AI metadata

### Shared product vocabularies and constants
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/constants.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/interests.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/districts.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/occupations.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/industryTaxonomy.ts`

### Shared domain engines
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/personality/` — archetypes, adaptive engine, compatibility references
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/socialIcebreaker.ts` — Social Icebreaker contracts and phase config
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/ai/` and `/types/aiMeta.ts` — AI-facing shared contracts

### Truly shared UI primitives
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/ui/`

Only put UI here when it is reusable across multiple apps without carrying user-client-only or admin-client-only behavior.

## What does not belong here

- App-specific pages, hooks, or route logic
- Server-only services that depend on secrets, sessions, or storage internals
- User-client-only presentation components
- Admin-only screens or business rules
- New legacy compatibility wrappers when the active contract can be updated directly

## Where new shared files go

- **New DB table or shared model type:** update `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/schema.ts`
- **New cross-app type or response contract:** add under `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/types/`
- **New shared constant/taxonomy:** place in the existing closest domain file rather than inventing a near-duplicate
- **New personality or matching reference data used by multiple apps:** place under `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/personality/`
- **New shared UI primitive:** place under `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/ui/`

## Export boundary

`/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/index.ts` is the public barrel for general shared exports.

When adding a new shared contract, export it intentionally. Do not assume every internal helper should be public.

## Rule of thumb

Put code here only if at least two apps or layers should depend on the same definition.

If the code is owned by a single runtime, keep it in that runtime and import shared contracts from this package instead.
