import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import BlindBoxEventCard from "@/components/BlindBoxEventCard";
import BlindBoxSection from "@/components/BlindBoxSection";
import HeroWelcome from "@/components/HeroWelcome";
import LocationPickerSheet from "@/components/LocationPickerSheet";
import { PromotionBannerCarousel } from "@/components/PromotionBannerCarousel";
import BlindBoxGuide from "@/components/BlindBoxGuide";
import InviteFriendCard from "@/components/InviteFriendCard";
import JourneyProgressCard from "@/components/JourneyProgressCard";
import { Sparkles } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays } from "date-fns";
import { formatChineseDateOnly, extractChineseTime } from "@/lib/chineseDateTime";

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

// Safe localStorage read with SSR guard
const getSavedLocation = (): { city: "香港" | "深圳"; area: string } => {
  if (typeof window === "undefined") {
    return { city: "深圳", area: "南山区" };
  }
  try {
    const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (saved) {
      const { city, area } = JSON.parse(saved);
      return { 
        city: (city === "香港" || city === "深圳") ? city : "深圳", 
        area: area || "南山区" 
      };
    }
  } catch {}
  return { city: "深圳", area: "南山区" };
};

export default function DiscoverPage() {
  const { user, isAuthenticated } = useAuth();
  
  const savedLocation = getSavedLocation();
  const [selectedCity, setSelectedCity] = useState<"香港" | "深圳">(savedLocation.city);
  const [selectedArea, setSelectedArea] = useState<string>(savedLocation.area);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const { mutate: markDiscoverAsRead } = useMarkNotificationsAsRead();
  const hasMarkedRef = useRef(false);
  const eventListRef = useRef<HTMLDivElement>(null);

  const handleSelectEvent = () => {
    eventListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Fetch event pools with client-side caching (毫秒级加载)
  const { data: eventPools = [], isLoading } = useQuery<EventPool[]>({
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

  // Calculate days until expiry
  const getExpiryText = (validUntil: string | null) => {
    if (!validUntil) return undefined;
    const days = differenceInDays(new Date(validUntil), new Date());
    if (days <= 0) return "今日到期";
    if (days === 1) return "1天";
    if (days <= 7) return `${days}天`;
    return undefined;
  };

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

  // Transform event pools to blind box event card props
  const transformEventPool = (pool: EventPool) => {
    try {
      // Use Chinese date format: "12月25日 (周四)" with proper timezone
      const chineseDate = formatChineseDateOnly(pool.dateTime);
      // Extract time in Chinese format: "晚上9点" with proper timezone  
      const chineseTime = extractChineseTime(pool.dateTime);
      const area = `${pool.city}•${pool.district}`;
      
      // Use pool title as mystery title, or generate one
      const mysteryTitle = pool.title || `神秘${pool.eventType}｜等你揭晓`;
      
      // Check if it's girls night based on gender restriction or title
      const isGirlsNight = pool.genderRestriction === '仅限女性' || 
                          pool.title?.toLowerCase().includes('girls') ||
                          pool.title?.includes('女性') ||
                          pool.title?.includes('闺蜜');

      return {
        id: pool.id,
        poolId: pool.id, // 关键：传递 poolId 给 BlindBoxEventCard，用于后端报名
        date: chineseDate,
        time: chineseTime,
        eventType: (pool.eventType === "其他" ? "饭局" : pool.eventType) as "饭局" | "酒局",
        area,
        city: pool.city,
        mysteryTitle,
        isAA: true, // Event pools default to AA
        isGirlsNight,
        registrationCount: pool.registrationCount || 0,
        sampleArchetypes: pool.sampleArchetypes || [],
        registrationDeadline: pool.registrationDeadline,
      };
    } catch (error) {
      console.error("Error transforming event pool:", pool, error);
      return null;
    }
  };

  // Filter and transform event pools
  const filteredBlindBoxEvents = eventPools
    .filter(pool => {
      if (pool.city !== selectedCity) return false;
      if (selectedArea && !pool.district.includes(selectedArea)) return false;
      return true;
    })
    .map(transformEventPool)
    .filter((event): event is NonNullable<typeof event> => event !== null);

  return (
    <div className="min-h-screen bg-background pb-16">
      <MobileHeader showLogo={true} />
      
      <div className="space-y-4">
        {/* Hero 欢迎区 */}
        <HeroWelcome 
          userName={user?.displayName || "朋友"}
          selectedCity={selectedCity}
          selectedArea={selectedArea}
          onLocationClick={() => setLocationPickerOpen(true)}
        />

        {/* 盲盒模式引导 - 仅首次访问显示 */}
        <BlindBoxGuide className="px-4" />

        {/* 用户旅程进度卡片 - 引导完成关键步骤 */}
        {isAuthenticated && (
          <div className="px-4">
            <JourneyProgressCard
              isLoggedIn={isAuthenticated}
              hasCompletedPersonalityTest={user?.hasCompletedPersonalityTest || false}
              hasRegisteredEvent={registrations.length > 0}
              onSelectEvent={handleSelectEvent}
            />
          </div>
        )}

        {/* 推广横幅轮播（含优惠券） */}
        <PromotionBannerCarousel 
          city={selectedCity} 
          placement="discover"
          className="mt-2"
          coupon={bestCoupon ? {
            type: "coupon",
            discountType: bestCoupon.discountType as "percentage" | "fixed_amount",
            discountValue: bestCoupon.discountValue,
            expiresIn: getExpiryText(bestCoupon.validUntil),
          } : undefined}
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
              ) : filteredBlindBoxEvents.length > 0 ? (
                filteredBlindBoxEvents.map((event) => (
                  <BlindBoxEventCard key={event.id} {...event} />
                ))
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
      
      {/* 地点选择器 */}
      <LocationPickerSheet
        open={locationPickerOpen}
        onOpenChange={setLocationPickerOpen}
        selectedCity={selectedCity}
        selectedArea={selectedArea}
        onSave={handleLocationSave}
      />
    </div>
  );
}
