import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Gift, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface ExpiringCoupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  validUntil: string;
  daysRemaining: number;
  isUrgent: boolean;
  isUsed: boolean;
  source: string;
}

interface ExpiringCouponsResponse {
  expiringCoupons: ExpiringCoupon[];
  totalExpiring: number;
  urgentCount: number;
}

interface CouponExpiryReminderProps {
  onUseCoupon?: () => void;
  className?: string;
  withinDays?: number;
  dismissible?: boolean;
}

export function CouponExpiryReminder({
  onUseCoupon,
  className = "",
  withinDays = 7,
  dismissible = true,
}: CouponExpiryReminderProps) {
  const [dismissed, setDismissed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<ExpiringCouponsResponse>({
    queryKey: ['/api/user/coupons/expiring', withinDays],
    enabled: !dismissed,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const savedDismissed = localStorage.getItem('couponExpiryDismissed');
    if (savedDismissed) {
      const parsed = JSON.parse(savedDismissed);
      if (parsed.date === new Date().toDateString()) {
        setDismissedIds(new Set(parsed.ids));
      }
    }
  }, []);

  if (isLoading || dismissed || !data || data.totalExpiring === 0) {
    return null;
  }

  const visibleCoupons = data.expiringCoupons.filter(c => !dismissedIds.has(c.id));
  if (visibleCoupons.length === 0) {
    return null;
  }

  const formatDiscount = (coupon: ExpiringCoupon) => {
    if (coupon.discountType === "percentage") {
      return `${coupon.discountValue}%折扣`;
    } else {
      return `¥${coupon.discountValue / 100}优惠`;
    }
  };

  const handleDismissCoupon = (couponId: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(couponId);
    setDismissedIds(newDismissed);
    localStorage.setItem('couponExpiryDismissed', JSON.stringify({
      date: new Date().toDateString(),
      ids: Array.from(newDismissed),
    }));
  };

  const handleDismissAll = () => {
    setDismissed(true);
    localStorage.setItem('couponExpiryDismissedAll', new Date().toDateString());
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 ${className}`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <h3 className="font-medium text-amber-800 dark:text-amber-200">
              优惠券即将过期提醒
            </h3>
            {data.urgentCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {data.urgentCount} 张紧急
              </Badge>
            )}
          </div>
          {dismissible && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-amber-600 hover:text-amber-800"
              onClick={handleDismissAll}
              data-testid="button-dismiss-coupon-reminders"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {visibleCoupons.map((coupon) => (
            <motion.div
              key={coupon.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`flex items-center justify-between p-3 rounded-md ${
                coupon.isUrgent
                  ? "bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800"
                  : "bg-white dark:bg-background/50 border border-amber-100 dark:border-amber-900"
              }`}
              data-testid={`coupon-expiry-item-${coupon.id}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  coupon.isUrgent
                    ? "bg-red-200 dark:bg-red-800"
                    : "bg-amber-100 dark:bg-amber-800"
                }`}>
                  {coupon.isUrgent ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300" />
                  ) : (
                    <Gift className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {formatDiscount(coupon)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {coupon.code}
                    </Badge>
                  </div>
                  <p className={`text-sm ${
                    coupon.isUrgent
                      ? "text-red-600 dark:text-red-300"
                      : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {coupon.daysRemaining === 1
                      ? "明天过期"
                      : coupon.daysRemaining <= 0
                      ? "今天过期"
                      : `${coupon.daysRemaining} 天后过期`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onUseCoupon && (
                  <Button
                    size="sm"
                    variant={coupon.isUrgent ? "default" : "outline"}
                    onClick={onUseCoupon}
                    data-testid={`button-use-coupon-${coupon.id}`}
                  >
                    立即使用
                  </Button>
                )}
                {dismissible && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDismissCoupon(coupon.id)}
                    data-testid={`button-dismiss-coupon-${coupon.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {data.totalExpiring > 1 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 text-center">
            共有 {data.totalExpiring} 张优惠券即将过期，请尽快使用
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function CouponExpiryBadge({ withinDays = 7 }: { withinDays?: number }) {
  const { data } = useQuery<ExpiringCouponsResponse>({
    queryKey: ['/api/user/coupons/expiring', withinDays],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  if (!data || data.totalExpiring === 0) {
    return null;
  }

  return (
    <Badge
      variant={data.urgentCount > 0 ? "destructive" : "secondary"}
      className="text-xs animate-pulse"
      data-testid="badge-expiring-coupons"
    >
      {data.urgentCount > 0 ? (
        <>
          <AlertTriangle className="h-3 w-3 mr-1" />
          {data.urgentCount}
        </>
      ) : (
        <>
          <Clock className="h-3 w-3 mr-1" />
          {data.totalExpiring}
        </>
      )}
    </Badge>
  );
}
