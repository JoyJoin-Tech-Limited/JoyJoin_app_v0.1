/**
 * Landing CTA Section Component
 * 
 * Displays two call-to-action buttons with dynamic routing.
 * 
 * Routing Configuration:
 * - Primary CTA: Routes to /personality-test (氛围测试)
 * - Secondary CTA: Routes to /login
 * 
 * Customization:
 * - Update button text in the Button components
 * - Change routes by modifying the setLocation() calls
 * - Adjust gradient colors in the style prop
 * 
 * Usage:
 * ```tsx
 * <LandingCTASection />
 * ```
 */

import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export function LandingCTASection() {
  const [, setLocation] = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const handlePrimaryClick = () => {
    // Route to personality test (氛围测试)
    setLocation("/personality-test");
  };

  const handleSecondaryClick = () => {
    // Route to login page
    setLocation("/login");
  };

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="space-y-3"
      >
        {/* Primary CTA - Personality Test */}
        <Button
          onClick={handlePrimaryClick}
          size="lg"
          className="w-full text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(to right, #a855f7, #ec4899)",
            border: "none",
          }}
        >
          首盲我已遇见吧
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>

        {/* Secondary CTA - Login */}
        <Button
          onClick={handleSecondaryClick}
          size="lg"
          variant="outline"
          className="w-full text-base sm:text-lg font-medium border-2 hover:bg-accent/50 transition-all"
        >
          已有账号登录
        </Button>
      </motion.div>
    </div>
  );
}
