/**
 * JoyJoin Shared Button Component
 *
 * Shared runtime implementation of the JoyJoin button for user-client and
 * admin-client. App-local `components/ui/button.tsx` files re-export from
 * here so that `import { Button } from "@/components/ui/button"` continues
 * to work across the codebase without any import rewrites.
 *
 * Design direction: clean · big · sleek · premium
 * See: docs/button-design.md
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { buttonVariants, type ButtonVariantProps } from "./buttonVariants";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  /** Render as a child element using Radix UI Slot composition */
  asChild?: boolean;
  /** Show a loading spinner and disable interaction */
  loading?: boolean;
  /** Stretch button to fill its container width */
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={clsx(
          buttonVariants({ variant, size, className }),
          fullWidth && "w-full",
        )}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonVariantProps };
