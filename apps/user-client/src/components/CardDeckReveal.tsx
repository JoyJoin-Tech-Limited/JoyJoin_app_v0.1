import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { archetypeConfig } from "@/lib/archetypes";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { AttendeeData } from "@/lib/attendeeAnalytics";

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #f97316, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #6366f1)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #10b981, #14b8a6)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #f59e0b, #f97316)",
];

const JOYJOIN_CARD_BACK = "linear-gradient(135deg, #4C1D95, #7C3AED)";

const CARD_DECK_HEIGHT = 320;

/** Width and height of each individual card (px). */
const CARD_WIDTH = 144;
const CARD_HEIGHT = 210;

/**
 * Fan positions for up to 6 cards (rotation & x-offset when fanned).
 * The component accepts arrays of any size; cards beyond the 6th slot
 * will share the last fan position and overlap visually.
 */
const FAN_CONFIGS: Array<{ rotate: number; x: number }> = [
  { rotate: -20, x: -130 },
  { rotate: -10, x: -70 },
  { rotate: 0,   x: 0   },
  { rotate: 10,  x: 70  },
  { rotate: 20,  x: 130 },
  { rotate: 25,  x: 175 },
];

// ──────────────────────────────────────────────────────────────────────────────
// MemberCard
// ──────────────────────────────────────────────────────────────────────────────

interface MemberCardProps {
  attendee: AttendeeData;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: () => void;
}

function MemberCard({ attendee, index, total, isSelected, onSelect }: MemberCardProps) {
  const cfg = attendee.archetype ? archetypeConfig[attendee.archetype] : undefined;
  const img = getArchetypeImage(attendee.archetype);
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const prefersReducedMotion = useReducedMotion();

  // Pick fan position; clamp to last config when more cards than slots
  const fanIdx = Math.min(index, FAN_CONFIGS.length - 1);
  const fan = FAN_CONFIGS[fanIdx];

  // Stacking order: selected card always on top
  const zIndex = isSelected ? 50 : total - index;

  // Respect reduced-motion: skip 3D flip, collapse stagger
  const animDelay = prefersReducedMotion ? 0 : index * 0.15;
  const flipTransition = prefersReducedMotion
    ? { duration: 0 }
    : { delay: animDelay + 0.4, duration: 0.5, ease: "easeInOut" };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSelect();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <motion.div
      layoutId={`card-${attendee.userId}`}
      className="absolute cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:rounded-2xl"
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${attendee.displayName}${attendee.archetype ? `，${attendee.archetype}` : ""}`}
      style={{
        zIndex,
        transformStyle: "preserve-3d",
        perspective: 1000,
        bottom: 0,
        left: "50%",
        marginLeft: -(CARD_WIDTH / 2),
      }}
      // ── Shoot up from centre, fan out, then flip face-up ──
      initial={{ y: 0, x: 0, rotate: 0, rotateY: prefersReducedMotion ? 0 : 180, opacity: 0 }}
      animate={
        isSelected
          ? // Selected: come to front, lift higher, scale up, add glow
            { y: -200, x: 0, rotate: 0, rotateY: 0, opacity: 1, scale: 1.08 }
          : {
              y: -160,
              x: fan.x,
              rotate: fan.rotate,
              rotateY: 0,
              opacity: 1,
              scale: 1,
            }
      }
      transition={{
        duration: prefersReducedMotion ? 0.15 : 0.6,
        delay: animDelay,
        rotateY: flipTransition,
        ease: "easeOut",
      }}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      whileHover={isSelected ? {} : { y: -175, scale: 1.03 }}
      whileFocus={isSelected ? {} : { y: -175, scale: 1.03 }}
    >
      {/* ── 3D flip container ── */}
      <div
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          transformStyle: "preserve-3d",
          position: "relative",
        }}
      >
        {/* ── BACK of card ── */}
        <div
          style={{
            background: JOYJOIN_CARD_BACK,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            transform: "rotateY(180deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          <Sparkles className="text-white/60" size={36} />
        </div>

        {/* ── FRONT of card ── */}
        <div
          style={{
            background: gradient,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            boxShadow: isSelected
              ? "0 12px 40px rgba(124,58,237,0.5), 0 0 0 2px rgba(255,255,255,0.6)"
              : "0 8px 24px rgba(0,0,0,0.25)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "12px 8px 8px",
          }}
        >
          {/* Avatar / archetype image */}
          {img ? (
            <img
              src={img}
              alt={attendee.archetype ?? ""}
              style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 4 }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 32 }}>{cfg?.icon ?? "✨"}</span>
            </div>
          )}

          {/* Name */}
          <p
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              textAlign: "center",
              lineHeight: 1.2,
              marginBottom: 2,
            }}
          >
            {attendee.displayName}
          </p>

          {/* Archetype name */}
          {attendee.archetype && (
            <p
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 11,
                textAlign: "center",
              }}
            >
              {cfg?.icon} {attendee.archetype}
            </p>
          )}

          {/* ── Expanded details (only when selected) ── */}
          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                style={{ width: "100%", marginTop: 8 }}
              >
                {/* Nickname / tagline */}
                {cfg?.tagline && (
                  <p
                    style={{
                      color: "rgba(255,255,255,0.75)",
                      fontSize: 10,
                      textAlign: "center",
                      marginBottom: 6,
                      fontStyle: "italic",
                    }}
                  >
                    {cfg.tagline}
                  </p>
                )}

                {/* Interest chips */}
                {attendee.topInterests && attendee.topInterests.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      justifyContent: "center",
                    }}
                  >
                    {attendee.topInterests.slice(0, 3).map((interest) => (
                      <span
                        key={interest}
                        style={{
                          background: "rgba(255,255,255,0.2)",
                          borderRadius: 8,
                          padding: "2px 6px",
                          fontSize: 10,
                          color: "white",
                        }}
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CardDeckReveal — public component
// ──────────────────────────────────────────────────────────────────────────────

interface CardDeckRevealProps {
  attendees: AttendeeData[];
}

export default function CardDeckReveal({ attendees }: CardDeckRevealProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback(
    (userId: string) => {
      setSelectedId((prev) => (prev === userId ? null : userId));
    },
    []
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: CARD_DECK_HEIGHT,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        overflowX: "clip",
      }}
    >
      {attendees.map((attendee, i) => (
        <MemberCard
          key={attendee.userId}
          attendee={attendee}
          index={i}
          total={attendees.length}
          isSelected={selectedId === attendee.userId}
          onSelect={() => handleSelect(attendee.userId)}
        />
      ))}

      {/* Tap hint */}
      {!selectedId && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: attendees.length * 0.15 + 1.2 }}
          style={{
            position: "absolute",
            bottom: -28,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 12,
            color: "rgba(0,0,0,0.45)",
          }}
        >
          点击或按 Enter 键查看详情
        </motion.p>
      )}
    </div>
  );
}
