import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { Sparkles, Package, Zap } from "lucide-react";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateAge as calculateAgeFromBirthdate } from "@shared/utils";
import {
  calculateAge,
  getUserAllInterests,
  getUserPrimaryInterests,
  getUserTopicAvoidances,
} from "@/lib/userFieldMappings";
import { generateSparkPredictions, type UserContext } from "@/lib/attendeeAnalytics";
import { useGroupAnalysis } from "@/hooks/useGroupAnalysis";
import { getVibeTokens } from "@/lib/vibeTokens";
import type { PairExplanation } from "@shared/types/groupAnalysis";

// Safe wrapper around the Web Vibration API
const hapticVibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
};

type FlowState = "ready" | "shaking" | "revealed";

// Shared JoyJoin gradient used across box and buttons in this flow
const JOYJOIN_GRADIENT = "linear-gradient(135deg, #4C1D95, #7C3AED)";

interface PoolGroupMember {
  userId: string;
  displayName: string;
  archetype?: string | null;
  topInterests?: string[] | null;
  /** API returns users.birthdate — a date string, not a numeric age */
  age?: string | null;
  industryNicheLabel?: string | null;
  industryCategoryLabel?: string | null;
  ageVisible?: string | null;
  industryVisible?: string | null;
  gender?: string | null;
  educationLevel?: string | null;
  hometownRegionCity?: string | null;
  hometownAffinityOptin?: boolean | null;
  educationVisible?: string | null;
  relationshipStatus?: string | null;
  intent?: string[] | null;
}

interface PoolGroupResponse {
  group: {
    id: string;
    groupNumber: number;
    memberCount: number;
    matchScore: number | null;
    matchExplanation: string | null;
    venueName: string | null;
    venueAddress: string | null;
    finalDateTime: string | null;
    status: string;
  };
  pool: {
    id: string;
    title: string;
    description: string | null;
    eventType: string;
    city: string;
    district: string | null;
    dateTime: string;
  };
  members: PoolGroupMember[];
}

// Action zone sits at the bottom; uses safe-area-inset-bottom so it clears
// the device home indicator without leaving the old BottomNav-sized gap.
const ACTION_ZONE_BOTTOM_STYLE = "calc(env(safe-area-inset-bottom, 0px) + 16px)";

export default function SquadUnboxingFlow() {
  const [, setLocation] = useLocation();
  const { groupId } = useParams();
  const [flowState, setFlowState] = useState<FlowState>("ready");
  const [showActionZone, setShowActionZone] = useState(false);
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  // 0 = waiting, 1–4 = each reveal phase
  const [analysingStage, setAnalysingStage] = useState<0 | 1 | 2 | 3 | 4>(0);
  // True when the user skipped mid-animation — suppresses stagger delays on stages 3 & 4
  const skippedToFinalRef = useRef(false);

  // Redirect immediately if there's no groupId in the URL
  useEffect(() => {
    if (!groupId) {
      setLocation("/discover");
    }
  }, [groupId, setLocation]);

  // Fetch current user — `useAuth` uses the cached `/api/auth/user` query,
  // which fires independently from squad data so there is no sequential waterfall.
  const { user, isLoading: isUserLoading } = useAuth();

  // Fetch real group data from the API
  const { data, isLoading: isGroupLoading } = useQuery<PoolGroupResponse>({
    queryKey: ["/api/pool-groups", groupId],
    enabled: !!groupId,
  });

  // Fetch group analysis — only fires once the box is opened (revealed state).
  // Uses the shared hook so the query key and stale-time are canonical.
  const { data: groupAnalysis, isLoading: isLoadingAnalysis } = useGroupAnalysis(
    flowState === "revealed" ? groupId : null
  );

  const { toast } = useToast();

  // Confirm attendance mutation
  const confirmAttendanceMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/pool-groups/${groupId}/confirm-attendance`, {}),
    onSuccess: async (res) => {
      const body = await res.json() as { success: boolean; blindBoxEventId: string | null };
      if (body.blindBoxEventId) {
        setLocation(`/blind-box-events/${body.blindBoxEventId}`);
      } else {
        setLocation(`/pool-groups/${groupId}`);
      }
    },
    onError: () => {
      toast({
        title: "确认失败",
        description: "无法确认出席，请稍后重试。",
        variant: "destructive",
      });
    },
  });

  // Map API members → SquadMember[] for CardDeckReveal
  // The API returns age as users.birthdate (a string) and industry as industryNicheLabel/industryCategoryLabel.
  // Normalise both fields here so spark predictions work correctly.
  // When groupAnalysis is available, merge AI pair data (matchReason, compatibilityScore,
  // connectionPoints) using myPairs (viewer-scoped) or the full pairExplanations list.
  const squadMembers = useMemo<SquadMember[]>(() => {
    if (!data?.members) return [];
    return data.members.map((m) => {
      // Look up the viewer↔member pair explanation from myPairs first (server-computed),
      // falling back to a client-side pairKey lookup against the full list.
      let pairExp: PairExplanation | undefined;
      if (groupAnalysis && user?.id && m.userId !== user.id) {
        const pairKey = [user.id, m.userId].sort().join("-");
        if (groupAnalysis.myPairs) {
          pairExp = groupAnalysis.myPairs.find((p) => p.pairKey === pairKey);
        }
        if (!pairExp) {
          pairExp = groupAnalysis.pairExplanations.find((p) => p.pairKey === pairKey);
        }
      }

      return {
        userId: m.userId,
        displayName: m.displayName,
        archetype: m.archetype ?? undefined,
        // Compute numeric age from birthdate string; undefined if absent
        age: m.age ? calculateAgeFromBirthdate(m.age) : undefined,
        gender: m.gender ?? undefined,
        educationLevel: m.educationLevel ?? undefined,
        topInterests: m.topInterests ?? undefined,
        // industry is not returned directly — use the most-specific label available
        industry: m.industryNicheLabel ?? m.industryCategoryLabel ?? undefined,
        relationshipStatus: m.relationshipStatus ?? undefined,
        hometownRegionCity: m.hometownRegionCity ?? undefined,
        hometownAffinityOptin: m.hometownAffinityOptin ?? undefined,
        // AI-populated fields (undefined when analysis hasn't loaded yet — cards fall back gracefully)
        matchReason: pairExp?.explanation ?? undefined,
        compatibilityScore: pairExp?.chemistryScore ?? undefined,
        connectionPoints: pairExp?.connectionPoints ?? undefined,
      };
    });
  }, [data, groupAnalysis, user?.id]);

  // Build UserContext from auth user for spark-prediction engine
  const currentUser = useMemo<UserContext | undefined>(() => {
    if (!user) return undefined;
    return {
      interests: getUserAllInterests(user),
      primaryInterests: getUserPrimaryInterests(user),
      topicAvoidances: getUserTopicAvoidances(user),
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

  // Derive compatibility percent from the server-calculated group score.
  // Per-member `compatibilityScore` is not returned by this API so we only
  // use the group-level matchScore, defaulting to 0 when absent.
  const squadCompatibilityPercent = useMemo(() => {
    if (data?.group.matchScore !== null && data?.group.matchScore !== undefined) {
      return Math.round(data.group.matchScore);
    }
    return 0;
  }, [data]);

  // Aggregate total sparks across the whole squad (for dynamic FOMO modal)
  const totalSquadSparks = useMemo(() => {
    if (!currentUser) return 0;
    return squadMembers.reduce((total, member) => {
      const sparks = generateSparkPredictions(currentUser, {
        userId: member.userId,
        displayName: member.displayName,
        archetype: member.archetype,
        age: member.age,
        topInterests: member.topInterests,
        educationLevel: member.educationLevel,
        industry: member.industry,
        gender: member.gender,
        relationshipStatus: member.relationshipStatus,
        hometownRegionCity: member.hometownRegionCity,
        hometownAffinityOptin: member.hometownAffinityOptin,
      });
      return total + sparks.length;
    }, 0);
  }, [currentUser, squadMembers]);

  // Sort pair explanations so current user's pairs appear first
  const sortedPairExplanations = useMemo<PairExplanation[]>(() => {
    if (!groupAnalysis?.pairExplanations) return [];
    const currentUserId = user?.id;
    if (!currentUserId) return groupAnalysis.pairExplanations;
    return [...groupAnalysis.pairExplanations].sort((a, b) => {
      const aHasUser = a.pairKey.includes(currentUserId);
      const bHasUser = b.pairKey.includes(currentUserId);
      if (aHasUser && !bHasUser) return -1;
      if (!aHasUser && bHasUser) return 1;
      return 0;
    });
  }, [groupAnalysis, user]);

  // Pre-compute a pairKey → [member, member] lookup map to avoid O(n²) per-pair lookups
  const pairKeyMemberMap = useMemo<Map<string, [PoolGroupMember, PoolGroupMember]>>(() => {
    const map = new Map<string, [PoolGroupMember, PoolGroupMember]>();
    if (!data?.members) return map;
    const members = data.members;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const key = [members[i].userId, members[j].userId].sort().join("-");
        map.set(key, [members[i], members[j]]);
      }
    }
    return map;
  }, [data]);

  const getMembersFromPairKey = useCallback(
    (pairKey: string): [PoolGroupMember, PoolGroupMember] | null =>
      pairKeyMemberMap.get(pairKey) ?? null,
    [pairKeyMemberMap]
  );

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

  // Progressive reveal: start Stage 1 (chemistry badge) 1.2s after revealed
  useEffect(() => {
    if (flowState !== "revealed") return;
    const t = setTimeout(() => setAnalysingStage((s) => (s === 0 ? 1 : s)), 1200);
    return () => clearTimeout(t);
  }, [flowState]);

  // Auto-advance stages 1 → 2 → 3 → 4, each 1.8s apart
  useEffect(() => {
    if (analysingStage < 1 || analysingStage >= 4) return;
    const next = Math.min(analysingStage + 1, 4) as typeof analysingStage;
    const t = setTimeout(() => setAnalysingStage(next), 1800);
    return () => clearTimeout(t);
  }, [analysingStage]);

  const handleOpenBox = () => {
    // Haptic: "weight of the box" shake pattern
    hapticVibrate([50, 50, 50, 50, 100]);
    setFlowState("shaking");
  };

  const handleConfirmAttendance = () => {
    confirmAttendanceMutation.mutate();
  };

  const handleSkip = () => {
    // If the progressive reveal is mid-animation, snap to the final state.
    // Set the ref first so stage 3/4 render their items without stagger delays.
    if (analysingStage < 4) {
      skippedToFinalRef.current = true;
      setAnalysingStage(4);
    }
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

  // Derive event type label for header
  const eventTypeLabel = data?.pool.eventType === "bar" ? "酒局" : "饭局";

  // Loading state
  if (isGroupLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // Error / not-found state
  if (!isGroupLoading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="text-center py-12">
          <p className="text-muted-foreground">小组不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16">
      {/* Screen-reader announcement of state changes */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {flowStateLabel}
      </p>

      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-foreground">你的{eventTypeLabel}桌友 🎉</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {squadMembers.length}人同桌 · {squadCompatibilityPercent}% 匹配度
        </p>
      </div>

      {/* Main content area — scrollable in revealed state to accommodate analysis sections */}
      <div
        className={`flex-1 flex flex-col px-5 py-4 ${
          flowState === "revealed" ? "overflow-y-auto" : "items-center justify-center"
        }`}
      >
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
                <p className="text-sm text-muted-foreground">为你匹配了 {squadMembers.length} 位桌友</p>
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

          {/* ── REVEALED state: card fan + progressive analysis reveal ── */}
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
                members={squadMembers}
                currentUser={currentUser}
                isUserLoading={isUserLoading}
                onAllRevealed={handleAllRevealed}
                onCardFlipped={handleCardFlipped}
              />

              {/* ── Progressive analysis reveal (additive below card fan) ── */}
              {analysingStage > 0 && (
                <div className="w-full mt-6 space-y-4 pb-44">

                  {/* Stage 1: Chemistry badge */}
                  <AnimatePresence>
                    {analysingStage >= 1 && (
                      <motion.div
                        key="stage-chemistry"
                        initial={{ opacity: 0, scale: 0.9, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          你们的火花
                        </p>
                        {isLoadingAnalysis ? (
                          <div className="h-16 w-full rounded-2xl bg-muted animate-pulse" />
                        ) : groupAnalysis ? (
                          (() => {
                            const cfg = getVibeTokens(groupAnalysis.overallChemistry);
                            return (
                              <div
                                className={`flex items-center justify-center gap-3 rounded-2xl px-6 py-4 bg-gradient-to-r ${cfg.gradientClass} shadow-lg`}
                              >
                                <span className="text-3xl" aria-hidden="true">{cfg.emoji}</span>
                                <span className="text-xl font-bold text-white">{cfg.label}</span>
                              </div>
                            );
                          })()
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Stage 2: Group theme tags + companion + dynamics */}
                  <AnimatePresence>
                    {analysingStage >= 2 && (
                      <motion.div
                        key="stage-dynamics"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        {isLoadingAnalysis ? (
                          <div className="space-y-2">
                            <div className="h-4 w-full rounded bg-muted animate-pulse" />
                            <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
                          </div>
                        ) : groupAnalysis ? (
                          <div className="space-y-3">
                            {/* Theme tags */}
                            {groupAnalysis.groupThemeTags && groupAnalysis.groupThemeTags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {groupAnalysis.groupThemeTags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Companion line */}
                            {groupAnalysis.groupThemeCompanion && (
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {groupAnalysis.groupThemeCompanion}
                              </p>
                            )}
                            {/* Group dynamics */}
                            <div className="rounded-2xl border border-border bg-card px-5 py-4">
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {groupAnalysis.groupDynamics}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Stage 3: Pair explanations */}
                  <AnimatePresence>
                    {analysingStage >= 3 && (
                      <motion.div
                        key="stage-pairs"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        <p className="text-sm font-semibold text-foreground mb-3">
                          为什么你们会聊得来？
                        </p>
                        {isLoadingAnalysis ? (
                          <div className="space-y-3">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
                            ))}
                          </div>
                        ) : groupAnalysis ? (
                          <div className="space-y-3">
                            {sortedPairExplanations.map((pair, idx) => {
                              const members = getMembersFromPairKey(pair.pairKey);
                              const hasHighChemistry = pair.chemistryScore >= 85;
                              // Animate entry only when first arriving at stage 3 via auto-advance.
                              // If the user skipped to the final state, render immediately without stagger.
                              const animateEntry = analysingStage === 3 && !skippedToFinalRef.current;
                              return (
                                <motion.div
                                  key={pair.pairKey}
                                  className="rounded-2xl border border-border bg-card px-4 py-3"
                                  initial={animateEntry ? { opacity: 0, y: 12 } : false}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.35, delay: animateEntry ? idx * 0.3 : 0 }}
                                >
                                  <div className="flex items-start gap-2 mb-1">
                                    {hasHighChemistry && (
                                      <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-label="高火花" />
                                    )}
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {members
                                        ? `${members[0].displayName} × ${members[1].displayName}`
                                        : pair.pairKey}
                                    </p>
                                  </div>
                                  <p className="text-sm text-foreground leading-relaxed">
                                    {pair.explanation}
                                  </p>
                                </motion.div>
                              );
                            })}
                          </div>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Stage 4: Ice-breakers */}
                  <AnimatePresence>
                    {analysingStage >= 4 && (
                      <motion.div
                        key="stage-icebreakers"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        <p className="text-sm font-semibold text-foreground mb-3">今晚聊什么？💬</p>
                        {isLoadingAnalysis ? (
                          <div className="flex flex-wrap gap-2">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="h-8 w-24 rounded-full bg-muted animate-pulse" />
                            ))}
                          </div>
                        ) : groupAnalysis ? (
                          <div className="flex flex-wrap gap-2">
                            {groupAnalysis.iceBreakers.map((topic, idx) => {
                              // Animate entry only when first arriving at stage 4 via auto-advance.
                              // If the user skipped to the final state, render immediately without stagger.
                              const animateEntry = analysingStage === 4 && !skippedToFinalRef.current;
                              return (
                                <motion.span
                                  key={idx}
                                  className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground"
                                  initial={animateEntry ? { opacity: 0, scale: 0.85 } : false}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.3, delay: animateEntry ? idx * 0.15 : 0 }}
                                >
                                  {topic}
                                </motion.span>
                              );
                            })}
                          </div>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Legacy fallback: show matchExplanation when groupAnalysis is null after loading */}
                  {!isLoadingAnalysis && !groupAnalysis && data?.group.matchExplanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="rounded-2xl border border-border bg-card px-5 py-4"
                    >
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        为什么是这桌？
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {data.group.matchExplanation}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}
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
              disabled={confirmAttendanceMutation.isPending}
              data-testid="button-confirm-attendance"
            >
              {confirmAttendanceMutation.isPending ? "确认中…" : "确认出席 🎉"}
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
