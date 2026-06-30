# Payment Operations and Detailed Reference

## Webhook handling specifics

WeChat-facing payment creation, status queries, webhook verification, refund initiation, and reconciliation live in `apps/server/src/paymentService.ts`. Keep H5 and JSAPI request construction, webhook signature checks, `REFUND.SUCCESS` handling, and `reconcilePayment()` there instead of duplicating them in routes or clients.

`resolvePlatformCert()` accepts:
- raw PEM public key (微信支付公钥 mode),
- raw PEM platform certificate (legacy),
- base64-encoded PEM (recommended for docker-compose `env_file` to avoid multi-line corruption).

On webhook verification failure, return 400 and log the failure — do not silently ignore.

## Verification polling

Shared client contracts and pure verification helpers live in `packages/shared/src/api.ts`. Safe extractions include payment DTOs, plan normalization, and `getPaymentVerificationStatusDecision()` / `getPaymentVerificationErrorDecision()`. Do not move WeChat SDK calls, storage, redirect launch, or toast logic there.

If a webhook is delayed or a client polling window times out, call `POST /api/payments/:wechatOrderId/reconcile` to query WeChat Pay directly and fulfill the order. The endpoint is idempotent and returns `{ status, fulfilled }`.

## Refund procedures

Admin refunds require both auth and audit truth. `/api/admin/payments/:paymentId/refund` is protected by `requireAdmin` and records `PAYMENT_REFUND_INITIATED`. If refund permissions, logging, or failure handling changes, review the admin governance skill too.

Refund flow:
1. Initiate via `paymentService.createRefund()`
2. Preserve the refund blocker check in `eventCreditsRepo.getRefundBlockerCountForPayment()`
3. Let `paymentFulfillmentRepo.finalizeRefundedPayment()` reverse credits after webhook confirmation

## Event-pack credit details

Event-pack credit lifecycle lives in `apps/server/src/repositories/eventCreditsRepo.ts`. Grant, consume, summarize, and reverse credits only through this repository. Do not mutate `event_credit_grants` or `event_credit_redemptions` ad hoc.

## Cross-platform payment coordination

Platform launch and pending-order persistence stay local:
- Mini Program owns `Taro.requestPayment` and pending-order storage (launch-primary)
- Browser clients own H5 redirect launch (reference-only, not shipping)
- Coordinate shared contract changes through `docs/PLATFORM_COORDINATION.md`

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
