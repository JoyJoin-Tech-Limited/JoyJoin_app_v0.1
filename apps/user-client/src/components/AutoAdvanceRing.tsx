import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AutoAdvanceRingProps {
  /** Duration of the countdown in milliseconds */
  duration: number;
  /** Size of the ring in pixels */
  size?: number;
  /** Whether the ring is active (counting down) */
  active: boolean;
  /** Called when countdown completes */
  onComplete: () => void;
  /** CSS class for the ring */
  className?: string;
}

export function AutoAdvanceRing({
  duration,
  size = 24,
  active,
  onComplete,
  className,
}: AutoAdvanceRingProps) {
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  // Keep a stable ref to onComplete to avoid restarting animation on every re-render
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      startTimeRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      if (!startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);

      if (p >= 1) {
        onCompleteRef.current();
        return;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, duration]); // onComplete excluded from deps — a ref keeps it current (see above),
  // so the animation never restarts just because the parent re-renders with a new callback reference

  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  if (!active) return null;

  return (
    <svg
      width={size}
      height={size}
      className={cn("transform -rotate-90", className)}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-muted-foreground/20"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        className="text-primary transition-none"
      />
    </svg>
  );
}
