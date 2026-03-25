/**
 * SliderQuestion — playful energy-dial interaction for V4 personality assessment.
 * Renders a draggable horizontal slider that captures continuous trait intensity.
 */

import { useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getOptionFeedback } from "@shared/personality/feedback";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";

export interface SliderConfig {
  leftLabel: string;
  rightLabel: string;
  leftEmoji: string;
  rightEmoji: string;
  traitMappings: Array<{
    traitKey: string;
    scoreAtZero: number;
    scoreAt100: number;
  }>;
}

interface SliderQuestionProps {
  questionId: string;
  sliderConfig: SliderConfig;
  /** 0–100, undefined = user hasn't touched slider yet */
  value: number | undefined;
  onChange: (value: number) => void;
  animate?: boolean;
}

// Thumb is w-11 (44px); track has mx-5 (20px) horizontal padding on each side.
// The thumb center lives within [TRACK_PADDING, trackWidth - TRACK_PADDING].
const TRACK_PADDING = 20; // px — matches the `mx-5` / `px-5` classes on track & labels

/** Map slider value (0–100) to one of the three feedback buckets. */
function getSliderBucket(v: number): "left" | "center" | "right" {
  if (v < 30) return "left";
  if (v > 70) return "right";
  return "center";
}

/** Pick the emoji to show on the thumb based on value thresholds. */
function getThumbEmoji(
  value: number | undefined,
  leftEmoji: string,
  rightEmoji: string,
): string {
  if (value === undefined) return "👆";
  if (value < 25) return leftEmoji;
  if (value > 75) return rightEmoji;
  return "😐";
}

export function SliderQuestion({
  questionId,
  sliderConfig,
  value,
  onChange,
  animate = true,
}: SliderQuestionProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  /**
   * Convert a clientX position to a 0–100 value relative to the track's
   * draggable region ([TRACK_PADDING, trackWidth - TRACK_PADDING]).
   */
  const clientXToValue = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 50;
    const rect = track.getBoundingClientRect();
    const usableWidth = rect.width - TRACK_PADDING * 2;
    const x = Math.max(0, Math.min(clientX - rect.left - TRACK_PADDING, usableWidth));
    return Math.round((x / usableWidth) * 100);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      haptics.light();
      onChange(clientXToValue(e.clientX));
    },
    [clientXToValue, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      onChange(clientXToValue(e.clientX));
    },
    [clientXToValue, onChange],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    haptics.medium();
  }, []);

  /** Keyboard interaction: arrow keys move by 5 units, Home/End jump to extremes. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const current = value ?? 50;
      const STEP = 5;
      let next: number | undefined;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = Math.min(100, current + STEP);
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = Math.max(0, current - STEP);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = 100;
          break;
        default:
          return;
      }

      e.preventDefault();
      onChange(next);
    },
    [value, onChange],
  );

  const fillPercent = value ?? 50;
  const thumbEmoji = getThumbEmoji(value, sliderConfig.leftEmoji, sliderConfig.rightEmoji);

  // Xiaoyue feedback bubble — shown once user has interacted with slider
  const xiaoyueFeedbackText =
    value !== undefined
      ? getOptionFeedback(questionId, getSliderBucket(value))
      : undefined;

  return (
    <div className="w-full px-2 py-4" data-testid="slider-question">
      {/* Track area — pointer events live here so the whole width is grabbable.
          Also acts as the ARIA slider widget with keyboard support. */}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? 50}
        aria-valuetext={`${value ?? 50} — ${sliderConfig.leftLabel} 到 ${sliderConfig.rightLabel}`}
        tabIndex={0}
        className="relative h-12 flex items-center cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        data-testid="slider-track"
      >
        {/* Track rail — inset by TRACK_PADDING on each side */}
        <div className="absolute left-0 right-0 h-3 rounded-full bg-muted mx-5 overflow-hidden">
          {/* Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-primary/40 transition-[width] duration-75"
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {/* Thumb — positioned at fillPercent% of the usable track range */}
        <motion.div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
            "w-11 h-11 rounded-full bg-primary shadow-lg",
            "flex items-center justify-center text-2xl",
            "cursor-grab active:cursor-grabbing",
            "pointer-events-none", // track div handles pointer events
          )}
          style={{
            // Map 0–100 value into the [TRACK_PADDING, width-TRACK_PADDING] range
            left: `calc(${TRACK_PADDING}px + ${fillPercent}% * (100% - ${TRACK_PADDING * 2}px) / 100)`,
          }}
          animate={
            shouldAnimate && value !== undefined
              ? { scale: [1, 1.15, 1] }
              : undefined
          }
          transition={{ duration: 0.25 }}
          data-testid="slider-thumb"
        >
          <span className="leading-none select-none">{thumbEmoji}</span>
        </motion.div>
      </div>

      {/* Emoji + label row — px-5 matches TRACK_PADDING so labels align under track ends */}
      <div className="flex justify-between mt-1 px-5">
        <div className="flex flex-col items-center gap-1 max-w-[6rem]">
          <span className="text-2xl leading-none">{sliderConfig.leftEmoji}</span>
          <span className="text-xs text-muted-foreground text-center leading-tight">
            {sliderConfig.leftLabel}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 max-w-[6rem]">
          <span className="text-2xl leading-none">{sliderConfig.rightEmoji}</span>
          <span className="text-xs text-muted-foreground text-center leading-tight">
            {sliderConfig.rightLabel}
          </span>
        </div>
      </div>

      {/* Xiaoyue feedback bubble — shown once user touches slider */}
      {xiaoyueFeedbackText && (
        <div className="mt-4">
          <XiaoyueChatBubble
            pose="pointing"
            content={xiaoyueFeedbackText}
            horizontal
            animate={shouldAnimate}
          />
        </div>
      )}
    </div>
  );
}
