/**
 * Landing Brand Section Component
 * 
 * Displays the JoyJoin brand elements:
 * - Gift box logo
 * - Main heading with gradient text
 * - Three feature badges
 * 
 * Customization:
 * - Update heading text in the <h1> element
 * - Modify feature badges in the FEATURES array
 * - Adjust gradient colors using CSS variables
 * 
 * Usage:
 * ```tsx
 * <LandingBrandSection />
 * ```
 */

import { motion } from "framer-motion";
import { Gift, Users, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import boxLogo from "@/assets/box_logo_archetypes.png";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const FEATURES = [
  { icon: Sparkles, text: "惊喜圈访" },
  { icon: Users, text: "普定吧配" },
  { icon: Gift, text: "4-6人局" },
];

export function LandingBrandSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="w-full max-w-md mx-auto px-4 text-center">
      {/* Logo */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="flex justify-center mb-6"
      >
        <img 
          src={boxLogo} 
          alt="JoyJoin Logo" 
          className="w-20 h-20 sm:w-24 sm:h-24"
        />
      </motion.div>

      {/* Main Heading with Gradient */}
      <motion.h1
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-3xl sm:text-4xl font-bold mb-4 leading-tight"
      >
        <span 
          className="bg-clip-text text-transparent bg-gradient-to-r"
          style={{
            backgroundImage: "linear-gradient(to right, hsl(280, 50%, 60%), hsl(340, 75%, 60%))",
          }}
        >
          让闲时相遇
        </span>
        <br />
        <span 
          className="bg-clip-text text-transparent bg-gradient-to-r"
          style={{
            backgroundImage: "linear-gradient(to right, hsl(280, 50%, 60%), hsl(340, 75%, 60%))",
          }}
        >
          不再遇见
        </span>
      </motion.h1>

      {/* Feature Badges */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="flex flex-wrap justify-center gap-2 sm:gap-3"
      >
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Badge
              key={index}
              variant="outline"
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 transition-colors"
            >
              <Icon className="w-4 h-4 mr-1.5" />
              <span className="text-sm sm:text-base font-medium">{feature.text}</span>
            </Badge>
          );
        })}
      </motion.div>
    </div>
  );
}
