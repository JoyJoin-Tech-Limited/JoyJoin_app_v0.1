/**
 * App-local button wrapper — re-exports the shared JoyJoin Button so that the
 * canonical `import { Button } from "@/components/ui/button"` path works
 * without any import rewrites across the codebase.
 *
 * All logic lives in packages/shared/src/ui/Button.tsx.
 * All styling lives in packages/shared/src/ui/buttonVariants.ts.
 */
export { Button, buttonVariants } from "@shared/ui/Button";
export type { ButtonProps, ButtonVariantProps } from "@shared/ui/Button";
