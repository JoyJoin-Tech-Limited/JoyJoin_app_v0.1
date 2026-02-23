import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export interface SquadMember {
  userId: string;
  displayName: string;
  archetype?: string;
  age?: number;
  topInterests?: string[];
  matchReason?: string;
  compatibilityScore?: number;
}

interface CardDeckRevealProps {
  members: SquadMember[];
  /** Called once when all cards have flipped face-up. Wrap in useCallback to avoid spurious re-runs. */
  onAllRevealed?: () => void;
}

export default function CardDeckReveal({ members, onAllRevealed }: CardDeckRevealProps) {
  const [phase, setPhase] = useState<"shooting" | "fanned">("shooting");
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Keep a stable ref to onAllRevealed so the flip effect doesn't need it as a dependency.
  const onAllRevealedRef = useRef(onAllRevealed);
  useEffect(() => {
    onAllRevealedRef.current = onAllRevealed;
  });

  // Start fanning after mount
  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase("fanned");
      return;
    }
    const fanTimer = setTimeout(() => setPhase("fanned"), 100);
    return () => clearTimeout(fanTimer);
  }, [prefersReducedMotion]);

  // Flip cards face-up sequentially after they fan out.
  // Uses a single interval (not per-card timeouts) to avoid timer accumulation.
  useEffect(() => {
    if (phase !== "fanned" || members.length === 0) return;

    // Reduced motion: reveal all cards instantly
    if (prefersReducedMotion) {
      const allIndices = new Set(members.map((_, i) => i));
      setFlippedCards(allIndices);
      onAllRevealedRef.current?.();
      return;
    }

    let currentIndex = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startTimer = setTimeout(() => {
      // Flip first card
      setFlippedCards((prev) => new Set(prev).add(0));

      if (members.length === 1) {
        onAllRevealedRef.current?.();
        return;
      }

      currentIndex = 1;
      intervalId = setInterval(() => {
        if (currentIndex >= members.length) {
          if (intervalId) clearInterval(intervalId);
          return;
        }

        const idx = currentIndex;
        setFlippedCards((prev) => new Set(prev).add(idx));

        if (idx === members.length - 1) {
          onAllRevealedRef.current?.();
          if (intervalId) clearInterval(intervalId);
        }

        currentIndex += 1;
      }, 300);
    }, 600);

    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [phase, members.length, prefersReducedMotion]);

  const getFanProps = (index: number, total: number) => {
    const spread = total > 1 ? Math.min(18, 54 / total) : 0;
    const angle = (index - (total - 1) / 2) * spread;
    const xOffset = (index - (total - 1) / 2) * Math.min(80, 200 / total);
    return { angle, xOffset };
  };

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number, isFlipped: boolean, isSelected: boolean) => {
      if (!isFlipped) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSelectedIndex(isSelected ? null : idx);
      }
    },
    []
  );

  return (
    <div className="relative flex items-end justify-center" style={{ height: 280 }}>
      {members.map((member, idx) => {
        const { angle, xOffset } = getFanProps(idx, members.length);
        const isFlipped = flippedCards.has(idx);
        const isSelected = selectedIndex === idx;
        const archetypeImage = getArchetypeImage(member.archetype);
        // Use viewport-relative offsets to avoid clipping on short screens.
        // Selected card rises slightly higher; fanned cards use a smaller offset.
        const selectedY = "-20vh";
        const fannedY = "-18vh";

        return (
          <motion.div
            key={member.userId}
            className="absolute"
            role={isFlipped ? "button" : undefined}
            tabIndex={isFlipped ? 0 : undefined}
            aria-label={
              isFlipped
                ? `${member.displayName}${member.archetype ? `，${member.archetype}` : ""}${isSelected ? "，已展开" : "，点击展开详情"}`
                : undefined
            }
            aria-expanded={isFlipped ? isSelected : undefined}
            style={{
              bottom: 0,
              zIndex: isSelected ? 30 : idx + 1,
              transformOrigin: "bottom center",
              cursor: isFlipped ? "pointer" : "default",
            }}
            initial={{ y: 60, x: 0, rotate: 0, opacity: 0, scale: 0.6 }}
            animate={
              phase === "shooting"
                ? { y: 60, x: 0, rotate: 0, opacity: 0.8, scale: 0.7 }
                : isSelected
                ? { y: selectedY, x: 0, rotate: 0, opacity: 1, scale: 1.08 }
                : { y: fannedY, x: xOffset, rotate: angle, opacity: 1, scale: 1 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : {
                    delay: idx * 0.08,
                    duration: 0.55,
                    type: "spring",
                    stiffness: 180,
                    damping: 22,
                  }
            }
            onClick={() => {
              if (!isFlipped) return;
              setSelectedIndex(isSelected ? null : idx);
            }}
            onKeyDown={(e) => handleCardKeyDown(e, idx, isFlipped, isSelected)}
          >
            {/* 3D flip wrapper */}
            <div
              style={{
                width: 120,
                height: isSelected ? 240 : 180,
                transformStyle: "preserve-3d",
                transition: prefersReducedMotion
                  ? "none"
                  : "transform 0.55s cubic-bezier(0.4,0,0.2,1), height 0.3s ease",
                transform: isFlipped ? "rotateY(0deg)" : "rotateY(180deg)",
                position: "relative",
                perspective: 800,
              }}
            >
              {/* ── Card Back ── */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #4C1D95, #7C3AED)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 20px rgba(124,58,237,0.45)",
                }}
              >
                <Sparkles className="h-9 w-9 text-white/80" aria-hidden="true" />
              </div>

              {/* ── Card Front ── */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  borderRadius: 14,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "10px 8px 8px",
                  background: "var(--background)",
                }}
              >
                {/* Avatar / Archetype image */}
                <div className="flex items-center justify-center mb-1.5">
                  {archetypeImage ? (
                    <img
                      src={archetypeImage}
                      alt={member.archetype}
                      style={{ width: 48, height: 48, objectFit: "contain" }}
                    />
                  ) : (
                    <Sparkles className="h-10 w-10 text-primary" aria-hidden="true" />
                  )}
                </div>

                {/* Name */}
                <p className="text-sm font-bold text-foreground text-center leading-tight truncate w-full">
                  {member.displayName}
                </p>

                {/* Archetype */}
                {member.archetype && (
                  <p className="text-xs text-primary font-medium mt-0.5 text-center">
                    {member.archetype}
                  </p>
                )}

                {/* Compatibility score badge */}
                {member.compatibilityScore !== undefined && (
                  <Badge
                    variant="secondary"
                    className="mt-1.5 text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20"
                  >
                    契合度 {member.compatibilityScore}%
                  </Badge>
                )}

                {/* Expanded content — visible only when selected */}
                {isSelected && (
                  <motion.div
                    className="w-full mt-2 space-y-1.5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.15, duration: 0.25 }}
                  >
                    {/* AI match reason */}
                    {member.matchReason && (
                      <p className="text-[10px] text-muted-foreground text-center leading-snug px-1">
                        {member.matchReason}
                      </p>
                    )}

                    {/* Interest chips */}
                    {member.topInterests && member.topInterests.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {member.topInterests.slice(0, 3).map((interest, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-[9px] px-1 py-0 bg-accent/30"
                          >
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
