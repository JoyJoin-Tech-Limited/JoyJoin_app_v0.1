import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import CardDeckReveal from "@/components/CardDeckReveal";
import boxImg from "@/assets/box_logo_archetypes.png";
import type { AttendeeData } from "@/lib/attendeeAnalytics";

// ──────────────────────────────────────────────────────────────────────────────
// Layout constants
// ──────────────────────────────────────────────────────────────────────────────

/** Height of the BottomNav bar (h-16 = 64px) + protrusion clearance. */
const BOTTOM_NAV_HEIGHT = 96;
/** Extra padding so page content clears both BottomNav and the Action Zone. */
const BOTTOM_SPACING = BOTTOM_NAV_HEIGHT + 64;

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type FlowState = "ready" | "shaking" | "revealed";

/** Placeholder until a real match score is passed via props / API. */
const PLACEHOLDER_MATCH_SCORE = 92;

// ──────────────────────────────────────────────────────────────────────────────
// Mock data (replaced when real API is wired up)
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_ATTENDEES: AttendeeData[] = [
  {
    userId: "u1",
    displayName: "小明",
    archetype: "开心柯基",
    topInterests: ["旅行", "摄影", "咖啡"],
  },
  {
    userId: "u2",
    displayName: "晓雯",
    archetype: "太阳鸡",
    topInterests: ["读书", "美食", "音乐"],
  },
  {
    userId: "u3",
    displayName: "阿哲",
    archetype: "机智狐",
    topInterests: ["科技", "健身", "游戏"],
  },
  {
    userId: "u4",
    displayName: "小玲",
    archetype: "暖心熊",
    topInterests: ["电影", "绘画", "瑜伽"],
  },
  {
    userId: "u5",
    displayName: "大壮",
    archetype: "织网蛛",
    topInterests: ["商业", "篮球", "烹饪"],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Skip-confirmation modal
// ──────────────────────────────────────────────────────────────────────────────

interface SkipModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function SkipModal({ onConfirm, onCancel }: SkipModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Sheet */}
      <motion.div
        className="relative z-10 w-full max-w-md bg-background rounded-t-2xl p-6 pb-10 shadow-xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Sparkles className="text-destructive" size={24} />
          </div>

          <h2 className="text-lg font-bold text-foreground">确定要放弃吗？</h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            这支战队与你的匹配度高达 <span className="font-semibold text-primary">{PLACEHOLDER_MATCH_SCORE}%</span>，
            放弃后将无法恢复此次匹配机会。
          </p>

          <div className="flex flex-col w-full gap-3 mt-2">
            <Button
              variant="outline"
              className="w-full h-12 text-base font-semibold"
              onClick={onCancel}
            >
              让我再想想
            </Button>
            <button
              className="text-sm text-muted-foreground underline underline-offset-2 py-1"
              onClick={onConfirm}
            >
              确认退出
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SquadUnboxingFlow — main page
// ──────────────────────────────────────────────────────────────────────────────

export default function SquadUnboxingFlow() {
  const [, setLocation] = useLocation();
  const [flowState, setFlowState] = useState<FlowState>("ready");
  const [showActions, setShowActions] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);

  // ── Transition: ready → shaking → revealed ──
  const handleOpenBox = useCallback(() => {
    setFlowState("shaking");
    setTimeout(() => {
      setFlowState("revealed");
      // Show action zone after cards finish animating
      setTimeout(() => setShowActions(true), 2500);
    }, 1500);
  }, []);

  const handleConfirmAttendance = useCallback(() => {
    // TODO: fire API call to confirm attendance
    setLocation("/");
  }, [setLocation]);

  const handleSkipConfirm = useCallback(() => {
    setShowSkipModal(false);
    // TODO: fire API call to decline
    setLocation("/");
  }, [setLocation]);

  // ── Box shaking animation variants ──
  const boxVariants = {
    idle: { rotate: 0, scale: 1 },
    shaking: {
      rotate: [0, -8, 8, -8, 8, -6, 6, -4, 4, 0],
      scale: [1, 1.05, 1.05, 1.05, 1.05, 1.02, 1.02, 1.01, 1.01, 1],
      transition: { duration: 1.5, ease: "easeInOut" },
    },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingBottom: BOTTOM_SPACING }}>
      {/* ── Header ── */}
      <div className="px-4 pt-10 pb-4 text-center">
        <h1 className="text-2xl font-bold text-foreground font-display">你的战队揭晓了！</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI 为你匹配了 {MOCK_ATTENDEES.length} 位契合伙伴
        </p>
      </div>

      {/* ── Stage area ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
        <AnimatePresence mode="wait">
          {/* READY state — show box */}
          {(flowState === "ready" || flowState === "shaking") && (
            <motion.div
              key="box-stage"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-6"
            >
              {/* Blind box image */}
              <motion.div
                variants={boxVariants}
                animate={flowState === "shaking" ? "shaking" : "idle"}
                style={{ filter: flowState === "shaking" ? "drop-shadow(0 0 20px #7C3AED88)" : undefined }}
              >
                <img
                  src={boxImg}
                  alt="JoyJoin blind box"
                  className="w-48 h-48 object-contain"
                />
              </motion.div>

              {/* Particles during shaking */}
              <AnimatePresence>
                {flowState === "shaking" && (
                  <motion.div
                    key="particles"
                    className="absolute inset-0 pointer-events-none overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {["✨", "🎊", "⭐", "💫", "🎉"].map((emoji, i) => (
                      <motion.span
                        key={i}
                        className="absolute text-2xl select-none"
                        style={{ left: `${15 + i * 16}%`, top: "30%" }}
                        initial={{ y: 0, opacity: 1, scale: 0.5 }}
                        animate={{ y: -80, opacity: 0, scale: 1.2 }}
                        transition={{ delay: i * 0.15, duration: 1.0 }}
                      >
                        {emoji}
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Open button — only in ready state */}
              {flowState === "ready" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Button
                    size="lg"
                    className="h-14 px-8 text-base font-bold rounded-2xl shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #4C1D95, #7C3AED)",
                      color: "white",
                    }}
                    onClick={handleOpenBox}
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    立即开盲盒
                  </Button>
                </motion.div>
              )}

              {/* Loading label while shaking */}
              {flowState === "shaking" && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-sm font-medium text-primary"
                >
                  正在解锁战队成员…
                </motion.p>
              )}
            </motion.div>
          )}

          {/* REVEALED state — fan of cards */}
          {flowState === "revealed" && (
            <motion.div
              key="card-stage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              {/* Match score badge */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <Sparkles size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-primary">{PLACEHOLDER_MATCH_SCORE}% 匹配度</span>
                </div>
              </div>

              <CardDeckReveal attendees={MOCK_ATTENDEES} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Action Zone (sticky, above BottomNav) ── */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            key="actions"
            className="fixed left-0 right-0 flex flex-col items-center gap-3 px-6 py-4 bg-background/90 backdrop-blur-sm border-t"
            style={{ bottom: BOTTOM_NAV_HEIGHT }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <Button
              size="lg"
              className="w-full max-w-sm h-14 text-base font-bold rounded-2xl shadow-lg"
              style={{
                background: "linear-gradient(135deg, #4C1D95, #7C3AED)",
                color: "white",
              }}
              onClick={handleConfirmAttendance}
            >
              确认参与 🎉
            </Button>

            <button
              className="text-sm text-muted-foreground underline underline-offset-2 py-1"
              onClick={() => setShowSkipModal(true)}
            >
              跳过 / 无法参与
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skip confirmation modal ── */}
      <AnimatePresence>
        {showSkipModal && (
          <SkipModal
            onConfirm={handleSkipConfirm}
            onCancel={() => setShowSkipModal(false)}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
