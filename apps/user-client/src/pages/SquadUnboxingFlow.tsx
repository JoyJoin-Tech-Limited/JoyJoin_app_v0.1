import { useState, useEffect, useMemo, useCallback } from "react";
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
import CardDeckReveal, { type SquadMember } from "@/components/CardDeckReveal";
import { useAuth } from "@/hooks/useAuth";
import { calculateAge } from "@/lib/userFieldMappings";
import { generateSparkPredictions, type UserContext } from "@/lib/attendeeAnalytics";

// Safe wrapper around the Web Vibration API
const hapticVibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
};

type FlowState = "ready" | "shaking" | "revealed";

// Shared JoyJoin gradient used across box and buttons in this flow
const JOYJOIN_GRADIENT = "linear-gradient(135deg, #4C1D95, #7C3AED)";

// Mock squad data — replace with real API data when available.
// TODO: integrate with POST /api/squad/confirm-attendance and add loading/error states.
// Fields beyond displayName/archetype/topInterests are included so that
// generateSparkPredictions can produce meaningful sparks during local dev/demo.
const MOCK_SQUAD: SquadMember[] = [
  {
    userId: "u1",
    displayName: "小雅",
    archetype: "开心柯基",
    age: 26,
    gender: "Woman",
    educationLevel: "Master's",
    topInterests: ["旅行", "美食", "摄影"],
    primaryInterests: ["travel_exploration", "food_dining", "photography"],
    industry: "创意设计",
    relationshipStatus: "Single",
    hometownRegionCity: "成都",
    matchReason: "你们都热爱探索新事物，话题永远聊不完",
    compatibilityScore: 92,
  },
  {
    userId: "u2",
    displayName: "志明",
    archetype: "机智狐",
    age: 28,
    gender: "Man",
    educationLevel: "Bachelor's",
    topInterests: ["科技", "阅读", "音乐"],
    primaryInterests: ["technology", "reading_books", "music_concerts"],
    industry: "科技互联网",
    relationshipStatus: "Single",
    hometownRegionCity: "上海",
    matchReason: "理性与感性的碰撞，能激发彼此的新想法",
    compatibilityScore: 88,
  },
  {
    userId: "u3",
    displayName: "晓晴",
    archetype: "暖心熊",
    age: 25,
    gender: "Woman",
    educationLevel: "Master's",
    topInterests: ["艺术", "健身", "美食"],
    primaryInterests: ["art_culture", "fitness_health", "food_dining"],
    industry: "教育培训",
    relationshipStatus: "Single",
    hometownRegionCity: "北京",
    matchReason: "暖意十足，是整桌的情绪担当",
    compatibilityScore: 85,
  },
  {
    userId: "u4",
    displayName: "铭轩",
    archetype: "淡定海豚",
    age: 29,
    gender: "Man",
    educationLevel: "Bachelor's",
    topInterests: ["旅行", "游戏", "电影"],
    primaryInterests: ["travel_exploration", "gaming", "film_entertainment"],
    industry: "金融投资",
    relationshipStatus: "Single",
    hometownRegionCity: "广州",
    matchReason: "沉稳又幽默，气氛冷场时总能救场",
    compatibilityScore: 83,
  },
];

// Action zone sits at the bottom; uses safe-area-inset-bottom so it clears
// the device home indicator without leaving the old BottomNav-sized gap.
const ACTION_ZONE_BOTTOM_STYLE = "calc(env(safe-area-inset-bottom, 0px) + 16px)";

export default function SquadUnboxingFlow() {
  const [, setLocation] = useLocation();
  const [flowState, setFlowState] = useState<FlowState>("ready");
  const [showActionZone, setShowActionZone] = useState(false);
  const [showSkipDialog, setShowSkipDialog] = useState(false);

  // Fetch current user — `useAuth` uses the cached `/api/auth/user` query,
  // which fires independently from squad data so there is no sequential waterfall.
  const { user, isLoading: isUserLoading } = useAuth();

  // Build UserContext from auth user for spark-prediction engine
  const currentUser = useMemo<UserContext | undefined>(() => {
    if (!user) return undefined;
    return {
      interests: user.interestsDeep ?? undefined,
      educationLevel: user.educationLevel ?? undefined,
      industry: user.industryCategoryLabel ?? user.industryCategory ?? undefined,
      age: user.birthdate ? calculateAge(user.birthdate) : undefined,
      gender: user.gender ?? undefined,
      archetype: user.archetype ?? undefined,
      relationshipStatus: user.relationshipStatus ?? undefined,
      hometownRegionCity: user.hometownRegionCity ?? undefined,
      hometownAffinityOptin: user.hometownAffinityOptin ?? undefined,
    };
  }, [user]);

  // Derive compatibility stats dynamically from squad data
  const squadCompatibilityPercent = useMemo(() => {
    const scores = MOCK_SQUAD.map((m) => m.compatibilityScore ?? 0).filter(Boolean);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }, []);

  // Aggregate total sparks across the whole squad (for dynamic FOMO modal)
  const totalSquadSparks = useMemo(() => {
    if (!currentUser) return 0;
    return MOCK_SQUAD.reduce((total, member) => {
      const sparks = generateSparkPredictions(currentUser, {
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
      return total + sparks.length;
    }, 0);
  }, [currentUser]);

  // Shaking → revealed transition after 1.5s
  useEffect(() => {
    if (flowState !== "shaking") return;
    const shakeToRevealTimeout = setTimeout(() => setFlowState("revealed"), 1500);
    return () => clearTimeout(shakeToRevealTimeout);
  }, [flowState]);

  // Show action zone 2.5s after revealed (gives cards time to fan and flip)
  useEffect(() => {
    if (flowState !== "revealed") return;
    const actionZoneTimeout = setTimeout(() => setShowActionZone(true), 2500);
    return () => clearTimeout(actionZoneTimeout);
  }, [flowState]);

  const handleOpenBox = () => {
    // Haptic: "weight of the box" shake pattern
    hapticVibrate([50, 50, 50, 50, 100]);
    setFlowState("shaking");
  };

  const handleConfirmAttendance = () => {
    // TODO: call POST /api/squad/confirm-attendance before navigating
    setLocation("/");
  };

  const handleSkip = () => {
    setShowSkipDialog(true);
  };

  const handleConfirmExit = () => {
    setShowSkipDialog(false);
    setLocation("/");
  };

  // Stable ref passed to CardDeckReveal; no-op for now (action zone timing is independent)
  const handleAllRevealed = useCallback(() => {}, []);

  // Haptic tick per card flip — creates "tick-tick-tick" dealing effect
  const handleCardFlipped = useCallback(() => {
    hapticVibrate(20);
  }, []);

  // Human-readable label for the current flow state (read by screen readers)
  const flowStateLabel =
    flowState === "ready"
      ? "盲盒已就绪，点击按钮开启"
      : flowState === "shaking"
      ? "正在开盒"
      : "桌友卡片已揭晓";

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16">
      {/* Screen-reader announcement of state changes */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {flowStateLabel}
      </p>

      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-foreground">你的饭局桌友 🎉</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {squadCompatibilityPercent}% 匹配度 · {MOCK_SQUAD.length}人同桌
        </p>
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
                  style={{ background: JOYJOIN_GRADIENT }}
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
                style={{ background: JOYJOIN_GRADIENT }}
                onClick={handleOpenBox}
                data-testid="button-open-blind-box"
              >
                <Sparkles className="h-5 w-5 mr-2" aria-hidden="true" />
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
                style={{ background: JOYJOIN_GRADIENT }}
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
                {isUserLoading
                  ? "正在加载个性化连接点…"
                  : "点击卡片查看详情 ✨"}
              </p>
              <CardDeckReveal
                members={MOCK_SQUAD}
                currentUser={currentUser}
                isUserLoading={isUserLoading}
                onAllRevealed={handleAllRevealed}
                onCardFlipped={handleCardFlipped}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Sticky Action Zone ── */}
      <AnimatePresence>
        {showActionZone && (
          <motion.div
            className="fixed left-0 right-0 px-5 flex flex-col gap-3"
            style={{ bottom: ACTION_ZONE_BOTTOM_STYLE }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, type: "spring", stiffness: 200, damping: 22 }}
          >
            <Button
              size="lg"
              className="w-full h-14 text-base font-bold rounded-2xl shadow-lg"
              style={{ background: JOYJOIN_GRADIENT }}
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

      <AlertDialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要放弃吗？</AlertDialogTitle>
            <AlertDialogDescription>
              你确定要放弃吗？系统检测到你与这桌新朋友共有{" "}
              {totalSquadSparks > 0 ? (
                <span className="font-semibold text-foreground">{totalSquadSparks} 个</span>
              ) : (
                "若干"
              )}
              潜在契合点，错过这波缘分可就太可惜啦！
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
    </div>
  );
}
