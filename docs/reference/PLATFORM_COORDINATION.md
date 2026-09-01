# Platform Coordination Playbook

> **Status:** Active coordination playbook — `apps/mini-program` is the **launch-primary** client; `apps/user-client` has been archived to `archived/workspaces/user-client/` for historical reference only. Verified against `apps/mini-program`, `apps/admin-client`, and `apps/server/src/routes/domains/payments.ts`. **Last reviewed for doc sync:** 2026-06-08.

## Executive Summary

**Launch focus:** The **WeChat Mini Program** (`apps/mini-program`) is the **launch-primary** client; treat it as the first surface for release-critical fixes in auth, payments, and in-app flows. The previous web client (`apps/user-client`) has been archived to `archived/workspaces/user-client/` and is no longer an active client.

**Mini Program file map (personality test, WeChat login, payment):**

| Concern | Canonical files |
|---------|-------------------|
| Personality test (V4 UI) | `apps/mini-program/src/pages/onboarding/personality-test/` — `index` (test), `results`; onboarding subpackage registration in `lib/onboarding/onboardingRoutes.ts` |
| Anonymous assessment keys | `apps/mini-program/src/lib/auth/anonymousOnboarding.ts` (uses `joyjoin_v4_presignup_answers` local-storage semantics) |
| WeChat login — **returning** users | `apps/mini-program/src/pages/index/LandingPage.tsx` (`loggedOut` state, `?auth=logout\|expired`; `pages/login/index` retired 2026-09-01), `apps/mini-program/src/hooks/auth/useWeChatLogin.ts` → `authenticateMiniProgramUser()` → `POST /api/auth/wechat/login` (`Taro.login` → code2Session) |
| WeChat login — **with test import** | `authenticateMiniProgramUserWithTest()` in `apps/mini-program/src/lib/api/api.ts` → `POST /api/auth/wechat/login-with-test` (inline from personality-test results page) |
| Welcome coupon award | `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` → `claimWelcomeCoupon()` in `packages/shared/src/api/user.ts` → `GET /api/user/welcome-coupon` (awards or re-fetches the lifetime welcome coupon on first profile-review view) |
| Blind-box payment (JSAPI) | `apps/mini-program/src/pages/blind-box-payment/index.tsx` → `createMiniProgramPaymentIntent()` in `packages/shared/src/api.ts` → `POST /api/payments/miniprogram/create` → `Taro.requestPayment` (skipped for mock orders when `MOCK_PAYMENTS=true`) |
| Payment Ritual V2 context | `apps/mini-program/src/pages/blind-box-payment/index.tsx` → `fetchRitualCommunityData()` → `GET /api/payments/ritual-context` (real DB-backed community stats, plans, coupons) |
| Payment Ritual V2 analytics | `apps/mini-program/src/pages/blind-box-payment/lib/paymentRitualAnalytics.ts` → `POST /api/analytics/payment` (A/B test funnel instrumentation) |
| Post-pay verification + pending order | `apps/mini-program/src/pages/payment-verification/index.tsx`, `lib/payment/paymentPendingOrder.ts`, `lib/payment/paymentPendingOrderStorage.ts`, `lib/payment/paymentVerificationStatus.ts`; app resume: `apps/mini-program/src/app.ts` |

Current platform symmetry is **yellow**, and the previous payment-contract blockers are no longer endpoint-availability issues.

`apps/mini-program` consumes active cross-platform modules from `packages/shared` for API DTOs/helpers, blind-box event status, notification counts, center-tab routing, and Hong Kong time comparisons. The archived web client (`archived/workspaces/user-client/`) retains historical reference implementations of these patterns.

The biggest remaining risk is payment orchestration, not broken contracts. The Mini Program still owns a native `Taro.requestPayment` flow plus pending-order verification, while the browser surfaces follow H5 redirect metadata returned by `/api/subscription/renew` and `/api/payments/create`. The admin blind-box payment page is now aligned with the active server contract for coupon validation and plan normalization, but the headless payment state machine is still duplicated across runtimes.

## Approved execution baseline

- The current approved migration track continues to use the existing `packages/shared` workspace as the only shared runtime surface.
- Shared modules should remain limited to pure logic, contracts, static configuration, and headless helpers.
- Platform-specific adapters and renderers stay in app workspaces, using the center-tab routing split as the reference pattern:
  - `packages/shared/src/centerTabRouting.ts` owns shared decision logic.
  - `apps/mini-program/src/lib/navigation/centerTabRouting.ts` owns mini-program route mapping.
- The archived web client retains a historical reference adapter at `archived/workspaces/user-client/src/lib/centerTabRouting.ts`.
- Do not introduce a new shared business-logic workspace during the current execution track. Reassess only after the existing `packages/shared` extraction path is stable.
- The root `package.json` remains orchestration-only throughout this migration.

## Divergence Report Card

> The previous web vs. mini-program divergence audit is preserved in the archived client at `archived/workspaces/user-client/`. The table below focuses on mini-program + server coordination only.

| Area | Status | Findings | Evidence |
| --- | --- | --- | --- |
| API layer | 🟡 Yellow | Shared API helpers live in `packages/shared/src/api.ts` and are consumed by the mini-program. Active browser payment routes remain present on the server for admin and any future web surface. | `packages/shared/src/api.ts`; `apps/mini-program/src/lib/api/api.ts`; `apps/admin-client/src/pages/BlindBoxPaymentPage.tsx`; `apps/server/src/routes/domains/payments.ts` |
| Auth logic | 🟡 Yellow | Mini Program performs login inline with `authenticateMiniProgramUser()` and stores only `openid` locally. The server remains the source of truth via `GET /api/auth/user`. | `apps/mini-program/src/lib/api/api.ts`; `apps/server/src/wechatAuth.ts` |
| Payment trigger logic | 🟡 Yellow | Mini Program runs the full payment intent → `Taro.requestPayment` → verification polling flow. Admin browser surfaces use normalized plan IDs plus `paymentRedirectUrl` / `paymentStatus` returned by `/api/subscription/renew` and `/api/payments/create`. | `apps/mini-program/src/pages/blind-box-payment/index.tsx`; `apps/mini-program/src/pages/payment-verification/index.tsx`; `apps/admin-client/src/pages/BlindBoxPaymentPage.tsx`; `apps/server/src/routes/domains/payments.ts`; `packages/shared/src/api.ts` |
| Core utilities | 🟡 Yellow | Mini Program imports shared API, center-tab routing, and Hong Kong time helpers. Tab-bar chrome state is owned by `tabBarState` and synced via `useTabBarStateBridge`. Remaining duplication is mostly transport glue and some page-local display formatting. | `packages/shared/src/api.ts`; `packages/shared/src/centerTabRouting.ts`; `packages/shared/src/hongKongTime.ts`; `apps/mini-program/src/lib/navigation/tabBarState.ts`; `apps/mini-program/src/hooks/navigation/useCustomTabBarSync.ts`; `apps/mini-program/src/hooks/navigation/useTabBarStateBridge.ts`; `apps/mini-program/src/lib/navigation/centerTabRouting.ts` |

## Phase 1 — Architecture Discovery and Divergence Audit

### Shared code inventory

- **Active shared workspace:** `packages/shared`
  - Exports schema/contracts, constants, utils, personality assets, and shared UI primitives (`packages/shared/package.json`).
  - `mini-program` imports active shared helpers for API DTOs, blind-box event status, notification counts, center-tab routing, and Hong Kong time handling.
- **Implication:** semantic reuse now exists on active contract surfaces for the mini-program and admin client, but runtime adapters still differ.

### Duplicated business logic

> Historical web reference implementations are archived at `archived/workspaces/user-client/`.

| Logic | Mini Program location | Notes |
| --- | --- | --- |
| Auth session bootstrap | `apps/mini-program/src/lib/api/api.ts` | Inline auth state with local `openid` storage |
| WeChat login entry | `apps/mini-program/src/lib/api/api.ts` | `Taro.login` → code2Session via `POST /api/auth/wechat/login` |
| API request wrapper | `apps/mini-program/src/lib/api/api.ts` | Wraps `Taro.request` with cookie + base-URL handling |
| Price/currency formatting | `apps/mini-program/src/pages/blind-box-payment/index.tsx`; `packages/shared/src/api.ts` | Plan lookup is shared; some display formatting is still runtime-local |
| Payment page orchestration | `apps/mini-program/src/pages/blind-box-payment/index.tsx`; `packages/shared/src/api.ts` | Shared endpoint contract and plan normalization; runtime launch flow is platform-local |
| Payment verification / post-pay routing | `apps/mini-program/src/pages/payment-verification/index.tsx`; `apps/mini-program/src/lib/payment/paymentVerificationStatus.ts`; `packages/shared/src/api.ts` | Pure verification decision helpers are shared; pending-order persistence and polling orchestration remain platform-local |

### API client analysis

- **Not shared today**
  - The archived web client retains a historical `fetch`-based wrapper at `archived/workspaces/user-client/src/lib/queryClient.ts`.
  - Mini Program: `apiRequest({ path, method, data })` wraps `Taro.request` in `apps/mini-program/src/lib/api/api.ts`.
    - Returns parsed JSON
    - Uses cookies plus a base URL env var
- **Shared API types**
  - Domain/database types are shared through `packages/shared/src/schema.ts`.
  - Request/response DTOs for pricing, coupons, payments, notifications, blind-box events, and pool-group details are shared through `packages/shared/src/api.ts`.
- **Active endpoint alignment**
  - Shared and present on server: `/api/pricing`, `/api/user/coupons`, `/api/auth/wechat/login`, `/api/auth/wechat/login-with-test`, `/api/payments/miniprogram/create`, `/api/payments/create`, `/api/coupons/validate`, `/api/subscription/renew`, `/api/payments/status/:wechatOrderId`, `/api/my-events`, `/api/notifications/counts`, `/api/notifications/mark-read`.
  - Browser blind-box payment pages no longer call `/api/event-packs/purchase`; event packs stay disabled behind `supportsEventPacks = false`.
  - Browser payment responses now expose `paymentRedirectUrl` and `paymentStatus`, and shared helpers normalize launch URLs across both nested and top-level payload shapes.
  - `/api/payments/create` is now the primary browser event-payment path.

### State management symmetry

| Concern | mini-program | Notes |
| --- | --- | --- |
| Auth/session | inline page bootstrap + cookies + local `openid` state | Server remains source of truth via `GET /api/auth/user` |
| Payment UI state | page-local `useState` only | — |
| Pending order state | `Taro.setStorageSync('pending_order')` and verification page polling | No shared state machine |
| Global state substrate | app lifecycle only in `app.ts`, no shared provider/store | — |

There is no shared Zustand/Redux store. The closest shared state source of truth is the backend plus `GET /api/auth/user`.

### WebSocket → React Query invalidation (`EVENT_THEME_TITLE_REVEALED`)

When the server broadcasts theme reveal for a pool group, clients should invalidate **group detail** and **group analysis** (AI explanations may incorporate updated theme metadata). Query keys differ by runtime:

| Client | Group detail | Group analysis |
| --- | --- | --- |
| Mini Program | `['mini-program', 'pool-group', groupId]` | `['mini-program', 'pool-group-analysis', groupId]` |

Handlers: `apps/mini-program/.../useMatchingStatusController.ts`.

### Component mapping: same logic, different renderer

| Candidate | Mini Program surface | Extraction target |
| --- | --- | --- |
| Payment plan selection | `apps/mini-program/src/pages/blind-box-payment/index.tsx` | `usePaymentPlanSelection` |
| Payment bootstrap (pricing + coupons + auth/session) | `apps/mini-program/src/pages/blind-box-payment/index.tsx` | `usePaymentBootstrap` |
| Post-payment verification state machine | `apps/mini-program/src/pages/payment-verification/index.tsx`; `apps/mini-program/src/lib/payment/paymentVerificationStatus.ts`; `packages/shared/src/api.ts` | Shared verification decision helpers already live in `packages/shared/src/api.ts`; full launch and polling orchestration still belong to the platform adapter |
| Payment summary math (base price, savings, coupon totals) | `blind-box-payment/index.tsx` | `paymentPricing.ts` utility |
| Payment CTA state | disabled/loading/error logic in payment page | headless action model |

### Divergence hotspot: payment trigger logic

- **Mini Program:** `handlePay()` creates an intent with `/api/payments/miniprogram/create`, stores pending order context, invokes `Taro.requestPayment`, then navigates into a polling verification page.
- **Admin browser surface:** `handlePayment()` validates event coupons against `/api/coupons/validate`, sends event registrations to `/api/payments/create`, and sends subscriptions to `/api/subscription/renew`. Uses shared `normalizeSubscriptionPlanType()` and `getBrowserPaymentLaunchUrl()` helpers, but still owns its own page-local loading/toast/redirect flow.
- **Existing server service boundary:** payment creation/query logic already lives behind `paymentService` on the server (`apps/server/src/routes/domains/payments.ts`), so the client side is the right place for an adapter pattern.
- **Recommended client boundary:** a shared payment orchestration package with a `PaymentAdapter` interface:
  - `MiniProgramPaymentAdapter` → wraps `Taro.requestPayment`
  - `WebPaymentAdapter` → runs mock/dev simulation now, real H5 flow later

## Phase 2 — Proposed Coordination Strategy

### Option A — Future evolution (not the current execution baseline)

If the current `packages/shared`-first extraction path stabilizes and duplicated orchestration still remains high, create a new workspace package, for example `packages/core`, and move non-UI client business logic there.

#### What belongs in `packages/core`

- API request/response contracts for auth, pricing, coupons, subscriptions, and payments
- Pure payment orchestration and verification state machines
- Shared auth/session helpers that consume the `/api/auth/user` contract
- Shared pricing and coupon math
- Shared headless hooks where runtime primitives can be injected
- Constants for plan IDs, payment statuses, and supported payment modes

#### Platform adaptation layer

Each client keeps only a thin adapter layer:

- **Mini Program adapter**
  - Taro request transport
  - `Taro.requestPayment`
  - Taro storage
  - Taro navigation and toast APIs
- **Web adapter**
  - browser `fetch`
  - mock/dev payment simulator for sandbox use
  - browser storage/navigation/toast bindings

#### P0 migration guide for the payment flow

1. **Freeze the contract**
   - Normalize plan identifiers, payment statuses, and coupon payloads into one shared contract.
   - Decide one canonical create-payment entrypoint for both clients.
2. **Extract payment DTOs**
   - Move pricing plan, coupon summary, payment intent, payment result, and verification response types into a shared package.
3. **Extract pure payment logic**
   - Pull plan selection, price math, coupon math, and verification state rules out of both page files.
4. **Define the adapter interface**
   - Separate “prepare intent”, “launch payment”, “persist pending order”, and “poll verification” responsibilities.
5. **Wrap Mini Program flow first**
  - Keep `Taro.requestPayment`, but call it only through the adapter.
6. **Add web mock payment mode**
   - Simulate success after a short delay, then drive the same verification/post-payment flow used by Mini Program.
7. **Move UI pages to thin shells**
   - Keep `<View>` vs `<div>` rendering differences local to each app.
8. **Delete duplicate helpers**
   - Remove page-local `formatPrice`, coupon math, and duplicated request wrappers once shared equivalents exist.

#### Trade-offs

- **Pros:** lowest long-term rework, one bug fix per feature, safer future web relaunch
- **Cons:** requires upfront refactor discipline during beta

### Option B — Strict contract plus copy-paste discipline

Keep the codebases separate, but enforce strong contracts.

#### Required rules

- All request/response interfaces for shared endpoints live in one shared file.
- Any endpoint change must update that shared contract in the same PR.
- CI must typecheck both clients against the shared contract.
- Payment/auth plan identifiers must be standardized before merge.

#### PR checklist template

```md
- [ ] Updated shared API contract/types for any endpoint or payload change
- [ ] Verified `apps/mini-program` still builds and the affected flow still loads
- [ ] Confirmed payment/auth plan IDs match server expectations
- [ ] If Mini Program behavior changed, documented the corresponding admin client impact
```

#### Trade-offs

- **Pros:** lower immediate refactor cost
- **Cons:** duplication remains, drift risk stays high, web re-launch cost remains materially higher

## Phase 3 — Debugging and Development Workflow

### Backend alignment

- Both clients should point to the **same local backend** during development.
- In this repo, use the backend started by `npm run dev:server` as the shared local target, and keep both clients aligned to that same origin.
- **CI build alignment (2026-07-20):** the mini-program CI workflow (`.github/workflows/taro-weapp-build.yml`) defaults `TARO_APP_API_BASE_URL` to the staging API (`https://staging.joyjoinapp.com`) and automatically uploads only after `Deploy Staging` succeeds for the same commit. Production API builds require an explicit `workflow_dispatch` `api_target=production` selection; this prevents accidental production uploads and client-before-server version skew.
- Practical rule:
  - **Breaks on Mini Program** → backend or shared business logic issue
  - **Works in admin client but breaks on Mini Program** → Mini Program adapter/runtime issue
  - **Works on Mini Program but not in admin client** → admin client adapter issue

### Web payment simulation rule

Because the browser cannot run the mini-program payment API (`Taro.requestPayment`), the web sandbox should support a development-only simulated payment path:

1. Click **Pay**
2. Create or mock a canonical payment result
3. Wait about 2 seconds
4. Route into the same verification/post-payment path contract used by Mini Program
5. Reuse the same success/failure UI states and cache invalidation logic

This keeps post-payment verification, routing, and entitlement refresh debuggable without a real WeChat runtime.

## Phase 4 — Feature Upgrade Synchronization Protocol

### Example: add coupon selection to the payment page

| Step | Mini Program (primary) | Shared asset update |
| --- | --- | --- |
| 1. API update | Pass `couponId` or `couponCode` through the canonical payment request | Update shared payment/auth DTOs |
| 2. Logic | Reuse shared coupon-selection logic | One shared headless hook |
| 3. UI | Render Mini Program picker/list | Keep only render-layer differences local |
| 4. QA | Real device with WeChat Pay | Verify shared contract version in the mini-program |

### Ongoing engineering process

1. Update backend contract first
2. Update shared types/contracts second
3. Update shared/headless logic third
4. Apply Mini Program renderer changes
5. Smoke-test the mini-program before merge

## Phase 5 — Final Recommendations and Risk Mitigation

### Immediate next-sprint tasks before beta freeze

1. Keep `packages/shared/src/api.ts` as the single contract surface for pricing, coupons, payments, notifications, blind-box events, and browser launch metadata.
2. Extract a shared headless payment orchestration layer so browser H5 redirects and Mini Program pending-order verification stop duplicating state transitions.
3. Move remaining cross-platform price / currency display rules into shared utilities only when the same presentation behavior is required in both runtimes.
4. Keep browser event packs disabled unless active server support is restored in the same sprint.
5. Spot-check the admin payment page whenever the shared payment contract changes.

### Long-term north star

The currently approved execution path is to keep consolidating pure logic and contracts inside `packages/shared` while leaving platform adapters in each app workspace. A dedicated `packages/core` package remains an optional future evolution only if the existing `packages/shared`-first path proves insufficient after the initial extraction phases.

### Testing automation

Add the simplest cross-platform guardrails first:

- `npm run typecheck`
- `npm run build:weapp --workspace=mini-program`

Then add one lightweight CI rule: any PR touching payment/auth/contracts must prove both clients still compile.
