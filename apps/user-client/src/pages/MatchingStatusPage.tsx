import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  MapPin, 
  Lock, 
  UserPlus, 
  XCircle,
  Navigation,
  CheckCircle,
} from "lucide-react";
import { useCountdown } from "@/hooks/useCountdown";
import { usePoolRegistrationCancel } from "@/hooks/usePoolRegistrationCancel";
import { getArchetypeAvatar } from "@/lib/archetypeAdapter";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import MatchCelebrationOverlay from "@/components/MatchCelebrationOverlay";
import EventThemeTitleReveal from "@/components/EventThemeTitleReveal";
import type { PoolMatchedData, EventThemeTitleRevealedData } from "@shared/wsEvents";
import { formatDateInHongKong } from "@/lib/hongKongTime";

// Constants
const DEFAULT_MIN_GROUP_SIZE = 4;
const DEFAULT_MAX_GROUP_SIZE = 6;

interface PoolRegistration {
  id: string;
  poolId: string;
  matchStatus: "pending" | "matched" | "completed";
  assignedGroupId: string | null;
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
}

interface PoolStats {
  currentFill: number;
  minGroupSize: number;
  maxGroupSize: number;
  progress: number;
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

  // Progress update micro-interaction state
  const [newMemberJoined, setNewMemberJoined] = useState(false);
  const [newMemberArchetype, setNewMemberArchetype] = useState<string | null>(null);

  // Refs for timeout cleanup
  const matchTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const microInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch registration from shared cache
  const { data: poolRegistrations } = useQuery<Array<PoolRegistration>>({
    queryKey: ["/api/my-pool-registrations"],
  });

  const registration = poolRegistrations?.find(r => r.id === registrationId);

  // Fetch pool stats for progress
  const { data: poolStats } = useQuery<PoolStats>({
    queryKey: ["/api/event-pools", registration?.poolId, "group-fill"],
    enabled: !!registration?.poolId,
  });

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

  // WebSocket subscriptions
  useEffect(() => {
    const unsubscribePoolMatched = subscribe('POOL_MATCHED', async (message) => {
      const poolData = message.data as PoolMatchedData;
      
      // Guard: only react to matches for the currently viewed registration's pool
      if (!registration || poolData.poolId !== registration.poolId) {
        return;
      }

      console.log('[Analytics] matching_succeeded', {
        waitTimeSeconds: message.data?.waitTimeSeconds,
        groupSize: message.data?.groupSize,
        matchScore: message.data?.matchScore,
      });

      setMatchData(poolData);
      
      // In-page transition: progress → 100%, ribbon changes
      await queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
      
      // Clear any existing timeout
      if (matchTransitionTimeoutRef.current) {
        clearTimeout(matchTransitionTimeoutRef.current);
      }
      
      // Wait 1 second for visual transition
      matchTransitionTimeoutRef.current = setTimeout(() => {
        setShowMatchCelebration(true);
      }, 1000);
    });

    const unsubscribeRegistrationAdded = subscribe('POOL_REGISTRATION_ADDED', async (message) => {
      const data = message.data as any;
      
      console.log('[Analytics] matching_progress_updated', {
        oldProgress: poolStats?.progress,
        newProgress: data.currentGroupFill ? (data.currentGroupFill / (data.minGroupSize || 4)) * 100 : 0,
      });

      // Show "+1 新朋友加入！" micro-interaction
      setNewMemberJoined(true);
      setNewMemberArchetype(data.archetype || null);
      
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

      console.log('[User] Event theme title revealed:', message);
      
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

  // Analytics tracking
  useEffect(() => {
    if (registration) {
      console.log('[Analytics] matching_page_viewed', {
        registrationId: registration.id,
        poolId: registration.poolId,
        timeUntilEvent: countdown.totalMs,
      });
    }
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
    console.log('[Analytics] matching_cancel_confirmed', {
      registrationId: registration?.id,
    });

    cancelMutation.mutate(registration!.id, {
      onSuccess: () => {
        setLocation("/");
      },
    });
  };

  // Handle invite
  const handleInvite = async () => {
    console.log('[Analytics] matching_invite_tapped', {
      registrationId: registration?.id,
      progress: poolStats?.progress,
    });

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
        
        console.log('[Analytics] matching_invite_shared', {
          registrationId: registration?.id,
        });
      } catch (error) {
        // User cancelled or error
        console.log('[Analytics] matching_invite_cancelled');
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

  const getInviteButtonText = () => {
    const progress = poolStats?.progress || 0;
    if (progress < 50) return "邀请好友加速匹配 ⚡";
    if (progress >= 75) return "马上就好！分享给朋友一起来";
    return "再邀1人即可成局！";
  };

  // Loading state
  if (!registration) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
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
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold">本次活动未能成局</h2>
            <p className="text-sm text-muted-foreground">
              很遗憾，本次活动未达到最少人数要求。报名费用将原路退回。
            </p>
            <p className="text-sm font-medium">下次再来 💜</p>
            <Button onClick={() => setLocation("/")} className="w-full">
              探索更多活动
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
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
        {/* Main matching card */}
        <Card className="relative overflow-hidden">
          {/* Status ribbon badge */}
          <div className="absolute top-4 right-4 z-10">
            {registration.matchStatus === "matched" ? (
              <Badge 
                className="bg-green-500 hover:bg-green-600 shadow-lg"
                style={{
                  animation: "slideInRight 0.5s ease-out",
                }}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                ✅ 组队成功
              </Badge>
            ) : (
              <Badge 
                variant="secondary"
                className="bg-purple-500 hover:bg-purple-600 text-white shadow-lg"
              >
                <Lock className="h-3 w-3 mr-1" />
                🔒 活动解锁中
              </Badge>
            )}
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Mascot animation area */}
            <div className="relative h-48 flex items-center justify-center">
              {/* Main user archetype */}
              {userArchetypeAvatar && (
                <div className="relative z-10">
                  <img 
                    src={userArchetypeAvatar} 
                    alt="你的人格原型" 
                    className="h-32 w-32 object-contain"
                    style={{
                      animation: registration.matchStatus === "matched" 
                        ? "bounce 1s ease-in-out"
                        : "float 3s ease-in-out infinite",
                    }}
                  />
                </div>
              )}

              {/* Orbiting emoji circles */}
              <div 
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  animation: "spin 20s linear infinite",
                }}
              >
                {['🦊', '🐘', '🕷️', '⚙️'].map((emoji, idx) => (
                  <div
                    key={idx}
                    className="absolute text-2xl"
                    style={{
                      transform: `rotate(${idx * 90}deg) translateY(-80px)`,
                    }}
                  >
                    {emoji}
                  </div>
                ))}
              </div>

              {/* New member joined indicator */}
              {newMemberJoined && (
                <div 
                  className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium shadow-lg"
                  style={{
                    animation: "fadeInOut 2s ease-in-out",
                  }}
                >
                  +1 新朋友加入！
                  {newMemberArchetype && ` ${newMemberArchetype}`}
                </div>
              )}
            </div>

            {/* Status text */}
            <div className="text-center space-y-2">
              <h2 className="text-lg font-black">
                正在为你寻找 {poolStats?.minGroupSize || DEFAULT_MIN_GROUP_SIZE}-{poolStats?.maxGroupSize || DEFAULT_MAX_GROUP_SIZE} 人的完美契合小队...
              </h2>
              <p className="text-sm text-muted-foreground font-medium">
                匹配中，组队成功后你将收到通知。
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
                  value={
                    registration.matchStatus === "matched" 
                      ? 100 
                      : (poolStats?.progress || 0)
                  }
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
                      left: `${Math.min(
                        registration.matchStatus === "matched" ? 100 : (poolStats?.progress || 0),
                        95
                      )}%`,
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
            </div>
          </CardContent>
        </Card>

        {/* Locked venue card */}
        <Card 
          className="relative overflow-hidden"
          style={{
            transition: "all 0.5s ease-in-out",
          }}
        >
          <CardContent className="p-0">
            {/* Blurred map background */}
            <div 
              className="h-32 bg-gradient-to-br from-primary/10 to-secondary/10 relative"
              style={{
                filter: isVenueUnlocked ? "blur(0px)" : "blur(8px)",
                transition: "filter 0.5s ease-in-out",
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

              {/* Lock overlay */}
              {!isVenueUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <div className="text-center">
                    <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-semibold">🔒 目的地即将揭晓！</p>
                  </div>
                </div>
              )}

              {/* Unlocked venue info */}
              {isVenueUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-2 p-4">
                    <MapPin className="h-6 w-6 mx-auto text-primary" />
                    <p className="text-sm font-semibold">
                      {registration.poolCity} · {registration.poolDistrict}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        // Navigate to Google Maps or Amap
                        const address = `${registration.poolCity} ${registration.poolDistrict}`;
                        if (registration.poolCity === '深圳') {
                          window.open(`https://uri.amap.com/marker?address=${encodeURIComponent(address)}`, '_blank');
                        } else {
                          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
                        }
                      }}
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      到这去
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        {registration.matchStatus === "pending" && (
          <div className="space-y-3">
            {/* Dynamic invite text */}
            <p className="text-sm text-center font-medium text-primary">
              {getInviteButtonText()}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      console.log('[Analytics] matching_cancel_initiated', {
                        registrationId: registration.id,
                        progress: poolStats?.progress,
                      });
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    取消匹配
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认取消匹配？</AlertDialogTitle>
                    <AlertDialogDescription>
                      你确定要取消匹配吗？取消后需要重新报名才能参加此活动池。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? "取消中..." : "确认取消"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button 
                className="w-full"
                onClick={handleInvite}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                邀请好友
              </Button>
            </div>
          </div>
        )}

        {/* Matched state: View group button */}
        {registration.matchStatus === "matched" && registration.assignedGroupId && (
          <Button 
            className="w-full"
            size="lg"
            onClick={() => setLocation(`/pool-groups/${registration.assignedGroupId}`)}
          >
            查看小组成员
          </Button>
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
