/**
 * MatchRevealSequenceV2
 *
 * Cinematic, member-first V2 reveal orchestrator for the JoyJoin match reveal flow.
 *
 * Staged reveal sequence:
 *   lock_in       → progress completion beat (1 s)
 *   prelude       → JoyJoin-branded logo moment (1.2 s)
 *   member_entrance → staggered archetype fly-in via ArchetypeOrbit (2.3 s)
 *   formation     → group formation hero tableau (1.5 s)
 *   chemistry     → personalised chemistry payoff card (user interaction)
 *   celebration   → fires onComplete callback
 *
 * Design constraints:
 * - Respects `prefers-reduced-motion`: collapses to a short single-beat when active.
 * - Animates only transform/opacity — no layout-triggering properties.
 * - All haptics gated through revealHaptics helpers (no-op when unsupported).
 * - Preserves existing websocket/data architecture — caller owns data fetching.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ArchetypeOrbit from "@/components/ArchetypeOrbit";
import {
  hapticPulse,
  hapticDoublePulse,
  hapticCelebrate,
  hapticTick,
} from "@/lib/revealHaptics";
import {
  generateChemistryPayoff,
  type ChemistryPayoff,
} from "@/lib/chemistryPayoff";
import type { AttendeeData, UserContext } from "@/lib/attendeeAnalytics";

// ── Stage type ─────────────────────────────────────────────────────────────────

type RevealStage =
  | "lock_in"
  | "prelude"
  | "member_entrance"
  | "formation"
  | "chemistry"
  | "celebration";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface MatchRevealSequenceV2Props {
  members: Pick<
    AttendeeData,
    | "userId"
    | "displayName"
    | "archetype"
    | "topInterests"
    | "primaryInterests"
    | "socialTag"
  >[];
  currentUser?: UserContext;
  /** Called after the user dismisses the chemistry payoff card. */
  onComplete: () => void;
}

// ── Backdrop ───────────────────────────────────────────────────────────────────

const BACKDROP_STYLE = {
  background:
    "linear-gradient(160deg, rgba(18,10,40,0.98) 0%, rgba(10,5,30,0.99) 100%)",
};

// ── Stage timings (ms) — collapsed to near-zero when reduced-motion active ────

function getStageDuration(stage: RevealStage, reduced: boolean): number {
  if (reduced) {
    // Reduced motion: skip animated stages, land directly on chemistry
    return stage === "lock_in" ? 100 : 0;
  }
  const durations: Record<RevealStage, number> = {
    lock_in: 900,
    prelude: 1200,
    member_entrance: 2400,
    formation: 1500,
    chemistry: 0, // user-driven
    celebration: 0, // fires callback immediately
  };
  return durations[stage];
}

// ── Xiaoyue prelude messages ───────────────────────────────────────────────────

const PRELUDE_MESSAGES = [
  "小悦替你凑好这一桌了～",
  "有人正在等你……",
  "今晚，命运安排了这次相遇",
  "有些缘分，就该发生在今晚",
];

function pickPreludeMessage(memberCount: number): string {
  return PRELUDE_MESSAGES[memberCount % PRELUDE_MESSAGES.length];
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MatchRevealSequenceV2({
  members,
  currentUser,
  onComplete,
}: MatchRevealSequenceV2Props) {
  const reduced = useReducedMotion() ?? false;

  const [stage, setStage] = useState<RevealStage>("lock_in");
  const [orbitAnimating, setOrbitAnimating] = useState(false);

  // Recompute when members/currentUser change so chemistry reflects latest data.
  const payoff = useMemo(
    () => generateChemistryPayoff(members, currentUser),
    [members, currentUser],
  );

  const archetypes = members.map((m) => m.archetype ?? "").filter(Boolean);

  // ── Stage machine ────────────────────────────────────────────────────────────

  useEffect(() => {
    // Helper: schedule next stage transition (returns a cleanup function).
    function advance(next: RevealStage) {
      const delay = getStageDuration(stage, reduced);
      if (delay === 0) {
        setStage(next);
        return undefined;
      }
      const t = setTimeout(() => setStage(next), delay);
      return () => clearTimeout(t);
    }

    if (stage === "lock_in") {
      hapticPulse();
      return advance(reduced ? "chemistry" : "prelude");
    }
    if (stage === "prelude") {
      hapticTick();
      return advance("member_entrance");
    }
    if (stage === "member_entrance") {
      setOrbitAnimating(true);
      // ArchetypeOrbit fires onAnimationComplete which drives the next transition.
      return undefined;
    }
    if (stage === "formation") {
      hapticDoublePulse();
      return advance("chemistry");
    }
    if (stage === "celebration") {
      hapticCelebrate();
      onComplete();
      return undefined;
    }
    return undefined;
  }, [stage, reduced, onComplete]);

  const handleOrbitComplete = useCallback(() => {
    setOrbitAnimating(false);
    setStage("formation");
  }, []);

  const handleChemistryContinue = useCallback(() => {
    setStage("celebration");
  }, []);

  // ── Shared motion props ──────────────────────────────────────────────────────

  const fadeIn = {
    initial: { opacity: 0, y: reduced ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduced ? 0 : -8 },
    transition: { duration: reduced ? 0.15 : 0.4, ease: "easeOut" as const },
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={BACKDROP_STYLE}
      aria-live="polite"
      aria-label="匹配揭晓"
    >
      {/* Ambient glow */}
      {!reduced && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 20%, rgba(139,92,246,0.18) 0%, transparent 70%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 40% 40% at 80% 80%, rgba(168,85,247,0.10) 0%, transparent 60%)",
            }}
          />
        </>
      )}

      <AnimatePresence mode="wait">
        {/* ── Stage: lock_in ─────────────────────────────────────────────── */}
        {stage === "lock_in" && (
          <motion.div
            key="lock_in"
            {...fadeIn}
            className="flex flex-col items-center gap-6 px-6 text-center"
          >
            <motion.div
              animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(168,85,247,0.2))",
                boxShadow: "0 0 40px 8px rgba(139,92,246,0.3)",
              }}
            >
              <Users className="h-8 w-8 text-violet-300" />
            </motion.div>
            <p className="text-base font-semibold text-violet-200">
              匹配锁定中…
            </p>
          </motion.div>
        )}

        {/* ── Stage: prelude ─────────────────────────────────────────────── */}
        {stage === "prelude" && (
          <motion.div
            key="prelude"
            {...fadeIn}
            className="flex flex-col items-center gap-5 px-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(168,85,247,0.2))",
                  boxShadow: "0 0 60px 15px rgba(139,92,246,0.35)",
                }}
              >
                <Sparkles className="h-10 w-10 text-violet-200" />
              </div>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-lg font-semibold text-white"
            >
              {pickPreludeMessage(members.length)}
            </motion.p>
          </motion.div>
        )}

        {/* ── Stage: member_entrance ─────────────────────────────────────── */}
        {stage === "member_entrance" && (
          <motion.div
            key="member_entrance"
            {...fadeIn}
            className="flex flex-col items-center gap-6 px-6 text-center"
          >
            <ArchetypeOrbit
              archetypes={archetypes}
              size="large"
              animated={orbitAnimating}
              onAnimationComplete={handleOrbitComplete}
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-sm text-violet-300"
            >
              你的伙伴正在加入…
            </motion.p>
          </motion.div>
        )}

        {/* ── Stage: formation ──────────────────────────────────────────── */}
        {stage === "formation" && (
          <motion.div
            key="formation"
            {...fadeIn}
            className="flex flex-col items-center gap-6 px-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <ArchetypeOrbit
                archetypes={archetypes}
                size="large"
                animated={false}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="space-y-1"
            >
              <p className="text-xl font-bold text-white">
                这一桌，凑齐了！
              </p>
              <p className="text-sm text-violet-300">
                {members.length} 位伙伴就位
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ── Stage: chemistry ──────────────────────────────────────────── */}
        {stage === "chemistry" && (
          <ChemistryPayoffCard
            payoff={payoff}
            members={members}
            reduced={reduced}
            onContinue={handleChemistryContinue}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Chemistry payoff card ──────────────────────────────────────────────────────

interface ChemistryPayoffCardProps {
  payoff: ChemistryPayoff;
  members: MatchRevealSequenceV2Props["members"];
  reduced: boolean;
  onContinue: () => void;
}

function ChemistryPayoffCard({
  payoff,
  members,
  reduced,
  onContinue,
}: ChemistryPayoffCardProps) {
  return (
    <motion.div
      key="chemistry"
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -12 }}
      transition={{ duration: reduced ? 0.15 : 0.45, ease: "easeOut" }}
      className="w-full max-w-sm px-6"
    >
      {/* Glass card */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-center space-y-5"
        style={{
          background:
            "linear-gradient(160deg, rgba(40,25,80,0.97) 0%, rgba(25,12,55,0.99) 100%)",
          boxShadow:
            "inset 1px 1px 0 rgba(255,255,255,0.12), inset -1px -1px 0 rgba(0,0,0,0.2), 0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Sheen */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)",
          }}
        />

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.15, duration: 0.35 }}
          className="space-y-1"
        >
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-medium uppercase tracking-widest text-violet-400">
              你的小队
            </span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">
            {payoff.headline}
          </h2>
        </motion.div>

        {/* Chemistry line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 0.3, duration: 0.35 }}
          className="text-sm text-violet-200 leading-relaxed"
        >
          {payoff.chemistryLine}
        </motion.p>

        {/* Tags */}
        {payoff.tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduced ? 0 : 0.45, duration: 0.35 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {payoff.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-violet-500/40 bg-violet-500/10 text-violet-200 text-xs"
              >
                {tag}
              </Badge>
            ))}
          </motion.div>
        )}

        {/* Member count indicator */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 0.5, duration: 0.35 }}
          className="text-xs text-violet-400"
        >
          共 {members.length} 位桌友就位
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.6, duration: 0.35 }}
        >
          <Button
            size="lg"
            className="w-full font-semibold transition-transform duration-150 ease-out active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            }}
            onClick={onContinue}
            data-testid="button-chemistry-continue"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            开始认识伙伴
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
