/**
 * SliderQuestion — playful energy-dial interaction for V4 personality assessment.
 * Renders a draggable horizontal slider that captures continuous trait intensity.
 */

import { useRef, useCallback, useEffect, useState } from "react";
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

  /** Convert a clientX position to a 0–100 value relative to the track. */
  const clientXToValue = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 50;
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 100);
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

  const fillPercent = value ?? 50;
  const thumbEmoji = getThumbEmoji(value, sliderConfig.leftEmoji, sliderConfig.rightEmoji);

  // Xiaoyue feedback bubble
  const xiaoyueFeedbackText =
    value !== undefined
      ? getOptionFeedback(questionId, getSliderBucket(value))
      : undefined;

  return (
    <div className="w-full px-2 py-4" data-testid="slider-question">
      {/* Track area — pointer events live here so the whole width is grabbable */}
      <div
        ref={trackRef}
        className="relative h-12 flex items-center cursor-pointer select-none"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-testid="slider-track"
      >
        {/* Track rail */}
        <div className="absolute left-0 right-0 h-3 rounded-full bg-muted mx-5 overflow-hidden">
          {/* Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-primary/40 transition-[width] duration-75"
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {/* Thumb */}
        <motion.div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
            "w-11 h-11 rounded-full bg-primary shadow-lg",
            "flex items-center justify-center text-2xl",
            "cursor-grab active:cursor-grabbing",
            "pointer-events-none", // track div handles pointer events
          )}
          style={{ left: `calc(${fillPercent}% * (100% - 40px) / 100% + 20px)` }}
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

      {/* Emoji + label row */}
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
