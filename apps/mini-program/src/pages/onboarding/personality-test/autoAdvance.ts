export const AUTO_ADVANCE_AFTER_TYPING_MS = 400

/**
 * PR-4 single-tap auto-advance guardrail.
 *
 * The auto-advance fires at max(commentaryShownAt + minDisplayMs,
 * typingDoneAt + 400ms) — it never interrupts the typewriter, and never
 * cuts the commentary below its minimum display span. Returns the
 * remaining wait from `now` (0 when the guard has already passed).
 */
export function computeAutoAdvanceDelayMs(params: {
  commentaryShownAt: number
  typingDoneAt: number
  minDisplayMs: number
  now: number
}): number {
  const target = Math.max(
    params.commentaryShownAt + params.minDisplayMs,
    params.typingDoneAt + AUTO_ADVANCE_AFTER_TYPING_MS,
  )
  return Math.max(0, target - params.now)
}
