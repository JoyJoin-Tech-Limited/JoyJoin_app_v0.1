import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Sparkles, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BottomNav from "@/components/BottomNav";
import CardDeckReveal, { type SquadMember } from "@/components/CardDeckReveal";

type FlowState = "ready" | "shaking" | "revealed";

// Mock squad data — replace with real API data when available
const MOCK_SQUAD: SquadMember[] = [
  {
    userId: "u1",
    displayName: "小雅",
    archetype: "开心柯基",
    age: 26,
    topInterests: ["旅行", "美食", "摄影"],
    matchReason: "你们都热爱探索新事物，话题永远聊不完",
    compatibilityScore: 92,
  },
  {
    userId: "u2",
    displayName: "志明",
    archetype: "机智狐",
    age: 28,
    topInterests: ["科技", "阅读", "音乐"],
    matchReason: "理性与感性的碰撞，能激发彼此的新想法",
    compatibilityScore: 88,
  },
  {
    userId: "u3",
    displayName: "晓晴",
    archetype: "暖心熊",
    age: 25,
    topInterests: ["艺术", "健身", "美食"],
    matchReason: "暖意十足，是整桌的情绪担当",
    compatibilityScore: 85,
  },
  {
    userId: "u4",
    displayName: "铭轩",
    archetype: "淡定海豚",
    age: 29,
    topInterests: ["旅行", "游戏", "电影"],
    matchReason: "沉稳又幽默，气氛冷场时总能救场",
    compatibilityScore: 83,
  },
];

export default function SquadUnboxingFlow() {
  const [, setLocation] = useLocation();
  const [flowState, setFlowState] = useState<FlowState>("ready");
  const [showActionZone, setShowActionZone] = useState(false);
  const [showSkipDialog, setShowSkipDialog] = useState(false);

  // Shaking → revealed transition after 1.5s
  useEffect(() => {
    if (flowState !== "shaking") return;
    const t = setTimeout(() => setFlowState("revealed"), 1500);
    return () => clearTimeout(t);
  }, [flowState]);

  // Show action zone 2.5s after revealed
  useEffect(() => {
    if (flowState !== "revealed") return;
    const t = setTimeout(() => setShowActionZone(true), 2500);
    return () => clearTimeout(t);
  }, [flowState]);

  const handleOpenBox = () => {
    setFlowState("shaking");
  };

  const handleConfirmAttendance = () => {
    // TODO: call POST /api/squad/confirm-attendance
    setLocation("/my-journey");
  };

  const handleSkip = () => {
    setShowSkipDialog(true);
  };

  const handleConfirmExit = () => {
    setShowSkipDialog(false);
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingBottom: 160 }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-foreground">你的饭局桌友 🎉</h1>
        <p className="text-sm text-muted-foreground mt-1">92% 匹配度 · 4人同桌</p>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-4">
        <AnimatePresence mode="wait">
          {/* ── READY state: glowing box ── */}
          {flowState === "ready" && (
            <motion.div
              key="ready"
              className="flex flex-col items-center gap-8"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.35 }}
            >
              {/* Blind box visual */}
              <div className="relative flex items-center justify-center">
                {/* Glow rings */}
                <motion.div
                  className="absolute rounded-full border-2 border-primary/20"
                  style={{ width: 200, height: 200 }}
                  animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute rounded-full border border-primary/10"
                  style={{ width: 240, height: 240 }}
                  animate={{ scale: [1, 1.06, 1], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                />
                {/* Box */}
                <div
                  className="h-32 w-32 rounded-3xl flex items-center justify-center shadow-2xl"
                  style={{ background: "linear-gradient(135deg, #4C1D95, #7C3AED)" }}
                >
                  <Package className="h-16 w-16 text-white/90" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-base font-semibold text-foreground">盲盒已就绪</p>
                <p className="text-sm text-muted-foreground">为你匹配了 {MOCK_SQUAD.length} 位桌友</p>
              </div>

              <Button
                size="lg"
                className="w-full max-w-xs text-base font-semibold rounded-2xl h-14 shadow-lg"
                style={{ background: "linear-gradient(135deg, #4C1D95, #7C3AED)" }}
                onClick={handleOpenBox}
                data-testid="button-open-blind-box"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                立即开启盲盒
              </Button>
            </motion.div>
          )}

          {/* ── SHAKING state: animated box ── */}
          {flowState === "shaking" && (
            <motion.div
              key="shaking"
              className="flex flex-col items-center gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="h-32 w-32 rounded-3xl flex items-center justify-center shadow-2xl"
                style={{ background: "linear-gradient(135deg, #4C1D95, #7C3AED)" }}
                animate={{
                  rotate: [0, -10, 10, -10, 10, -6, 6, -3, 3, 0],
                  y: [0, -8, 4, -8, 4, -4, 2, 0],
                  scale: [1, 1.04, 1, 1.04, 1, 1.02, 1],
                }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              >
                <Package className="h-16 w-16 text-white/90" />
              </motion.div>

              <motion.p
                className="text-base font-medium text-foreground"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                正在开盒…✨
              </motion.p>
            </motion.div>
          )}

          {/* ── REVEALED state: card fan ── */}
          {flowState === "revealed" && (
            <motion.div
              key="revealed"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-sm text-muted-foreground mb-2 text-center">
                点击卡片查看详情 ✨
              </p>
              <CardDeckReveal members={MOCK_SQUAD} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Sticky Action Zone ── */}
      <AnimatePresence>
        {showActionZone && (
          <motion.div
            className="fixed left-0 right-0 px-5 flex flex-col gap-3"
            style={{ bottom: 96 }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, type: "spring", stiffness: 200, damping: 22 }}
          >
            <Button
              size="lg"
              className="w-full h-14 text-base font-bold rounded-2xl shadow-lg"
              style={{ background: "linear-gradient(135deg, #4C1D95, #7C3AED)" }}
              onClick={handleConfirmAttendance}
              data-testid="button-confirm-attendance"
            >
              确认出席 🎉
            </Button>
            <button
              className="text-sm text-muted-foreground text-center py-2 hover:text-foreground transition-colors"
              onClick={handleSkip}
              data-testid="button-skip"
            >
              跳过 / 无法参加
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skip Confirmation Dialog ── */}
      <AlertDialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要放弃吗？</AlertDialogTitle>
            <AlertDialogDescription>
              你将错过这次 92% 匹配度的桌友组合，下次等待可能需要更长时间。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-let-me-think">
              再想想
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmExit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-exit"
            >
              确认放弃
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
