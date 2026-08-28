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

**Core rule:** Payment writes are server-owned, shared contracts stay pure, and platform launch flows stay local. Keep endpoint auth, feature flags, and request validation in the route layer; WeChat-facing logic in the service layer; fulfillment side effects transaction-wrapped in repositories.

## When to use this skill

Use this skill when you are:

- adding or reviewing payment creation, status, or webhook handling
- changing refund flows, event-pack credits, or entitlement gating
- updating shared payment verification helpers or shared payment DTOs
- deciding whether a payment change belongs on the server, in `packages/shared`, or in platform-local adapters
- auditing mini-program versus web payment coordination

## Authority map overview

| Layer | Owner | Responsibility |
|-------|-------|----------------|
| Route layer | `apps/server/src/routes/domains/payments.ts` | Endpoint auth, feature flags, request validation, coupon validation |
| WeChat service | `apps/server/src/paymentService.ts` | Creation, status queries, webhook verification, refund initiation |
| Fulfillment | `apps/server/src/repositories/paymentFulfillmentRepo.ts` | Transaction-wrapped confirmation, refund application, subscription activation |
| Event credits | `apps/server/src/repositories/eventCreditsRepo.ts` | Grant, consume, summarize, reverse credits |
| Registration-cancel refunds | `apps/server/src/lib/poolRegistrationCancel.ts` (2026-08-27) | User-initiated cancel orchestration: pre-reveal full refund (money via `claimPaymentForRefund` atomic claim, credits reversed in-tx before delete; refund failure aborts without delete), post-reveal forfeiture, group-collapse stayer refunds via `autoRefundService` `REFUND_CONTEXTS.collapsed`. Both halves flag-gated (`preRevealRefundEnabled` / `noRefundAfterReveal`) |
| Entitlement reads | `apps/server/src/routes.ts` | Server-owned gating; checks subscription first, then event-pack credits |
| Shared contracts | `packages/shared/src/api.ts` | Pure DTOs, plan normalization, verification decision helpers |
| Schema | `packages/shared/src/schema.ts` | Persistence contract for payments and credit tables |

Platform launch flows stay local: Mini Program owns `Taro.requestPayment`; web owns H5 redirect. Coordinate shared contract changes through `docs/PLATFORM_COORDINATION.md`.

See [`references/payment-ops.md`](references/payment-ops.md) for webhook handling specifics, verification polling, refund procedures, event-pack credit details, and cross-platform coordination.

## Payment lifecycle overview

1. Client requests creation → route validates and delegates to `paymentService.ts`
2. WeChat SDK returns prepay info → client launches payment locally
3. Webhook or status query confirms → `paymentFulfillmentRepo.ts` updates state transactionally
4. Entitlement read in `routes.ts` grants access based on subscription or available credits

## Grill-me stress-test

After implementing payment changes, run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — a one-question-per-turn interview that stress-tests idempotency, webhook replay, refund atomicity, entitlement gating order, and cross-platform parity. Every assumption is a potential chargeback.

## Quick examples

- **Add a new payment status rule**: update the pure decision helper in `packages/shared/src/api.ts` when the change is only about client-visible verification state. Leave storage, retries, and platform navigation local.
- **Refund an event pack safely**: keep refund initiation in `paymentService.createRefund()`, preserve the refund blocker check in `eventCreditsRepo`, and let `paymentFulfillmentRepo.finalizeRefundedPayment()` reverse credits after webhook confirmation.
- **Debug "paid but still locked"**: inspect the payment row, then check whether `paymentFulfillmentRepo.finalizeConfirmedPayment()` ran and whether entitlement reads see an active subscription or available event-pack credits.

## Troubleshooting

**The client created a payment but the user still has no entitlement**
Check whether the payment is still `pending`, whether the webhook or status query reached `paymentFulfillmentRepo.finalizeConfirmedPayment()`, and whether the entitlement read is looking for a subscription versus event-pack credits.

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
- [ ] Grill-me interview completed for any payment path change (see `references/grill-me-checklist.md`)
