import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Clock, MapPin, DollarSign, Users, Phone, Navigation, AlertCircle, Sparkles, ChevronRight } from "lucide-react";
import type { BlindBoxEvent } from "@shared/schema";
import { getCurrencySymbol } from "@/lib/currency";
import { calculateAge } from "@shared/utils";
import IcebreakerCardsSheet from "@/components/IcebreakerCardsSheet";
import PostMatchEventCard from "@/components/PostMatchEventCard";
import ReunionButton from "@/components/ReunionButton";
import MatchRevealAnimation from "@/components/MatchRevealAnimation";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { invalidateCacheForEvent } from "@/lib/cacheInvalidation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { trackAnimationEvent } from "@/lib/animationAnalytics";
import { preloadArchetypeImages } from "@/hooks/usePreloadImages";
import { archetypeAvatars } from "@/lib/archetypeAvatars";
import { detectDevice } from "@/lib/deviceDetection";
import { getOrAssignVariant } from "@/lib/abTestingFramework";

interface AnimationStatus {
  hasViewed: boolean;
  shouldShowAnimation: boolean;
  eventTitle?: string;
  eventType?: string;
  participants?: Array<{
    userId: string;
    displayName: string;
    archetype: string;
    compatibilityScore?: number;
  }>;
}

export default function BlindBoxEventDetailPage() {
  const { eventId } = useParams();
  const [, setLocation] = useLocation();
  const { user, isLoading: isUserLoading } = useAuth();
  const { subscribe } = useWebSocket();
  const { toast } = useToast();
  const { playSound } = useSoundEffects();
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationDecisionMade, setAnimationDecisionMade] = useState(false);
  const [allowReplay, setAllowReplay] = useState(false);
  const [icebreakerSheetOpen, setIcebreakerSheetOpen] = useState(false);
  const [hasAutoShownIcebreaker, setHasAutoShownIcebreaker] = useState(false);

  const { data: event, isLoading } = useQuery<BlindBoxEvent>({
    queryKey: ["/api/blind-box-events", eventId],
  });

  // Query animation status for matched events
  const { data: animationStatus } = useQuery<AnimationStatus>({
    queryKey: ["/api/events", eventId, "animation-status"],
    enabled: !!eventId && event?.status === "matched",
  });

  // Mark animation as viewed mutation with error handling
  const markAnimationViewedMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/events/${eventId}/mark-animation-viewed`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "animation-status"] });
    },
    onError: (error) => {
      console.error("Failed to mark animation as viewed:", error);
      toast({
        title: "保存状态失败",
        description: "下次访问可能会再次看到动画",
        variant: "destructive",
      });
    },
  });

  // Trigger animation on first view of matched event
  // Guard: Wait for user data to load before making any decision
  useEffect(() => {
    // Skip if still loading user data or decision already made
    if (isUserLoading || animationDecisionMade) return;
    
    // Skip if animation status not ready or event not matched
    if (!animationStatus?.shouldShowAnimation || animationStatus.hasViewed || event?.status !== "matched") {
      return;
    }
    
    // Verify all required data exists for animation
    const hasRequiredUserData = user?.primaryRole && user?.displayName;
    const hasParticipants = animationStatus.participants && animationStatus.participants.length > 0;
    const hasEventMetadata = animationStatus.eventTitle;
    
    // Mark decision as made to prevent re-runs
    setAnimationDecisionMade(true);
    
    if (hasRequiredUserData && hasParticipants && hasEventMetadata) {
      setShowAnimation(true);
    } else {
      // Skip animation if any required data is missing - mark as viewed to prevent future attempts
      console.warn("Skipping animation: required data incomplete", { 
        hasArchetype: !!user?.primaryRole, 
        hasDisplayName: !!user?.displayName,
        hasParticipants: !!hasParticipants,
        hasEventMetadata: !!hasEventMetadata,
      });
      // Use async IIFE to properly await the mutation
      (async () => {
        try {
          await markAnimationViewedMutation.mutateAsync();
        } catch (error) {
          console.error("Failed to mark animation as viewed in skip path:", error);
        }
      })();
    }
  }, [isUserLoading, animationDecisionMade, animationStatus, event?.status, user?.primaryRole, user?.displayName]);

  const handleAnimationComplete = async () => {
    // Mark animation as viewed before closing
    try {
      playSound('match_complete');
      await markAnimationViewedMutation.mutateAsync();
      trackAnimationEvent({
        eventId: eventId || '',
        userId: user?.id || '',
        eventType: 'complete',
        device: detectDevice(),
        abTestVariant: getOrAssignVariant(),
      });
    } catch (error) {
      console.error("Failed to save animation state, may replay on next visit");
    }
    setShowAnimation(false);
    setAllowReplay(true);
  };

  const handleAnimationSkip = async () => {
    // Mark animation as viewed before closing
    try {
      await markAnimationViewedMutation.mutateAsync();
      trackAnimationEvent({
        eventId: eventId || '',
        userId: user?.id || '',
        eventType: 'skip',
        device: detectDevice(),
        abTestVariant: getOrAssignVariant(),
      });
    } catch (error) {
      console.error("Failed to save animation state, may replay on next visit");
    }
    setShowAnimation(false);
    setAllowReplay(true);
  };

  const handleAnimationReplay = () => {
    trackAnimationEvent({
      eventId: eventId || '',
      userId: user?.id || '',
      eventType: 'replay',
      device: detectDevice(),
      abTestVariant: getOrAssignVariant(),
    });
    setShowAnimation(true);
  };

  const handleAnimationShare = () => {
    trackAnimationEvent({
      eventId: eventId || '',
      userId: user?.id || '',
      eventType: 'share',
      device: detectDevice(),
      abTestVariant: getOrAssignVariant(),
    });
    // Share functionality would go here
    playSound('team_gather'); // Audio feedback
    toast({
      title: "分享成功！",
      description: "🎉 邀请好友一起参加这场有趣的活动吧！",
      variant: "default",
    });
  };

  // Preload archetype images on page mount for better animation performance
  useEffect(() => {
    preloadArchetypeImages(archetypeAvatars).catch(err => 
      console.debug('Image preload failed (non-critical):', err)
    );
  }, []);

  // Smart timing: Auto-show icebreaker sheet 1 hour before event
  useEffect(() => {
    if (!event?.dateTime || event.status !== "matched") return;
    
    // Check localStorage first to prevent any duplicate logic
    const autoShownKey = `icebreaker_auto_shown_${eventId}`;
    const hasShownBefore = localStorage.getItem(autoShownKey);
    
    if (hasShownBefore || hasAutoShownIcebreaker) {
      if (!hasAutoShownIcebreaker) {
        setHasAutoShownIcebreaker(true);
      }
      return;
    }
    
    const eventTime = new Date(event.dateTime).getTime();
    const now = Date.now();
    const oneHourBefore = eventTime - (60 * 60 * 1000);
    const threeHoursBefore = eventTime - (3 * 60 * 60 * 1000);
    
    // Only auto-show if within 1 hour before event and not past event time
    if (now >= oneHourBefore && now < eventTime) {
      // Delay slightly to not interrupt page load
      const timer = setTimeout(() => {
        setIcebreakerSheetOpen(true);
        setHasAutoShownIcebreaker(true);
        localStorage.setItem(autoShownKey, "true");
      }, 1500);
      return () => clearTimeout(timer);
    }
    
    // If between 3 hours and 1 hour before, show a toast reminder (only once per session)
    if (now >= threeHoursBefore && now < oneHourBefore) {
      const toastShownKey = `icebreaker_toast_shown_${eventId}`;
      if (!sessionStorage.getItem(toastShownKey)) {
        toast({
          title: "小悦提醒",
          description: "活动即将开始，查看小悦为你们准备的话题吧",
        });
        sessionStorage.setItem(toastShownKey, "true");
      }
    }
  }, [event?.dateTime, event?.status, eventId, hasAutoShownIcebreaker, toast]);

  // WebSocket实时更新订阅（仅订阅当前活动）
  useEffect(() => {
    if (!eventId) return;

    const unsubscribeMatched = subscribe('EVENT_MATCHED', async (message) => {
      if (message.eventId !== eventId) return;
      
      console.log('[Detail] Event matched:', message);
      await invalidateCacheForEvent(message);
      
      const matchData = message.data as any;
      toast({
        title: "匹配成功！",
        description: `活动已成功匹配，地点：${matchData.restaurantName || '未知'}`,
      });
    });

    const unsubscribeStatus = subscribe('EVENT_STATUS_CHANGED', async (message) => {
      if (message.eventId !== eventId) return;
      
      console.log('[Detail] Event status changed:', message);
      await invalidateCacheForEvent(message);
      
      const statusData = message.data as any;
      if (statusData.newStatus === 'completed') {
        toast({
          title: "活动已完成",
          description: "期待你的反馈！",
        });
      } else if (statusData.newStatus === 'canceled') {
        toast({
          title: "活动已取消",
          description: statusData.reason || "活动已被取消",
          variant: "destructive",
        });
      }
    });

    const unsubscribeUserJoined = subscribe('USER_JOINED', async (message) => {
      if (message.eventId !== eventId) return;
      
      console.log('[Detail] User joined:', message);
      await invalidateCacheForEvent(message);
    });

    return () => {
      unsubscribeMatched();
      unsubscribeStatus();
      unsubscribeUserJoined();
    };
  }, [eventId, subscribe, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <div className="text-center py-12">
          <p className="text-muted-foreground">活动不存在</p>
        </div>
      </div>
    );
  }

  const currencySymbol = getCurrencySymbol(event.city as "香港" | "深圳");

  const formatDateTime = (dateTime: Date) => {
    const date = new Date(dateTime);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${weekday} ${hours}:${minutes}`;
  };

  const getCountdown = (dateTime: Date) => {
    const now = new Date();
    const eventDate = new Date(dateTime);
    const diff = eventDate.getTime() - now.getTime();
    
    if (diff <= 0) return "活动进行中";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `还剩 ${days}天 ${hours}小时`;
    } else {
      return `还剩 ${hours}小时`;
    }
  };

  const getParticipantInfo = () => {
    if (event.isGirlsNight) {
      return `${event.totalParticipants}人 Girls Night`;
    }
    if (event.maleCount && event.femaleCount) {
      return `${event.totalParticipants}人（${event.maleCount}男${event.femaleCount}女）`;
    }
    return `${event.totalParticipants}人`;
  };

  const handleNavigation = () => {
    if (event.restaurantLat && event.restaurantLng) {
      const restaurantName = encodeURIComponent(event.restaurantName || '目的地');
      
      // 深圳使用高德地图，香港使用Google Maps
      if (event.city === '深圳') {
        window.open(`https://uri.amap.com/navigation?to=${event.restaurantLng},${event.restaurantLat},${restaurantName}&mode=car&coordinate=gaode`, '_blank');
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${event.restaurantLat},${event.restaurantLng}`, '_blank');
      }
    }
  };

  return (
    <>
      {/* Match Reveal Animation - three-act storytelling experience */}
      {showAnimation && user && eventId && (
        <MatchRevealAnimation
          eventId={eventId}
          eventTitle={animationStatus?.eventTitle || event?.eventType || "活动"}
          eventType={animationStatus?.eventType || "饭局"}
          userArchetype={user.primaryRole || "开心柯基"}
          userName={user.displayName || "用户"}
          participants={animationStatus?.participants || []}
          onComplete={handleAnimationComplete}
          onSkip={handleAnimationSkip}
          onShare={handleAnimationShare}
          onReplay={allowReplay ? handleAnimationReplay : undefined}
        />
      )}
      
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
          <div className="flex items-center h-14 px-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/events")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="ml-2 font-semibold">活动详情</h1>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
        {/* 顶部摘要 */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold flex-1">{event.eventType}</h2>
                {event.isGirlsNight && (
                  <Badge className="bg-pink-500 hover:bg-pink-600 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Girls Night
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{formatDateTime(event.dateTime)}</p>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium text-primary">{getCountdown(event.dateTime)}</span>
              </div>
            </div>

            {(event.status === "matched" || event.status === "completed") && event.totalParticipants && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{getParticipantInfo()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 地点信息 (仅已匹配或已完成显示) */}
        {event && (event.status === "matched" || event.status === "completed") && event.restaurantName ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">地点信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">{event.restaurantName}</p>
                    <p className="text-sm text-muted-foreground">{event.restaurantAddress}</p>
                    <p className="text-xs text-muted-foreground">{event.city}•{event.district}</p>
                  </div>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleNavigation}
                data-testid="button-navigate"
              >
                <Navigation className="h-4 w-4 mr-2" />
                到这去
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* 预算与菜式 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">预算与菜式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{currencySymbol}{event.budgetTier}（人均AA）</span>
            </div>

            {event.cuisineTags && event.cuisineTags.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">菜式/酒类</p>
                <div className="flex flex-wrap gap-1.5">
                  {event.cuisineTags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Post-Match Event Card: Attendee Insights & Match Explanation */}
        {event && (event.status === "matched" || event.status === "completed") && event.matchedAttendees && Array.isArray(event.matchedAttendees) && event.matchedAttendees.length > 0 ? (
          <PostMatchEventCard 
            matchedAttendees={event.matchedAttendees as Array<{
              userId: string;
              displayName: string;
              archetype?: string;
              topInterests?: string[];
              industry?: string;
              ageVisible?: boolean;
              industryVisible?: boolean;
            }>}
            matchExplanation={event.matchExplanation || undefined}
            userInterests={(user?.interestsTop as string[] | undefined) || ["film_entertainment", "travel_exploration"]}
            userEducationLevel={user?.educationLevel || "Master's"}
            userIndustry={user?.industry || "科技"}
            userAge={user?.birthdate ? calculateAge(user.birthdate) : undefined}
            userGender={user?.gender || undefined}
            userRelationshipStatus={user?.relationshipStatus || "Single"}
            userChildren={user?.children || undefined}
            userStudyLocale={user?.studyLocale || "Overseas"}
            userOverseasRegions={user?.overseasRegions as string[] | undefined}
            userSeniority={user?.seniority || "Mid"}
            userFieldOfStudy={user?.fieldOfStudy || undefined}
            userLanguages={user?.languagesComfort as string[] | undefined}
            userHometownCountry={user?.hometownCountry || undefined}
            userHometownRegionCity={user?.hometownRegionCity || undefined}
          />
        ) : null}

        {/* 小悦话题入口按钮 (仅已匹配或已完成显示) */}
        {(event.status === "matched" || event.status === "completed") && eventId && (
          <>
            <button
              onClick={() => setIcebreakerSheetOpen(true)}
              className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-600 rounded-xl p-4 transition-all active:scale-[0.98] shadow-lg"
              data-testid="button-open-icebreaker"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-white/30">
                  <AvatarFallback className="bg-white/20 text-white text-sm font-medium">
                    小悦
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold text-sm">查看小悦精选话题</p>
                  <p className="text-white/70 text-xs">为你们准备的破冰话题</p>
                </div>
                <div className="flex items-center gap-1 text-white/80">
                  <Sparkles className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </button>
            
            <IcebreakerCardsSheet
              open={icebreakerSheetOpen}
              onOpenChange={setIcebreakerSheetOpen}
              eventId={eventId}
              eventType={event.eventType as "饭局" | "酒局" | "其他"}
              isGirlsNight={event.isGirlsNight || false}
            />
          </>
        )}

        {/* VIP一键再约 (仅已完成活动显示) */}
        {event.status === "completed" && eventId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">意犹未尽？</CardTitle>
            </CardHeader>
            <CardContent>
              <ReunionButton eventId={eventId} />
            </CardContent>
          </Card>
        )}

        {/* 规则与到场指南 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">规则与到场指南</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p>请提前10分钟到场</p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p>开局前24小时内不可退</p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p>迟到/缺席将影响信用分</p>
            </div>
          </CardContent>
        </Card>

        {/* 帮助与支持 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">帮助与支持</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" data-testid="button-contact-support">
              <Phone className="h-4 w-4 mr-2" />
              联系支持
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>
    </>
  );
}
