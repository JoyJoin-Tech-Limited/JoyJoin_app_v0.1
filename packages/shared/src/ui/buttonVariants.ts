/**
 * JoyJoin Shared Button Variants
 *
 * Source of truth for button styling across user-client and admin-client.
 * App-local `components/ui/button.tsx` files re-export from here so that the
 * canonical `import { Button } from "@/components/ui/button"` path continues
 * to work without any import rewrites across the codebase.
 *
 * Design direction: clean · big · sleek · premium
 *  - Warm purple brand gradient on the primary/default variant
 *  - Refined `rounded-xl` radius for a premium feel
 *  - Subtle depth shadow on primary actions
 *  - Smooth 150 ms transitions on all interactions
 *  - WCAG AA contrast; `lg` size meets 44 px touch-target requirement
 */

import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  // Base: accessible layout, premium radius, bold type, smooth transitions
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold" +
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" +
  " disabled:pointer-events-none disabled:opacity-45" +
  " [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
  " transition-all duration-150 ease-out" +
  " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        // Premium primary: brand gradient + subtle depth shadow
        default:
          "[background:var(--btn-primary-gradient)] text-primary-foreground border border-primary-border" +
          " shadow-[var(--btn-shadow-primary)]",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border",
        outline:
          // Inherits card/section background; shows contained context colour.
          "border [border-color:var(--button-outline)] shadow-xs active:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground border border-secondary-border",
        // Transparent border keeps layout stable when a border is toggled on later.
        ghost: "border border-transparent",
      },
      // Heights use `min-h` so buttons gracefully expand for multi-line content
      // (e.g. AI-generated labels) while looking correct with typical short labels.
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        // lg targets 44 px+ height — primary CTAs and action buttons
        lg: "min-h-11 rounded-xl px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
