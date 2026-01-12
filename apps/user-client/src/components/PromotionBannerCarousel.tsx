import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket, Gift, Sparkles } from "lucide-react";
import type { PromotionBanner } from "@shared/schema";

interface CouponSlide {
  type: "coupon";
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  expiresIn?: string;
}

interface FallbackSlide {
  type: "fallback";
}

interface PromotionBannerCarouselProps {
  city?: string;
  placement?: "discover" | "landing";
  className?: string;
  autoplayDelay?: number;
  coupon?: CouponSlide;
}

export function PromotionBannerCarousel({
  city,
  placement = "discover",
  className,
  autoplayDelay = 4000,
  coupon,
}: PromotionBannerCarouselProps) {
  const [, navigate] = useLocation();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: banners, isLoading } = useQuery<PromotionBanner[]>({
    queryKey: ["/api/banners", { city, placement }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (city) params.set("city", city);
      if (placement) params.set("placement", placement);
      const response = await fetch(`/api/banners?${params.toString()}`);
      if (!response.ok) throw new Error("获取横幅失败");
      return response.json();
    },
  });

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    [Autoplay({ delay: autoplayDelay, stopOnInteraction: false })]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const handleBannerClick = (banner: PromotionBanner) => {
    if (banner.linkType === "none" || !banner.linkUrl) return;
    
    if (banner.linkType === "external") {
      window.open(banner.linkUrl, "_blank", "noopener,noreferrer");
    } else {
      navigate(banner.linkUrl);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("w-full px-4", className)}>
        <Skeleton className="w-full h-40 rounded-xl" data-testid="skeleton-banner" />
      </div>
    );
  }

  const allSlides: Array<PromotionBanner | CouponSlide | FallbackSlide> = [];
  if (banners && banners.length > 0) {
    banners.forEach((banner, idx) => {
      allSlides.push(banner);
      if (idx === 0 && coupon) {
        allSlides.push(coupon);
      }
    });
  } else if (coupon) {
    allSlides.push(coupon);
  } else {
    // Add fallback slide when no banners and no coupon
    allSlides.push({ type: "fallback" });
  }

  // Single fallback slide should still render (removed early return for empty allSlides)

  const formatDiscount = (type: "percentage" | "fixed_amount", value: number) => {
    if (type === "percentage") {
      return `${Math.round(value * 10)}折`;
    }
    return `¥${value}`;
  };

  return (
    <div className={cn("w-full", className)} data-testid="promotion-banner-carousel">
      <div className="overflow-hidden rounded-xl mx-4" ref={emblaRef}>
        <div className="flex">
          {allSlides.map((slide, index) => {
            // Handle fallback slide
            if ("type" in slide && slide.type === "fallback") {
              return (
                <div
                  key="fallback-slide"
                  className="flex-[0_0_100%] min-w-0"
                  data-testid="banner-slide-fallback"
                >
                  <div 
                    className="relative aspect-[2.5/1] rounded-xl overflow-hidden bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400"
                    role="img"
                    aria-label="发现你的社交圈 - 开启盲盒社交之旅"
                  >
                    <div className="absolute inset-0 flex items-center justify-center px-6">
                      <div className="text-center text-white">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Sparkles className="w-6 h-6" />
                          <h3 className="text-xl font-bold">发现你的社交圈</h3>
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <p className="text-sm opacity-90">开启盲盒社交之旅</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if ("type" in slide && slide.type === "coupon") {
              return (
                <div
                  key="coupon-slide"
                  className="flex-[0_0_100%] min-w-0"
                  data-testid="banner-slide-coupon"
                >
                  <div 
                    className="relative aspect-[2.5/1] rounded-xl overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent cursor-pointer hover-elevate"
                    onClick={() => navigate("/my-coupons")}
                  >
                    <div className="absolute inset-0 flex items-center justify-between px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                          <Ticket className="w-7 h-7 text-white" />
                        </div>
                        <div className="text-white">
                          <div className="text-2xl font-bold">
                            {formatDiscount(slide.discountType, slide.discountValue)}
                          </div>
                          <div className="text-sm opacity-90">优惠券待使用</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {slide.expiresIn && (
                          <div className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                            {slide.expiresIn}后过期
                          </div>
                        )}
                        <div className="text-white/80 text-xs flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          <span>立即使用</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const banner = slide as PromotionBanner;
            return (
              <div
                key={banner.id}
                className="flex-[0_0_100%] min-w-0"
                data-testid={`banner-slide-${index}`}
              >
                <div
                  className={cn(
                    "relative aspect-[2.5/1] rounded-xl overflow-hidden",
                    banner.linkType !== "none" && banner.linkUrl && "cursor-pointer hover-elevate"
                  )}
                  onClick={() => handleBannerClick(banner)}
                >
                  <img
                    src={banner.imageUrl}
                    alt={banner.title || "推广横幅"}
                    className="w-full h-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  {(banner.title || banner.subtitle) && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                      <div className="absolute bottom-3 left-4 right-4 text-white">
                        {banner.title && (
                          <h3 className="text-lg font-semibold line-clamp-1" data-testid={`banner-title-${index}`}>
                            {banner.title}
                          </h3>
                        )}
                        {banner.subtitle && (
                          <p className="text-sm opacity-90 line-clamp-1" data-testid={`banner-subtitle-${index}`}>
                            {banner.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {allSlides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3" data-testid="banner-dots">
          {allSlides.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === selectedIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30"
              )}
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`跳转到第${index + 1}张横幅`}
              data-testid={`banner-dot-${index}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
