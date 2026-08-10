# Shared Package Boundaries

This package holds contracts and logic that are intentionally shared across multiple apps.

## What belongs here

### Canonical data contracts
- `packages/shared/src/schema.ts` — database schema and shared model types
- `packages/shared/src/wsEvents.ts` — websocket event contracts
- `packages/shared/src/eventDetail.ts` — event detail contract surface
- `packages/shared/src/types/` — stable shared types, including AI metadata
- `packages/shared/src/schema/_definitions.ts` — Drizzle table definitions, including `contentFilterLogs` (content_filter_logs table for auditable content violation records)
- The `invitations` schema supports pool-scoped duo invites via `poolId` with `invitationType='duo'` (`eventId` nullable); see `apps/server/src/lib/duoInvites.ts` and `docs/design/duo-registration-spec-20260807.md`. Auth responses expose `features.duoRegistrationEnabled` (default `true`).

### Shared product vocabularies and constants
- `packages/shared/src/constants.ts` — canonical intent/options constants and `toggleIntentValue()` helper for multi-select cap logic
- `packages/shared/src/interests.ts` — canonical interest taxonomy v2.0.0: 48 active interests across 6 macro categories, each with a CDN `.webp` `imageUrl` consumed by both server and mini-program
- `packages/shared/src/districts.ts`
- `packages/shared/src/occupations.ts`
- `packages/shared/src/industryTaxonomy.ts`
- `packages/shared/src/iconSystem/emojiToIconMap.ts` — emoji → proprietary icon mapping for `JoyJoinIcon`; `CDN_ICON_TIERS` controls CDN vs bundled resolution. `status`, `ui`, and `semantic`/`info-label` icons are bundled locally; `reaction`, `reveal`, `achievement`, and `phase` icons are CDN-primary. When no explicit `tier` is provided, `getIconMapping()` falls back to an unambiguous single-tier mapping if the emoji exists in exactly one tier map.

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

### Brand-governed copy
- `packages/shared/src/copy/` — centralized copy modules for mini-program 文案 governance:
  - `terms.ts` — core terminology table (canonical vs legacy), banned words
  - `errorBaselines.ts` — error message factory functions (`getErrorMessage`, `getErrorForSurface`)
  - `emptyStates.ts` — empty state templates with action guidance (`getEmptyStateMessage`)
  - `mascotVoice.ts` — 悦仔常用句式库 (personified sentence patterns)
  - `toneMap.ts` — surface ↔ tone mapping (System UI / 悦仔 Voice / Social Game)
  - `exceptions.ts` — orange-word permit-with-framing exceptions
  - `index.ts` — barrel export

### Shared cross-platform flow helpers
- `packages/shared/src/onboarding.ts` — `nextStepToOnboardingStep`, `buildOnboardingProgress`, and related step-mapping utilities
- `packages/shared/src/api.ts` — typed API helpers and DTOs for onboarding/profile, pricing, coupons, payments, notifications, blind-box events, and pool-group details (shared across web and mini-program). Domain-specific definitions live in `packages/shared/src/api/*.ts`; this file is a thin re-export barrel.
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
- **New typed API helper used by both web and mini-program:** place in the relevant `packages/shared/src/api/<domain>.ts` module and re-export it through `packages/shared/src/api.ts`
- **New brand-governed copy module or factory function:** place under `packages/shared/src/copy/`
- **New shared UI primitive:** place under `packages/shared/src/ui/`

## Export boundary

`packages/shared/src/index.ts` is the public barrel for general shared exports.

When adding a new shared contract, export it intentionally. Do not assume every internal helper should be public.

## Rule of thumb

Put code here only if at least two apps or layers should depend on the same definition.

If the code is owned by a single runtime, keep it in that runtime and import shared contracts from this package instead.
