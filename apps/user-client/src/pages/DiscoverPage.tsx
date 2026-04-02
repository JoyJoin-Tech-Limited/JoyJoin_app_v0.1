import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import BlindBoxEventCard from "@/components/BlindBoxEventCard";
import BlindBoxSection from "@/components/BlindBoxSection";
import HeroWelcome from "@/components/HeroWelcome";
import LocationPickerSheet from "@/components/LocationPickerSheet";
import { PromotionBannerCarousel } from "@/components/PromotionBannerCarousel";
import InviteFriendCard from "@/components/InviteFriendCard";
import JourneyProgressCard from "@/components/JourneyProgressCard";
import EventPoolDetailDrawer from "@/components/EventPoolDetailDrawer";
import JoinEventPoolSheet from "@/components/event-pool-registration/JoinEventPoolSheet";
import { CoachMarkBanner, ProfileCompletionNudge, XiaoyueFAB, PulsingIndicator } from "@/components/coach-marks";
import { ProfileEnrichmentCard } from "@/components/ProfileEnrichmentCard";
import LimitedBrowseBanner from "@/components/LimitedBrowseBanner";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { formatChineseDateOnly, extractChineseTime } from "@/lib/chineseDateTime";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { archetypeConfig } from "@/lib/archetypes";
import { getDiscoverJoinRoute, getJoinPoolIdFromUrl } from "@/lib/poolRegistrationRouting";

interface EventPool {
  id: string;
  title: string;
  description: string;
  eventType: "饭局" | "酒局" | "其他";
  city: "香港" | "深圳";
  district: string;
  dateTime: string;
  registrationDeadline: string;
  status: string;
  registrationCount: number;
  spotsLeft: number;
  genderRestriction?: string;
  sampleArchetypes?: string[];
  minGroupSize?: number;
  targetGroups?: number;
}

interface UserCoupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  validFrom: string | null;
  validUntil: string | null;
  applicableTo: string | null;
  remainingUses: number | null;
  usageCount: number;
  assignedToUser: boolean;
}

interface CouponResponse {
  count: number;
  coupons: UserCoupon[];
}

const LOCATION_STORAGE_KEY = "joyjoin_user_location";
const COACH_MARKS_STORAGE_KEY = "joyjoin_coach_marks_seen";

// Coach mark state interface
interface CoachMarkState {
  welcomeBanner?: boolean;
  eventTooltip?: boolean;
  xiaoyueTooltip?: boolean;
  profileNudge?: boolean;
}

// Safe localStorage read with SSR guard, with user profile fallback
// Note: Hong Kong areas are currently "coming soon", so default to Shenzhen
const getSavedLocation = (userCity?: string): { city: "香港" | "深圳"; area: string } => {
  // First check localStorage for user's explicit selection
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (saved) {
        const { city, area } = JSON.parse(saved);
        // Hong Kong areas are coming soon, fall back to Shenzhen if HK selected
        if (city === "香港") {
          return { city: "深圳", area: "南山区" };
        }
        return { 
          city: city === "深圳" ? city : "深圳", 
          area: area || "南山区"
        };
      }
    } catch {}
  }
  
  // Fall back to user's registered city from profile
  // Hong Kong areas are coming soon, so always default to Shenzhen
  return { city: "深圳", area: "南山区" };
};

// Get coach mark state from localStorage
const getCoachMarkState = (): CoachMarkState => {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(COACH_MARKS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

// Save coach mark state to localStorage
const saveCoachMarkState = (state: CoachMarkState) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COACH_MARKS_STORAGE_KEY, JSON.stringify(state));
  } catch {}
};

// Pure transformation: module-level so it's stable across renders (no component state deps).
function transformEventPool(pool: EventPool): {
  id: string;
  poolId: string;
  date: string;
  time: string;
  eventType: "饭局" | "酒局";
  area: string;
  city: "香港" | "深圳";
  mysteryTitle: string;
  isAA: boolean;
  isGirlsNight: boolean;
  registrationCount: number;
  sampleArchetypes: string[];
  registrationDeadline: string | undefined;
} | null {
  try {
    const chineseDate = formatChineseDateOnly(pool.dateTime);
    const chineseTime = extractChineseTime(pool.dateTime);
    const area = `${pool.city}•${pool.district}`;
    const mysteryTitle = pool.title || `神秘${pool.eventType}｜等你揭晓`;
    const isGirlsNight = pool.genderRestriction === '仅限女性' ||
                        pool.title?.toLowerCase().includes('girls') ||
                        pool.title?.includes('女性') ||
                        pool.title?.includes('闺蜜');

    return {
      id: pool.id,
      poolId: pool.id,
      date: chineseDate,
      time: chineseTime,
      eventType: (pool.eventType === "其他" ? "饭局" : pool.eventType) as "饭局" | "酒局",
      area,
      city: pool.city,
      mysteryTitle,
      isAA: true,
      isGirlsNight,
      registrationCount: pool.registrationCount || 0,
      sampleArchetypes: pool.sampleArchetypes || [],
      registrationDeadline: pool.registrationDeadline,
    };
  } catch (error) {
    console.error("Error transforming event pool:", pool, error);
    return null;
  }
}

export default function DiscoverPage() {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  
  // Use user's registered city as fallback when no localStorage selection exists
  const savedLocation = getSavedLocation(user?.currentCity ?? undefined);
  const [selectedCity, setSelectedCity] = useState<"香港" | "深圳">(savedLocation.city);
  const [selectedArea, setSelectedArea] = useState<string>(savedLocation.area);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  
  // Drawer state
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedPoolData, setSelectedPoolData] = useState<EventPool | null>(null);
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  
  // Coach marks state
  const [coachMarkState, setCoachMarkState] = useState<CoachMarkState>(getCoachMarkState);
  const [showEventTooltip, setShowEventTooltip] = useState(false);
  
  // Check if should show coach marks (not if user has seen guide)
  const shouldShowCoachMarks = user && !user.hasSeenGuide;
  const profileExtendedComplete = user?.profileExtendedComplete ?? true; // Default to true to hide nudge unless explicitly incomplete
  
  // Update location when user data loads (for first-time visitors without localStorage)
  useEffect(() => {
    if (user?.currentCity && !localStorage.getItem(LOCATION_STORAGE_KEY)) {
      const userLocation = getSavedLocation(user.currentCity ?? undefined);
      setSelectedCity(userLocation.city);
      setSelectedArea(userLocation.area);
    }
  }, [user?.currentCity]);
  
  const { mutate: markDiscoverAsRead } = useMarkNotificationsAsRead();
  const hasMarkedRef = useRef(false);
  const eventListRef = useRef<HTMLDivElement>(null);
  
  // Mutation to mark guide as complete on server
  const markGuideCompleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/guide/complete");
    },
    onSuccess: async () => {
      // Refetch user query to refresh hasSeenGuide immediately
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
    },
  });
  
  // Mark guide as complete when showing coach marks for first time
  useEffect(() => {
    if (shouldShowCoachMarks && user && !user.hasSeenGuide) {
      // Mark guide as complete on server so nextStep doesn't return 'guide'
      markGuideCompleteMutation.mutate();
    }
  }, [shouldShowCoachMarks, user?.hasSeenGuide]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectEvent = () => {
    eventListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Fetch event pools with client-side caching (毫秒级加载)
  const { data: eventPools = [], isLoading, isError: isEventPoolsError, refetch: refetchEventPools } = useQuery<EventPool[]>({
    queryKey: ["/api/event-pools", selectedCity],
    queryFn: async () => {
      const res = await fetch(`/api/event-pools?city=${encodeURIComponent(selectedCity)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
  });

  // Fetch user's available coupons
  const { data: couponData } = useQuery<CouponResponse>({
    queryKey: ["/api/user/coupons"],
    enabled: isAuthenticated,
  });

  // Fetch user's pool registrations to check journey progress
  const { data: registrations = [] } = useQuery<{ poolId: string }[]>({
    queryKey: ["/api/my-pool-registrations"],
    enabled: isAuthenticated,
  });

  // Get the best available coupon to display
  const bestCoupon = couponData?.coupons?.find(c => {
    if (!c.validUntil) return true;
    return new Date(c.validUntil) > new Date();
  });

  // 异步清理通知 - 不阻塞UI (仅执行一次)
  useEffect(() => {
    if (!isAuthenticated || hasMarkedRef.current) return;
    
    const timer = setTimeout(() => {
      markDiscoverAsRead('discover');
      hasMarkedRef.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, [isAuthenticated, markDiscoverAsRead]);

  const handleLocationSave = (city: "香港" | "深圳", area: string) => {
    setSelectedCity(city);
    setSelectedArea(area);
    // Persist to localStorage for returning users
    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ city, area }));
    } catch {}
  };

  const handleOpenDrawer = (pool: EventPool) => {
    setSelectedPoolId(pool.id);
    setSelectedPoolData(pool);
    setShowDrawer(true);
  };

  const handleRegister = () => {
    if (selectedPoolData?.id) {
      setShowDrawer(false);
      setLocation(getDiscoverJoinRoute(selectedPoolData.id));
    }
  };

  // Filter and transform event pools — memoized to avoid recomputing on every render
  const filteredBlindBoxEvents = useMemo(() => eventPools
    .filter(pool => {
      if (pool.city !== selectedCity) return false;
      if (selectedArea && !pool.district.includes(selectedArea)) return false;
      return true;
    })
    .map(transformEventPool)
    .filter((event): event is NonNullable<typeof event> => event !== null),
    [eventPools, selectedCity, selectedArea]
  );

  // Create a map for O(1) pool lookup to avoid O(n²) complexity — memoized
  const poolMap = useMemo(
    () => new Map(eventPools.map(pool => [pool.id, pool])),
    [eventPools]
  );

  useEffect(() => {
    const joinPoolId = getJoinPoolIdFromUrl(location);

    if (!joinPoolId) {
      setShowJoinSheet(false);
      return;
    }

    if (eventPools.length === 0) {
      return;
    }

    const pool = poolMap.get(joinPoolId);
    if (!pool) {
      setShowJoinSheet(false);
      setLocation("/discover");
      return;
    }

    setSelectedPoolId(pool.id);
    setSelectedPoolData(pool);
    setShowDrawer(false);
    setShowJoinSheet(true);
  }, [location, eventPools.length, poolMap, setLocation]);
  
  // Show event tooltip after a delay if first time (must be after filteredBlindBoxEvents is defined)
  useEffect(() => {
    if (shouldShowCoachMarks && !coachMarkState.eventTooltip && filteredBlindBoxEvents.length > 0) {
      const timer = setTimeout(() => {
        setShowEventTooltip(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowCoachMarks, coachMarkState.eventTooltip, filteredBlindBoxEvents.length]);
  
  // Coach mark handlers
  const handleDismissWelcomeBanner = () => {
    const newState = { ...coachMarkState, welcomeBanner: true };
    setCoachMarkState(newState);
    saveCoachMarkState(newState);
  };
  
  const handleDismissEventTooltip = () => {
    setShowEventTooltip(false);
    const newState = { ...coachMarkState, eventTooltip: true };
    setCoachMarkState(newState);
    saveCoachMarkState(newState);
  };
  
  const handleDismissXiaoyueTooltip = () => {
    const newState = { ...coachMarkState, xiaoyueTooltip: true };
    setCoachMarkState(newState);
    saveCoachMarkState(newState);
  };
  
  const handleDismissProfileNudge = () => {
    const newState = { ...coachMarkState, profileNudge: true };
    setCoachMarkState(newState);
    saveCoachMarkState(newState);
  };
  
  // Get archetype info for welcome banner
  const archetypeInfo = user?.primaryArchetype ? archetypeConfig[user.primaryArchetype] : null;

  return (
    <div className="min-h-screen bg-background pb-16">
      <MobileHeader showLogo={true} />
      
      <div className="space-y-4">
        {/* Coach Mark: Archetype Welcome Banner */}
        {shouldShowCoachMarks && 
         !coachMarkState.welcomeBanner && 
         user?.primaryArchetype && 
         archetypeInfo && (
          <CoachMarkBanner
            archetype={user.primaryArchetype}
            archetypeName={archetypeInfo.nickname}
            description={archetypeInfo.tagline}
            onDismiss={handleDismissWelcomeBanner}
          />
        )}
        
        {/* Hero 欢迎区 */}
        <HeroWelcome 
          userName={user?.displayName || "朋友"}
          selectedCity={selectedCity}
          selectedArea={selectedArea}
          onLocationClick={() => setLocationPickerOpen(true)}
        />

        {/* Limited Browse Mode Banner — shown when user chose "browse first" on profile review */}
        {registrations.length === 0 && (
          <LimitedBrowseBanner
            className="mx-4 mt-3"
            onExploreEvents={handleSelectEvent}
          />
        )}

        {/* 用户旅程进度卡片 - 引导完成关键步骤 */}
        {isAuthenticated && (
          <div className="px-4 -mt-4">
            <JourneyProgressCard
              hasCompletedPersonalityTest={user?.hasCompletedPersonalityTest || false}
              hasCompletedBasicInfo={Boolean(user?.displayName && user?.gender && user?.currentCity)}
              hasCompletedEnrichment={user?.hasCompletedVoiceQuiz || false}
              hasRegisteredEvent={registrations.length > 0}
              onSelectEvent={handleSelectEvent}
            />
          </div>
        )}

        {/* Profile Enrichment Card - post-onboarding "Complete Your Profile" surface */}
        {isAuthenticated && user && (
          <ProfileEnrichmentCard user={user} />
        )}
        
        {/* Coach Mark: Profile Completion Nudge */}
        {shouldShowCoachMarks && 
         !coachMarkState.profileNudge && 
         !profileExtendedComplete && (
          <ProfileCompletionNudge onDismiss={handleDismissProfileNudge} />
        )}

        {/* 推广横幅轮播 */}
        <PromotionBannerCarousel 
          city={selectedCity} 
          placement="discover"
          className="mt-2"
        />

        <div className="px-4 pb-2">
          {!bestCoupon && <InviteFriendCard />}
        </div>

        <BlindBoxSection className="py-6">
          <div className="px-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium">盲盒模式</span>
            </div>

            <div className="space-y-5" ref={eventListRef}>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-4">加载中...</p>
                </div>
              ) : isEventPoolsError ? (
                <div className="text-center py-8 px-4 border border-dashed rounded-2xl bg-muted/20 space-y-3">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">活动列表加载失败</p>
                    <p className="text-sm text-muted-foreground">请重试，或先看看其他页面再回来。</p>
                  </div>
                  <Button variant="outline" onClick={() => refetchEventPools()} className="min-w-32">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新加载
                  </Button>
                </div>
              ) : filteredBlindBoxEvents.length > 0 ? (
                filteredBlindBoxEvents.map((event, index) => {
                  // O(1) lookup using poolMap
                  const pool = poolMap.get(event.id);
                  const isFirstCard = index === 0;
                  
                  return (
                    <div key={event.id} className="relative">
                      {/* Coach Mark: Event Tooltip on first card */}
                      {shouldShowCoachMarks && 
                       isFirstCard && 
                       showEventTooltip && (
                        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                          <PulsingIndicator size="md" />
                          <div className="bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg text-sm font-medium max-w-xs">
                            盲盒活动：报名后才能看到匹配的桌友~
                          </div>
                        </div>
                      )}
                      <div 
                        onClick={(e) => {
                          if (isFirstCard && showEventTooltip) {
                            e.stopPropagation();
                            handleDismissEventTooltip();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (isFirstCard && showEventTooltip && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDismissEventTooltip();
                          }
                        }}
                        role={isFirstCard && showEventTooltip ? "button" : undefined}
                        tabIndex={isFirstCard && showEventTooltip ? 0 : undefined}
                        aria-label={isFirstCard && showEventTooltip ? "关闭提示" : undefined}
                      >
                        <BlindBoxEventCard 
                          {...event}
                          onDetailsClick={pool ? () => handleOpenDrawer(pool) : undefined}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>暂无{selectedCity}{selectedArea ? `·${selectedArea}` : ''}的盲盒活动</p>
                  <p className="text-sm mt-2">Admin还没创建活动池，或当前筛选条件下没有可用活动</p>
                </div>
              )}
            </div>
          </div>
        </BlindBoxSection>
      </div>

      <BottomNav />
      
      {/* Coach Mark: Xiaoyue FAB */}
      {shouldShowCoachMarks && (
        <XiaoyueFAB
          showTooltip={!coachMarkState.xiaoyueTooltip && coachMarkState.welcomeBanner === true}
          onTooltipDismiss={handleDismissXiaoyueTooltip}
          onClick={() => {
            // TODO: Wire to actual Xiaoyue chat when implemented
          }}
        />
      )}
      
      {/* 地点选择器 */}
      <LocationPickerSheet
        open={locationPickerOpen}
        onOpenChange={setLocationPickerOpen}
        selectedCity={selectedCity}
        selectedArea={selectedArea}
        onSave={handleLocationSave}
      />

      {/* Event Pool Detail Drawer */}
      {selectedPoolData && (
        <EventPoolDetailDrawer
          poolId={selectedPoolId}
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          onRegister={handleRegister}
          eventData={{
            eventType: selectedPoolData.eventType,
            title: selectedPoolData.title,
            date: formatChineseDateOnly(selectedPoolData.dateTime),
            location: `${selectedPoolData.city}•${selectedPoolData.district}`,
            groupSize: "4-6人",
            minGroupSize: selectedPoolData.minGroupSize || 4,
          }}
        />
      )}

      {showJoinSheet && selectedPoolData && (
        <JoinEventPoolSheet
          open={showJoinSheet}
          onOpenChange={(open) => {
            setShowJoinSheet(open);
            if (!open) {
              setLocation("/discover");
            }
          }}
          poolData={{
            poolId: selectedPoolData.id,
            title: selectedPoolData.title || `神秘${selectedPoolData.eventType}｜等你揭晓`,
            date: formatChineseDateOnly(selectedPoolData.dateTime),
            area: selectedPoolData.district,
            city: selectedPoolData.city,
            eventType: (selectedPoolData.eventType === "其他" ? "饭局" : selectedPoolData.eventType) as "饭局" | "酒局",
            registrationCount: selectedPoolData.registrationCount || 0,
          }}
        />
      )}
    </div>
  );
}
