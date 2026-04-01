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
1. `apps/server/src/routes.ts` computes `nextStep`
2. `apps/user-client/src/hooks/useAuth.ts` exposes that contract
3. `apps/user-client/src/App.tsx` gates routes from `nextStep`

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
- `apps/user-client/src/features/onboarding/README.md`
- `apps/user-client/src/App.tsx`
- `apps/user-client/src/hooks/useAuth.ts`
- `apps/server/src/routes.ts`

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

**Client hook/surfaces**
- `apps/user-client/src/hooks/useSocialIcebreaker.ts`
- `apps/user-client/src/pages/IcebreakerSessionPage.tsx`

Boundary:
- This is the active in-event icebreaker system; do not route new primary icebreaker work through legacy toolkit flows.

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

**Auth / onboarding / sessions**
- `apps/server/src/routes.ts`
- `apps/server/src/wechatAuth.ts`
- `apps/server/src/phoneAuth.ts`

**Payments / subscriptions**
- `apps/server/src/paymentService.ts`
- `apps/server/src/subscriptionService.ts`

**Admin operations**
- `apps/server/src/adminAuth.ts`
- `apps/server/src/lib/adminAuditLogger.ts`
- `apps/server/src/README.md`

## Where new files go

### User client
- Route-level page: `apps/user-client/src/pages/`
- Shared presentation component: `apps/user-client/src/components/`
- Client hook or query adapter: `apps/user-client/src/hooks/`
- Pure browser utility: `apps/user-client/src/lib/` or `apps/user-client/src/utils/`

### Server
- Route registration: `apps/server/src/routes.ts`
- Cohesive router module: `apps/server/src/routes/`
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
