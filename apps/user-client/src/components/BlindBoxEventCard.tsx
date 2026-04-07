import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Sparkles, Shield, HelpCircle, Timer, Flame, Lock, DollarSign } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import BlindBoxInfoSheet from "./BlindBoxInfoSheet";
import JoinEventPoolSheet from "./event-pool-registration/JoinEventPoolSheet";
import PreJoinVibeBriefSheet from "./PreJoinVibeBriefSheet";
import FitHintBadge from "./FitHintBadge";
import PoolVibeBadge from "./PoolVibeBadge";
import { getCountdown, type UrgencyLevel } from "@/lib/chineseDateTime";
import { getCurrencySymbol } from "@/lib/currency";

type PriceTier = "150以下" | "150-200" | "200-300" | "300-500";

interface BlindBoxEventCardProps {
  id: string;
  date: string;
  time: string;
  eventType: "饭局" | "酒局";
  area: string;
  mysteryTitle: string;
  priceTier?: PriceTier;
  isAA?: boolean;
  city?: "香港" | "深圳";
  isGirlsNight?: boolean;
  poolId?: string;
  registrationCount?: number;
  sampleArchetypes?: string[];
  registrationDeadline?: string;
  onDetailsClick?: () => void;
  /**
   * Wave 3 featured-card treatment: applies a premium glow halo and
   * upgraded emphasis to the first card in the discovery list.
   */
  isFeatured?: boolean;
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(15);
  }
}

function CountdownBadge({ deadline }: { deadline: string }) {
  const [countdown, setCountdown] = useState(() => getCountdown(deadline));
  const prefersReducedMotion = useReducedMotion();
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getCountdown(deadline));
    }, 60000);
    
    return () => clearInterval(interval);
  }, [deadline]);
  
  if (!countdown.shouldShow) return null;
  
  const urgencyStyles: Record<UrgencyLevel, string> = {
    calm: "bg-primary/10 text-primary border-primary/20",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    critical: "bg-destructive/10 text-destructive border-destructive/20",
    expired: "bg-muted text-muted-foreground border-muted",
  };
  
  const IconComponent = countdown.urgency === "critical" ? Flame : Timer;
  const shouldPulse = countdown.urgency === "critical" && !prefersReducedMotion;
  
  return (
    <motion.div
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${urgencyStyles[countdown.urgency]}`}
      animate={shouldPulse ? { opacity: [0.85, 1, 0.85] } : {}}
      transition={shouldPulse ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
      aria-live="polite"
      data-testid="countdown-badge"
    >
      <IconComponent className="h-3 w-3" />
      <span>{countdown.text}</span>
    </motion.div>
  );
}

export default function BlindBoxEventCard({
  id,
  date,
  time,
  eventType,
  area,
  mysteryTitle,
  priceTier,
  isAA,
  city,
  isGirlsNight,
  poolId,
  registrationCount = 0,
  sampleArchetypes = [],
  registrationDeadline,
  onDetailsClick,
  isFeatured = false,
}: BlindBoxEventCardProps) {
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [vibeBriefOpen, setVibeBriefOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const MIN_TABLE_SIZE = 4;
  const MAX_TABLE_SIZE = 6;
  const seatsNeeded = Math.max(MIN_TABLE_SIZE - registrationCount, 0);
  const progressPercent = Math.min((registrationCount / MIN_TABLE_SIZE) * 100, 100);
  const currencySymbol = getCurrencySymbol(city ?? "深圳");
  const priceSummary = priceTier ? `${currencySymbol}${priceTier}` : null;

  // [Event Pool layer] — pool readiness/threshold copy, never table-seating language
  const poolHeadline =
    registrationCount >= MIN_TABLE_SIZE
      ? "人已凑齐，揭晓来了"
      : registrationCount > 0
        ? `差 ${seatsNeeded} 人就能见真章`
        : "你来，局就热了";
  const poolDetail =
    registrationCount >= MIN_TABLE_SIZE
      ? `${registrationCount} 人已入池 · 小悦正在拼局`
      : registrationCount > 0
        ? `已有 ${registrationCount} 人入池 · 4–6 人才够热闹`
        : `4–6 人组局 · 你来第一个`;

  // [Bridge layer] — known info now; tablemates revealed only after 成局
  const promiseLine = "时间地点已定 · 伙伴是成局的惊喜";

  // [Event Pool layer] — CTA uses pool-join language, never "take a seat at this table"
  const ctaLabel = eventType === "酒局" ? "来凑这局酒" : "来凑这顿饭";

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!poolId) {
      console.warn("[BlindBoxEventCard] join clicked but no poolId — button should be disabled");
      return;
    }
    setVibeBriefOpen(true);
  };

  const handleProceedToJoin = () => {
    console.log("[BlindBoxEventCard] opening JoinEventPoolSheet with poolId:", poolId);
    setJoinSheetOpen(true);
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    if (onDetailsClick) {
      onDetailsClick();
      return;
    }
    setInfoSheetOpen(true);
  };

  // Wave 3: event-aware glow gradients for the featured (first) card
  const isWineEvent = eventType === "酒局";
  const FeaturedCtaIcon = isWineEvent ? Flame : Sparkles;
  const featuredGlowGradient = isWineEvent
    ? "linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(139,92,246,0.18) 100%)"
    : "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(236,72,153,0.18) 100%)";
  const featuredCtaClass = "bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90 shadow-md";

  return (
    <>
      {/* Wave 3: featured-card glow halo — soft living ring for the first card */}
      <div
        className="relative h-[280px]"
      >
        {isFeatured && !prefersReducedMotion && (
          <motion.div
            className="absolute -inset-[3px] rounded-xl pointer-events-none z-0"
            style={{ background: featuredGlowGradient }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
        )}
        {isFeatured && (
          <div
            className="absolute -inset-[3px] rounded-xl pointer-events-none z-0 border border-primary/20"
            aria-hidden="true"
          />
        )}
        <Card
          className="relative z-10 h-full overflow-hidden border shadow-sm"
          data-testid={`card-blindbox-${id}`}
        >
          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg pointer-events-none ${
            isGirlsNight ? "bg-pink-400" : eventType === "酒局" ? "bg-amber-400" : "bg-violet-500"
          }`} />
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full pointer-events-none" />

          <div className="p-4 h-full flex flex-col gap-3">
            {isFeatured && (
              <div className="flex items-center gap-1 -mt-0.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-primary/90 to-violet-500/90 text-white select-none"
                  aria-label="今日推荐活动"
                >
                  ✦ 今日推荐
                </span>
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                    data-testid={`badge-event-type-${eventType}`}
                  >
                    {eventType}
                  </Badge>
                  {isGirlsNight && (
                    <Badge
                      variant="default"
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-pink-500 hover:bg-pink-600"
                      data-testid="badge-girls-night"
                    >
                      Girls Night
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary/80 tracking-wide">
                  <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{promiseLine}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {registrationDeadline && <CountdownBadge deadline={registrationDeadline} />}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={handleDetailsClick}
                  data-testid={`button-details-${id}`}
                >
                  <HelpCircle className="h-3.5 w-3.5 mr-1" />
                  玩法详情
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-cn-display font-bold text-xl leading-snug text-foreground">
                {mysteryTitle}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap min-h-0">
                <PoolVibeBadge sampleArchetypes={sampleArchetypes} />
                <FitHintBadge sampleArchetypes={sampleArchetypes} eventType={eventType} isGirlsNight={isGirlsNight} />
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/8 via-primary/4 to-violet-500/6 px-3 py-2.5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* [Event Pool] Pool Pulse header: live indicator + module label */}
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <span className="flex items-center gap-1 shrink-0" aria-hidden="true">
                      <span className="text-[9px] font-bold text-primary/55 tracking-widest select-none">热度</span>
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        {!prefersReducedMotion && registrationCount > 0 && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                        )}
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${registrationCount > 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      </span>
                    </span>
                    <span>{poolHeadline}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {poolDetail}
                  </p>
                </div>
                {/* [Event Pool] Pool count — never implies table occupancy */}
                <span className="text-[11px] font-semibold text-primary/80 shrink-0">
                  {registrationCount > 0
                    ? (registrationCount >= MIN_TABLE_SIZE ? `${registrationCount} 人就位` : `${registrationCount} 人候局`)
                    : "虚位以待"}
                </span>
              </div>

              <div className="h-1.5 rounded-full bg-background/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(progressPercent, registrationCount > 0 ? 18 : 0)}%` }}
                  aria-label={`活动池成桌门槛进度 ${Math.round(progressPercent)}%`}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 min-w-0">
                <Calendar className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="truncate">{date} {time}</span>
              </span>
              <span className="flex items-center gap-1 min-w-0">
                <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="truncate">{area}</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {priceSummary && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border/60 bg-background/80 text-foreground/80">
                  <DollarSign className="h-3 w-3 text-primary/70" aria-hidden="true" />
                  预算 {priceSummary}
                </span>
              )}
              {isAA && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border/60 bg-background/80 text-foreground/80">
                  AA制
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border/60 bg-background/80 text-foreground/80">
                未成局自动退
              </span>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/35 px-3 py-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-primary/70 shrink-0" aria-hidden="true" />
                <span>已知时间与区域 · 成局前随时退 · 伙伴成局才揭晓</span>
              </div>
            </div>

            <Button
              className={`w-full mt-auto transition-all duration-150 active:scale-[0.98] ${
                isFeatured ? featuredCtaClass : ""
              }`}
              size="lg"
              onClick={handleJoinClick}
              disabled={!poolId}
              data-testid={`button-join-${id}`}
            >
              <FeaturedCtaIcon className="h-4 w-4 mr-1.5" />
              {ctaLabel}
            </Button>
          </div>
        </Card>
      </div>

      <BlindBoxInfoSheet
        open={infoSheetOpen}
        onOpenChange={setInfoSheetOpen}
        eventData={{
          date,
          time,
          eventType,
          area,
          priceTier,
          isAA,
          city,
        }}
      />

      {poolId && (
        <PreJoinVibeBriefSheet
          open={vibeBriefOpen}
          onOpenChange={setVibeBriefOpen}
          onProceedToJoin={handleProceedToJoin}
          eventType={eventType}
          area={area}
        />
      )}

      {poolId && joinSheetOpen && (
        <JoinEventPoolSheet
          open={joinSheetOpen}
          onOpenChange={setJoinSheetOpen}
          poolData={{
            poolId,
            title: mysteryTitle,
            date: `${date} ${time}`,
            area,
            city: city ?? "深圳",
            eventType,
            registrationCount,
          }}
        />
      )}
    </>
  );
}
