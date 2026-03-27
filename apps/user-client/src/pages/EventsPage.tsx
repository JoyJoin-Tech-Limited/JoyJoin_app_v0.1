import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import PendingMatchCard from "@/components/PendingMatchCard";
import MatchedEventCard from "@/components/MatchedEventCard";
import CompletedEventCard from "@/components/CompletedEventCard";
import PoolRegistrationCard from "@/components/PoolRegistrationCard";
import ReunionInviteCard from "@/components/ReunionInviteCard";
import SlidingTabs from "@/components/SlidingTabs";
import MatchCelebrationOverlay from "@/components/MatchCelebrationOverlay";
import EventThemeTitleReveal from "@/components/EventThemeTitleReveal";
import { useState, useEffect, useCallback, useRef } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";
import { useWebSocket } from "@/hooks/useWebSocket";
import { invalidateCacheForEvent } from "@/lib/cacheInvalidation";
import type { BlindBoxEvent, EventFeedback } from "@shared/schema";
import type { EventThemeTitleRevealedData, PoolMatchedData } from "@shared/wsEvents";

interface ReunionInvite {
  responseId: string;
  requestId: string;
  eventDescription: string;
  minParticipants: number;
  maxParticipants: number;
  currentAccepted: number;
  expiresAt: string;
  createdAt: string;
  status: string;
  originalEventId: string;
}

// 温度等级文字标签（无emoji）
function getTemperatureLabel(temperatureLevel: string): string {
  const labelMap: Record<string, string> = {
    "fire": "超火热",
    "warm": "很温暖",
    "mild": "刚刚好",
    "cold": "较冷清"
  };
  return labelMap[temperatureLevel] || "";
}

interface PoolRegistration {
  id: string;
  poolId: string;
  matchStatus: "pending" | "matched" | "completed";
  assignedGroupId: string | null;
  matchScore: number | null;
  registeredAt: string;
  poolTitle: string;
  poolEventType: string;
  poolCity: string;
  poolDistrict: string;
  poolDateTime: string;
  poolStatus: string;
  budgetRange: string[];
  preferredLanguages: string[];
  eventIntent: string[];
  invitationRole?: "inviter" | "invitee" | null;
  relatedUserName?: string | null;
}

// Animation timing constants
const MATCH_CELEBRATION_DURATION_MS = 2000;

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const markAsRead = useMarkNotificationsAsRead();
  const { subscribe } = useWebSocket();

  // State for match celebration and event theme title reveal
  const [showMatchCelebration, setShowMatchCelebration] = useState(false);
  const [matchData, setMatchData] = useState<PoolMatchedData | null>(null);
  const [showThemeReveal, setShowThemeReveal] = useState(false);
  const [themeData, setThemeData] = useState<EventThemeTitleRevealedData | null>(null);

  // Ref to store timeout for match celebration auto-dismiss
  const matchCelebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stable callback for closing theme reveal
  const handleCloseThemeReveal = useCallback(() => {
    setShowThemeReveal(false);
  }, []);

  // 异步清理通知 - 不阻塞UI (100ms后执行)
  useEffect(() => {
    const timer = setTimeout(() => {
      markAsRead.mutate('activities');
    }, 100);
    return () => clearTimeout(timer);
  }, [markAsRead]);

  // WebSocket实时更新订阅（毫秒级响应）
  useEffect(() => {
    const unsubscribeMatched = subscribe('EVENT_MATCHED', async (message) => {
      console.log('[User] Event matched:', message);
      await invalidateCacheForEvent(message);
      
      const matchData = message.data as any;
      toast({
        title: "匹配成功！",
        description: `你的活动已成功匹配，地点：${matchData.restaurantName || '未知'}`,
      });
      
      setActiveTab("active");
    });

    const unsubscribePoolMatched = subscribe('POOL_MATCHED', async (message) => {
      console.log('[User] Pool matched:', message);
      
      const poolData = message.data as PoolMatchedData;
      setMatchData(poolData);
      setShowMatchCelebration(true);
      
      // Clear any existing timeout before setting a new one
      if (matchCelebrationTimeoutRef.current) {
        clearTimeout(matchCelebrationTimeoutRef.current);
      }
      
      // Auto-dismiss match celebration
      matchCelebrationTimeoutRef.current = setTimeout(() => {
        setShowMatchCelebration(false);
      }, MATCH_CELEBRATION_DURATION_MS);
      
      await queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
      setActiveTab("active");
    });

    const unsubscribeThemeTitle = subscribe('EVENT_THEME_TITLE_REVEALED', async (message) => {
      console.log('[User] Event theme title revealed:', message);
      
      const themeTitleData = message.data as EventThemeTitleRevealedData;
      setThemeData(themeTitleData);
      setShowThemeReveal(true);
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 100, 50]);
      }
      
      await queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
    });

    const unsubscribeStatus = subscribe('EVENT_STATUS_CHANGED', async (message) => {
      console.log('[User] Event status changed:', message);
      await invalidateCacheForEvent(message);
      
      const statusData = message.data as any;
      if (statusData.newStatus === 'completed') {
        toast({
          title: "活动已完成",
          description: "期待你的反馈！",
        });
        setActiveTab("completed");
      } else if (statusData.newStatus === 'canceled') {
        toast({
          title: "活动已取消",
          description: statusData.reason || "活动已被取消",
          variant: "destructive",
        });
      }
    });

    const unsubscribeCompleted = subscribe('EVENT_COMPLETED', async (message) => {
      console.log('[User] Event completed:', message);
      await invalidateCacheForEvent(message);
    });

    return () => {
      // Clean up timeout on unmount
      if (matchCelebrationTimeoutRef.current) {
        clearTimeout(matchCelebrationTimeoutRef.current);
      }
      
      unsubscribeMatched();
      unsubscribePoolMatched();
      unsubscribeThemeTitle();
      unsubscribeStatus();
      unsubscribeCompleted();
    };
  }, [subscribe, toast, queryClient]);

  // 客户端永久缓存 - 毫秒级加载
  const { data: events, isLoading, isError: isEventsError, refetch: refetchEvents } = useQuery<Array<BlindBoxEvent>>({
    queryKey: ["/api/my-events"],
  });

  // 客户端永久缓存 - 毫秒级加载
  const { data: poolRegistrations, isLoading: isLoadingPoolRegistrations, isError: isPoolRegistrationsError, refetch: refetchPoolRegistrations } = useQuery<Array<PoolRegistration>>({
    queryKey: ["/api/my-pool-registrations"],
  });

  // 客户端永久缓存 - 毫秒级加载
  const { data: feedbacks } = useQuery<Array<EventFeedback>>({
    queryKey: ["/api/my-feedbacks"],
  });

  // 待响应的再约邀请
  const { data: reunionInvites } = useQuery<Array<ReunionInvite>>({
    queryKey: ["/api/reunions/received"],
  });

  const cancelMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest("POST", `/api/blind-box-events/${eventId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
      toast({
        title: "已取消",
        description: "活动已取消，费用将原路退回",
      });
    },
    onError: (error) => {
      toast({
        title: "取消失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pendingEvents = events?.filter(e => e.status === "pending_match") || [];
  const matchedEvents = events?.filter(e => e.status === "matched") || [];
  const completedEvents = events?.filter(e => e.status === "completed") || [];

  const pendingPoolRegistrations = poolRegistrations?.filter(r => r.matchStatus === "pending") || [];
  const matchedPoolRegistrations = poolRegistrations?.filter(r => r.matchStatus === "matched") || [];
  const completedPoolRegistrations = poolRegistrations?.filter(r => r.matchStatus === "completed") || [];

  const totalActive = pendingEvents.length + matchedEvents.length + pendingPoolRegistrations.length + matchedPoolRegistrations.length;
  const totalCompleted = completedEvents.length + completedPoolRegistrations.length;

  if (isLoading || isLoadingPoolRegistrations) {
    return (
      <div className="min-h-screen bg-background pb-16 flex flex-col">
        <MobileHeader title="活动" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (isEventsError || isPoolRegistrationsError) {
    return (
      <div className="min-h-screen bg-background pb-16 flex flex-col">
        <MobileHeader title="活动" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full border border-dashed rounded-2xl bg-muted/20 p-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold">活动状态加载失败</h2>
              <p className="text-sm text-muted-foreground">请重试，或先返回发现页继续浏览活动。</p>
            </div>
            <button
              type="button"
              onClick={() => {
                refetchEvents();
                refetchPoolRegistrations();
              }}
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              重新加载
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const tabs = [
    { value: "active", label: "进行中", count: totalActive },
    { value: "completed", label: "已完成", count: totalCompleted },
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      <MobileHeader title="活动" />
      
      <div className="py-4 space-y-4">
        {/* 再约邀请 - 有邀请时显示在最顶部 */}
        {reunionInvites && reunionInvites.length > 0 && (
          <div className="px-4 space-y-3">
            {reunionInvites.map(invite => (
              <ReunionInviteCard 
                key={invite.responseId} 
                invite={invite}
                onResponded={() => queryClient.invalidateQueries({ queryKey: ['/api/reunions/received'] })}
              />
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground px-4">
          展示你已报名的盲盒与已匹配活动
        </p>

        <SlidingTabs 
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(value) => setActiveTab(value as typeof activeTab)}
        />

        <div className="px-4">
          {activeTab === "active" && (
            <div className="space-y-3">
              {totalActive === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4">
                    <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center">
                      <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2">暂无进行中的活动</h3>
                  <p className="text-sm text-muted-foreground">去发现页报名新活动吧</p>
                </div>
              ) : (
                <>
                  {pendingPoolRegistrations.map(registration => (
                    <PoolRegistrationCard 
                      key={registration.id} 
                      registration={registration} 
                    />
                  ))}
                  {pendingEvents.map(event => (
                    <PendingMatchCard 
                      key={event.id} 
                      event={event} 
                      onCancel={(eventId) => cancelMutation.mutate(eventId)}
                    />
                  ))}
                  {matchedPoolRegistrations.map(registration => (
                    <PoolRegistrationCard 
                      key={registration.id} 
                      registration={registration} 
                    />
                  ))}
                  {matchedEvents.map(event => (
                    <MatchedEventCard key={event.id} event={event} />
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === "completed" && (
            <div className="space-y-3">
              {totalCompleted === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4">
                    <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center">
                      <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2">暂无已完成的活动</h3>
                  <p className="text-sm text-muted-foreground">参加过的活动会显示在这里</p>
                </div>
              ) : (
                <>
                  {completedPoolRegistrations.map(registration => (
                    <PoolRegistrationCard 
                      key={registration.id} 
                      registration={registration} 
                    />
                  ))}
                  {completedEvents.map(event => {
                    const feedback = feedbacks?.find(f => f.eventId === event.id);
                    return (
                      <CompletedEventCard 
                        key={event.id} 
                        event={event} 
                        feedback={feedback}
                      />
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />

      {/* Stage 1: Quick celebration (2s auto-dismiss) */}
      {matchData && (
        <MatchCelebrationOverlay
          isVisible={showMatchCelebration}
          onContinue={() => setShowMatchCelebration(false)}
        />
      )}

      {/* Stage 2: Gold foil event theme title reveal */}
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
