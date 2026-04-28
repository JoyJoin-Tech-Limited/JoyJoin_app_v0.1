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
import ChemistryArc from "./ChemistryArc";
import ConnectionPointPills from "./ConnectionPointPills";

// ── Per-archetype visual lookup maps ─────────────────────────────────────────

const ARCHETYPE_BACK_GRADIENTS: Record<string, string> = {
  'corgi': 'linear-gradient(135deg, #EAB308, #F97316, #EF4444)',
  'rooster':   'linear-gradient(135deg, #F59E0B, #EAB308, #F97316)',
  'hamster_praise':   'linear-gradient(135deg, #06B6D4, #3B82F6, #6366F1)',
  'fox':   'linear-gradient(135deg, #F97316, #EF4444, #EC4899)',
  'dolphin_calm': 'linear-gradient(135deg, #3B82F6, #6366F1, #A855F7)',
  'spider':   'linear-gradient(135deg, #A855F7, #EC4899, #D946EF)',
  'koala':   'linear-gradient(135deg, #F43F5E, #EC4899, #EF4444)',
  'octopus': 'linear-gradient(135deg, #8B5CF6, #A855F7, #6366F1)',
  'owl': 'linear-gradient(135deg, #64748B, #6B7280, #71717A)',
  'elephant': 'linear-gradient(135deg, #64748B, #6B7280, #71717A)',
  'turtle':   'linear-gradient(135deg, #10B981, #14B8A6, #0D9488)',
  'cat':   'linear-gradient(135deg, #6366F1, #4F46E5, #4338CA)',
};
const FALLBACK_BACK_GRADIENT = 'linear-gradient(135deg, #4C1D95, #7C3AED)';

const ARCHETYPE_GLOW: Record<string, string> = {
  'corgi': 'rgba(249,115,22,0.50)',
  'rooster':   'rgba(245,158,11,0.50)',
  'hamster_praise':   'rgba(6,182,212,0.50)',
  'fox':   'rgba(239,68,68,0.50)',
  'dolphin_calm': 'rgba(59,130,246,0.50)',
  'spider':   'rgba(168,85,247,0.50)',
  'koala':   'rgba(244,63,94,0.50)',
  'octopus': 'rgba(139,92,246,0.50)',
  'owl': 'rgba(100,116,139,0.40)',
  'elephant': 'rgba(100,116,139,0.40)',
  'turtle':   'rgba(16,185,129,0.45)',
  'cat':   'rgba(99,102,241,0.45)',
};

const ARCHETYPE_ACCENT_HEX: Record<string, string> = {
  'corgi': '#F97316',
  'rooster':   '#F59E0B',
  'hamster_praise':   '#06B6D4',
  'fox':   '#EF4444',
  'dolphin_calm': '#3B82F6',
  'spider':   '#A855F7',
  'koala':   '#F43F5E',
  'octopus': '#8B5CF6',
  'owl': '#64748B',
  'elephant': '#10B981',
  'turtle':   '#10B981',
  'cat':   '#6366F1',
};

const ARCHETYPE_BORDER_RGB: Record<string, string> = {
  'corgi': '249,115,22',
  'rooster':   '245,158,11',
  'hamster_praise':   '6,182,212',
  'fox':   '239,68,68',
  'dolphin_calm': '59,130,246',
  'spider':   '168,85,247',
  'koala':   '244,63,94',
  'octopus': '139,92,246',
  'owl': '100,116,139',
  'elephant': '16,185,129',
  'turtle':   '16,185,129',
  'cat':   '99,102,241',
};

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
  /** AI-detected connection points, e.g. "同乡（广州）", "同行业", "性格互补" */
  connectionPoints?: string[];
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

  // ── Per-archetype visual tokens ───────────────────────────────────────────
  const cardBackGradient = (member.archetype && ARCHETYPE_BACK_GRADIENTS[member.archetype])
    ? ARCHETYPE_BACK_GRADIENTS[member.archetype]
    : FALLBACK_BACK_GRADIENT;

  const cardGlow = (member.archetype && ARCHETYPE_GLOW[member.archetype])
    ? ARCHETYPE_GLOW[member.archetype]
    : 'rgba(124,58,237,0.45)';

  const archetypeAccentHex = (member.archetype && ARCHETYPE_ACCENT_HEX[member.archetype])
    ? ARCHETYPE_ACCENT_HEX[member.archetype]
    : '#7C3AED';

  const archetypeBorderRgb = (member.archetype && ARCHETYPE_BORDER_RGB[member.archetype])
    ? ARCHETYPE_BORDER_RGB[member.archetype]
    : '124,58,237';

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
  const hasAIInsights = Boolean(
    (member.connectionPoints && member.connectionPoints.length > 0) || member.matchReason
  );

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
            background: cardBackGradient,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxShadow: `0 6px 20px ${cardGlow}`,
            border: "1.5px solid rgba(255,255,255,0.15)",
            overflow: "hidden",
          }}
        >
          {/* Blurred silhouette — teases the character without full reveal */}
          {archetypeImage && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <img
                src={archetypeImage}
                alt=""
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "contain",
                  opacity: 0.18,
                  filter: "blur(3px) saturate(0)",
                  transform: "scale(1.1)",
                }}
              />
            </div>
          )}
          {/* Foreground icon — sits above silhouette */}
          <Sparkles className="h-8 w-8 text-white/75 relative z-10" aria-hidden="true" />
          <p
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,0.6)",
              fontWeight: 500,
              letterSpacing: "0.04em",
              position: "relative",
              zIndex: 10,
            }}
          >
            点击翻开
          </p>
        </div>

        {/* ── Card Front ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: 14,
            boxShadow: `0 6px 24px ${cardGlow}`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: `1.5px solid rgba(${archetypeBorderRgb}, 0.35)`,
            background: "white",
            colorScheme: "light",
          }}
        >
          {/* ── Header Band (gradient top) ── */}
          <div
            aria-hidden="true"
            style={{
              flexShrink: 0,
              height: 76,
              background: cardBackGradient,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingBottom: 6,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Archetype image — centred, slightly overflows downward for depth */}
            <div style={{ position: "relative", zIndex: 2 }}>
              {archetypeImage ? (
                <img
                  src={archetypeImage}
                  alt={member.archetype ?? ""}
                  style={{
                    width: 52,
                    height: 52,
                    objectFit: "contain",
                    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))",
                    marginBottom: -8,
                  }}
                />
              ) : (
                <Sparkles className="h-10 w-10 text-white/90" aria-hidden="true" />
              )}
            </div>
          </div>

          {/* ── Body (white) ── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px 8px 8px",
              overflow: "hidden",
            }}
          >
            {/* Name */}
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#111827",
                textAlign: "center",
                lineHeight: 1.2,
                marginTop: 4,
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {member.displayName}
            </p>

            {/* Social Tag */}
            {socialTagText && (
              <p
                style={{
                  fontSize: 10,
                  color: archetypeAccentHex,
                  fontWeight: 600,
                  marginTop: 2,
                  textAlign: "center",
                  width: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  paddingInline: 4,
                }}
              >
                {socialTagText}
              </p>
            )}

            {/* Micro-traits */}
            {config?.traits && config.traits.length > 0 && (
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
                {config.traits.slice(0, 2).map((trait, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 8,
                      padding: "1px 5px",
                      borderRadius: 999,
                      background: `rgba(${archetypeBorderRgb}, 0.12)`,
                      color: archetypeAccentHex,
                      fontWeight: 600,
                    }}
                  >
                    {trait}
                  </span>
                ))}
              </div>
            )}

            {/* Chemistry Arc (AI) or Social Energy Bar (heuristic fallback) */}
            {member.compatibilityScore !== undefined ? (
              <div style={{ marginTop: 4 }}>
                <ChemistryArc
                  score={member.compatibilityScore}
                  accentColor={archetypeAccentHex}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>
            ) : (
              config?.energyLevel !== undefined && <EnergyBar level={config.energyLevel} />
            )}

            {/* Rarity dots — subtle preview of spark quality when collapsed */}
            {isFlipped && !isSelected && sortedSparks.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  justifyContent: "center",
                  marginTop: 4,
                }}
                aria-hidden="true"
              >
                {sortedSparks.slice(0, 3).map((spark, i) => (
                  <span
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background:
                        spark.rarity === "epic"
                          ? "#F59E0B"
                          : spark.rarity === "rare"
                          ? "#7C3AED"
                          : "#D1D5DB",
                      display: "inline-block",
                    }}
                  />
                ))}
                {sortedSparks.length > 3 && (
                  <span style={{ fontSize: 7, color: "#9CA3AF", lineHeight: "5px" }}>+{sortedSparks.length - 3}</span>
                )}
              </div>
            )}

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
                      spark.rarity === "epic" ? (
                        <div
                          key={i}
                          className="joyjoin-holo-epic"
                          style={{
                            position: "relative",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 6px",
                            borderRadius: 8,
                            border: "1px solid rgba(245,158,11,0.70)",
                            backgroundColor: "#FEF3C7",
                          }}
                        >
                          <motion.span
                            style={{ fontSize: 10, color: "#F59E0B", flexShrink: 0 }}
                            aria-hidden="true"
                            animate={prefersReducedMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
                            transition={prefersReducedMotion ? undefined : { duration: 1.5, repeat: Infinity }}
                          >
                            ✨
                          </motion.span>
                          <span style={{ fontSize: 9, fontWeight: 600, color: "#92400E", lineHeight: 1.3 }}>
                            {spark.text}
                          </span>
                          {/* Rarity corner mark */}
                          <span
                            style={{
                              position: "absolute",
                              top: 2,
                              right: 3,
                              fontSize: 7,
                              color: "rgba(245,158,11,0.8)",
                              fontWeight: 700,
                              lineHeight: 1,
                            }}
                            aria-hidden="true"
                          >
                            ★
                          </span>
                        </div>
                      ) : spark.rarity === "rare" ? (
                        <div
                          key={i}
                          style={{
                            position: "relative",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 6px",
                            borderRadius: 8,
                            border: "1px solid rgba(139,92,246,0.50)",
                            background: "linear-gradient(135deg, #EDE9FE, #DDD6FE)",
                          }}
                        >
                          <span style={{ fontSize: 10, color: "#7C3AED", flexShrink: 0 }} aria-hidden="true">💫</span>
                          <span style={{ fontSize: 9, fontWeight: 500, color: "#4C1D95", lineHeight: 1.3 }}>
                            {spark.text}
                          </span>
                          <span
                            style={{
                              position: "absolute",
                              top: 2,
                              right: 3,
                              fontSize: 7,
                              color: "rgba(139,92,246,0.7)",
                              fontWeight: 700,
                              lineHeight: 1,
                            }}
                            aria-hidden="true"
                          >
                            ◆
                          </span>
                        </div>
                      ) : (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 6px",
                            borderRadius: 8,
                            border: "1px solid rgba(0,0,0,0.08)",
                            background: "rgba(0,0,0,0.03)",
                          }}
                        >
                          <span style={{ fontSize: 8, color: "#9CA3AF", flexShrink: 0 }} aria-hidden="true">·</span>
                          <span style={{ fontSize: 9, color: "rgba(17,24,39,0.75)", lineHeight: 1.3 }}>
                            {spark.text}
                          </span>
                        </div>
                      )
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

                {hasAIInsights ? (
                  <div
                    style={{
                      padding: "6px",
                      borderRadius: 10,
                      border: `1px solid rgba(${archetypeBorderRgb}, 0.18)`,
                      background: `rgba(${archetypeBorderRgb}, 0.05)`,
                    }}
                  >
                    {member.connectionPoints && member.connectionPoints.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                          AI 契合点
                        </p>
                        <ConnectionPointPills
                          points={member.connectionPoints}
                          accentColor={archetypeAccentHex}
                          maxVisible={2}
                          prefersReducedMotion={prefersReducedMotion}
                        />
                      </div>
                    )}

                    {member.matchReason && (
                      <p
                        style={{
                          fontSize: 9,
                          color: "rgba(17,24,39,0.78)",
                          lineHeight: 1.4,
                          marginTop:
                            member.connectionPoints && member.connectionPoints.length > 0 ? 6 : 0,
                        }}
                      >
                        {member.matchReason}
                      </p>
                    )}
                  </div>
                ) : null}

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
      <style>{`
        @keyframes joyjoin-holo-sheen {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .joyjoin-holo-epic {
          background: linear-gradient(
            105deg,
            transparent 35%,
            rgba(255, 255, 255, 0.22) 50%,
            transparent 65%
          );
          background-size: 200% 100%;
          animation: joyjoin-holo-sheen 2.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .joyjoin-holo-epic { animation: none; }
        }
      `}</style>
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
