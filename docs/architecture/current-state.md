# Current Architecture Map

This document is the active architecture map for contributors working in the current JoyJoin codebase.

Use it together with:
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/.github/copilot-instructions.md`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/DEVELOPER_QUICK_REFERENCE.md`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/docs/onboarding-flow.md`

## Monorepo map

- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client` — user-facing React app
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/admin-client` — separate admin React app
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server` — Express API and operational backend
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared` — shared schema, contracts, taxonomies, and engines

## Active architecture by domain

### 1. Onboarding and authenticated routing

**Authority chain**
1. `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes.ts` computes `nextStep`
2. `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useAuth.ts` exposes that contract
3. `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/App.tsx` gates routes from `nextStep`

**Active flow**
- `/personality-test`
- `/personality-test/results`
- `/onboarding/setup`
- `/onboarding/extended`
- `/onboarding/review`
- `/discover`

**Boundary rules**
- Do not reconstruct onboarding progress as a new client-side source of truth.
- Treat `guide` and `onboarding` as compatibility values, not new feature targets.
- Keep server-owned completion semantics aligned with the `users` table and `/api/auth/user` response.

Primary files:
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/features/onboarding/README.md`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/App.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useAuth.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes.ts`

### 2. Matching, events, and post-match experience

**Deterministic matching**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/poolMatchingService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/poolRealtimeMatchingService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/personality/`

**AI explanation and enrichment**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/matchExplanationService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/types/aiMeta.ts`

**Client surfaces**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/DiscoverPage.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/MatchingStatusPage.tsx`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/components/matching/`

Boundary:
- Deterministic scores come from active server matching rules, not client heuristics.

### 3. Social Icebreaker

**Shared contract**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/socialIcebreaker.ts`

**Server runtime**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes/socialIcebreaker.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/socialIcebreakerAIService.ts`

**Client hook/surfaces**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/useSocialIcebreaker.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/IcebreakerSessionPage.tsx`

Boundary:
- This is the active in-event icebreaker system; do not route new primary icebreaker work through legacy toolkit flows.

### 4. Shared contracts and schema ownership

**Canonical schema**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/schema.ts`

**Shared contract barrel**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/index.ts`

**Domain guide**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/README.md`

Boundary:
- If more than one app/runtime must agree on a contract, define it in `packages/shared`.
- If code is runtime-specific, keep it in that app and import only the shared definitions.

### 5. Server domain ownership

**Auth / onboarding / sessions**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/wechatAuth.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/phoneAuth.ts`

**Payments / subscriptions**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/paymentService.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/subscriptionService.ts`

**Admin operations**
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/adminAuth.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/lib/adminAuditLogger.ts`
- `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/README.md`

## Where new files go

### User client
- Route-level page: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/pages/`
- Shared presentation component: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/components/`
- Client hook or query adapter: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/hooks/`
- Pure browser utility: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/user-client/src/lib/` or `/utils/`

### Server
- Route registration: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes.ts`
- Cohesive router module: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/routes/`
- Domain service: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/` or an existing domain subfolder
- Cross-cutting invariant/helper: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/lib/`
- Middleware: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/apps/server/src/middleware/`

### Shared package
- Shared schema/model: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/schema.ts`
- Shared types/contracts: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/types/`
- Shared product constants/taxonomies: existing closest file in `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/`
- Shared UI primitive: `/home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1/packages/shared/src/ui/`

## Contribution guardrails

- Prefer adding to an active domain over reviving a legacy path.
- Document active behavior close to the code when a feature has important boundaries.
- When changing onboarding, matching, shared contracts, or server domain ownership, update the nearest domain README if the boundary changes.
