/**
 * SwipeToConfirm — Wave 2 EXP_IGNITION_CONFIRMATION
 *
 * A deliberate "ignition" gesture mechanic that replaces the standard submit
 * button with a horizontal swipe-right interaction.
 *
 * Accessibility requirements (MUST always be met):
 *   - A plain `<button>` fallback is always rendered below the swipe track.
 *   - When `prefersReducedMotion` is true, the swipe track is hidden and only
 *     the fallback button is shown.
 *   - The swipe track handle has an `aria-label` and is keyboard-activatable
 *     (Enter / Space fires onConfirm via the handle's `onClick`).
 *
 * Analytics:
 *   - `onSwipeStarted`    — user began dragging
 *   - `onSwipeCompleted`  — drag crossed the threshold → confirm fires
 *   - `onSwipeAbandoned`  — drag released before threshold (receives progress 0–100)
 *   - `onFallbackUsed`    — accessible button tapped
 */

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type PointerEvent,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Fraction of track width that must be cleared to trigger confirm. */
const CONFIRM_THRESHOLD = 0.75;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SwipeToConfirmProps {
  onConfirm: () => void;
  isSubmitting?: boolean;
  disabled?: boolean;
  label?: string;
  fallbackLabel?: string;
  // Analytics callbacks
  onSwipeStarted?: () => void;
  onSwipeCompleted?: () => void;
  onSwipeAbandoned?: (progressPct: number) => void;
  onFallbackUsed?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SwipeToConfirm({
  onConfirm,
  isSubmitting = false,
  disabled = false,
  label = "向右滑动锁定席位",
  fallbackLabel = "点击锁定席位",
  onSwipeStarted,
  onSwipeCompleted,
  onSwipeAbandoned,
  onFallbackUsed,
}: SwipeToConfirmProps) {
  const shouldReduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0–1
  const [isDragging, setIsDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const hasReportedStartRef = useRef(false);
  const progressRef = useRef(0);
  const previousIsSubmittingRef = useRef(isSubmitting);

  // Reset local swipe state once a submission attempt finishes so retry remains
  // possible after an error and the UI does not stay latched in the confirmed state.
  useEffect(() => {
    const wasSubmitting = previousIsSubmittingRef.current;

    if (wasSubmitting && !isSubmitting) {
      setConfirmed(false);
      setProgress(0);
      progressRef.current = 0;
      setIsDragging(false);
      dragStartXRef.current = null;
      hasReportedStartRef.current = false;
    }

    previousIsSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const getTrackWidth = useCallback((): number => {
    return trackRef.current?.getBoundingClientRect().width ?? 1;
  }, []);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled || isSubmitting || confirmed) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartXRef.current = e.clientX;
      setIsDragging(true);
      hasReportedStartRef.current = false;
    },
    [disabled, isSubmitting, confirmed],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isDragging || dragStartXRef.current === null) return;
      const delta = e.clientX - dragStartXRef.current;
      const trackWidth = getTrackWidth();
      const raw = delta / trackWidth;
      const clamped = Math.max(0, Math.min(1, raw));
      progressRef.current = clamped;
      setProgress(clamped);

      if (!hasReportedStartRef.current && clamped > 0.05) {
        hasReportedStartRef.current = true;
        onSwipeStarted?.();
        haptics.light();
      }
    },
    [isDragging, getTrackWidth, onSwipeStarted],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartXRef.current = null;
    const latestProgress = progressRef.current;

    if (latestProgress >= CONFIRM_THRESHOLD) {
      setConfirmed(true);
      haptics.heavy();
      onSwipeCompleted?.();
      onConfirm();
    } else {
      const progressPct = Math.round(latestProgress * 100);
      if (hasReportedStartRef.current) {
        onSwipeAbandoned?.(progressPct);
      }
      progressRef.current = 0;
      setProgress(0);
    }
    hasReportedStartRef.current = false;
    // `progressRef.current` is the source of truth here so the pointer-up
    // handler always sees the latest drag distance, even if React state for
    // `progress` has not flushed yet.
  }, [isDragging, onSwipeCompleted, onSwipeAbandoned, onConfirm]);

  const handleFallback = useCallback(() => {
    if (disabled || isSubmitting) return;
    haptics.medium();
    onFallbackUsed?.();
    onConfirm();
  }, [disabled, isSubmitting, onFallbackUsed, onConfirm]);

  // Keyboard support on the track: Enter / Space fires confirm
  const handleTrackKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!disabled && !isSubmitting && !confirmed) {
          haptics.medium();
          onFallbackUsed?.(); // counts as fallback for analytics
          onConfirm();
        }
      }
    },
    [disabled, isSubmitting, confirmed, onFallbackUsed, onConfirm],
  );

  const handleCue = isSubmitting
    ? "提交中…"
    : confirmed
    ? "✓ 已确认"
    : label;

  // When reduced-motion: hide the swipe track entirely; only show the plain button.
  if (shouldReduceMotion) {
    return (
      <div className="space-y-2" data-testid="swipe-to-confirm-reduced">
        <Button
          type="button"
          size="lg"
          onClick={handleFallback}
          disabled={disabled || isSubmitting}
          className="w-full bg-gradient-to-r from-primary to-purple-600"
          data-testid="swipe-confirm-fallback"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              提交中…
            </>
          ) : (
            fallbackLabel
          )}
        </Button>
      </div>
    );
  }

  const handleX = progress * (trackRef.current?.getBoundingClientRect().width ?? 280) * 0.8;

  return (
    <div className="space-y-3" data-testid="swipe-to-confirm">
      {/* Swipe track */}
      <div
        ref={trackRef}
        className={[
          "relative h-14 w-full select-none overflow-hidden rounded-2xl",
          "bg-gradient-to-r from-primary/20 to-purple-600/20 border border-primary/30",
          disabled || isSubmitting ? "opacity-60" : "cursor-grab active:cursor-grabbing",
        ].join(" ")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleTrackKeyDown}
        role="button"
        tabIndex={disabled || isSubmitting ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled || isSubmitting}
        data-testid="swipe-track"
      >
        {/* Progress fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-2xl bg-gradient-to-r from-primary/30 to-purple-600/30"
          style={{ width: `${progress * 100}%` }}
          animate={
            confirmed
              ? { width: "100%", opacity: 0.6 }
              : { width: `${progress * 100}%` }
          }
          transition={isDragging ? { duration: 0 } : { duration: 0.25 }}
        />

        {/* Track label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.span
              key={handleCue}
              initial={{ opacity: 0 }}
              animate={{ opacity: progress > 0.15 ? 0 : 1 }}
              exit={{ opacity: 0 }}
              className="text-sm font-semibold text-primary/70 select-none"
              aria-hidden="true"
            >
              {handleCue}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Draggable handle */}
        <motion.div
          className={[
            "absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center",
            "rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/40",
            "touch-none",
          ].join(" ")}
          style={{ x: handleX }}
          animate={
            confirmed
              ? { scale: 1.1, opacity: 0 }
              : isDragging
              ? { scale: 1.05 }
              : { scale: 1 }
          }
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          aria-hidden="true"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <ArrowRight className="h-5 w-5 text-white" />
          )}
        </motion.div>
      </div>

      {/* Accessible fallback — always rendered */}
      <button
        type="button"
        onClick={handleFallback}
        disabled={disabled || isSubmitting}
        className="w-full text-xs text-muted-foreground/60 hover:text-muted-foreground py-1 transition-colors"
        data-testid="swipe-confirm-fallback"
      >
        {fallbackLabel}
      </button>
    </div>
  );
}
