/**
 * SwipeToUnlock – draggable slider with haptic feedback.
 *
 * • Uses Pointer Events (onPointerDown / Move / Up) for smooth cross-device drag.
 * • Progressive navigator.vibrate ticks while dragging; heavy thud on unlock.
 * • Inset recessed-groove track + glowing handle.
 * • Placeholder text changes at 0%, 30%, 80% thresholds.
 */

import { useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface SwipeToUnlockProps {
  onUnlock: () => void;
  disabled?: boolean;
  labelStages?: Array<{ threshold: number; label: string }>;
  ariaLabel?: string;
}

const DEFAULT_LABEL_STAGES = [
  { threshold: 0, label: "探索本桌伙伴 >" },
  { threshold: 30, label: "滑动解封..." },
  { threshold: 80, label: "准备揭晓!" },
];

function getLabel(pct: number, labelStages: Array<{ threshold: number; label: string }>): string {
  if (labelStages.length === 0) return "继续滑动";
  let label = labelStages[0].label;
  for (const stage of labelStages) {
    if (pct >= stage.threshold) label = stage.label;
  }
  return label;
}

/** Width of the draggable handle in pixels (keep in sync with w-14 class below). */
const HANDLE_W = 56;

export default function SwipeToUnlock({
  onUnlock,
  disabled = false,
  labelStages = DEFAULT_LABEL_STAGES,
  ariaLabel = "滑动解锁",
}: SwipeToUnlockProps) {
  const sortedLabelStages = useMemo(
    () => [...labelStages].sort((a, b) => a.threshold - b.threshold),
    [labelStages],
  );
  const trackRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const startXRef = useRef(0);
  const unlockedRef = useRef(false);
  // Track the last vibrated percentage within a drag session for haptic ticks
  const lastVibratePctRef = useRef(0);

  const triggerUnlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    setUnlocked(true);
    setPct(100);
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
    setTimeout(onUnlock, 300);
  }, [onUnlock]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || unlockedRef.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      startXRef.current = e.clientX;
      // Sync the vibration baseline with the current position at drag start
      // so ticks are always 10% ahead of where we started, not the last release
      lastVibratePctRef.current = 0;
      setIsDragging(true);
    },
    [disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || unlockedRef.current) return;
      const track = trackRef.current;
      if (!track) return;

      const trackWidth = track.clientWidth - HANDLE_W;
      const dx = e.clientX - startXRef.current;
      const raw = Math.max(0, Math.min(dx / trackWidth, 1)) * 100;
      setPct(raw);

      // Haptic tick every 10% increment (navigator.vibrate may be unavailable on iOS)
      if (navigator.vibrate && raw - lastVibratePctRef.current >= 10) {
        navigator.vibrate(8);
        lastVibratePctRef.current = raw;
      }

      if (raw >= 95) triggerUnlock();
    },
    [isDragging, triggerUnlock]
  );

  const handlePointerUp = useCallback(() => {
    if (unlockedRef.current) return;
    setIsDragging(false);
    setPct(0); // snap back — lastVibratePctRef is reset on next pointerdown
  }, []);

  // Keyboard accessibility: arrow keys adjust position, Space/Enter unlock
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || unlockedRef.current) return;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        setPct((prev) => {
          const next = Math.min(prev + 10, 100);
          if (next >= 95) triggerUnlock();
          return next;
        });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        setPct((prev) => Math.max(prev - 10, 0));
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        triggerUnlock();
      }
    },
    [disabled, triggerUnlock]
  );

  const label = getLabel(pct, sortedLabelStages);
  // Position the handle so its left edge is proportional to pct,
  // accounting for the handle's own width to keep it fully within the track.
  const handleLeft = `calc(${pct}% * (100% - ${HANDLE_W}px) / 100)`;

  return (
    <div
      className="w-full px-1 select-none"
      aria-label={ariaLabel}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={unlocked ? "已解锁" : label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-14 rounded-full overflow-hidden"
        style={{
          background: "rgba(0,0,0,0.35)",
          boxShadow: "inset 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 3px rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Fill glow */}
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, rgba(139,92,246,0.3) 0%, rgba(168,85,247,0.5) 100%)",
          }}
          transition={{ type: "tween", ease: "easeOut", duration: 0.05 }}
        />

        {/* Placeholder label */}
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            className="absolute inset-0 flex items-center justify-center text-sm font-medium pointer-events-none"
            style={{ color: "rgba(255,255,255,0.7)", paddingLeft: 64 }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {label}
          </motion.span>
        </AnimatePresence>

        {/* Draggable handle */}
        <motion.div
          className="absolute top-1 h-12 w-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
          style={{
            left: handleLeft,
            background: unlocked
              ? "linear-gradient(135deg,#a78bfa,#7c3aed)"
              : "linear-gradient(135deg,#c4b5fd,#8b5cf6)",
            boxShadow: isDragging
              ? "0 0 0 6px rgba(139,92,246,0.35), 0 4px 20px rgba(139,92,246,0.6)"
              : "0 0 0 3px rgba(139,92,246,0.2), 0 2px 10px rgba(0,0,0,0.4)",
            transition: "box-shadow 0.2s",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={unlocked ? { rotate: 90, scale: 1.2 } : { rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
