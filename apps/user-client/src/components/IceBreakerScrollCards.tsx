/**
 * IceBreakerScrollCards
 *
 * Horizontal snap-scroll strip of ice-breaker topic cards.
 * Used inside SquadVibePanel as the reward after the card reveal.
 *
 * - Cards are 160×90dp, horizontally scrollable with snap-to-card
 * - Each card gets a subtle top border in the vibe accent colour
 * - Loading state renders shimmer placeholders
 */

import { motion } from "framer-motion";

interface IceBreakerScrollCardsProps {
  /** Array of ice-breaker topic strings from the AI analysis */
  topics: string[];
  /** CSS gradient or colour string for the top border accent */
  accentColor?: string;
  /** While true, render shimmer skeleton cards */
  isLoading?: boolean;
  /** When true, skips shimmer animation */
  prefersReducedMotion?: boolean;
}

const CARD_WIDTH = 160;
const CARD_HEIGHT = 90;

export default function IceBreakerScrollCards({
  topics,
  accentColor = "linear-gradient(135deg, #7C3AED, #A855F7)",
  isLoading = false,
  prefersReducedMotion = false,
}: IceBreakerScrollCardsProps) {
  const items = isLoading ? Array(3).fill("") : topics;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        overflowX: "auto",
        paddingInline: 20,
        paddingBottom: 4,
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        // Hide scrollbar visually while keeping it functional
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="icebreaker-scroll-strip"
    >
      <style>{`
        .icebreaker-scroll-strip::-webkit-scrollbar { display: none; }
        @keyframes icebreaker-shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.85; }
        }
      `}</style>

      {items.map((topic, i) =>
        isLoading ? (
          <div
            key={i}
            style={{
              flexShrink: 0,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              borderRadius: 12,
              background: "rgba(0,0,0,0.06)",
              scrollSnapAlign: "start",
              animation: prefersReducedMotion ? undefined : `icebreaker-shimmer 1.4s ease-in-out infinite`,
              animationDelay: prefersReducedMotion ? undefined : `${i * 0.12}s`,
            }}
          />
        ) : (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1, ease: "easeOut" }}
            style={{
              flexShrink: 0,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              borderRadius: 12,
              background: "var(--card, #fff)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderTop: `3px solid transparent`,
              backgroundImage: `linear-gradient(var(--card, #fff), var(--card, #fff)), ${accentColor}`,
              backgroundOrigin: "border-box",
              backgroundClip: "padding-box, border-box",
              scrollSnapAlign: "start",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 12px",
              cursor: "default",
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: "var(--foreground, #111827)",
                lineHeight: 1.5,
                textAlign: "center",
                margin: 0,
                // Clamp to 3 lines
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {topic}
            </p>
          </motion.div>
        )
      )}
    </div>
  );
}
