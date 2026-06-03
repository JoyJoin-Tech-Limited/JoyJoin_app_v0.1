# Grill-Me — Payment Entitlement Authority

> Stress-test payment implementation assumptions. One question per turn.
> Every chargeback starts with an assumption that wasn't challenged.

## Payment Creation

Ask when adding or modifying payment flow:

**Q1:** Walk me through the full payment lifecycle: create → user pays → webhook confirms → entitlement granted. Where's the idempotency check?
- Recommended: Creation checks for existing pending order. Webhook handler checks for already-confirmed payment before processing.

**Q2:** What happens if the WeChat Pay webhook fires twice (replay)? Does the user get double-charged or double-credited?
- Recommended: Idempotent. Second webhook sees `status = 'confirmed'` and returns 200 without re-processing.

**Q3:** Where does the payment row get created vs where does entitlement get granted? Are they in the same transaction?
- Recommended: Payment row creation and entitlement grant are separate. Payment confirms first; fulfillment runs after — outside the creation transaction.

## Refunds

Ask when touching refund logic:

**Q4:** After a refund succeeds in WeChat, what happens to the user's credits/entitlement? Are they reversed atomically?
- Recommended: `paymentFulfillmentRepo.finalizeRefundedPayment()` reverses credits inside a transaction. Webhook → refund service → transaction-wrapped fulfillment.

**Q5:** Can a user refund an event pack they've already partially consumed? What's the blocker check?
- Recommended: Refund blocked if credits consumed. `eventCreditsRepo` checks remaining balance before allowing refund initiation.

**Q6:** If the refund API call to WeChat times out but WeChat processed it, what happens on retry?
- Recommended: Status query before retry. If WeChat shows `REFUND.SUCCESS`, local state syncs without re-initiating.

## Entitlement Gating

Ask when changing access control:

**Q7:** What's the exact order of entitlement checks? Subscription first, then event-pack credits? What if both are present?
- Recommended: Subscription checked first (premium access). Event-pack credits checked second (per-event access). Order is deterministic and documented.

**Q8:** What happens when a user's subscription expires mid-event? Are they locked out immediately or given a grace period?
- Recommended: Grace period or explicit expiry check with clear error. No silent lockout mid-experience.

## Cross-Platform

Ask when shared payment contracts change:

**Q9:** Does this change affect both mini-program (Taro.requestPayment) and web (H5 redirect)? Are both paths tested?
- Recommended: Both platforms verified. `packages/shared/src/api.ts` DTOs updated. Platform launch flows stay local.

**Q10:** Is `PAYMENTS_ENABLED` feature flag checked on every payment endpoint? What happens when it's turned off mid-session?
- Recommended: Flag checked in route layer. Disabled → clear error response. Client reads `/api/auth/user` for flag state.

## Observability

Ask when payment code changes:

**Q11:** If a payment gets stuck in `pending` for 24 hours, how do we know? Is there a dashboard or alert?
- Recommended: Admin dashboard shows pending payments. WeCom alert for payments pending > 1 hour.
