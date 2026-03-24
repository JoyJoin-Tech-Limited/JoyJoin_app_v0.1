/**
 * ConnectionPointPills
 *
 * Renders AI-generated connection points (契合点) as compact pill badges.
 * Used in the expanded card view inside CardDeckReveal.
 *
 * - Shows up to `maxVisible` pills (default 3)
 * - Overflow pills collapsed into a "+N" pill
 * - Maps known keyword patterns to a leading emoji icon
 * - Supports a loading skeleton via `isLoading`
 * - Works well in tight card layouts (max-width ~200px)
 */

import { motion } from "framer-motion";

// ── Icon mapping ───────────────────────────────────────────────────────────────
// Maps Chinese keyword patterns to emoji icons for quick visual scanning.
const ICON_PATTERNS: Array<{ pattern: RegExp; icon: string }> = [
  { pattern: /同乡|老乡|hometown/i,         icon: "🏠" },
  { pattern: /同行|同业|同产业|industry/i,   icon: "💼" },
  { pattern: /同学|同校|学历|education/i,    icon: "🎓" },
  { pattern: /性格互补|原型|archetype/i,     icon: "✨" },
  { pattern: /深度同好|共同兴趣|interest/i,  icon: "🎯" },
  { pattern: /同状态|关系状态/i,             icon: "💫" },
  { pattern: /同阶段|人生阶段|life stage/i,  icon: "🌱" },
];

function getIcon(text: string): string {
  for (const { pattern, icon } of ICON_PATTERNS) {
    if (pattern.test(text)) return icon;
  }
  return "🔗";
}

// ── Component ─────────────────────────────────────────────────────────────────
interface ConnectionPointPillsProps {
  /** Array of connection-point strings from the AI analysis */
  points: string[];
  /** Maximum number of pills to display before collapsing into "+N" */
  maxVisible?: number;
  /** Accent colour used for pill text and border */
  accentColor?: string;
  /** While true, renders shimmer skeleton pills */
  isLoading?: boolean;
  /** When true, skips stagger animation */
  prefersReducedMotion?: boolean;
}

export default function ConnectionPointPills({
  points,
  maxVisible = 3,
  accentColor = "#7C3AED",
  isLoading = false,
  prefersReducedMotion = false,
}: ConnectionPointPillsProps) {
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 20,
              width: [52, 64, 44][i],
              borderRadius: 999,
              background: "rgba(0,0,0,0.07)",
              animation: prefersReducedMotion ? undefined : "pill-shimmer 1.4s ease-in-out infinite",
              animationDelay: prefersReducedMotion ? undefined : `${i * 0.15}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes pill-shimmer {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.85; }
          }
        `}</style>
      </div>
    );
  }

  if (!points || points.length === 0) return null;

  const visible = points.slice(0, maxVisible);
  const overflow = points.length - maxVisible;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {visible.map((point, i) => {
        const icon = getIcon(point);
        return (
          <motion.span
            key={i}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 0.25, delay: i * 0.08, ease: "easeOut" }
            }
            title={point}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 7px",
              borderRadius: 999,
              border: `1px solid ${accentColor}40`,
              background: `${accentColor}10`,
              fontSize: 9,
              fontWeight: 600,
              color: accentColor,
              whiteSpace: "nowrap",
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "default",
            }}
          >
            <span aria-hidden="true">{icon}</span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 90,
              }}
            >
              {point}
            </span>
          </motion.span>
        );
      })}
      {overflow > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 7px",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(0,0,0,0.05)",
            fontSize: 9,
            fontWeight: 600,
            color: "rgba(0,0,0,0.45)",
          }}
          aria-label={`还有 ${overflow} 个契合点`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
