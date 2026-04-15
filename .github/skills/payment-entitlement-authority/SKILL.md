---
name: payment-entitlement-authority
description: >-
  Payment authority map for creation, verification, entitlement gating, refunds,
  event-pack credits, and cross-platform payment coordination. Use when adding
  or reviewing payment routes, webhook handling, verification polling,
  entitlement checks, refunds, event credits, or shared payment contracts.
  Trigger phrases: "create a payment", "verify payment status", "refund this payment",
  "event pack credits", "Subscription or event pack required", "pending_order",
  "who owns payment logic".
---

# Payment Entitlement Authority

## Purpose

This skill defines the current ownership boundaries for JoyJoin payment creation,
verification, fulfillment, entitlement reads, refunds, and platform coordination.
It keeps payment writes server-owned, shared contracts pure, and platform launch
flows local.

## When to use this skill

Use this skill when you are:

- adding or reviewing payment creation, status, or webhook handling
- changing refund flows, event-pack credits, or entitlement gating
- updating shared payment verification helpers or shared payment DTOs
- deciding whether a payment change belongs on the server, in `packages/shared`, or in platform-local adapters
- auditing mini-program versus web payment coordination

## Authority map

1. Endpoint auth, feature flags, and request validation live in `apps/server/src/routes/domains/payments.ts`.
   Keep `PAYMENTS_ENABLED`, coupon validation, plan normalization, and route-level auth at the route layer. Add payment endpoints there, not in `apps/server/src/routes.ts`.

2. WeChat-facing payment creation, status queries, webhook verification, and refund initiation live in `apps/server/src/paymentService.ts`.
   Keep H5 and JSAPI request construction, webhook signature checks, and `REFUND.SUCCESS` handling there instead of duplicating them in routes or clients.

3. Stateful payment fulfillment side effects live in `apps/server/src/repositories/paymentFulfillmentRepo.ts`.
   Payment confirmation and refund application must stay transaction-wrapped there: payment status updates, coupon usage, subscription activation, event registration, notifications, and event-pack credit grant or reversal.

4. Event-pack credit lifecycle lives in `apps/server/src/repositories/eventCreditsRepo.ts`.
   Grant, consume, summarize, and reverse credits only through this repository. Do not mutate `event_credit_grants` or `event_credit_redemptions` ad hoc.

5. Read-side entitlement gating stays server-owned in `apps/server/src/routes.ts`.
   The active pool-registration gate checks subscription first, then available event-pack credits, and returns `NO_ACTIVE_ENTITLEMENT` when neither exists. Clients may reflect that state, but they do not decide entitlement.

6. Shared client contracts and pure verification helpers live in `packages/shared/src/api.ts`.
   Safe extractions include payment DTOs, plan normalization, and `getPaymentVerificationStatusDecision()` / `getPaymentVerificationErrorDecision()`. Do not move WeChat SDK calls, storage, redirect launch, or toast logic there.

7. Payment schema authority lives in `packages/shared/src/schema.ts`.
   The `payments`, `event_credit_grants`, and `event_credit_redemptions` tables define the persistence contract. Behavior changes should stay aligned with that schema and its tests.

8. Platform launch and pending-order persistence stay local.
   Mini Program owns `Taro.requestPayment` and pending-order storage; browser clients own H5 redirect launch. Coordinate shared contract changes through `docs/PLATFORM_COORDINATION.md`.

9. Admin refunds require both auth and audit truth.
   `/api/admin/payments/:paymentId/refund` is protected by `requireAdmin` and records `PAYMENT_REFUND_INITIATED`. If refund permissions, logging, or failure handling changes, review the admin governance skill too.

## Quick examples

- **Add a new payment status rule**: update the pure decision helper in `packages/shared/src/api.ts` when the change is only about client-visible verification state. Leave storage, retries, and platform navigation local.
- **Refund an event pack safely**: keep refund initiation in `paymentService.createRefund()`, preserve the refund blocker check in `eventCreditsRepo.getRefundBlockerCountForPayment()`, and let `paymentFulfillmentRepo.finalizeRefundedPayment()` reverse credits after webhook confirmation.
- **Debug "paid but still locked"**: inspect the payment row, then check whether `paymentFulfillmentRepo.finalizeConfirmedPayment()` ran and whether entitlement reads in `apps/server/src/routes.ts` see an active subscription or available event-pack credits.
- **Change web and mini-program payment flow together**: update shared DTOs and pure helpers in `packages/shared/src/api.ts`, then review both platform adapters and `docs/PLATFORM_COORDINATION.md` before merging.

## Troubleshooting

**The client created a payment but the user still has no entitlement**
Check whether the payment is still `pending`, whether the webhook or status query reached `paymentFulfillmentRepo.finalizeConfirmedPayment()`, and whether the entitlement read in `apps/server/src/routes.ts` is looking for a subscription versus event-pack credits.

**A refund succeeded in WeChat but credits or entitlement did not roll back**
Verify that `REFUND.SUCCESS` reaches `paymentService.handleWebhook()` and that `paymentFulfillmentRepo.finalizeRefundedPayment()` ran. Do not patch the route to set refunded state directly.

**Mini-program and web payment behavior drifted after a shared change**
Update `packages/shared/src/api.ts`, re-read `docs/PLATFORM_COORDINATION.md`, and confirm both platform adapters still compile and preserve their local launch responsibilities.

**The client sees `PAYMENTS_DISABLED` unexpectedly**
Check `PAYMENTS_ENABLED`, the launch-config guidance in `docs/LAUNCH_CONFIG.md`, and whether the client is reading the current `/api/auth/user` response.

## Review checklist

- [ ] Payment endpoint changes stay in `apps/server/src/routes/domains/payments.ts`
- [ ] WeChat creation, status, webhook, and refund initiation stay in `apps/server/src/paymentService.ts`
- [ ] Fulfillment and refund side effects stay transaction-wrapped in `apps/server/src/repositories/paymentFulfillmentRepo.ts`
- [ ] Event-pack credits are only mutated through `apps/server/src/repositories/eventCreditsRepo.ts`
- [ ] Entitlement gating remains server-owned in `apps/server/src/routes.ts`
- [ ] Shared payment DTOs and verification helpers stay pure in `packages/shared/src/api.ts`
- [ ] Shared contract or platform-boundary changes update `docs/PLATFORM_COORDINATION.md` and the affected platform builds
- [ ] Payment feature-flag or environment assumptions still match `docs/LAUNCH_CONFIG.md`
- [ ] Relevant payment tests were updated when the authority boundary or behavior changed

## Related files

- `apps/server/src/routes/domains/payments.ts`
- `apps/server/src/paymentService.ts`
- `apps/server/src/repositories/paymentFulfillmentRepo.ts`
- `apps/server/src/repositories/eventCreditsRepo.ts`
- `apps/server/src/routes.ts`
- `packages/shared/src/api.ts`
- `packages/shared/src/schema.ts`
- `docs/PLATFORM_COORDINATION.md`
- `docs/LAUNCH_CONFIG.md`
- `apps/server/src/__tests__/paymentWebhook.test.ts`
- `apps/server/src/__tests__/paymentFulfillmentRepo.test.ts`
- `apps/server/src/__tests__/miniProgramPaymentRoutes.test.ts`
- `apps/server/src/__tests__/sharedApiContracts.test.ts`
