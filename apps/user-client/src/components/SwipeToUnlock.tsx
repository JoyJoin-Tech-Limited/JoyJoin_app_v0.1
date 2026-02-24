/**
 * SwipeToUnlock – draggable slider with haptic feedback.
 *
 * • Uses Pointer Events on the track div for correct touch math.
 * • Spring snap-back animation via useMotionValue + useSpring.
 * • Progressive navigator.vibrate ticks while dragging; heavy thud on unlock.
 * • Inset recessed-groove track + glowing handle.
 * • Placeholder text changes at 0%, 30%, 80% thresholds.
 * • Reduced-motion fallback: simple tap button.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ChevronsRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface SwipeToUnlockProps {
  onUnlock: () => void;
  disabled?: boolean;
}

const LABEL_STAGES = [
  { threshold: 0, label: "探索本桌伙伴 >" },
  { threshold: 30, label: "滑动解封..." },
  { threshold: 80, label: "准备揭晓!" },
];

function getLabel(pct: number): string {
  let label = LABEL_STAGES[0].label;
  for (const stage of LABEL_STAGES) {
    if (pct >= stage.threshold) label = stage.label;
  }
  return label;
}

/** Width of the draggable handle in pixels (keep in sync with w-14 class below). */
const HANDLE_W = 56;

export default function SwipeToUnlock({ onUnlock, disabled = false }: SwipeToUnlockProps) {
  const prefersReducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const unlockedRef = useRef(false);
  const lastVibratePctRef = useRef(0);

  // Spring-backed motion value for smooth snap-back on release
  const rawPct = useMotionValue(0);
  const pct = useSpring(rawPct, { stiffness: 400, damping: 35, mass: 0.8 });

  // Derive fill width and handle left offset from the spring motion value
  const fillWidth = useTransform(pct, (v) => `${v}%`);
  const handleLeft = useTransform(
    pct,
    (v) => `calc(${v}% * (100% - ${HANDLE_W}px) / 100)`
  );

  // Sync label text with spring value
  const [labelPct, setLabelPct] = useState(0);
  useEffect(() => {
    return pct.on("change", (v) => setLabelPct(v));
  }, [pct]);

  const label = getLabel(labelPct);

  // ── Pointer handlers on the track div ────────────────────────────────────────
  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || unlockedRef.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
    },
    [disabled]
  );

  const handleTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || unlockedRef.current) return;
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const raw =
        Math.max(
          0,
          Math.min(
            (e.clientX - rect.left - HANDLE_W / 2) / (rect.width - HANDLE_W),
            1
          )
        ) * 100;
      rawPct.set(raw);

      // Haptic tick every 10% increment
      const currentPct = rawPct.get();
      if (navigator.vibrate && currentPct - lastVibratePctRef.current >= 10) {
        navigator.vibrate(8);
        lastVibratePctRef.current = currentPct;
      }

      // Unlock at >= 95%
      if (raw >= 95 && !unlockedRef.current) {
        unlockedRef.current = true;
        setUnlocked(true);
        rawPct.set(100);
        if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
        setTimeout(onUnlock, 300);
      }
    },
    [isDragging, onUnlock, rawPct]
  );

  const handleTrackPointerUp = useCallback(() => {
    if (unlockedRef.current) return;
    setIsDragging(false);
    lastVibratePctRef.current = 0;
    rawPct.set(0); // spring snaps back smoothly
  }, [rawPct]);

  // ── Reduced motion fallback – rendered after all hooks ───────────────────────
  if (prefersReducedMotion) {
    return (
      <div className="w-full px-1">
        <button
          onClick={() => { onUnlock(); }}
          className="w-full h-14 rounded-full font-medium text-white text-sm"
          style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
        >
          点击查看伙伴 →
        </button>
      </div>
    );
  }

  return (
    <div className="w-full px-1 select-none" aria-label="滑动解锁">
      {/* Track – pointer events live here for correct touch math */}
      <div
        ref={trackRef}
        className="relative h-14 rounded-full overflow-hidden"
        style={{
          background: "rgba(0,0,0,0.35)",
          boxShadow: "inset 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 3px rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        onPointerCancel={handleTrackPointerUp}
      >
        {/* Fill glow */}
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: fillWidth,
            background:
              "linear-gradient(90deg, rgba(139,92,246,0.3) 0%, rgba(168,85,247,0.5) 100%)",
          }}
        />

        {/* Placeholder label */}
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            className="absolute inset-0 flex items-center justify-center text-sm font-medium pointer-events-none"
            style={{
              color: "rgba(255,255,255,0.7)",
              paddingLeft: `${HANDLE_W + 8}px`,
              paddingRight: "16px",
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {label}
          </motion.span>
        </AnimatePresence>

        {/* Draggable handle – true circle, pointer events removed (on track now) */}
        <motion.div
          className="absolute top-0 h-14 w-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
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
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={unlocked ? { rotate: 90, scale: 1.2 } : { rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <ChevronsRight className="w-6 h-6 text-white" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
