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
import { CoachMarkBanner, ProfileCompletionNudge, XiaoyueFAB } from "@/components/coach-marks";
import { ProfileEnrichmentCard } from "@/components/ProfileEnrichmentCard";
import LimitedBrowseBanner from "@/components/LimitedBrowseBanner";
import EventCardSkeleton from "@/components/EventCardSkeleton";
import SparkSectionHeader from "@/components/SparkSectionHeader";
import { AlertCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { formatChineseDateOnly, extractChineseTime } from "@/lib/chineseDateTime";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { archetypeConfig } from "@/lib/archetypes";
import { getDiscoverJoinRoute, getJoinPoolIdFromUrl } from "@/lib/poolRegistrationRouting";
import TestIncompleteScreen from "@/components/matching/TestIncompleteScreen";

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
// Also enriches mysteryTitle with a social-invitation fallback when title is generic.
const MYSTERY_TITLE_FALLBACKS: Record<string, string[]> = {
  饭局: [
    "这顿饭，或许会改变什么",
    "一桌陌生人，一段真实故事",
    "今晚的饭，不知道和谁吃",
    "认识一个新朋友，从这顿饭开始",
    "神秘饭局，等你揭晓",
  ],
  酒局: [
    "今晚喝一杯，认识点有意思的人",
    "不知道对面坐着谁，但肯定有缘",
    "小酌一杯，盲约新朋友",
    "酒局里的缘分，从不靠脸",
    "神秘酒局，等你揭晓",
  ],
};

function getEnrichedMysteryTitle(rawTitle: string | undefined, eventType: "饭局" | "酒局", poolId: string): string {
  if (rawTitle && rawTitle !== `神秘${eventType}｜等你揭晓`) return rawTitle;
  // Use a stable hash of poolId to pick consistently for the same pool
  const options = MYSTERY_TITLE_FALLBACKS[eventType] ?? MYSTERY_TITLE_FALLBACKS["饭局"];
  let hash = 0;
  for (let i = 0; i < poolId.length; i++) hash = (hash * 31 + poolId.charCodeAt(i)) | 0;
  return options[Math.abs(hash) % options.length];
}

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
    const mysteryTitle = getEnrichedMysteryTitle(
      pool.title,
      (pool.eventType === "其他" ? "饭局" : pool.eventType) as "饭局" | "酒局",
      pool.id,
    );
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
  const prefersReducedMotion = useReducedMotion();
  
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
  const [showTestIncomplete, setShowTestIncomplete] = useState(false);
  
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

  const openDrawerForPool = useCallback((pool: EventPool) => {
    setSelectedPoolId(pool.id);
    setSelectedPoolData(pool);
    setShowDrawer(true);
  }, []);

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

  const handleOpenDrawer = useCallback((poolId: string) => {
    const pool = poolMap.get(poolId);
    if (!pool) {
      return;
    }

    openDrawerForPool(pool);
  }, [openDrawerForPool, poolMap]);

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

    // Pre-entry interception: if personality test isn't done, show the
    // TestIncompleteScreen overlay instead of opening the join sheet.
    if (user && !user.hasCompletedPersonalityTest) {
      setShowTestIncomplete(true);
      return;
    }

    setShowJoinSheet(true);
  }, [location, eventPools.length, poolMap, setLocation, user?.hasCompletedPersonalityTest]);
  
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
  
  const handleDismissEventTooltip = useCallback(() => {
    setShowEventTooltip(false);
    setCoachMarkState((previousState) => {
      if (previousState.eventTooltip) {
        return previousState;
      }

      const nextState = { ...previousState, eventTooltip: true };
      saveCoachMarkState(nextState);
      return nextState;
    });
  }, []);
  
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
    <div className="flex min-h-full min-h-0 flex-col bg-background">
      <MobileHeader showLogo={true} />
      {/* Scroll: variable-length event feed and modules — exception to zero-scroll document policy */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pb-16">
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
            {/* Branded section header — replaces generic "盲盒模式" label */}
            <SparkSectionHeader
              eventCount={isLoading ? undefined : filteredBlindBoxEvents.length}
              city={selectedCity}
            />

            <div className="space-y-5" ref={eventListRef}>
              {isLoading ? (
                /* Launch-grade skeleton loading — 2 placeholder cards */
                <div className="space-y-5" aria-label="活动加载中">
                  <EventCardSkeleton />
                  <EventCardSkeleton />
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
                  const isFirstCard = index === 0;
                  
                  return (
                    <motion.div
                      key={event.id}
                      className="relative"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 0.42, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }
                      }
                    >
                      {/* Coach Mark: first-session onboarding cue — premium styled tooltip */}
                      <AnimatePresence>
                        {shouldShowCoachMarks && isFirstCard && showEventTooltip && (
                          <motion.div
                            className="absolute -top-3 left-3 right-3 z-10"
                            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
                            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
                          >
                            <div className="flex items-start gap-2 bg-primary text-primary-foreground px-3 py-2.5 rounded-xl shadow-lg text-xs font-medium">
                              <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                              <span className="flex-1 leading-relaxed">
                                报名后 AI 匹配桌友，全程匿名直到见面 — 点卡片查看玩法详情 🎲
                              </span>
                              <button
                                className="shrink-0 opacity-80 hover:opacity-100 ml-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDismissEventTooltip();
                                }}
                                aria-label="关闭提示"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {/* Downward pointer */}
                            <div className="ml-4 w-3 h-1.5 overflow-hidden">
                              <div className="w-3 h-3 bg-primary rotate-45 -translate-y-1.5 ml-0" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Wave 3: isFeatured={true} for first card — premium glow + upgraded CTA */}
                      <BlindBoxEventCard 
                        {...event}
                        isFeatured={isFirstCard}
                        dismissCoachMarkOnSurfaceTap={isFirstCard && showEventTooltip}
                        onDismissCoachMark={handleDismissEventTooltip}
                        onDetailsClick={handleOpenDrawer}
                      />
                    </motion.div>
                  );
                })
              ) : (
                /* Launch-grade empty state — warm and on-brand, not generic */
                <motion.div
                  className="text-center py-10 px-5 rounded-2xl border border-dashed border-primary/20 bg-primary/3 space-y-3"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
                >
                  <div className="text-3xl" aria-hidden="true">🌙</div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground/80">
                      {selectedCity}{selectedArea ? `·${selectedArea}` : ''} 今晚还没活动
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      新的圈子正在组建中，先去别的板块逛逛，活动上线我们会通知你~
                    </p>
                  </div>
                </motion.div>
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

      {/* Pre-entry personality test interception overlay */}
      {showTestIncomplete && (
        <div className="fixed inset-0 z-50 bg-background">
          <TestIncompleteScreen
            onContinueTest={() => {
              setShowTestIncomplete(false);
              setLocation("/personality-test");
            }}
            onDismiss={() => setShowTestIncomplete(false)}
          />
        </div>
      )}
    </div>
  );
}
