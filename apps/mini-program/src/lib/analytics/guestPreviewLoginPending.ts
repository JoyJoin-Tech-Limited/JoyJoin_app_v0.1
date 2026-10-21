/**
 * Guest-preview login-pending guard (转化 P1c / S7.4, 2026-10-20).
 *
 * `guest_preview_login_success` must only fire when this login completes a
 * guest attempt that actually STARTED at the preview card. The funnel SQL
 * (`benchmark-conversion-funnel-metrics.sql` Q4b) counts DISTINCT guestAttemptIds
 * for login_tap and login_success independently, so an unconditional emit on
 * every results-page login would mint a phantom id via
 * `consumeGuestAttemptId()` (get-or-create semantics) and inflate
 * `guest_to_login_conv` — flag-off / supply<3 guests who log in through the
 * plain continue CTA never entered the guest funnel and must contribute
 * nothing.
 *
 * The flag lives in module scope: impression (id mint), card tap, and login
 * success all happen inside the same page session (the results page), so the
 * JS runtime lifetime is exactly the attempt lifetime. It carries zero PII —
 * it is a boolean "did the guest tap the preview card's login CTA" marker.
 */

let loginPending = false

/** Section marks on card tap (the same instant login_tap fires). */
export function markGuestPreviewLoginPending(): void {
  loginPending = true
}

/**
 * Login-success callback: read + reset. Returns true only when the login
 * completes a guest attempt started at the preview card.
 */
export function consumeGuestPreviewLoginPending(): boolean {
  const wasPending = loginPending
  loginPending = false
  return wasPending
}

/** Test-only reset — never called in product code. */
export function __resetGuestPreviewLoginPendingForTests(): void {
  loginPending = false
}
