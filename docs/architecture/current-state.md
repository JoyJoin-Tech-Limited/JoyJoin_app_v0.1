# Current Architecture Map

This document is the active architecture map for contributors working in the current JoyJoin codebase.

Use it together with:
- `.github/copilot-instructions.md`
- `DEVELOPER_QUICK_REFERENCE.md`
- `docs/onboarding-flow.md`

## Monorepo map

- `apps/user-client` — user-facing React app
- `apps/admin-client` — separate admin React app
- `apps/server` — Express API and operational backend
- `packages/shared` — shared schema, contracts, taxonomies, and engines

## Active architecture by domain

### 1. Onboarding and authenticated routing

**Authority chain**
1. `apps/server/src/routes/domains/auth.ts` computes and serves `nextStep` from `GET /api/auth/user`
2. `apps/user-client/src/hooks/useAuth.ts` exposes that contract
3. `apps/user-client/src/App.tsx` gates routes from `nextStep`
4. `apps/user-client/src/features/onboarding/active/flow.ts` and `useOnboardingOrchestrator.ts` provide the canonical client mapping helpers

**Active flow module**
- `apps/user-client/src/features/onboarding/active/pages/PersonalityTestPage.tsx`
- `apps/user-client/src/pages/PersonalityTestResultPage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/WeChatAuthGatePage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/EssentialDataPage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/ExtendedDataPage.tsx`
- `apps/user-client/src/features/onboarding/active/pages/FinalProfileReviewPage.tsx`

**Boundary rules**
- Do not reconstruct onboarding progress as a new client-side source of truth.
- Treat `guide` and `onboarding` as compatibility values, not new feature targets.
- Keep server-owned completion semantics aligned with the `users` table and `/api/auth/user` response.
- Legacy onboarding surfaces stay under `apps/user-client/src/legacy/onboarding/`.

Primary files:
- `apps/user-client/src/features/onboarding/README.md`
- `apps/user-client/src/App.tsx`
- `apps/user-client/src/hooks/useAuth.ts`
- `apps/server/src/routes/domains/auth.ts`
- `apps/server/src/routes/domains/onboarding.ts`

### 2. Matching, events, and post-match experience

**Deterministic matching**
- `apps/server/src/poolMatchingService.ts`
- `apps/server/src/poolRealtimeMatchingService.ts`
- `packages/shared/src/personality/`

**AI explanation and enrichment**
- `apps/server/src/matchExplanationService.ts`
- `packages/shared/src/types/aiMeta.ts`

**Client surfaces**
- `apps/user-client/src/pages/DiscoverPage.tsx`
- `apps/user-client/src/pages/MatchingStatusPage.tsx`
- `apps/user-client/src/components/matching/`

Boundary:
- Deterministic scores come from active server matching rules, not client heuristics.

### 3. Social Icebreaker

**Shared contract**
- `packages/shared/src/socialIcebreaker.ts`

**Server runtime**
- `apps/server/src/routes/socialIcebreaker.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/lib/socialIcebreakerStore.ts` — PostgreSQL-backed session persistence layer (sessions, participants, lie-truths); replaced the previous in-memory Maps

**Client hook/surfaces**
- `apps/user-client/src/hooks/useSocialIcebreaker.ts`
- `apps/user-client/src/pages/IcebreakerSessionPage.tsx`

Boundary:
- This is the active in-event icebreaker system; do not route new primary icebreaker work through legacy toolkit flows.
- All session reads and writes go through `lib/socialIcebreakerStore.ts`; do not add direct `db` calls in the route file.

### 4. Shared contracts and schema ownership

**Canonical schema**
- `packages/shared/src/schema.ts`

**Shared contract barrel**
- `packages/shared/src/index.ts`

**Domain guide**
- `packages/shared/src/README.md`

Boundary:
- If more than one app/runtime must agree on a contract, define it in `packages/shared`.
- If code is runtime-specific, keep it in that app and import only the shared definitions.

### 5. Server domain ownership

**Routes**
- `apps/server/src/routes.ts` is the composition root that mounts domain routers from `apps/server/src/routes/domains/`
- Domain modules currently include auth, onboarding, assessment, analytics, admin, payments, and icebreaker routing

**Data access**
- `apps/server/src/storage.ts` is now a compatibility facade composed from `apps/server/src/repositories/*`
- New persistence logic should live in the nearest domain repository instead of expanding the legacy facade

**Operational entry points**
- `apps/server/src/wechatAuth.ts`
- `apps/server/src/phoneAuth.ts`
- `apps/server/src/adminAuth.ts`
- `apps/server/src/lib/adminAuditLogger.ts`

## Where new files go

### User client
- Route-level page: `apps/user-client/src/pages/` unless it belongs to the active onboarding module
- Active onboarding page/hook/flow utility: `apps/user-client/src/features/onboarding/active/`
- Shared presentation component: `apps/user-client/src/components/`
- Client hook or query adapter: `apps/user-client/src/hooks/`
- Pure browser utility: `apps/user-client/src/lib/` or `apps/user-client/src/utils/`

### Server
- Route registration composition: `apps/server/src/routes.ts`
- Cohesive domain router: `apps/server/src/routes/domains/`
- Domain repository: `apps/server/src/repositories/`
- Domain service: `apps/server/src/` or an existing domain subfolder
- Cross-cutting invariant/helper: `apps/server/src/lib/`
- Middleware: `apps/server/src/middleware/`

### Shared package
- Shared schema/model: `packages/shared/src/schema.ts`
- Shared types/contracts: `packages/shared/src/types/`
- Shared product constants/taxonomies: existing closest file in `packages/shared/src/`
- Shared UI primitive: `packages/shared/src/ui/`

## Contribution guardrails

- Prefer adding to an active domain over reviving a legacy path.
- Document active behavior close to the code when a feature has important boundaries.
- When changing onboarding, matching, shared contracts, or server domain ownership, update the nearest domain README if the boundary changes.
