/**
 * MatchSuccessSheet – Premium "Match Reveal" bottom-sheet experience.
 *
 * Layer architecture:
 *   z-40  darkened backdrop
 *   z-50  this card (volumetric glass)
 *   z-60  BottomNav (stays interactive above everything)
 *
 * Phases:
 *   'intro'    → floating archetype avatars + map placeholder + SwipeToUnlock slider
 *   'merging'  → avatars fly to center and merge into a deck
 *   'deck'     → 3-D CardDeckReveal with icebreaker CTAs
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Sparkles, ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import SwipeToUnlock from "@/components/SwipeToUnlock";
import CardDeckReveal, { type SquadMember } from "@/components/CardDeckReveal";
import { archetypeAvatars, archetypeGradients } from "@/lib/archetypeAvatars";
import type { UserContext } from "@/lib/attendeeAnalytics";

interface MatchSuccessSheetProps {
  members: SquadMember[];
  currentUser?: UserContext;
  isUserLoading?: boolean;
  onDismiss: () => void;
  /** Optional: navigate to the group/reflection page after dismissing */
  onReflect?: () => void;
}

type Phase = "intro" | "merging" | "deck";

// ── Floating avatar ────────────────────────────────────────────────────────────
interface FloatingAvatarProps {
  archetype: string;
  index: number;
  total: number;
  phase: Phase;
}

function FloatingAvatar({ archetype, index, total, phase }: FloatingAvatarProps) {
  const img = archetypeAvatars[archetype];
  const gradient = archetypeGradients[archetype] || "from-violet-500 to-purple-500";
  const controls = useAnimation();

  // Distribute avatars in an arc across the top half
  const spread = 280; // total horizontal spread in px
  const baseX = -spread / 2 + (index / Math.max(total - 1, 1)) * spread;
  const baseY = -60 - (index % 2) * 30;

  // Slow infinite float in intro phase
  useEffect(() => {
    if (phase === "intro") {
      controls.start({
        y: [baseY, baseY - 14, baseY],
        transition: {
          duration: 2.4 + index * 0.3,
          ease: "easeInOut",
          repeat: Infinity,
          delay: index * 0.18,
        },
      });
      return () => controls.stop();
    }
  }, [phase, baseY, controls, index]);

  // Fly to center when merging
  useEffect(() => {
    if (phase === "merging") {
      controls.start({
        x: 0,
        y: -20,
        scale: 0.3,
        opacity: 0,
        transition: {
          duration: 0.55,
          ease: [0.4, 0, 0.2, 1],
          delay: index * 0.07,
        },
      });
      return () => controls.stop();
    }
  }, [phase, index, controls]);

  return (
    <motion.div
      className="absolute"
      style={{ x: baseX, y: baseY }}
      animate={controls}
    >
      <div
        className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} p-0.5 shadow-lg`}
        style={{
          filter: "drop-shadow(0 10px 15px rgba(123,44,191,0.4))",
        }}
      >
        <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
          {img ? (
            <img src={img} alt={archetype} className="w-12 h-12 object-contain" />
          ) : (
            <span className="text-2xl">🐾</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MatchSuccessSheet({
  members,
  currentUser,
  isUserLoading,
  onDismiss,
  onReflect,
}: MatchSuccessSheetProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [showDeck, setShowDeck] = useState(false);

  const handleUnlock = useCallback(() => {
    setPhase("merging");
  }, []);

  // Auto-advance from merging to deck after the animation completes.
  // The last avatar animates at delay=(displayCount-1)*0.07s + 0.55s duration.
  // We add a small buffer (200ms) for the flash effect.
  useEffect(() => {
    if (phase !== "merging") return;
    const displayCount = Math.min(members.length, 5);
    const mergeMs = (displayCount - 1) * 70 + 550 + 200;
    const timer = setTimeout(() => {
      setPhase("deck");
      setShowDeck(true);
    }, mergeMs);
    return () => clearTimeout(timer);
  }, [phase, members.length]);

  const archetypes = members.map((m) => m.archetype ?? "");

  return (
    <AnimatePresence>
      {/* Darkened backdrop – z-40 */}
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.7)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />

      {/* Volumetric glass card – z-50 */}
      <motion.div
        key="sheet"
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          // Volumetric glass background
          background:
            "linear-gradient(160deg, rgba(30,20,60,0.97) 0%, rgba(20,10,45,0.99) 100%)",
          // 1-px inner border – top/left bright, bottom/right dark
          boxShadow:
            "inset 1px 1px 0 rgba(255,255,255,0.4), inset -1px -1px 0 rgba(0,0,0,0.2), 0 -8px 40px rgba(0,0,0,0.5)",
          // Diagonal sheen via pseudo background
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 32 }}
      >
        {/* Diagonal sheen overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-t-3xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(255,255,255,0.03) 100%)",
          }}
        />

        {/* Drag handle notch */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-300" />
            <span className="font-bold text-white text-lg">匹配成功！</span>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-full text-white/60 hover:text-white transition-colors"
            aria-label="关闭"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="px-5 pb-8" style={{ minHeight: 380 }}>
          <AnimatePresence mode="wait">
            {/* ── INTRO PHASE ── */}
            {phase === "intro" && (
              <motion.div
                key="intro"
                className="flex flex-col items-center gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                {/* Avatar arc + map background */}
                <div className="relative w-full flex items-center justify-center" style={{ height: 200 }}>
                  {/* Blurred map placeholder */}
                  <div
                    className="absolute inset-0 rounded-2xl overflow-hidden"
                    style={{
                      background:
                        "radial-gradient(ellipse at 60% 40%, rgba(139,92,246,0.25), rgba(30,20,60,0.8))",
                    }}
                  >
                    {/* Grid lines */}
                    <svg className="absolute inset-0 w-full h-full opacity-10">
                      <defs>
                        <pattern id="mgrid" width="24" height="24" patternUnits="userSpaceOnUse">
                          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#mgrid)" />
                    </svg>
                    {/* Blur overlay for mystery */}
                    <div className="absolute inset-0 backdrop-blur-sm bg-black/20 rounded-2xl" />
                  </div>

                  {/* Floating avatars */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {archetypes.slice(0, 5).map((archetype, i) => (
                      <FloatingAvatar
                        key={i}
                        archetype={archetype}
                        index={i}
                        total={Math.min(archetypes.length, 5)}
                        phase={phase}
                      />
                    ))}
                  </div>

                  {/* Member count badge */}
                  <div
                    className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full"
                    style={{
                      background: "rgba(139,92,246,0.3)",
                      border: "1px solid rgba(139,92,246,0.5)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Users className="w-3.5 h-3.5 text-violet-300" />
                    <span className="text-xs text-white font-medium">{members.length} 位伙伴</span>
                  </div>
                </div>

                {/* Copy */}
                <p className="text-center text-white/70 text-sm px-4">
                  小悦已经为你精心匹配了 {members.length} 位志同道合的伙伴 ✨
                </p>

                {/* Swipe-to-unlock slider */}
                <SwipeToUnlock onUnlock={handleUnlock} />
              </motion.div>
            )}

            {/* ── MERGING PHASE ── */}
            {phase === "merging" && (
              <motion.div
                key="merging"
                className="flex flex-col items-center justify-center gap-6"
                style={{ height: 380 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Avatars fly to center from their intro positions */}
                <div className="relative flex items-center justify-center" style={{ height: 200 }}>
                  {archetypes.slice(0, 5).map((archetype, i) => (
                    <FloatingAvatar
                      key={i}
                      archetype={archetype}
                      index={i}
                      total={Math.min(archetypes.length, 5)}
                      phase={phase}
                    />
                  ))}

                  {/* Merge flash */}
                  <motion.div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 0.8, 0], scale: [0, 1.5, 2] }}
                    transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
                    style={{ background: "radial-gradient(circle, rgba(139,92,246,0.8), transparent)" }}
                  />
                </div>

                <motion.p
                  className="text-white/70 text-sm"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  正在组队...
                </motion.p>
              </motion.div>
            )}

            {/* ── DECK PHASE ── */}
            {phase === "deck" && showDeck && (
              <motion.div
                key="deck"
                className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              >
                <p className="text-white/60 text-xs text-center">点击卡片翻转查看契合点</p>

                {/* 3-D Card Deck */}
                <CardDeckReveal
                  members={members}
                  currentUser={currentUser}
                  isUserLoading={isUserLoading}
                  onCardFlipped={() => {
                    if (navigator.vibrate) navigator.vibrate(15);
                  }}
                />

                {/* CTA buttons */}
                <div className="flex flex-col gap-2 mt-2">
                  <Button
                    className="w-full font-semibold"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    }}
                    onClick={onDismiss}
                    data-testid="button-meet-tablemates"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    开始认识伙伴！
                  </Button>
                  {onReflect && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-xs text-white/40 hover:text-white/70"
                      onClick={onReflect}
                    >
                      记录这次相遇 ✨
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
