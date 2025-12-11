import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import BlindBoxEventCard from "@/components/BlindBoxEventCard";
import DiscountCouponCard from "@/components/DiscountCouponCard";
import HeroWelcome from "@/components/HeroWelcome";
import LocationPickerSheet from "@/components/LocationPickerSheet";
import { PromotionBannerCarousel } from "@/components/PromotionBannerCarousel";
import BlindBoxGuide from "@/components/BlindBoxGuide";
import InviteFriendCard from "@/components/InviteFriendCard";
import JourneyProgressCard from "@/components/JourneyProgressCard";
import { Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import { zhCN } from "date-fns/locale";

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

export default function DiscoverPage() {
  const { user, isAuthenticated } = useAuth();
  const [selectedCity, setSelectedCity] = useState<"香港" | "深圳">("深圳");
  const [selectedArea, setSelectedArea] = useState<string>("南山区");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const markAsRead = useMarkNotificationsAsRead();

  // Fetch event pools with client-side caching (毫秒级加载)
  const { data: eventPools = [], isLoading } = useQuery<EventPool[]>({
    queryKey: ["/api/event-pools", selectedCity],
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

  // 异步清理通知 - 不阻塞UI
  useEffect(() => {
    const timer = setTimeout(() => {
      markAsRead.mutate('discover');
    }, 100);
    return () => clearTimeout(timer);
  }, [markAsRead]);

  const handleLocationSave = (city: "香港" | "深圳", area: string) => {
    setSelectedCity(city);
    setSelectedArea(area);
  };

  // Transform event pools to blind box event card props
  const transformEventPool = (pool: EventPool) => {
    try {
      const dateTime = parseISO(pool.dateTime);
      const dayOfWeek = format(dateTime, 'EEEE', { locale: zhCN });
      const time = format(dateTime, 'HH:mm');
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
        date: dayOfWeek,
        time,
        eventType: (pool.eventType === "其他" ? "饭局" : pool.eventType) as "饭局" | "酒局",
        area,
        city: pool.city,
        mysteryTitle,
        isAA: true, // Event pools default to AA
        isGirlsNight,
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
            />
          </div>
        )}

        {/* 推广横幅轮播 */}
        <PromotionBannerCarousel 
          city={selectedCity} 
          placement="discover"
          className="mt-2"
        />

        {/* 分割线 */}
        <div className="h-px bg-border/50 mx-4" />

        <div className="px-4 space-y-4">
          {/* 动态优惠券卡片 - 有券显示优惠券，无券显示邀请引导 */}
          {bestCoupon ? (
            <DiscountCouponCard 
              discountType={bestCoupon.discountType as "percentage" | "fixed_amount"}
              discountValue={bestCoupon.discountValue}
              reason={bestCoupon.assignedToUser ? "专属奖励优惠券" : "活动能量奖励"}
              expiresIn={getExpiryText(bestCoupon.validUntil)}
            />
          ) : (
            <InviteFriendCard />
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">盲盒模式</span>
          </div>

          <div className="space-y-5">
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
