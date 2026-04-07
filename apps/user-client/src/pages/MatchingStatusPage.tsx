import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  MapPin, 
  Lock, 
  XCircle,
  Navigation,
  CheckCircle,
  RefreshCw,
  Gamepad2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCountdown } from "@/hooks/useCountdown";
import { usePoolRegistrationCancel } from "@/hooks/usePoolRegistrationCancel";
import { getArchetypeAvatar } from "@/lib/archetypeAdapter";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import MatchCelebrationOverlay from "@/components/MatchCelebrationOverlay";
import EventThemeTitleReveal from "@/components/EventThemeTitleReveal";
import ArchetypeOrbit from "@/components/ArchetypeOrbit";
import MatchSuccessSheet from "@/components/MatchSuccessSheet";
import MatchingWaitingScreen from "@/components/MatchingWaitingScreen";
import NoMatchScreen from "@/components/matching/NoMatchScreen";
import JoinEventPoolSheet from "@/components/event-pool-registration/JoinEventPoolSheet";
import type { EventPreferences } from "@/hooks/useEventPoolRegistration";
import type { NoMatchRecommendation } from "@/components/matching/NoMatchRecommendations";
import type { PoolMatchedData, EventThemeTitleRevealedData } from "@shared/wsEvents";
import { formatDateInHongKong } from "@/lib/hongKongTime";
import { calculateAge } from "@/lib/userFieldMappings";
import type { AttendeeData, UserContext } from "@/lib/attendeeAnalytics";

// Constants
const DEFAULT_MIN_GROUP_SIZE = 4;
const DEFAULT_MAX_GROUP_SIZE = 6;

interface PoolRegistration {
  id: string;
  poolId: string;
  matchStatus: "pending" | "matched" | "completed";
  assignedGroupId: string | null;
  budgetRange?: string[] | null;
  preferredLanguages?: string[] | null;
  eventIntent?: string[] | null;
  poolTitle: string;
  poolEventType: string;
  poolCity: string;
  poolDistrict: string;
  poolDateTime: string;
  poolStatus: string;
  theme?: string;
  subtitle?: string;
  themeEmoji?: string;
  highlights?: string[];
  vibe?: string;
  venueName?: string;
  venueAddress?: string;
  venuePhone?: string;
}

interface GroupMember {
  userId: string;
  displayName: string;
  archetype?: string;
  chemistryScore?: number;
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
  members: AttendeeData[];
}

interface PoolStats {
  currentFill: number;
  minGroupSize: number;
  maxGroupSize: number;
  progress: number;
  archetypeDistribution?: Record<string, number>;
}

interface RecommendedPool {
  id: string;
  title: string;
  eventType: "饭局" | "酒局" | "其他";
  city: "香港" | "深圳";
  district: string;
  dateTime: string;
  registrationCount: number;
}

export default function MatchingStatusPage() {
  const { registrationId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscribe } = useWebSocket();
  const cancelMutation = usePoolRegistrationCancel();

  // Match celebration states
  const [showMatchCelebration, setShowMatchCelebration] = useState(false);
  const [matchData, setMatchData] = useState<PoolMatchedData | null>(null);
  const [showThemeReveal, setShowThemeReveal] = useState(false);
  const [themeData, setThemeData] = useState<EventThemeTitleRevealedData | null>(null);
  
  // Reveal animation states
  const [showRevealAnimation, setShowRevealAnimation] = useState(false);
  const [groupMembersData, setGroupMembersData] = useState<PoolGroupResponse | null>(null);
  const [isLoadingGroupData, setIsLoadingGroupData] = useState(false);
  const [groupDataError, setGroupDataError] = useState<string | null>(null);
  const [revealAnimationComplete, setRevealAnimationComplete] = useState(false);  // Progress update micro-interaction state
  const [newMemberJoined, setNewMemberJoined] = useState(false);
  const [newMemberArchetype, setNewMemberArchetype] = useState<string | null>(null);
  const [livePoolArchetypes, setLivePoolArchetypes] = useState<string[]>([]);
  const [liveArchetypeDistribution, setLiveArchetypeDistribution] = useState<Record<string, number>>({});
  const [recoverJoinPool, setRecoverJoinPool] = useState<RecommendedPool | null>(null);

  // Refs for timeout cleanup
  const matchTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const microInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch registration from shared cache
  const { data: poolRegistrations, isLoading: isRegistrationLoading, isError: isRegistrationError, refetch: refetchRegistrations } = useQuery<Array<PoolRegistration>>({
    queryKey: ["/api/my-pool-registrations"],
    staleTime: 0,
  });

  const registration = poolRegistrations?.find(r => r.id === registrationId);
  const rejoinPreferences = useMemo<Partial<EventPreferences>>(
    () => ({
      eventType: registration?.poolEventType === "酒局" ? "酒局" : "饭局",
      budget: registration?.budgetRange?.[0] ?? "",
      socialGoals: registration?.eventIntent ?? [],
      languages: registration?.preferredLanguages ?? [],
    }),
    [registration],
  );

  // Fetch pool stats for progress
  const { data: poolStats } = useQuery<PoolStats>({
    queryKey: ["/api/event-pools", registration?.poolId, "group-fill"],
    enabled: !!registration?.poolId,
    refetchInterval: (() => {
      if (!registration?.poolDateTime) return 30_000;
      const msUntilEvent = new Date(registration.poolDateTime).getTime() - Date.now();
      return msUntilEvent > 0 && msUntilEvent <= 5 * 60 * 1000 ? 1_000 : 30_000;
    })(),
  });

  const { data: recommendedPools = [] } = useQuery<RecommendedPool[]>({
    queryKey: ["/api/event-pools", registration?.poolCity, "recover-options"],
    enabled: !!registration?.poolCity,
    queryFn: async () => {
      const response = await fetch(
        `/api/event-pools?city=${encodeURIComponent(registration?.poolCity ?? "")}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`);
      }
      return response.json();
    },
    select: (pools) =>
      pools
        .filter((pool) => pool.id !== registration?.poolId)
        .filter((pool) => pool.eventType === registration?.poolEventType)
        .sort((a, b) => {
          const districtBoost =
            Number(b.district === registration?.poolDistrict) -
            Number(a.district === registration?.poolDistrict);
          if (districtBoost !== 0) return districtBoost;
          return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
        })
        .slice(0, 3),
  });

  // Fetch group members when matched
  const { data: groupMembers } = useQuery<{ members: GroupMember[] }, unknown, GroupMember[]>({
    queryKey: ["/api/pool-groups", registration?.assignedGroupId],
    enabled: registration?.matchStatus === "matched" && !!registration?.assignedGroupId,
    select: (data) => data.members,
  });

  // Helper function to get chemistry temperature emoji and label
  const getChemistryBadge = (score?: number) => {
    if (score == null) return { emoji: '🌤️', label: '适宜', color: 'bg-blue-100 text-blue-700' };
    if (score >= 85) return { emoji: '🔥', label: '炽热', color: 'bg-red-100 text-red-700' };
    if (score >= 70) return { emoji: '🌡️', label: '温暖', color: 'bg-orange-100 text-orange-700' };
    if (score >= 55) return { emoji: '🌤️', label: '适宜', color: 'bg-blue-100 text-blue-700' };
    return { emoji: '❄️', label: '冷淡', color: 'bg-gray-100 text-gray-700' };
  };

  // Countdown to event
  const countdown = useCountdown(registration?.poolDateTime);

  // Check if venue should be unlocked (< 24h and matched)
  const isVenueUnlocked = registration?.matchStatus === "matched" && 
    countdown.totalMs > 0 && 
    countdown.totalMs < 24 * 60 * 60 * 1000;

  // Get user's archetype avatar
  const userArchetypeAvatar = user?.archetype 
    ? getArchetypeAvatar(user.archetype) 
    : null;
  const userArchetype = user?.archetype ?? null;
  const noMatchRecommendations = useMemo<NoMatchRecommendation[]>(
    () =>
      recommendedPools.map((pool) => ({
        id: pool.id,
        title: pool.title,
        eventType: pool.eventType === "酒局" ? "酒局" : "饭局",
        district: `${pool.city} · ${pool.district}`,
        dateTime: pool.dateTime,
        registrationCount: pool.registrationCount,
      })),
    [recommendedPools],
  );

  // Build UserContext for spark-prediction engine in MatchSuccessSheet
  const currentUserContext = useMemo<UserContext | undefined>(() => {
    if (!user) return undefined;
    const ctx: UserContext = {};
    if (user.interestsDeep && user.interestsDeep.length > 0) ctx.interests = user.interestsDeep;
    if (user.educationLevel != null) ctx.educationLevel = user.educationLevel;
    const industry = user.industryCategoryLabel ?? user.industryCategory;
    if (industry != null && industry !== "") ctx.industry = industry;
    if (user.birthdate != null) ctx.age = calculateAge(user.birthdate);
    if (user.gender != null) ctx.gender = user.gender;
    if (user.archetype != null) ctx.archetype = user.archetype;
    if (user.relationshipStatus != null) ctx.relationshipStatus = user.relationshipStatus;
    if (user.hometownRegionCity != null && user.hometownRegionCity !== "") ctx.hometownRegionCity = user.hometownRegionCity;
    if (user.hometownAffinityOptin != null) ctx.hometownAffinityOptin = user.hometownAffinityOptin;
    return ctx;
  }, [user]);

  useEffect(() => {
    if (!poolStats?.archetypeDistribution) return;
    setLiveArchetypeDistribution(poolStats.archetypeDistribution);
    setLivePoolArchetypes(
      Object.entries(poolStats.archetypeDistribution).flatMap(([archetype, count]) =>
        Array.from({ length: count }, () => archetype),
      ),
    );
  }, [poolStats?.archetypeDistribution]);

  // WebSocket subscriptions
  useEffect(() => {
    const unsubscribePoolMatched = subscribe('POOL_MATCHED', async (message) => {
      const poolData = message.data as PoolMatchedData;
      let fetchedGroupData: PoolGroupResponse | null = null;
      
      // Guard: only react to matches for the currently viewed registration's pool
      if (!registration || poolData.poolId !== registration.poolId) {
        return;
      }

      setMatchData(poolData);
      setGroupDataError(null);
      
      // In-page transition: progress → 100%, ribbon changes
      await queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
      
      // Fetch group members data before starting reveal
      if (poolData.groupId) {
        setIsLoadingGroupData(true);
        try {
          const response = await fetch(`/api/pool-groups/${poolData.groupId}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const groupData = await response.json();
            fetchedGroupData = groupData;
            setGroupMembersData(groupData);
          } else {
            setGroupDataError("已匹配成功，但暂时无法同步小队详情。你仍然可以继续查看活动状态。");
            setGroupMembersData(null);
          }
        } catch (error) {
          console.error('Failed to fetch group data:', error);
          setGroupDataError("已匹配成功，但暂时无法同步小队详情。你仍然可以继续查看活动状态。");
          setGroupMembersData(null);
        } finally {
          setIsLoadingGroupData(false);
        }
      }
      
      // Clear any existing timeout
      if (matchTransitionTimeoutRef.current) {
        clearTimeout(matchTransitionTimeoutRef.current);
      }
      
      // Wait 1 second for the visual transition, then branch based on whether
      // the group fetch produced member data during the async fetch above.
      matchTransitionTimeoutRef.current = setTimeout(() => {
        if (poolData.groupId) {
          if (fetchedGroupData) {
            setShowRevealAnimation(true);
          } else {
            // Fallback: no member data, skip reveal and go straight to celebration
            setShowMatchCelebration(true);
          }
        } else {
          // No groupId, skip reveal and go straight to celebration
          setShowMatchCelebration(true);
        }
      }, 1000);
    });

    const unsubscribeRegistrationAdded = subscribe('POOL_REGISTRATION_ADDED', async (message) => {
      const data = message.data as any;

      if (!registration || data.poolId !== registration.poolId) {
        return;
      }
      
      // Show "+1 新朋友加入！" micro-interaction
      setNewMemberJoined(true);
      setNewMemberArchetype(data.archetype || null);
      if (data.archetype) {
        setLivePoolArchetypes((current) => [...current, data.archetype]);
        setLiveArchetypeDistribution((current) => ({
          ...current,
          [data.archetype]: (current[data.archetype] ?? 0) + 1,
        }));
      }
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      // Clear any existing timeout
      if (microInteractionTimeoutRef.current) {
        clearTimeout(microInteractionTimeoutRef.current);
      }

      // Clear micro-interaction after 2s
      microInteractionTimeoutRef.current = setTimeout(() => {
        setNewMemberJoined(false);
        setNewMemberArchetype(null);
      }, 2000);

      await queryClient.invalidateQueries({ 
        queryKey: ["/api/event-pools", registration?.poolId, "group-fill"] 
      });
    });

    const unsubscribeThemeTitle = subscribe('EVENT_THEME_TITLE_REVEALED', async (message) => {
      const themeTitleData = message.data as EventThemeTitleRevealedData;
      
      // Ignore theme title events for other pools
      if (!registration || themeTitleData.poolId !== registration.poolId) {
        return;
      }

      setThemeData(themeTitleData);
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 100, 50]);
      }
      
      await queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
    });

    return () => {
      // Clean up timeouts
      if (matchTransitionTimeoutRef.current) {
        clearTimeout(matchTransitionTimeoutRef.current);
      }
      if (microInteractionTimeoutRef.current) {
        clearTimeout(microInteractionTimeoutRef.current);
      }
      
      unsubscribePoolMatched();
      unsubscribeRegistrationAdded();
      unsubscribeThemeTitle();
    };
  }, [subscribe, registration?.poolId, poolStats?.progress]);

    // Handle user dismissing the MatchSuccessSheet (animation is handled internally by the sheet)
  const handleRevealContinue = useCallback(() => {
    // Hide the reveal overlay and show match celebration
    setShowRevealAnimation(false);
    setRevealAnimationComplete(false);
    setShowMatchCelebration(true);
  }, []);

  // Handle match celebration flow
  const handleCelebrationContinue = useCallback(() => {
    setShowMatchCelebration(false);
    
    // If theme data is available, show theme reveal
    if (themeData) {
      setShowThemeReveal(true);
      return;
    }
    
    // Navigate to group detail, preferring live WS payload over registration refetch
    const targetGroupId = 
      matchData?.groupId ?? 
      registration?.assignedGroupId;
    
    if (targetGroupId) {
      setLocation(`/pool-groups/${targetGroupId}`);
    }
  }, [themeData, matchData?.groupId, registration?.assignedGroupId, setLocation]);

  const handleCloseThemeReveal = useCallback(() => {
    setShowThemeReveal(false);
    
    // Navigate to group detail after theme reveal, preferring WS payload
    const targetGroupId = 
      themeData?.groupId ?? 
      matchData?.groupId ?? 
      registration?.assignedGroupId;
    
    if (targetGroupId) {
      setLocation(`/pool-groups/${targetGroupId}`);
    }
  }, [themeData?.groupId, matchData?.groupId, registration?.assignedGroupId, setLocation]);

  // Handle cancel
  const handleCancel = () => {
    cancelMutation.mutate(registration!.id, {
      onSuccess: () => {
        setLocation("/");
      },
    });
  };

  // Handle invite
  const handleInvite = async () => {
    const poolTitle = registration?.poolTitle ?? "盲盒社交活动";
    const formattedDateTime = registration?.poolDateTime 
      ? formatDateInHongKong(registration.poolDateTime, 'full')
      : "活动时间待定";
    const shareText = `${poolTitle}\n${formattedDateTime}\n一起来参加盲盒社交活动吧！`;
    const shareUrl = `${window.location.origin}/discover`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: poolTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or share failed.
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast({
        title: "链接已复制",
        description: "邀请链接已复制到剪贴板",
      });
    }
  };

  if (isRegistrationLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">正在同步匹配进度...</p>
        </div>
      </div>
    );
  }

  if (isRegistrationError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">匹配状态加载失败</h2>
            <p className="text-sm text-muted-foreground">请重试，或先返回发现页继续浏览其他活动。</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => refetchRegistrations()} variant="outline" className="w-full">
                重新加载
              </Button>
              <Button onClick={() => setLocation("/")} className="w-full">
                返回发现页
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold">未找到这次报名</h2>
            <p className="text-sm text-muted-foreground">可能是状态刚更新完成，或这次报名已被取消。</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => refetchRegistrations()} variant="outline" className="w-full">
                刷新状态
              </Button>
              <Button onClick={() => setLocation("/events")} className="w-full">
                查看我的活动
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check for special states
  if (registration.poolStatus === "cancelled") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">活动已取消</h2>
            <p className="text-sm text-muted-foreground">
              抱歉，此活动已被管理员取消。报名费用将原路退回。
            </p>
            <Button onClick={() => setLocation("/")} className="w-full">
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (countdown.isExpired && registration.matchStatus === "pending") {
    return (
      <>
        <NoMatchScreen
          poolTitle={registration.poolTitle}
          onNotify={() =>
            toast({
              title: "安排上了",
              description: "有相似新局时，我们会优先提醒你。",
            })
          }
          onBrowse={() => setLocation("/")}
          onBack={() => setLocation("/events")}
          recommendations={noMatchRecommendations}
          originalBudget={registration.budgetRange?.[0] ?? null}
          onJoinRecommendation={(poolId) => {
            const nextPool = recommendedPools.find((pool) => pool.id === poolId) ?? null;
            setRecoverJoinPool(nextPool);
          }}
        />

        {recoverJoinPool && (
          <JoinEventPoolSheet
            open={Boolean(recoverJoinPool)}
            onOpenChange={(open) => {
              if (!open) {
                setRecoverJoinPool(null);
              }
            }}
            poolData={{
              poolId: recoverJoinPool.id,
              title: recoverJoinPool.title,
              date: formatDateInHongKong(recoverJoinPool.dateTime, "full"),
              area: recoverJoinPool.district,
              city: recoverJoinPool.city,
              eventType: recoverJoinPool.eventType === "酒局" ? "酒局" : "饭局",
              registrationCount: recoverJoinPool.registrationCount,
            }}
            initialPreferences={rejoinPreferences}
          />
        )}
      </>
    );
  }

  // ── Pending (waiting) state: full-screen MatchingWaitingScreen ──────────────
  if (registration.matchStatus === "pending") {
    return (
      <>
        <MatchingWaitingScreen
          poolTitle={registration.poolTitle}
          filledCount={poolStats?.currentFill ?? 0}
          minGroupSize={poolStats?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE}
          maxGroupSize={poolStats?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE}
          onRefresh={() => {
            queryClient.invalidateQueries({
              queryKey: ["/api/event-pools", registration.poolId, "group-fill"],
            });
          }}
          onInvite={handleInvite}
          onBrowse={() => setLocation("/")}
          onCancel={handleCancel}
          isCancelling={cancelMutation.isPending}
          onBack={() => setLocation("/events")}
          newMemberJoined={newMemberJoined}
          newMemberArchetype={newMemberArchetype}
          userArchetype={userArchetype}
          archetypes={livePoolArchetypes}
          archetypeDistribution={liveArchetypeDistribution}
        />

        {/* Celebration overlays still needed when a match arrives while waiting */}
        {matchData && (
          <MatchCelebrationOverlay
            isVisible={showMatchCelebration}
            onContinue={handleCelebrationContinue}
          />
        )}
        {showRevealAnimation && groupMembersData && !isLoadingGroupData && (
          <MatchSuccessSheet
            members={groupMembersData.members.map((m) => ({
              userId: m.userId,
              displayName: m.displayName,
              archetype: m.archetype,
              age: m.age,
              topInterests: m.topInterests,
              primaryInterests: m.primaryInterests,
              socialTag: m.socialTag,
              educationLevel: m.educationLevel,
              industry: m.industry,
              gender: m.gender,
              relationshipStatus: m.relationshipStatus,
              children: m.children,
              hometownRegionCity: m.hometownRegionCity,
              hometownAffinityOptin: m.hometownAffinityOptin,
            }))}
            currentUser={currentUserContext}
            onDismiss={handleRevealContinue}
          />
        )}
        {themeData && (
          <EventThemeTitleReveal
            isVisible={showThemeReveal}
            eventThemeTitle={themeData.eventThemeTitle}
            themeTagline={themeData.themeTagline}
            themeEmoji={themeData.themeEmoji}
            themeHighlights={themeData.themeHighlights || []}
            themeVibe={themeData.themeVibe || 'playful'}
            onClose={handleCloseThemeReveal}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 safe-area-bottom">
      {/* Ambient glow effects */}
      <div 
        className="fixed top-0 left-0 w-[300px] h-[300px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(224, 170, 255, 0.4) 0%, transparent 70%)",
          transform: "translate(-100px, -100px)",
        }}
      />
      <div 
        className="fixed bottom-0 right-0 w-[400px] h-[400px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(123, 44, 191, 0.1) 0%, transparent 70%)",
          transform: "translate(100px, 150px)",
        }}
      />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/events")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="ml-3 flex-1">
            <h1 className="font-semibold text-base line-clamp-1">
              {registration.poolTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              {formatDateInHongKong(registration.poolDateTime, 'full')}
            </p>
          </div>
        </div>
      </div>

      <div className="relative px-4 py-6 space-y-6 z-10">
        {groupDataError && (
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="p-4 text-sm text-amber-900">
              {groupDataError}
            </CardContent>
          </Card>
        )}
        {/* Main matching card - only reached in matched state */}
        <Card className="relative overflow-hidden">
          {/* Status ribbon badge */}
          <div className="absolute top-4 right-4 z-10">
            <Badge 
              className="bg-green-500 hover:bg-green-600 shadow-lg"
              style={{
                animation: "slideInRight 0.5s ease-out",
              }}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              ✅ 组队成功
            </Badge>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Mascot animation area */}
            {groupMembersData ? (
              <ArchetypeOrbit
                archetypes={groupMembersData.members.map(m => m.archetype || '')}
                size="medium"
                animated={false}
              />
            ) : (
              userArchetypeAvatar && (
                <div className="relative h-48 flex items-center justify-center">
                  <img 
                    src={userArchetypeAvatar} 
                    alt="你的人格原型" 
                    className="h-32 w-32 object-contain"
                    style={{ animation: "bounce 1s ease-in-out" }}
                  />
                </div>
              )
            )}

            {/* Status text */}
            <div className="text-center space-y-2">
              <h2 className="text-lg font-black">
                你的小队已组好，准备解锁这场相遇
              </h2>
              <p className="text-sm text-muted-foreground font-medium">
                我们已为你锁定同组伙伴，活动细节会按时间逐步揭晓。
              </p>
            </div>

            {/* Countdown timer */}
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">距离活动开始</p>
              <p className="text-2xl font-black text-primary">
                {countdown.days > 0 && `${countdown.days}天 `}
                {String(countdown.hours).padStart(2, '0')}:
                {String(countdown.minutes).padStart(2, '0')}:
                {String(countdown.seconds).padStart(2, '0')}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                活动信息将在开始前24小时揭晓
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">匹配进度</span>
                <span className="text-muted-foreground">
                  {poolStats?.currentFill || 0}/{poolStats?.minGroupSize || DEFAULT_MIN_GROUP_SIZE} 人已就绪
                </span>
              </div>
              <div className="relative">
                <Progress 
                  value={100}
                  className="h-3"
                  style={{
                    transition: "all 0.8s ease-in-out",
                  }}
                />
                {/* User archetype avatar as progress marker */}
                {userArchetypeAvatar && (
                  <div 
                    className="absolute top-1/2 transform -translate-y-1/2"
                    style={{
                      left: "95%",
                      transition: "left 0.8s ease-in-out",
                    }}
                  >
                    <img 
                      src={userArchetypeAvatar} 
                      alt="进度标记" 
                      className="h-6 w-6 object-contain rounded-full bg-white border-2 border-primary"
                    />
                  </div>
                )}
              </div>
              <p className="text-sm text-center font-medium text-primary">组队完成！🎉</p>
            </div>
          </CardContent>
        </Card>

        {/* P0-2: Group members (桌友) reveal section */}
        {registration.matchStatus === "matched" && registration.assignedGroupId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.2 }}
          >
            <Card className="relative overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">🎉 你的桌友来了！</h3>
                  <Badge className="bg-green-500 hover:bg-green-600">已组队</Badge>
                </div>

                {/* Horizontal scrolling member cards */}
                <div className="overflow-x-auto -mx-2 px-2">
                  <div className="flex gap-3 pb-2">
                    {groupMembers && groupMembers.length > 0 ? (
                      groupMembers.map((member, index) => {
                        const chemistryBadge = getChemistryBadge(member.chemistryScore);
                        const memberAvatar = member.archetype
                          ? getArchetypeAvatar(member.archetype)
                          : null;

                        return (
                          <motion.div
                            key={member.userId}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 25,
                              delay: index * 0.1,
                            }}
                            className="flex-shrink-0 w-32"
                          >
                            <Card className="border-2 border-muted">
                              <CardContent className="p-4 space-y-2 flex flex-col items-center">
                                {/* Avatar */}
                                <div className="relative">
                                  {memberAvatar ? (
                                    <img
                                      src={memberAvatar}
                                      alt={member.displayName}
                                      className="h-16 w-16 rounded-full object-contain bg-muted"
                                    />
                                  ) : (
                                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                                      {member.displayName.slice(0, 2)}
                                    </div>
                                  )}
                                </div>

                                {/* Name */}
                                <p className="text-sm font-bold text-center line-clamp-1">
                                  {member.displayName.length > 4
                                    ? member.displayName.slice(0, 4)
                                    : member.displayName}
                                </p>

                                {/* Archetype */}
                                {member.archetype && (
                                  <p className="text-xs text-muted-foreground text-center line-clamp-1">
                                    {member.archetype}
                                  </p>
                                )}

                                {/* Chemistry badge */}
                                <Badge
                                  className={`text-xs px-2 py-0.5 ${chemistryBadge.color}`}
                                  variant="secondary"
                                >
                                  {chemistryBadge.emoji} {chemistryBadge.label}
                                </Badge>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })
                    ) : (
                      // Skeleton loader
                      [1, 2, 3].map((i) => (
                        <div key={i} className="flex-shrink-0 w-32">
                          <Card className="border-2 border-muted">
                            <CardContent className="p-4 space-y-2 flex flex-col items-center">
                              <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
                              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                              <div className="h-5 w-12 bg-muted animate-pulse rounded-full" />
                            </CardContent>
                          </Card>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* P0-1: Enhanced venue reveal card */}
        <Card 
          className={`relative overflow-hidden ${
            isVenueUnlocked ? "ring-2 ring-green-400 shadow-lg shadow-green-200" : ""
          }`}
          style={{
            transition: "all 0.5s ease-in-out",
          }}
        >
          {/* P0-1: Green badge when unlocked */}
          {isVenueUnlocked && (
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.3 }}
              className="absolute top-3 right-3 z-10"
            >
              <Badge className="bg-green-500 hover:bg-green-600 text-white shadow-lg">
                ✅ 场地已揭晓
              </Badge>
            </motion.div>
          )}

          <CardContent className="p-0">
            {/* Map background with flip animation */}
            <motion.div
              initial={false}
              animate={{
                rotateY: isVenueUnlocked ? 0 : 90,
              }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="h-32 bg-gradient-to-br from-primary/10 to-secondary/10 relative"
              style={{
                filter: isVenueUnlocked ? "blur(0px)" : "blur(8px)",
                transition: "filter 0.5s ease-in-out",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Mock map pattern */}
              <div className="absolute inset-0 opacity-20">
                <svg width="100%" height="100%">
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>

              {/* P0-1: Lock overlay with pulse animation */}
              {!isVenueUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <div className="text-center">
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.7, 1, 0.7],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    </motion.div>
                    <p className="text-sm font-semibold">🔒 活动场地将在 24 小时前揭晓</p>
                  </div>
                </div>
              )}

              {/* P0-1: Unlocked venue info with flip reveal */}
              {isVenueUnlocked && (
                <motion.div
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    duration: 0.6,
                  }}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className="text-center space-y-2 p-4">
                    <MapPin className="h-6 w-6 mx-auto text-primary" />
                    <p className="text-sm font-semibold">
                      {registration.venueName || `${registration.poolCity} · ${registration.poolDistrict}`}
                    </p>
                    {registration.venueAddress && (
                      <p className="text-xs text-muted-foreground">{registration.venueAddress}</p>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        const address = registration.venueAddress || `${registration.poolCity} ${registration.poolDistrict}`;
                        window.open(
                          `https://uri.amap.com/marker?address=${encodeURIComponent(address)}`,
                          '_blank',
                          'noopener,noreferrer',
                        );
                      }}
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      到这去
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        {/* P0-3: Matched state without assignedGroupId - show loading */}
        {!registration.assignedGroupId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="space-y-3"
          >
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <div className="h-12 w-12 mx-auto">
                  <RefreshCw className="h-12 w-12 text-primary animate-spin" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">小组信息准备中</h3>
                  <p className="text-sm text-muted-foreground">
                    正在为你分配最佳小组，马上就好...
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Matched state: View group button + P1-3: Ice-breaker CTA */}
        {registration.assignedGroupId && (
          <div className="space-y-3">
            <Button 
              className="w-full"
              size="lg"
              onClick={() => {
                setLocation(`/pool-groups/${registration.assignedGroupId}`);
              }}
            >
              查看小组成员
            </Button>

            {/* P1-3: Ice-breaker CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.2 }}
            >
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => {
                  setLocation(`/icebreaker-game?groupId=${registration.assignedGroupId}`);
                }}
              >
                <Gamepad2 className="h-5 w-5 mr-2" />
                开始破冰游戏 🎮
              </Button>
            </motion.div>
          </div>
        )}
      </div>

      {/* CSS-only animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; transform: translateY(-10px); }
          10%, 90% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>

      {/* Match celebration overlay */}
      {matchData && (
        <MatchCelebrationOverlay
          isVisible={showMatchCelebration}
          onContinue={handleCelebrationContinue}
        />
      )}

      {/* Premium Match Success Sheet */}
      {showRevealAnimation && groupMembersData && !isLoadingGroupData && (
        <MatchSuccessSheet
          members={groupMembersData.members.map((m) => ({
            userId: m.userId,
            displayName: m.displayName,
            archetype: m.archetype,
            age: m.age,
            topInterests: m.topInterests,
            primaryInterests: m.primaryInterests,
            socialTag: m.socialTag,
            educationLevel: m.educationLevel,
            industry: m.industry,
            gender: m.gender,
            relationshipStatus: m.relationshipStatus,
            children: m.children,
            hometownRegionCity: m.hometownRegionCity,
            hometownAffinityOptin: m.hometownAffinityOptin,
          }))}
          currentUser={currentUserContext}
          onDismiss={handleRevealContinue}
        />
      )}

      {/* Theme title reveal */}
      {themeData && (
        <EventThemeTitleReveal
          isVisible={showThemeReveal}
          eventThemeTitle={themeData.eventThemeTitle}
          themeTagline={themeData.themeTagline}
          themeEmoji={themeData.themeEmoji}
          themeHighlights={themeData.themeHighlights || []}
          themeVibe={themeData.themeVibe || 'playful'}
          onClose={handleCloseThemeReveal}
        />
      )}
    </div>
  );
}
