# Platform Coordination Playbook

## Executive Summary

Current platform symmetry is **yellow trending red**. `apps/user-client` already shares many domain contracts with `packages/shared`, but `apps/mini-program` is still largely isolated and re-implements auth, API access, pricing, and payment orchestration inside page files. The largest risk is payment: the Mini Program has a real `wx.requestPayment` flow, while the web client still mixes direct endpoint calls, missing endpoint assumptions, and page-local state. If the team wants fast beta delivery without a costly web re-launch later, they should move non-UI payment/auth logic behind shared contracts immediately and keep platform-specific behavior in adapters only.

## Divergence Report Card

| Area | Status | Findings | Evidence |
| --- | --- | --- | --- |
| API layer | 🔴 Red | The web client uses `fetch` plus React Query (`apps/user-client/src/lib/queryClient.ts`), but the Mini Program uses a separate Taro wrapper (`apps/mini-program/src/lib/api.ts`). There is no shared API contract package for request/response DTOs. `apps/user-client/src/pages/BlindBoxPaymentPage.tsx` calls `/api/coupons/validate` and `/api/event-packs/purchase`, but no matching server route exists in `apps/server/src`. | `apps/user-client/src/lib/queryClient.ts`; `apps/mini-program/src/lib/api.ts`; `apps/user-client/src/pages/BlindBoxPaymentPage.tsx`; `apps/server/src/routes.ts`; `apps/server/src/routes/domains/payments.ts`; `apps/server/src/routes/domains/assessment.ts` |
| Auth logic | 🟡 Yellow | `user-client` uses server-driven auth state via `useAuth()` and `GET /api/auth/user`, while the Mini Program performs login inline with `authenticateMiniProgramUser()` and stores only `openid` locally. Both depend on WeChat login but use different entry endpoints and different state models. | `apps/user-client/src/hooks/useAuth.ts`; `apps/user-client/src/hooks/useWeChatLogin.ts`; `apps/mini-program/src/lib/api.ts`; `apps/server/src/wechatAuth.ts` |
| Payment trigger logic | 🔴 Red | The Mini Program runs a full payment intent → `wx.requestPayment` → verification polling flow. The web client does not share that orchestration, does not poll, and mixes direct event creation with separate subscription/pack purchase endpoints. The page also sends `vip_monthly` / `vip_quarterly` to `/api/subscription/renew`, while the server route validates `monthly` / `quarterly`. | `apps/mini-program/src/pages/blind-box-payment/index.tsx`; `apps/mini-program/src/pages/payment-verification/index.tsx`; `apps/user-client/src/pages/BlindBoxPaymentPage.tsx`; `apps/server/src/routes/domains/payments.ts` |
| Core utilities | 🟡 Yellow | `user-client` imports many shared contracts from `packages/shared`, but `mini-program` imports none. Currency/price formatting is duplicated and inconsistent: web uses `apps/user-client/src/lib/currency.ts`, Mini Program hardcodes `¥` in page-local logic. | `apps/user-client/src/lib/currency.ts`; `apps/mini-program/src/pages/blind-box-payment/index.tsx`; `packages/shared/package.json` |

## Phase 1 — Architecture Discovery and Divergence Audit

### Shared code inventory

- **Active shared workspace:** `packages/shared`
  - Exports schema/contracts, constants, utils, personality assets, and shared UI primitives (`packages/shared/package.json`).
  - `user-client` imports shared types and helpers broadly (`@shared/schema`, `@shared/constants`, `@shared/utils`, `@shared/wsEvents`, `@shared/ui/buttonVariants`, etc.).
  - `mini-program` currently does **not** import from `packages/shared`.
- **Implication:** semantic reuse exists for web/admin, but not for Mini Program beta code.

### Duplicated business logic

| Logic | Web / shared location | Mini Program location | Notes |
| --- | --- | --- | --- |
| Auth session bootstrap | `apps/user-client/src/hooks/useAuth.ts` | `apps/mini-program/src/lib/api.ts` | Separate auth state models |
| WeChat login entry | `apps/user-client/src/hooks/useWeChatLogin.ts` | `apps/mini-program/src/lib/api.ts` | Separate endpoint usage and runtime assumptions |
| API request wrapper | `apps/user-client/src/lib/queryClient.ts` | `apps/mini-program/src/lib/api.ts` | Different signatures, error handling, and caching |
| Price/currency formatting | `apps/user-client/src/lib/currency.ts` | `apps/mini-program/src/pages/blind-box-payment/index.tsx` | Incompatible formatting behavior |
| Payment page orchestration | `apps/user-client/src/pages/BlindBoxPaymentPage.tsx` | `apps/mini-program/src/pages/blind-box-payment/index.tsx` | Shared business intent, fully duplicated implementation |
| Payment verification / post-pay routing | none | `apps/mini-program/src/pages/payment-verification/index.tsx` | Missing on web; good candidate for shared state machine + platform renderer |

### API client analysis

- **Not shared today**
  - Web: `apiRequest(method, url, data)` wraps browser `fetch`, returns `Response`, and handles `401` by clearing the React Query cache and redirecting (`apps/user-client/src/lib/queryClient.ts`).
  - Mini Program: `apiRequest({ path, method, data })` wraps `Taro.request`, returns parsed JSON, and uses cookies plus a base URL env var (`apps/mini-program/src/lib/api.ts`).
- **Shared API types**
  - Domain/database types are shared through `packages/shared/src/schema.ts`.
  - Request/response DTOs for pricing, coupons, payments, and auth are **not** shared through a dedicated API contract module.
- **Endpoint drift**
  - Shared and present on server: `/api/pricing`, `/api/user/coupons`, `/api/auth/wechat/login`, `/api/auth/wechat/login-with-test`, `/api/payments/miniprogram/create`, `/api/payments/status/:wechatOrderId`.
  - Used by web but not found in active server code: `/api/coupons/validate`, `/api/event-packs/purchase`.
  - Present on server but not used by either audited client payment flow as the primary path: `/api/payments/create`.

### State management symmetry

| Concern | user-client | mini-program | Symmetry |
| --- | --- | --- | --- |
| Auth/session | React Query + `useAuth()` + `GET /api/auth/user` | inline page bootstrap + cookies + local `openid` state | Low |
| Payment UI state | page-local `useState` plus React Query for pricing/coupons | page-local `useState` only | Medium-low |
| Pending order state | no shared state machine | `wx.setStorageSync('pending_order')` and verification page polling | Low |
| Global state substrate | `QueryClientProvider` + a few React contexts in `App.tsx` | app lifecycle only in `app.ts`, no shared provider/store | Low |

There is no shared Zustand/Redux store. The closest shared state source of truth is the backend plus `GET /api/auth/user`.

### Component mapping: same logic, different renderer

| Candidate | Web surface | Mini Program surface | Extraction target |
| --- | --- | --- | --- |
| Payment plan selection | `apps/user-client/src/pages/BlindBoxPaymentPage.tsx` | `apps/mini-program/src/pages/blind-box-payment/index.tsx` | `usePaymentPlanSelection` |
| Payment bootstrap (pricing + coupons + auth/session) | same file | same file | `usePaymentBootstrap` |
| Post-payment verification state machine | not shared today | `apps/mini-program/src/pages/payment-verification/index.tsx` | headless `usePaymentVerification` |
| Payment summary math (base price, savings, coupon totals) | `BlindBoxPaymentPage.tsx` | `blind-box-payment/index.tsx` | `paymentPricing.ts` utility |
| Payment CTA state | disabled/loading/error logic in payment page | disabled/loading/error logic in payment page | headless action model |

### Divergence hotspot: payment trigger logic

- **Mini Program:** `handlePay()` creates an intent with `/api/payments/miniprogram/create`, stores pending order context, invokes `wx.requestPayment`, then navigates into a polling verification page.
- **Web:** `handlePayment()` branches into direct calls to `/api/subscription/renew`, `/api/event-packs/purchase`, or `/api/blind-box-events`, with no shared payment intent abstraction.
- **Existing server service boundary:** payment creation/query logic already lives behind `paymentService` on the server (`apps/server/src/routes/domains/payments.ts`), so the client side is the right place for an adapter pattern.
- **Recommended client boundary:** a shared payment orchestration package with a `PaymentAdapter` interface:
  - `MiniProgramPaymentAdapter` → wraps `wx.requestPayment`
  - `WebPaymentAdapter` → runs mock/dev simulation now, real H5 flow later

## Phase 2 — Proposed Coordination Strategy

### Option A — Single Source of Truth (recommended)

Create a new workspace package, for example `packages/core`, and move all non-UI client business logic there.

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
  - `wx.requestPayment`
  - `wx` storage
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
   - Keep `wx.requestPayment`, but call it only through the adapter.
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
- [ ] Verified `apps/user-client` still builds and the affected flow still loads
- [ ] Verified `apps/mini-program` still builds and the affected flow still loads
- [ ] Confirmed payment/auth plan IDs match server expectations
- [ ] If Mini Program behavior changed, documented the corresponding web sandbox behavior
```

#### Trade-offs

- **Pros:** lower immediate refactor cost
- **Cons:** duplication remains, drift risk stays high, web re-launch cost remains materially higher

## Phase 3 — Debugging and Development Workflow

### Backend alignment

- Both clients should point to the **same local backend** during development.
- In the current repo, the active local backend runs on **`localhost:5000`** (`npm run dev:server`), not `3000`.
- Practical rule:
  - **Breaks on both web and Mini Program** → backend or shared business logic issue
  - **Works on web but breaks on Mini Program** → Mini Program adapter/runtime issue
  - **Works on Mini Program but not web sandbox** → web adapter or stale web-only flow

### Web payment simulation rule

Because the browser cannot run `wx.requestPayment`, the web sandbox should support a development-only simulated payment path:

1. Click **Pay**
2. Create or mock a canonical payment result
3. Wait about 2 seconds
4. Route into the same verification/post-payment path contract used by Mini Program
5. Reuse the same success/failure UI states and cache invalidation logic

This keeps post-payment verification, routing, and entitlement refresh debuggable without a real WeChat runtime.

## Phase 4 — Feature Upgrade Synchronization Protocol

### Example: add coupon selection to the payment page

| Step | Mini Program (primary) | Web client (secondary) | Shared asset update |
| --- | --- | --- | --- |
| 1. API update | Pass `couponId` or `couponCode` through the canonical payment request | Confirm same contract compiles and loads in sandbox | Update shared payment/auth DTOs |
| 2. Logic | Reuse shared coupon-selection logic | Reuse the same hook/state machine | One shared headless hook |
| 3. UI | Render Mini Program picker/list | Render web select/tabs | Keep only render-layer differences local |
| 4. QA | Real device with WeChat Pay | Smoke-test simulated payment and post-pay routing | Verify shared contract version in both apps |

### Ongoing engineering process

1. Update backend contract first
2. Update shared types/contracts second
3. Update shared/headless logic third
4. Apply Mini Program renderer changes
5. Apply web sandbox renderer changes
6. Smoke-test both clients before merge

## Phase 5 — Final Recommendations and Risk Mitigation

### Immediate next-sprint tasks before beta freeze

1. Extract shared payment DTOs and plan identifiers so both clients stop hardcoding divergent values.
2. Fix the web payment route drift:
   - align `planType` for `/api/subscription/renew`
   - resolve the missing `/api/coupons/validate` contract
   - resolve the missing `/api/event-packs/purchase` contract
3. Move currency/price formatting into a shared utility instead of keeping Mini Program formatting inline.
4. Introduce a shared payment verification state model so web and Mini Program converge on one post-payment story.
5. Keep `user-client` buildable as the sandbox by smoke-testing it for every Mini Program payment/auth change.

### Long-term north star

Adopt **Option A**. JoyJoin already has the right monorepo shape for shared contracts (`packages/shared`), and the current pain comes from runtime-specific logic sitting too high in the client pages. A dedicated shared business-logic package is the cleanest way to ship beta fast without paying for a second implementation later.

### Testing automation

Add the simplest cross-platform guardrails first:

- `npm run typecheck`
- `npm run build -w @joyjoin/user-client`
- `npm run build:weapp -w mini-program`

Then add one lightweight CI rule: any PR touching payment/auth/contracts must prove both clients still compile.
