import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Sparkles } from "lucide-react";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { archetypeConfig } from "@/lib/archetypes";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  generateSparkPredictions,
  generatePersonalizedDescription,
  type UserContext,
  type SparkPrediction,
} from "@/lib/attendeeAnalytics";

export interface SquadMember {
  userId: string;
  displayName: string;
  archetype?: string;
  age?: number;
  topInterests?: string[];
  primaryInterests?: string[];
  socialTag?: string;
  matchReason?: string;
  compatibilityScore?: number;
  // Additional fields forwarded to spark-prediction engine
  educationLevel?: string;
  industry?: string;
  gender?: string;
  relationshipStatus?: string;
  children?: string;
  studyLocale?: string;
  overseasRegions?: string[];
  languagesComfort?: string[];
  hometownCountry?: string;
  hometownRegionCity?: string;
  hometownAffinityOptin?: boolean;
}

interface CardDeckRevealProps {
  members: SquadMember[];
  currentUser?: UserContext;
  /** True while the auth user is still being fetched — shows a loading placeholder in the sparks section. */
  isUserLoading?: boolean;
  /** Called once when all cards have flipped face-up. Wrap in useCallback to avoid spurious re-runs. */
  onAllRevealed?: () => void;
  /** Called each time an individual card flips face-up (for haptic tick). */
  onCardFlipped?: () => void;
}

// Card dimension constants (keep in sync with DECK_CONTAINER_HEIGHT)
const CARD_WIDTH = 120;
const CARD_HEIGHT_COLLAPSED = 180;
const CARD_HEIGHT_EXPANDED = 240;
const DECK_CONTAINER_HEIGHT = 260; // expanded + ~20px breathing room

// ── Social Energy Bar ─────────────────────────────────────────────────────────
function EnergyBar({ level }: { level: number }) {
  const clampedLevel = Math.min(100, Math.max(0, level));
  const colorClass =
    clampedLevel > 80 ? "bg-orange-500" : clampedLevel > 50 ? "bg-amber-400" : "bg-slate-400";
  return (
    <div className="w-full mt-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-muted-foreground">社交能量</span>
        <span className="text-[9px] font-medium text-foreground">{clampedLevel}</span>
      </div>
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-all`}
          style={{ width: `${clampedLevel}%` }}
        />
      </div>
    </div>
  );
}

// ── MemberCard ────────────────────────────────────────────────────────────────
interface MemberCardProps {
  member: SquadMember;
  index: number;
  total: number;
  currentUser?: UserContext;
  isUserLoading?: boolean;
  isFlipped: boolean;
  isSelected: boolean;
  phase: "shooting" | "fanned";
  prefersReducedMotion: boolean;
  onSelect: (idx: number) => void;
  onKeyDown: (
    e: React.KeyboardEvent,
    idx: number,
    isFlipped: boolean,
    isSelected: boolean
  ) => void;
}

function MemberCard({
  member,
  index,
  total,
  currentUser,
  isUserLoading,
  isFlipped,
  isSelected,
  phase,
  prefersReducedMotion,
  onSelect,
  onKeyDown,
}: MemberCardProps) {
  const archetypeImage = getArchetypeImage(member.archetype);
  const config = member.archetype ? archetypeConfig[member.archetype] : undefined;

  // ── Memoised analytics – prevents 60fps drops during 3D spring animations ──
  const sparks = useMemo<SparkPrediction[]>(() => {
    if (!currentUser || !isFlipped) return [];
    return generateSparkPredictions(currentUser, {
      userId: member.userId,
      displayName: member.displayName,
      archetype: member.archetype,
      age: member.age,
      topInterests: member.topInterests,
      primaryInterests: member.primaryInterests,
      educationLevel: member.educationLevel,
      industry: member.industry,
      gender: member.gender,
      relationshipStatus: member.relationshipStatus,
      children: member.children,
      studyLocale: member.studyLocale,
      overseasRegions: member.overseasRegions,
      languagesComfort: member.languagesComfort,
      hometownCountry: member.hometownCountry,
      hometownRegionCity: member.hometownRegionCity,
      hometownAffinityOptin: member.hometownAffinityOptin,
    });
  }, [currentUser, member, isFlipped]);

  const sortedSparks = useMemo(() => {
    const order: Record<string, number> = { epic: 0, rare: 1, common: 2 };
    return [...sparks].sort((a, b) => (order[a.rarity] ?? 3) - (order[b.rarity] ?? 3));
  }, [sparks]);

  const icebreakerText = useMemo(() => {
    if (!isFlipped) return "";
    return generatePersonalizedDescription({
      userId: member.userId,
      displayName: member.displayName,
      topInterests: member.topInterests,
    });
  }, [member.userId, member.displayName, member.topInterests, isFlipped]);

  // Social tag: explicit tag → archetype nickname → archetype name
  const socialTagText = member.socialTag ?? config?.nickname ?? member.archetype;

  // Fan layout geometry
  const spread = total > 1 ? Math.min(18, 54 / total) : 0;
  const angle = (index - (total - 1) / 2) * spread;
  const xOffset = (index - (total - 1) / 2) * Math.min(80, 200 / total);

  return (
    <motion.div
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
        zIndex: isSelected ? 30 : index + 1,
        transformOrigin: "bottom center",
        cursor: isFlipped ? "pointer" : "default",
      }}
      initial={{ y: 60, x: 0, rotate: 0, opacity: 0, scale: 0.6 }}
      animate={
        phase === "shooting"
          ? { y: 60, x: 0, rotate: 0, opacity: 0.8, scale: 0.7 }
          : isSelected
          ? { y: "-20vh", x: 0, rotate: 0, opacity: 1, scale: 1.08 }
          : { y: "-18vh", x: xOffset, rotate: angle, opacity: 1, scale: 1 }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { delay: index * 0.08, duration: 0.55, type: "spring", stiffness: 180, damping: 22 }
      }
      onClick={() => {
        if (!isFlipped) return;
        onSelect(isSelected ? -1 : index);
      }}
      onKeyDown={(e) => onKeyDown(e, index, isFlipped, isSelected)}
    >
      {/* 3D flip wrapper */}
      <div
        style={{
          width: CARD_WIDTH,
          height: isSelected ? CARD_HEIGHT_EXPANDED : CARD_HEIGHT_COLLAPSED,
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
          {/* ── Collapsed View ── */}

          {/* Avatar / Archetype image — strictly getArchetypeImage, no photos */}
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

          {/* Social Tag (replaces generic archetype/industry label) */}
          {socialTagText && (
            <p className="text-[10px] text-primary font-medium mt-0.5 text-center truncate w-full px-1">
              {socialTagText}
            </p>
          )}

          {/* Micro-traits: 2 capsule tags from archetype config */}
          {config?.traits && config.traits.length > 0 && (
            <div className="flex flex-wrap gap-0.5 justify-center mt-1">
              {config.traits.slice(0, 2).map((trait, i) => (
                <span
                  key={i}
                  className="text-[8px] px-1 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                >
                  {trait}
                </span>
              ))}
            </div>
          )}

          {/* Social Energy Bar */}
          {config?.energyLevel !== undefined && <EnergyBar level={config.energyLevel} />}

          {/* ── Expanded View ── */}
          {isSelected && (
            <motion.div
              className="w-full mt-2 space-y-1.5 overflow-y-auto"
              style={{ maxHeight: 170 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { delay: 0.15, duration: 0.25 }
              }
            >
              {/* The Magic Connection — Our Sparks (契合点) */}
              {isUserLoading ? (
                // Loading placeholder while auth user is being fetched
                <div className="text-center px-1 py-2 rounded-lg border border-dashed border-border/40">
                  <motion.p
                    className="text-[9px] text-muted-foreground"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    正在计算契合点…
                  </motion.p>
                </div>
              ) : sortedSparks.length > 0 ? (
                <div className="space-y-1">
                  {sortedSparks.slice(0, 5).map((spark, i) => (
                    <div
                      key={i}
                      className={
                        spark.rarity === "epic"
                          ? "flex items-center gap-1 px-1.5 py-1 rounded-lg border border-amber-400/70 bg-amber-50 dark:bg-amber-900/20"
                          : spark.rarity === "rare"
                          ? "flex items-center gap-1 px-1.5 py-1 rounded-lg border border-violet-300/60 bg-violet-50 dark:bg-violet-900/20"
                          : "flex items-center gap-1 px-1.5 py-1 rounded-lg border border-border/40 bg-muted/40"
                      }
                    >
                      {spark.rarity === "epic" && (
                        <motion.span
                          className="text-amber-500 text-[10px] shrink-0"
                          aria-hidden="true"
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          ✨
                        </motion.span>
                      )}
                      {spark.rarity === "rare" && (
                        <span className="text-violet-500 text-[10px] shrink-0" aria-hidden="true">💫</span>
                      )}
                      <span
                        className={`text-[9px] font-medium leading-tight ${
                          spark.rarity === "epic"
                            ? "text-amber-700 dark:text-amber-300"
                            : spark.rarity === "rare"
                            ? "text-violet-700 dark:text-violet-300"
                            : "text-foreground/80"
                        }`}
                      >
                        {spark.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                // Graceful empty state
                <div className="text-center px-1 py-2 rounded-lg border border-dashed border-border/50">
                  <p className="text-[9px] font-medium text-foreground/70">
                    充满未知的神秘缘分{" "}
                    <span aria-hidden="true">🎭</span>
                  </p>
                  <p className="text-[8px] text-muted-foreground mt-0.5 leading-snug">
                    AI也无法预测你们会碰撞出什么火花，这正是盲盒的魅力。
                  </p>
                </div>
              )}

              {/* Icebreaker Hook (破冰雷达) */}
              {icebreakerText && (
                <div className="flex items-start gap-1">
                  <MessageCircle
                    className="h-3 w-3 text-primary mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <p className="text-[9px] text-muted-foreground leading-snug">
                    {icebreakerText}
                  </p>
                </div>
              )}

              {/* Core Contribution */}
              {config?.coreContributions && (
                <p className="text-[9px] text-center text-foreground/70 font-medium">
                  <span aria-hidden="true">🎯</span> {config.coreContributions}
                </p>
              )}

              {/* Style Quote */}
              {config?.styleQuote && (
                <p className="text-[8px] text-muted-foreground text-center italic leading-snug px-1">
                  "{config.styleQuote}"
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── CardDeckReveal ────────────────────────────────────────────────────────────
export default function CardDeckReveal({
  members,
  currentUser,
  isUserLoading,
  onAllRevealed,
  onCardFlipped,
}: CardDeckRevealProps) {
  const [phase, setPhase] = useState<"shooting" | "fanned">("shooting");
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Stable refs so effects don't need callbacks as dependencies
  const onAllRevealedRef = useRef(onAllRevealed);
  const onCardFlippedRef = useRef(onCardFlipped);
  useEffect(() => {
    onAllRevealedRef.current = onAllRevealed;
    onCardFlippedRef.current = onCardFlipped;
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

    if (prefersReducedMotion) {
      const allIndices = new Set(members.map((_, i) => i));
      setFlippedCards(allIndices);
      onAllRevealedRef.current?.();
      return;
    }

    let currentIndex = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startTimer = setTimeout(() => {
      setFlippedCards((prev) => new Set(prev).add(0));
      onCardFlippedRef.current?.();

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
        onCardFlippedRef.current?.();

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

  const handleSelect = useCallback((idx: number) => {
    setSelectedIndex(idx === -1 ? null : idx);
  }, []);

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
    <div className="relative flex items-end justify-center" style={{ height: DECK_CONTAINER_HEIGHT }}>
      {members.map((member, idx) => (
        <MemberCard
          key={member.userId}
          member={member}
          index={idx}
          total={members.length}
          currentUser={currentUser}
          isUserLoading={isUserLoading}
          isFlipped={flippedCards.has(idx)}
          isSelected={selectedIndex === idx}
          phase={phase}
          prefersReducedMotion={prefersReducedMotion}
          onSelect={handleSelect}
          onKeyDown={handleCardKeyDown}
        />
      ))}
    </div>
  );
}
