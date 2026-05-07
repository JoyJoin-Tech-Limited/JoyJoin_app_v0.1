/**
 * PoolMomentumVisual
 *
 * Premium live-queue composition for the event pool discovery card.
 * Communicates pool momentum — quantity, diversity, and aliveness — through
 * a graphics-first archetype ribbon + registration count orb.
 *
 * Design notes:
 *   - Featured chips: actual pool archetypes from `sampleArchetypes` (up to 6)
 *   - Ghost chips: translucent placeholder coins to imply crowd volume
 *     (shown only when registrationCount > visible featured chips)
 *   - Count orb: pulsing orb showing total registrationCount
 *   - Animations: stagger entry (framer-motion spring) + CSS chip-float (GPU-only)
 *   - All animations are gated behind prefers-reduced-motion
 */

import { type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { archetypeConfig } from "@/lib/archetypes";

interface PoolMomentumVisualProps {
  sampleArchetypes: string[];
  registrationCount: number;
  className?: string;
}

// ---- animation constants ---------------------------------------------------

/** Base float duration (seconds) for the CSS chip-float keyframe. */
const FLOAT_DURATION_BASE = 2.8;
/** Per-chip float-duration variance to avoid synchronized bobbing. */
const FLOAT_DURATION_VARIANCE = 0.6;
/** Per-chip delay step so the queue reads as organic, not mechanical. */
const FLOAT_DELAY_STEP = 0.22;

interface ChipProps {
  index: number;
  prefersReducedMotion: boolean;
}

function ArchetypeChip({
  archetype,
  index,
  prefersReducedMotion,
}: ChipProps & { archetype: string }) {
  const imgSrc = getArchetypeImage(archetype);
  const config = archetypeConfig[archetype];
  const emoji = config?.icon ?? "✨";

  const floatStyle: CSSProperties = prefersReducedMotion
    ? {}
    : ({
        // CSS custom properties drive the CSS @keyframes chip-float
        "--float-duration": `${FLOAT_DURATION_BASE + (index % 3) * FLOAT_DURATION_VARIANCE}s`,
        "--float-delay": `${index * FLOAT_DELAY_STEP}s`,
      } as CSSProperties);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 320, damping: 22, delay: index * 0.07 }
      }
      className={`relative flex-shrink-0 ${prefersReducedMotion ? "" : "animate-chip-float"}`}
      style={{
        marginLeft: index === 0 ? 0 : "-8px",
        zIndex: 20 - index,
        ...floatStyle,
      }}
    >
      {/* Subtle glow ring — shows depth against other chips */}
      <div className="w-9 h-9 rounded-full ring-2 ring-background shadow-sm overflow-hidden bg-muted">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={archetype}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base leading-none select-none">
            {emoji}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function GhostChip({ index, prefersReducedMotion }: ChipProps) {
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 0.82, opacity: 0.35 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : {
              type: "spring",
              stiffness: 280,
              damping: 24,
              delay: index * 0.07 + 0.05,
            }
      }
      className="relative flex-shrink-0"
      style={{ marginLeft: "-8px", zIndex: 20 - index }}
      aria-hidden="true"
    >
      <div className="w-9 h-9 rounded-full border-2 border-dashed border-muted-foreground/25 bg-muted/40 flex items-center justify-center">
        <span className="text-muted-foreground/30 text-[10px] font-semibold select-none">
          ?
        </span>
      </div>
    </motion.div>
  );
}

function CountOrb({
  count,
  prefersReducedMotion,
}: {
  count: number;
  prefersReducedMotion: boolean;
}) {
  const display = count > 99 ? "99+" : String(count);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 300, damping: 20, delay: 0.42 }
      }
      className="ml-2 flex-shrink-0 relative"
    >
      {/* Pulsing glow ring — signals "live" */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/25 pointer-events-none"
          animate={{ scale: [1, 1.55, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        />
      )}

      {/* The orb */}
      <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-primary via-primary to-violet-500 flex items-center justify-center shadow-md">
        <span className="text-[11px] font-bold text-primary-foreground leading-none select-none tracking-tight">
          {display}
        </span>
      </div>
    </motion.div>
  );
}

/** Empty-pool invitation state — shown when no data yet. */
function EmptyInvitation({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex items-center gap-0"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="w-9 h-9 rounded-full border-2 border-dashed border-muted-foreground/20 bg-muted/25 flex-shrink-0"
          style={{ marginLeft: i === 0 ? 0 : "-8px", zIndex: 4 - i }}
          aria-hidden="true"
        />
      ))}
    </motion.div>
  );
}

// ---- main component ---------------------------------------------------------

export function PoolMomentumVisual({
  sampleArchetypes,
  registrationCount,
  className = "",
}: PoolMomentumVisualProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const featuredChips = sampleArchetypes.slice(0, 6);
  const isEmpty = featuredChips.length === 0 && registrationCount === 0;

  // Ghost chips: shown when we have real count data but fewer visible archetype chips
  // (implies there are more people than the chip row shows)
  const ghostCount =
    registrationCount > featuredChips.length && featuredChips.length < 5
      ? Math.min(2, 5 - featuredChips.length)
      : 0;

  const showOrb = registrationCount > 0;

  return (
    <div
      className={`relative flex items-center overflow-visible ${className}`}
      data-testid="pool-momentum-visual"
      aria-label={
        registrationCount > 0
          ? `${registrationCount} 人已入座`
          : "待参与"
      }
      role="img"
    >
      {/* Shimmer sweep — reinforces "live" feel, purely decorative */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-primary/8 to-transparent pointer-events-none"
          animate={{ x: ["-100%", "300%"] }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 2,
          }}
          aria-hidden="true"
        />
      )}

      {/* Chip row */}
      {isEmpty ? (
        <EmptyInvitation prefersReducedMotion={prefersReducedMotion} />
      ) : (
        <div className="flex items-center">
          {featuredChips.map((archetype, i) => (
            <ArchetypeChip
              key={`${archetype}-${i}`}
              archetype={archetype}
              index={i}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
          {Array.from({ length: ghostCount }).map((_, i) => (
            <GhostChip
              key={`ghost-${i}`}
              index={featuredChips.length + i}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>
      )}

      {/* Count orb */}
      {showOrb && (
        <CountOrb
          count={registrationCount}
          prefersReducedMotion={prefersReducedMotion}
        />
      )}
    </div>
  );
}
