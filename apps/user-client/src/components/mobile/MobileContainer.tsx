/**
 * Mobile Container with Safe Area Support
 * 
 * Handles mobile-specific layout considerations:
 * - Safe area insets (iOS notch, home indicator, Android navigation)
 * - Proper viewport height (100dvh for mobile)
 * - Container padding (40rpx ≈ 20px)
 * 
 * Based on: Mobile UI Design Specification Section 2
 */

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface MobileContainerProps {
  children: ReactNode;
  className?: string;
  enableSafeArea?: boolean;
}

export default function MobileContainer({
  children,
  className,
  enableSafeArea = true,
}: MobileContainerProps) {
  return (
    <div
      className={cn(
        // Full viewport with consistent height approach
        "w-full min-h-[100dvh]",
        // Safe area support OR base padding (not both)
        enableSafeArea
          ? [
              "pt-[env(safe-area-inset-top,1.5rem)]",
              "pb-[env(safe-area-inset-bottom,1.5rem)]",
              "pl-[env(safe-area-inset-left,1.25rem)]",
              "pr-[env(safe-area-inset-right,1.25rem)]",
            ]
          : "px-5 py-6",
        className
      )}
    >
      {children}
    </div>
  );
}
