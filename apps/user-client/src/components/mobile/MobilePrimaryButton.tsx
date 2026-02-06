/**
 * Mobile-Optimized Primary Button
 * 
 * Implements mobile-first design specification with:
 * - Touch-optimized size (96rpx height ≈ 48px)
 * - Gradient background
 * - Subtle tilt effect
 * - Instant touch feedback (<100ms)
 * - Haptic feedback support
 * 
 * Based on: Mobile UI Design Specification Section 3.B
 */

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef, useMemo } from "react";

interface MobilePrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tiltDegrees?: number;
  enableHaptic?: boolean;
}

// Check haptic support once at module level
const supportsHaptic = typeof navigator !== 'undefined' && 'vibrate' in navigator;

const MobilePrimaryButton = forwardRef<HTMLButtonElement, MobilePrimaryButtonProps>(
  ({ className, children, tiltDegrees = 0.8, enableHaptic = true, onClick, ...props }, ref) => {
    // Check for motion reduce preference
    const prefersReducedMotion = useMemo(() => {
      if (typeof window === 'undefined') return false;
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }, []);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Trigger haptic feedback on supported devices
      if (enableHaptic && supportsHaptic) {
        navigator.vibrate(20); // 20ms light vibration
      }
      
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          // Base styles - 90% width, comfortable height
          "w-[90%] h-12 mx-auto",
          "rounded-full",
          // Gradient background
          "bg-gradient-to-r from-[#FF6B9D] to-[#A86BFF]",
          "text-white font-semibold text-base",
          // Touch feedback - instant response
          "active:scale-[0.96] active:opacity-90",
          "transition-all duration-100 ease-out",
          // Shadow
          "shadow-md active:shadow-sm",
          // Motion reduce support
          "motion-reduce:transition-none motion-reduce:active:scale-100",
          // Disabled state
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          className
        )}
        style={{
          transform: prefersReducedMotion ? 'none' : `rotate(${tiltDegrees}deg)`,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

MobilePrimaryButton.displayName = "MobilePrimaryButton";

export default MobilePrimaryButton;
