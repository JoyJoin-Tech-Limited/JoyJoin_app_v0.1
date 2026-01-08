import { cn } from "@/lib/utils";

/**
 * Selection animation styles for interactive options
 * 
 * Provides consistent, sleek click/select animations across:
 * - Onboarding screens
 * - Personality test options
 * - Setup screens
 * - Event registration forms
 */

export const selectionAnimationClasses = {
  /**
   * Base container classes for selectable items
   * Includes border, transitions, and shadow
   */
  container: cn(
    "w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2",
    "transition-all duration-200 min-h-[64px]",
    "shadow-sm"
  ),

  /**
   * Unselected state classes
   */
  unselected: cn(
    "border-border bg-card",
    "hover:border-primary/50 hover:shadow-md",
    "active:scale-[0.98]"
  ),

  /**
   * Selected state classes
   */
  selected: cn(
    "border-primary bg-primary/10",
    "shadow-md"
  ),

  /**
   * Text classes for option labels
   */
  text: (isSelected: boolean) => cn(
    "text-lg font-medium leading-snug",
    isSelected ? "text-primary" : "text-foreground/90"
  ),

  /**
   * Checkmark indicator classes
   */
  indicator: cn(
    "w-6 h-6 rounded-full bg-primary",
    "flex items-center justify-center shrink-0"
  ),
};

/**
 * Get combined classes for a selection item
 */
export function getSelectionClasses(isSelected: boolean) {
  return cn(
    selectionAnimationClasses.container,
    isSelected 
      ? selectionAnimationClasses.selected 
      : selectionAnimationClasses.unselected
  );
}

/**
 * Framer Motion variants for selection animations
 */
export const selectionMotionVariants = {
  /**
   * Container entrance animation (staggered)
   */
  containerEntrance: {
    hidden: { opacity: 0, x: -20 },
    visible: (index: number) => ({
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, delay: index * 0.05 }
    }),
  },

  /**
   * Selection indicator pop-in animation
   */
  indicatorPopIn: {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { type: "spring", stiffness: 400, damping: 20 },
  },

  /**
   * Tap animation
   */
  tap: { scale: 0.98 },
};

export default selectionAnimationClasses;
