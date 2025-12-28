import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  X,
  ChevronDown,
  Sparkles,
  Zap,
  Gift,
  CheckCircle,
  Loader,
  Ticket,
  Crown,
  Package,
  Users,
  Calendar,
  MessageCircle,
  Star,
  Shield,
  MapPin,
} from "lucide-react";

import { motion } from "framer-motion";
import { SiWechat } from "react-icons/si";

import { getCurrencySymbol } from "@/lib/currency";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Default fallback prices (used while loading or if API fails)
const DEFAULT_SINGLE_PRICE = 8800; // ¥88.00 in cents (原价)
const DEFAULT_PACK3_PRICE = 21100; // ¥211.00 for 3 events (原价¥264, 约¥70/次, 8折)
const DEFAULT_PACK6_PRICE = 37000; // ¥370.00 for 6 events (原价¥528, 约¥62/次, 7折)
const DEFAULT_VIP_MONTHLY_PRICE = 12800; // ¥128.00 VIP monthly
const DEFAULT_VIP_QUARTERLY_PRICE = 26800; // ¥268.00 VIP quarterly (约¥89/月, 省¥116)

// Original prices for savings calculation (in cents)
const ORIGINAL_PACK3_PRICE = 26400; // ¥264 = ¥88 x 3
const ORIGINAL_PACK6_PRICE = 52800; // ¥528 = ¥88 x 6

interface PricingPlan {
  id: string;
  planType: string;
  displayName: string;
  displayNameEn?: string;
  description?: string;
  price: number; // in yuan
  originalPrice?: number | null; // in yuan
  durationDays?: number;
  isActive: boolean;
  isFeatured: boolean;
}


export default function BlindBoxPaymentPage() {
  const [, setLocation] = useLocation();
  const [promoOpen, setPromoOpen] = useState(false);
  const [couponTab, setCouponTab] = useState("input");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discount, setDiscount] = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<
    "single" | "pack3" | "pack6" | "vip_monthly" | "vip_quarterly"
  >("single");
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dynamic pricing from API
  const { data: pricingData, isLoading: loadingPricing } = useQuery<PricingPlan[]>({
    queryKey: ["/api/pricing"],
    queryFn: async () => {
      const response = await fetch("/api/pricing");
      if (!response.ok) return [];
      const json = await response.json();
      return Array.isArray(json) ? json : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Get prices from API data or use defaults
  const singlePricing = pricingData?.find((p) => p.planType === "event_single");
  const pack3Pricing = pricingData?.find((p) => p.planType === "pack_3");
  const pack6Pricing = pricingData?.find((p) => p.planType === "pack_6");
  const vipMonthlyPricing = pricingData?.find((p) => p.planType === "vip_monthly");
  const vipQuarterlyPricing = pricingData?.find((p) => p.planType === "vip_quarterly");

  const SINGLE_PRICE = singlePricing ? singlePricing.price * 100 : DEFAULT_SINGLE_PRICE;
  const PACK3_PRICE = pack3Pricing ? pack3Pricing.price * 100 : DEFAULT_PACK3_PRICE;
  const PACK6_PRICE = pack6Pricing ? pack6Pricing.price * 100 : DEFAULT_PACK6_PRICE;
  const VIP_MONTHLY_PRICE = vipMonthlyPricing ? vipMonthlyPricing.price * 100 : DEFAULT_VIP_MONTHLY_PRICE;
  const VIP_QUARTERLY_PRICE = vipQuarterlyPricing ? vipQuarterlyPricing.price * 100 : DEFAULT_VIP_QUARTERLY_PRICE;

  // Original prices from API or fallback to calculated values
  const PACK3_ORIGINAL = pack3Pricing?.originalPrice
    ? pack3Pricing.originalPrice * 100
    : ORIGINAL_PACK3_PRICE;
  const PACK6_ORIGINAL = pack6Pricing?.originalPrice
    ? pack6Pricing.originalPrice * 100
    : ORIGINAL_PACK6_PRICE;

  // Calculate per-event prices for display
  const PACK3_PER_EVENT = Math.round(PACK3_PRICE / 3);
  const PACK6_PER_EVENT = Math.round(PACK6_PRICE / 6);

  // Savings
  const PACK3_SAVINGS = PACK3_ORIGINAL - PACK3_PRICE;
  const PACK6_SAVINGS = PACK6_ORIGINAL - PACK6_PRICE;
  const VIP_QUARTERLY_SAVINGS = VIP_MONTHLY_PRICE * 3 - VIP_QUARTERLY_PRICE;

  // Discount “x折” display
  const PACK3_DISCOUNT = Math.round((1 - PACK3_PRICE / PACK3_ORIGINAL) * 10);
  const PACK6_DISCOUNT = Math.round((1 - PACK6_PRICE / PACK6_ORIGINAL) * 10);

  // ✅ Fetch user's available coupons (STRUCTURE GUARANTEED)
  const { data: availableCoupons, isLoading: loadingCoupons } = useQuery<{
    count: number;
    coupons: any[];
  }>({
    queryKey: ["/api/user/coupons"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/user/coupons", {
          credentials: "include",
        });
        if (!response.ok) return { count: 0, coupons: [] };

        const json = await response.json();
        return {
          count: typeof json?.count === "number" ? json.count : 0,
          coupons: Array.isArray(json?.coupons) ? json.coupons : [],
        };
      } catch {
        return { count: 0, coupons: [] };
      }
    },
    initialData: { count: 0, coupons: [] },
  });

  // ✅ Always-safe coupon list for .find / .map
  const couponsList = Array.isArray(availableCoupons?.coupons)
    ? availableCoupons.coupons
    : [];

  // Check for first-time user welcome coupon (50% off)
  const welcomeCoupon = couponsList.find(
    (c: any) =>
      c?.code?.startsWith("WELCOME50") &&
      c?.discountType === "percentage" &&
      c?.discountValue === 50
  );
  const hasWelcomeCoupon = !!welcomeCoupon;

  // 读取盲盒事件数据用于显示和提交
  const storedEventData = typeof window !== "undefined"
    ? (() => {
        try {
          const str = localStorage.getItem("blindbox_event_data");
          return str ? JSON.parse(str) : null;
        } catch { return null; }
      })()
    : null;

  // City / currency
  const city = (storedEventData?.city || 
    (typeof window !== "undefined"
      ? (localStorage.getItem("blindbox_city") || "深圳")
      : "深圳")) as "香港" | "深圳";
  const currencySymbol = getCurrencySymbol(city);

  // 活动显示数据
  const displayDate = storedEventData?.date || "待定";
  const displayTime = storedEventData?.time || "";
  const displayEventType = storedEventData?.eventType || "饭局";
  const displayArea = storedEventData?.area || storedEventData?.district || `${city}·南山区`;
  const displayPoolId = storedEventData?.poolId;

  // Get base price based on selected plan
  const getBasePrice = () => {
    switch (selectedPlan) {
      case "single":
        return SINGLE_PRICE;
      case "pack3":
        return PACK3_PRICE;
      case "pack6":
        return PACK6_PRICE;
      case "vip_monthly":
        return VIP_MONTHLY_PRICE;
      case "vip_quarterly":
        return VIP_QUARTERLY_PRICE;
      default:
        return SINGLE_PRICE;
    }
  };

  const basePrice = getBasePrice();
  const finalPrice = basePrice - (selectedPlan === "single" ? discount : 0);

  const isPack = selectedPlan === "pack3" || selectedPlan === "pack6";
  const isVIP = selectedPlan === "vip_monthly" || selectedPlan === "vip_quarterly";

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      return await apiRequest("POST", "/api/blind-box-events", eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/joined"] });
      localStorage.removeItem("blindbox_event_data");
      setLocation("/events");
    },
    onError: (error: any) => {
      toast({
        title: "创建活动失败",
        description: error?.message || "创建失败",
        variant: "destructive",
      });
    },
  });

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: "请输入优惠码",
        description: "输入您的优惠码以获得折扣",
        variant: "destructive",
      });
      return;
    }

    setValidatingCoupon(true);
    try {
      const result = (await apiRequest("POST", "/api/coupons/validate", {
        code: couponCode.trim(),
        amount: SINGLE_PRICE,
        paymentType: "event",
      })) as any;

      if (result?.valid) {
        setAppliedCoupon(result.coupon);
        setDiscount(result.discountAmount);
        toast({
          title: "优惠码已应用",
          description: `节省 ${currencySymbol}${(result.discountAmount / 100).toFixed(2)}`,
        });
        setPromoOpen(false);
      } else {
        toast({
          title: "优惠码无效",
          description: result?.message || "此优惠码不可用或已过期",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "验证失败",
        description: error?.message || "无法验证优惠码，请稍后重试",
        variant: "destructive",
      });
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    setAppliedCoupon(null);
    setDiscount(0);
    toast({
      title: "优惠码已移除",
      description: "返回原价",
    });
  };

  const handleApplyCouponFromList = async (coupon: any) => {
    setAppliedCoupon({
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });

    let d = 0;
    if (coupon.discountType === "fixed_amount") {
      d = Math.min(coupon.discountValue, SINGLE_PRICE);
    } else if (coupon.discountType === "percentage") {
      d = Math.floor(SINGLE_PRICE * (coupon.discountValue / 100));
    }
    setDiscount(d);

    toast({
      title: "优惠券已应用",
      description: `节省 ${currencySymbol}${(d / 100).toFixed(2)}`,
    });
    setPromoOpen(false);
  };

  const handlePayment = async () => {
    try {
      if (isVIP) {
        setIsProcessing(true);
        const planType = selectedPlan as "vip_monthly" | "vip_quarterly";

        const response = await fetch("/api/subscription/renew", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            planType,
            couponCode: appliedCoupon?.code,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error?.message || "订阅失败");
        }

        toast({
          title: "VIP订阅成功！",
          description:
            selectedPlan === "vip_quarterly"
              ? "季度VIP已开通，享3个月无限活动 + 专属权益"
              : "月度VIP已开通，享无限盲盒活动",
        });

        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        setLocation("/discover");
        setIsProcessing(false);
        return;
      }

      if (isPack) {
        setIsProcessing(true);
        const packCount = selectedPlan === "pack3" ? 3 : 6;
        const packPrice = selectedPlan === "pack3" ? PACK3_PRICE : PACK6_PRICE;
        const validityDays = selectedPlan === "pack3" ? 90 : 180;

        const response = await fetch("/api/event-packs/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            packType: selectedPlan,
            eventCount: packCount,
            priceInCents: packPrice,
            validityDays,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error?.message || "购买失败");
        }

        toast({
          title: "次数包购买成功！",
          description:
            selectedPlan === "pack3"
              ? `${packCount}次活动券已充入账户，90天内有效`
              : `${packCount}次活动券已充入账户，半年内有效`,
        });

        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        setLocation("/discover");
        setIsProcessing(false);
        return;
      }

      const eventDataStr = localStorage.getItem("blindbox_event_data");
      if (!eventDataStr) {
        toast({
          title: "数据错误",
          description: "未找到活动数据，请重新报名",
          variant: "destructive",
        });
        setLocation("/discover");
        return;
      }

      const eventData = JSON.parse(eventDataStr);
      if (appliedCoupon) {
        eventData.couponId = appliedCoupon.id;
      }

      await createEventMutation.mutateAsync(eventData);
    } catch (error) {
      console.error("Payment error:", error);
      setIsProcessing(false);
    }
  };

  // ✅ 到这里为止，下面就是你的 return (


  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
      {/* 背景装饰动画 */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-20 -right-20 w-96 h-96 bg-yellow-300/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={() => setLocation("/discover")}
        className="absolute top-4 right-4 z-50 bg-black/20 hover:bg-black/40 rounded-full p-2 backdrop-blur-sm transition-colors"
        data-testid="button-close-payment"
      >
        <X className="h-6 w-6 text-white" />
      </button>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* 顶部动画标题 */}
        <div className="flex-1 flex items-center justify-center px-6 pt-16 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <motion.div
              animate={{
                rotate: [0, 10, -10, 10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="inline-block mb-4"
            >
              <Sparkles className="h-16 w-16 text-yellow-300" />
            </motion.div>
            <h1 className="text-4xl font-bold text-white mb-3 drop-shadow-lg">
              解锁神秘盲盒
            </h1>
            <p className="text-white/90 text-lg drop-shadow-md mb-2">
              AI精准匹配 · 惊喜体验 · 新朋友
            </p>
            <p className="text-white/70 text-sm drop-shadow-md">
              告别尬聊，省去海量筛选时间
            </p>
          </motion.div>
        </div>

        {/* 付费卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-background rounded-t-[32px] shadow-2xl p-6 space-y-6"
        >
          {/* 新用户首单特惠横幅 */}
          {hasWelcomeCoupon && !appliedCoupon && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-gradient-to-r from-pink-500/20 to-orange-500/20 border border-pink-300 dark:border-pink-800"
              data-testid="banner-welcome-discount"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center shrink-0">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-pink-700 dark:text-pink-300">首单专享5折</p>
                  <p className="text-xs text-pink-600 dark:text-pink-400">新用户专属优惠券已自动发放，单次票可享半价</p>
                </div>
                <Badge className="bg-gradient-to-r from-pink-500 to-orange-500 text-white border-0 shrink-0">
                  -50%
                </Badge>
              </div>
            </motion.div>
          )}

          {/* 活动信息摘要 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold">{displayDate} {displayTime} · {displayEventType}</h2>
              <Badge variant="default" className="bg-purple-500 hover:bg-purple-600 shrink-0">
                盲盒模式
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {displayArea}</p>
              <p className="flex items-center gap-1"><Users className="h-4 w-4" /> 4-6人 · AI智能匹配</p>
            </div>
            {!displayPoolId && (
              <p className="text-xs text-destructive">活动数据不完整，请返回重新选择</p>
            )}
          </div>

          {/* 价格选项 - 次数包 + VIP */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              选择参与方式
            </h3>
            
            {/* 次数包选项 */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                次数包 · 90天有效
              </p>
              <div className="grid gap-3">
                {/* 单次票 */}
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Card 
                    className={`p-4 border-2 hover-elevate cursor-pointer relative transition-all ${
                      selectedPlan === "single" 
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                        : "border-muted"
                    }`}
                    onClick={() => setSelectedPlan("single")}
                    data-testid="card-single-ticket"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedPlan === "single" ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {selectedPlan === "single" && (
                            <div className="w-3 h-3 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold">单次体验票</h4>
                          <p className="text-xs text-muted-foreground">零门槛尝鲜，体验AI精准匹配</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xl font-bold text-primary">{currencySymbol}{(SINGLE_PRICE / 100).toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">1次</div>
                      </div>
                    </div>
                  </Card>
                </motion.div>

                {/* 3次包 - 推荐 8折 */}
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Card 
                    className={`p-4 border-2 hover-elevate cursor-pointer relative transition-all ${
                      selectedPlan === "pack3" 
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                        : "border-muted"
                    }`}
                    onClick={() => {
                      setSelectedPlan("pack3");
                      if (appliedCoupon) {
                        setAppliedCoupon(null);
                        setDiscount(0);
                        setCouponCode("");
                      }
                    }}
                    data-testid="card-pack3"
                  >
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-0">
                        <Gift className="h-3 w-3 mr-1" />
                        {PACK3_DISCOUNT}折热门
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedPlan === "pack3" ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {selectedPlan === "pack3" && (
                            <div className="w-3 h-3 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold">入门3次包</h4>
                          <p className="text-xs text-muted-foreground">
                            约{currencySymbol}{(PACK3_PER_EVENT / 100).toFixed(0)}/次
                          </p>
                          {PACK3_SAVINGS > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                              省{currencySymbol}{(PACK3_SAVINGS / 100).toFixed(0)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground line-through">{currencySymbol}{(PACK3_ORIGINAL / 100).toFixed(0)}</div>
                        <div className="text-xl font-bold text-primary">{currencySymbol}{(PACK3_PRICE / 100).toFixed(0)}</div>
                      </div>
                    </div>
                  </Card>
                </motion.div>

                {/* 6次包 - 超值 7折 半年有效 */}
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Card 
                    className={`p-4 border-2 hover-elevate cursor-pointer relative transition-all ${
                      selectedPlan === "pack6" 
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                        : "border-muted"
                    }`}
                    onClick={() => {
                      setSelectedPlan("pack6");
                      if (appliedCoupon) {
                        setAppliedCoupon(null);
                        setDiscount(0);
                        setCouponCode("");
                      }
                    }}
                    data-testid="card-pack6"
                  >
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0">
                        {PACK6_DISCOUNT}折超值
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedPlan === "pack6" ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {selectedPlan === "pack6" && (
                            <div className="w-3 h-3 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold">超值6次包</h4>
                          <p className="text-xs text-muted-foreground">
                            约{currencySymbol}{(PACK6_PER_EVENT / 100).toFixed(0)}/次
                          </p>
                          {PACK6_SAVINGS > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                              省{currencySymbol}{(PACK6_SAVINGS / 100).toFixed(0)}
                            </p>
                          )}
                          <p className="text-xs text-amber-600 dark:text-amber-400">半年有效期</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground line-through">{currencySymbol}{(PACK6_ORIGINAL / 100).toFixed(0)}</div>
                        <div className="text-xl font-bold text-green-600">{currencySymbol}{(PACK6_PRICE / 100).toFixed(0)}</div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </div>
            </div>
            
            {/* VIP订阅选项 */}
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Crown className="h-3 w-3" />
                VIP无限卡 · 专属权益
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* 月度VIP */}
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Card 
                    className={`p-3 border-2 hover-elevate cursor-pointer transition-all ${
                      selectedPlan === "vip_monthly" 
                        ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20" 
                        : "border-muted"
                    }`}
                    onClick={() => {
                      setSelectedPlan("vip_monthly");
                      if (appliedCoupon) {
                        setAppliedCoupon(null);
                        setDiscount(0);
                        setCouponCode("");
                      }
                    }}
                    data-testid="card-vip-monthly"
                  >
                    <div className="flex flex-col items-center text-center gap-1">
                      <Crown className="h-5 w-5 text-amber-500" />
                      <h4 className="font-bold text-sm">月度VIP</h4>
                      <div className="text-lg font-bold">{currencySymbol}{(VIP_MONTHLY_PRICE / 100).toFixed(0)}</div>
                      <p className="text-xs text-muted-foreground">无限活动</p>
                    </div>
                  </Card>
                </motion.div>

                {/* 季度VIP */}
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Card 
                    className={`p-3 border-2 hover-elevate cursor-pointer transition-all relative ${
                      selectedPlan === "vip_quarterly" 
                        ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20" 
                        : "border-muted"
                    }`}
                    onClick={() => {
                      setSelectedPlan("vip_quarterly");
                      if (appliedCoupon) {
                        setAppliedCoupon(null);
                        setDiscount(0);
                        setCouponCode("");
                      }
                    }}
                    data-testid="card-vip-quarterly"
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <Badge className="bg-amber-500 text-white border-0 text-xs">
                        省¥{(VIP_QUARTERLY_SAVINGS / 100).toFixed(0)}
                      </Badge>
                    </div>
                    <div className="flex flex-col items-center text-center gap-1">
                      <Crown className="h-5 w-5 text-amber-500" />
                      <h4 className="font-bold text-sm">季度尊享</h4>
                      <div className="text-lg font-bold">{currencySymbol}{(VIP_QUARTERLY_PRICE / 100).toFixed(0)}</div>
                      <p className="text-xs text-muted-foreground">约{currencySymbol}{Math.round(VIP_QUARTERLY_PRICE / 300)}/月</p>
                    </div>
                  </Card>
                </motion.div>
              </div>
              
              {/* VIP权益说明 */}
              {isVIP && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-2"
                >
                  <p className="font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <Crown className="h-3 w-3" /> VIP专属权益：
                  </p>
                  <ul className="text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> 
                      <span>无限次参与所有活动</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="h-3 w-3 text-purple-500 shrink-0" /> 
                      <span className="font-medium text-purple-600 dark:text-purple-400">每月1次免费携友特权</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">社交特权</Badge>
                    </li>
                    <li className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-blue-500 shrink-0" /> 
                      <span>活动免费改期</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <MessageCircle className="h-3 w-3 text-green-500 shrink-0" /> 
                      <span>专属VIP交流群</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Star className="h-3 w-3 text-amber-500 shrink-0" /> 
                      <span>会员身份标识</span>
                    </li>
                  </ul>
                </motion.div>
              )}
            </div>

          </div>

          {/* Applied Coupon Badge */}
          {appliedCoupon && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">优惠码已应用</p>
                  <p className="text-xs text-green-600 dark:text-green-500">{appliedCoupon.code}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemoveCoupon}
                data-testid="button-remove-coupon"
              >
                移除
              </Button>
            </motion.div>
          )}

          {/* Promo Code & Available Coupons - 仅单次票支持 */}
          {!appliedCoupon && selectedPlan === "single" && (
            <Collapsible open={promoOpen} onOpenChange={setPromoOpen}>
              <CollapsibleTrigger className="w-full" data-testid="button-promo-toggle">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">
                      优惠码 {availableCoupons.count > 0 && `· ${availableCoupons.count}张优惠券`}
                    </span>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${promoOpen ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Tabs defaultValue={availableCoupons.count > 0 ? "my-coupons" : "input"} value={couponTab} onValueChange={setCouponTab} className="p-3 pt-0">
                  <TabsList className="grid w-full grid-cols-2 mb-3">
                    <TabsTrigger value="input">手动输入</TabsTrigger>
                    <TabsTrigger value="my-coupons" disabled={availableCoupons.count === 0}>
                      我的优惠券 {availableCoupons.count > 0 && `(${availableCoupons.count})`}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="input" className="space-y-2">
                    <input
                      type="text"
                      placeholder="输入优惠码"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleValidateCoupon();
                        }
                      }}
                      className="w-full px-4 py-2 rounded-lg border bg-background"
                      data-testid="input-promo-code"
                      disabled={validatingCoupon}
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleValidateCoupon}
                      disabled={validatingCoupon || !couponCode.trim()}
                      data-testid="button-apply-coupon"
                    >
                      {validatingCoupon ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          验证中...
                        </>
                      ) : (
                        "应用优惠码"
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="my-coupons" className="space-y-2">
                    {loadingCoupons ? (
                      <div className="py-4 text-center text-muted-foreground">加载中...</div>
                    ) : availableCoupons.count === 0 ? (
                      <div className="py-4 text-center text-muted-foreground text-sm">
                        暂无可用优惠券
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {couponsList.map((coupon: any) => (
                          <motion.div
                            key={coupon.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Card
                              className="p-3 cursor-pointer hover-elevate border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20"
                              onClick={() => handleApplyCouponFromList(coupon)}
                              data-testid={`card-coupon-${coupon.id}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm truncate">{coupon.code}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {coupon.discountType === "fixed_amount"
                                      ? `节省 ¥${(coupon.discountValue / 100).toFixed(2)}`
                                      : `享受 ${coupon.discountValue}% 折扣`}
                                  </p>
                                </div>
                                <Badge variant="default" className="bg-green-600 shrink-0">
                                  选择
                                </Badge>
                              </div>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* 安心承诺区 */}
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900" data-testid="section-assurance">
            <h4 className="font-semibold text-sm text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              悦聚安心保障
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>活动前<strong>48小时</strong>可免费改签至其他场次</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>首场体验不满意，<strong>下场活动免费</strong></span>
              </div>
              {isVIP && (
                <div className="flex items-start gap-2 text-xs text-green-700 dark:text-green-400">
                  <Crown className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>VIP专属：<strong>随时改签</strong>，无时间限制</span>
                </div>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="pt-4 border-t space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {selectedPlan === "single" && "单次体验"}
                  {selectedPlan === "pack3" && "入门3次包"}
                  {selectedPlan === "pack6" && "超值6次包"}
                  {selectedPlan === "vip_monthly" && "月度VIP"}
                  {selectedPlan === "vip_quarterly" && "季度VIP"}
                </span>
                <span>
                  {currencySymbol}{(basePrice / 100).toFixed(0)}
                </span>
              </div>
              {discount > 0 && selectedPlan === "single" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between text-sm text-green-600 dark:text-green-400"
                >
                  <span className="font-medium">优惠</span>
                  <span className="font-bold">-{currencySymbol}{(discount / 100).toFixed(2)}</span>
                </motion.div>
              )}
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="text-lg font-bold">总计</span>
                <motion.span
                  key={finalPrice}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold text-primary"
                >
                  {currencySymbol}{(finalPrice / 100).toFixed(0)}
                </motion.span>
              </div>
            </div>

            {/* 微信支付按钮 - 小程序环境默认使用微信支付 */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                size="lg"
                className="w-full text-lg font-bold shadow-lg bg-[#07C160]"
                onClick={handlePayment}
                disabled={createEventMutation.isPending || isProcessing}
                data-testid="button-pay"
              >
                {(createEventMutation.isPending || isProcessing) ? (
                  <>
                    <Loader className="h-5 w-5 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <SiWechat className="h-5 w-5 mr-2" />
                    {selectedPlan === "single" && "微信支付"}
                    {selectedPlan === "pack3" && "微信支付 · 购买3次包"}
                    {selectedPlan === "pack6" && "微信支付 · 购买6次包"}
                    {selectedPlan === "vip_monthly" && "微信支付 · 开通月度VIP"}
                    {selectedPlan === "vip_quarterly" && "微信支付 · 开通季度VIP"}
                  </>
                )}
              </Button>
            </motion.div>

            {/* 说明文字 */}
            <div className="text-xs text-center text-muted-foreground space-y-1">
              {selectedPlan === "pack3" && <p><Package className="inline h-3 w-3 mr-1" />3次包90天内有效，可用于任意活动</p>}
              {selectedPlan === "pack6" && <p><Package className="inline h-3 w-3 mr-1" />6次包半年内有效，可用于任意活动</p>}
              {isVIP && <p><Crown className="inline h-3 w-3 mr-1" />VIP期间无限参与所有活动 + 每月携友特权</p>}
              {selectedPlan === "single" && <p><Sparkles className="inline h-3 w-3 mr-1" />支付后立即进入匹配队列</p>}
              <p className="flex items-center justify-center gap-2">
                <Shield className="h-3 w-3" />
                <SiWechat className="h-3 w-3 text-[#07C160]" />
                <span>微信安全支付</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
