import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Gift,
  Percent,
  Clock,
  ChevronRight,
  Sparkles,
  CircleDollarSign,
  Star,
  Ticket,
} from "lucide-react";
import { useState } from "react";
import type { Venue, VenueDeal } from "@joyjoin/shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface VenuePartnerCardProps {
  venue: Partial<Venue>;
  deals?: VenueDeal[];
  isRevealed?: boolean;
  eventDateTime?: Date | string;
}

function formatDiscountText(deal: VenueDeal): string {
  switch (deal.discountType) {
    case "percentage":
      return `${100 - (deal.discountValue || 0)}折`;
    case "fixed":
      return `立减¥${deal.discountValue}`;
    case "gift":
      return "赠品福利";
    default:
      return "专属优惠";
  }
}

function getDiscountIcon(type: string) {
  switch (type) {
    case "percentage":
      return <Percent className="h-4 w-4" />;
    case "fixed":
      return <CircleDollarSign className="h-4 w-4" />;
    case "gift":
      return <Gift className="h-4 w-4" />;
    default:
      return <Ticket className="h-4 w-4" />;
  }
}

function formatRedemptionMethod(method: string): string {
  switch (method) {
    case "show_page":
      return "出示本页面";
    case "code":
      return "报暗号";
    case "qr_code":
      return "扫码核销";
    default:
      return "现场使用";
  }
}

export default function VenuePartnerCard({
  venue,
  deals = [],
  isRevealed = true,
  eventDateTime,
}: VenuePartnerCardProps) {
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  
  const handleUseDeal = async (dealId: string) => {
    try {
      await apiRequest("POST", `/api/venue-deals/${dealId}/use`);
    } catch (error) {
      console.error("Failed to record deal usage:", error);
    }
  };

  if (!isRevealed) {
    return null;
  }

  const hasDeals = deals.length > 0;

  return (
    <Card className="overflow-hidden" data-testid="card-venue-partner">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            活动场地
          </CardTitle>
          {venue.partnerStatus === "active" && (
            <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-partner-status">
              <Star className="h-3 w-3" />
              悦聚合作场地
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            {venue.coverImageUrl ? (
              <img
                src={venue.coverImageUrl}
                alt={venue.name || "场地图片"}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                data-testid="img-venue-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-6 w-6 text-primary/60" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate" data-testid="text-venue-name">
                {venue.name || "待定场地"}
              </h4>
              {venue.address && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" data-testid="text-venue-address">
                  {venue.address}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {venue.priceRange && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-venue-price">
                    人均¥{venue.priceRange}
                  </Badge>
                )}
                {venue.priceNote && (
                  <span className="text-xs text-muted-foreground">
                    {venue.priceNote}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {hasDeals && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">悦聚专属优惠</span>
            </div>
            
            <div className="space-y-2">
              {deals.map((deal) => (
                <motion.div
                  key={deal.id}
                  layout
                  className="rounded-lg border border-amber-200/50 dark:border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 overflow-hidden"
                  data-testid={`card-deal-${deal.id}`}
                >
                  <button
                    onClick={() => {
                      setExpandedDealId(expandedDealId === deal.id ? null : deal.id);
                      if (expandedDealId !== deal.id) {
                        handleUseDeal(deal.id);
                      }
                    }}
                    className="w-full p-3 flex items-center gap-3 text-left hover-elevate"
                    data-testid={`button-expand-deal-${deal.id}`}
                  >
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                      {getDiscountIcon(deal.discountType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-700 dark:text-amber-400" data-testid={`text-discount-${deal.id}`}>
                          {formatDiscountText(deal)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          专属
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {deal.title}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedDealId === deal.id ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  
                  {expandedDealId === deal.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 pb-3 space-y-2"
                    >
                      {deal.description && (
                        <p className="text-xs text-muted-foreground" data-testid={`text-deal-description-${deal.id}`}>
                          {deal.description}
                        </p>
                      )}
                      
                      <div className="rounded-md bg-white/50 dark:bg-black/20 p-2 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <Ticket className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium">使用方式</span>
                          <span className="text-muted-foreground">
                            {formatRedemptionMethod(deal.redemptionMethod || "show_page")}
                          </span>
                        </div>
                        {deal.redemptionCode && (
                          <div className="flex items-center gap-2 text-xs">
                            <Gift className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-medium">暗号</span>
                            <span className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-400" data-testid={`text-redemption-code-${deal.id}`}>
                              {deal.redemptionCode}
                            </span>
                          </div>
                        )}
                        {(deal.validFrom || deal.validUntil) && (
                          <div className="flex items-center gap-2 text-xs">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              有效期：
                              {deal.validFrom && new Date(deal.validFrom).toLocaleDateString("zh-CN")}
                              {deal.validFrom && deal.validUntil && " - "}
                              {deal.validUntil && new Date(deal.validUntil).toLocaleDateString("zh-CN")}
                              {!deal.validFrom && !deal.validUntil && "长期有效"}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {deal.terms && (
                        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                          * {deal.terms}
                        </p>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {venue.tags && venue.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t">
            {venue.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
