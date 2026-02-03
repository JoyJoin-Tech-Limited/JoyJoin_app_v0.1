/**
 * Landing Footer Component
 * 
 * Displays legal links for terms and privacy policy.
 * 
 * Customization:
 * - Update link URLs in the href attributes
 * - Modify link text in the anchor elements
 * - Add additional links by duplicating the link structure
 * 
 * Usage:
 * ```tsx
 * <LandingFooter />
 * ```
 */

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export function LandingFooter() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.footer
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8, duration: 0.5 }}
      className="w-full max-w-md mx-auto px-4 pb-8 safe-area-bottom"
    >
      <div className="flex justify-center items-center gap-4 text-xs sm:text-sm text-muted-foreground">
        <a 
          href="/terms" 
          className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          服务条款
        </a>
        <span className="text-border">•</span>
        <a 
          href="/privacy" 
          className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          隐私政策
        </a>
      </div>
    </motion.footer>
  );
}
