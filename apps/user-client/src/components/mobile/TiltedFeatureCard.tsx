/**
 * Mobile-Optimized Tilted Feature Card
 * 
 * Implements mobile-first design specification with:
 * - Subtle tilt effect for visual interest
 * - Touch-optimized tap states
 * - Minimum 44x44pt tap target (Apple HIG)
 * - Smooth animations optimized for mobile
 * 
 * Based on: Mobile UI Design Specification Section 3
 */

import { cn } from "@/lib/utils";
import { ReactNode, useMemo } from "react";

interface TiltedFeatureCardProps {
  icon: ReactNode;
  title: string;
  description?: string;
  tiltDegrees?: number;
  onClick?: () => void;
  className?: string;
}

export default function TiltedFeatureCard({
  icon,
  title,
  description,
  tiltDegrees = 0,
  onClick,
  className,
}: TiltedFeatureCardProps) {
  // Check for motion reduce preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styles - aspect ratio 165:140 (1.18:1) per spec
        "relative w-full overflow-hidden rounded-3xl",
        "bg-white shadow-lg",
        "flex flex-col items-center justify-center gap-2",
        "p-6",
        // Touch target minimum 44x44pt
        "min-h-[44px] min-w-[44px]",
        // Touch feedback
        "active:scale-[0.98] active:opacity-90",
        "transition-all duration-200 ease-out",
        // Motion reduce support
        "motion-reduce:transition-none motion-reduce:active:scale-100",
        className
      )}
      style={{
        aspectRatio: '165 / 140',
        transform: prefersReducedMotion ? 'none' : `rotate(${tiltDegrees}deg)`,
      }}
      type="button"
      aria-label={title}
    >
      {/* Icon */}
      <div className="text-4xl mb-2">{icon}</div>

      {/* Title */}
      <h3 className="text-base font-semibold text-gray-800 text-center leading-tight">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-600 text-center leading-snug">
          {description}
        </p>
      )}
    </button>
  );
}
