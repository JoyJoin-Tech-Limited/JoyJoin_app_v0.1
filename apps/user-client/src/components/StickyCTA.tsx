import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { forwardRef } from "react";

interface StickyCTAProps {
  children: React.ReactNode;
  className?: string;
  /** Whether to show a top border */
  showBorder?: boolean;
  /** Additional padding at the bottom (for safe area) */
  safeAreaBottom?: boolean;
}

/**
 * StickyCTA - Floating bottom CTA container for mobile
 * 
 * Provides a consistent sticky bottom bar without white background,
 * using backdrop blur for a modern, translucent appearance.
 * Includes safe area inset handling for notched devices.
 */
export function StickyCTA({ 
  children, 
  className,
  showBorder = true,
  safeAreaBottom = true,
}: StickyCTAProps) {
  return (
    <div 
      className={cn(
        "sticky bottom-0 left-0 right-0 z-40",
        "bg-background/95 backdrop-blur-sm",
        showBorder && "border-t",
        "p-4",
        safeAreaBottom && "pb-[calc(1rem+env(safe-area-inset-bottom))]",
        "transition-all duration-300",
        className
      )}
    >
      <div className="max-w-md mx-auto w-full">
        {children}
      </div>
    </div>
  );
}

interface StickyCTAButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
  isLoading?: boolean;
  loadingText?: string;
}

/**
 * StickyCTAButton - Styled button for use within StickyCTA
 * 
 * Large, rounded button with loading state support.
 */
export const StickyCTAButton = forwardRef<HTMLButtonElement, StickyCTAButtonProps>(
  ({ children, isLoading, loadingText, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="lg"
        disabled={disabled || isLoading}
        className={cn(
          "w-full h-14 text-lg rounded-2xl",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);

StickyCTAButton.displayName = "StickyCTAButton";

interface StickyCTASecondaryButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
  isLoading?: boolean;
}

/**
 * StickyCTASecondaryButton - Secondary action button for StickyCTA
 * 
 * Dashed border outline style for secondary actions like "换一题".
 */
export const StickyCTASecondaryButton = forwardRef<HTMLButtonElement, StickyCTASecondaryButtonProps>(
  ({ children, isLoading, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="outline"
        size="lg"
        disabled={disabled || isLoading}
        className={cn(
          "w-full h-14 text-lg rounded-2xl gap-2 border-dashed",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : null}
        {children}
      </Button>
    );
  }
);

StickyCTASecondaryButton.displayName = "StickyCTASecondaryButton";

export default StickyCTA;
