import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getArchetypeImage } from "@/lib/archetypeImages";

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
  onAllRevealed?: () => void;
}

export default function CardDeckReveal({ members, onAllRevealed }: CardDeckRevealProps) {
  const [phase, setPhase] = useState<"shooting" | "fanned">("shooting");
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Start fanning after mount
  useEffect(() => {
    const t = setTimeout(() => setPhase("fanned"), 100);
    return () => clearTimeout(t);
  }, []);

  // Flip cards face-up sequentially after they fan out
  useEffect(() => {
    if (phase !== "fanned") return;
    let allRevealed = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    members.forEach((_, idx) => {
      const t = setTimeout(() => {
        setFlippedCards((prev) => {
          const next = new Set(prev);
          next.add(idx);
          return next;
        });
        if (idx === members.length - 1 && !allRevealed) {
          allRevealed = true;
          onAllRevealed?.();
        }
      }, 600 + idx * 300);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [phase, members, onAllRevealed]);

  const getFanProps = (index: number, total: number) => {
    const spread = total > 1 ? Math.min(18, 54 / total) : 0;
    const angle = (index - (total - 1) / 2) * spread;
    const xOffset = (index - (total - 1) / 2) * Math.min(80, 200 / total);
    return { angle, xOffset };
  };

  return (
    <div className="relative flex items-end justify-center" style={{ height: 280 }}>
      {members.map((member, idx) => {
        const { angle, xOffset } = getFanProps(idx, members.length);
        const isFlipped = flippedCards.has(idx);
        const isSelected = selectedIndex === idx;
        const archetypeImage = getArchetypeImage(member.archetype);

        return (
          <motion.div
            key={member.userId}
            className="absolute"
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
                // Raise selected card slightly higher than the fan; -180 keeps it visible on short screens
                ? { y: -180, x: 0, rotate: 0, opacity: 1, scale: 1.08 }
                // Cap at -160 (not -200) so cards don't clip the top of the screen
                : { y: -160, x: xOffset, rotate: angle, opacity: 1, scale: 1 }
            }
            transition={{
              delay: idx * 0.08,
              duration: 0.55,
              type: "spring",
              stiffness: 180,
              damping: 22,
            }}
            onClick={() => {
              if (!isFlipped) return;
              setSelectedIndex(isSelected ? null : idx);
            }}
          >
            {/* 3D flip wrapper */}
            <div
              style={{
                width: 120,
                height: isSelected ? 240 : 180,
                transformStyle: "preserve-3d",
                transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1), height 0.3s ease",
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
                <Sparkles className="h-9 w-9 text-white/80" />
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
                    <Sparkles className="h-10 w-10 text-primary" />
                  )}
                </div>

                {/* Name */}
                <p className="text-sm font-bold text-foreground text-center leading-tight truncate w-full text-center">
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
                    transition={{ delay: 0.15, duration: 0.25 }}
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
