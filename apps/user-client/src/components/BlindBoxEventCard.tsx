import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, MapPin, Sparkles, Shield, Eye, HelpCircle, Timer, Flame, Gift, UserCheck, Utensils, Lock, Heart } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import BlindBoxInfoSheet from "./BlindBoxInfoSheet";
import JoinEventPoolSheet from "./event-pool-registration/JoinEventPoolSheet";
import PreJoinVibeBriefSheet from "./PreJoinVibeBriefSheet";
import { PoolMomentumVisual } from "./PoolMomentumVisual";
import FitHintBadge from "./FitHintBadge";
import PoolVibeBadge from "./PoolVibeBadge";
import { getCountdown, type UrgencyLevel } from "@/lib/chineseDateTime";

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
   * upgraded CTA copy to the first card in the discovery list.
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
  const [isFlipped, setIsFlipped] = useState(false);
  const [isJoinHovered, setIsJoinHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();

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

  const handleFlip = () => {
    triggerHaptic();
    setIsFlipped(!isFlipped);
  };

  const gameplaySteps = [
    { icon: Gift, title: "AI 盲配", desc: "从真实喜好出发，不靠脸，靠缘分" },
    { icon: UserCheck, title: "组队成功", desc: "确认参与，见见新朋友" },
    { icon: Utensils, title: "线下见面", desc: "一起吃饭 / 小酌，轻松真实" },
  ];

  const trustPoints = [
    { icon: Shield, text: "手机号验证" },
    { icon: Heart, text: "匿名评价" },
  ];

  // Wave 3: intent-aware CTA copy and glow gradients for the featured (first) card
  const isWineEvent = eventType === "酒局";
  const featuredCtaCopy = isWineEvent ? "点燃这一局" : "开启这场缘";
  const FeaturedCtaIcon = isWineEvent ? Flame : Sparkles;
  const featuredGlowGradient = isWineEvent
    ? "linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(139,92,246,0.18) 100%)"
    : "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(236,72,153,0.18) 100%)";
  const featuredCtaClass = "bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90 shadow-md";

  return (
    <>
      {/* Wave 3: featured-card glow halo — soft living ring for the first card */}
      <div
        className="relative h-[240px]"
        style={{ perspective: "1000px" }}
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
        <motion.div
          className="relative z-10 w-full h-full cursor-pointer"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }}
          onClick={handleFlip}
          whileHover={prefersReducedMotion ? {} : { scale: 1.015, transition: { duration: 0.18 } }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.985, transition: { duration: 0.1 } }}
        >
          {/* 正面 - 活动信息 */}
          <div 
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden" }}
          >
            <Card
              className="h-full relative overflow-hidden border shadow-sm"
              data-testid={`card-blindbox-${id}`}
            >
              {/* Left accent bar — colour varies by event type */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg pointer-events-none ${
                isGirlsNight ? 'bg-pink-400' : eventType === '酒局' ? 'bg-amber-400' : 'bg-violet-500'
              }`} />
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full pointer-events-none" />
              
              <div className="p-4 h-full flex flex-col">
                {/* Wave 3: featured badge */}
                {isFeatured && (
                  <div className="flex items-center gap-1 mb-1.5 -mt-0.5">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-primary/90 to-violet-500/90 text-white select-none"
                      aria-label="今日推荐活动"
                    >
                      ✦ 今日推荐
                    </span>
                  </div>
                )}

                {/* ── HERO: Blind-box promise first ── */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lock className="h-3 w-3 text-primary/70 shrink-0" aria-hidden="true" />
                  <span className="text-[11px] font-semibold text-primary/80 tracking-wide">
                    活动已定，桌友待揭晓
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    {/* Eyebrow — event type + girls-night framing */}
                    <div className="flex items-center gap-1.5 mb-1">
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

                    {/* Title — vibe promise, styled as an invitation not a listing */}
                    <h3 className="font-brand font-bold text-base leading-snug text-foreground/75 mb-0">
                      {mysteryTitle}
                    </h3>
                  </div>

                  {registrationDeadline && (
                    <CountdownBadge deadline={registrationDeadline} />
                  )}
                </div>

                {/* ── HIERARCHY: Formation signal (who's coming) ── */}
                <div className="flex items-center gap-1.5 mb-1.5 min-h-0">
                  <PoolVibeBadge sampleArchetypes={sampleArchetypes} />
                  <FitHintBadge sampleArchetypes={sampleArchetypes} eventType={eventType} isGirlsNight={isGirlsNight} />
                </div>

                {/* Premium live-queue momentum visual */}
                <PoolMomentumVisual
                  sampleArchetypes={sampleArchetypes}
                  registrationCount={registrationCount}
                  className="mb-1.5"
                />

                {/* ── HIERARCHY: Logistics (time & place) — secondary ── */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-primary/70" />
                    {date} {time}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary/70" />
                    {area}
                  </span>
                </div>

                {/* ── Single dominant CTA ── */}
                <div className="flex gap-2 mt-auto">
                  <motion.div
                    className="flex-1"
                    onHoverStart={() => setIsJoinHovered(true)}
                    onHoverEnd={() => setIsJoinHovered(false)}
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
                  >
                    <Button
                      className={`w-full relative overflow-hidden transition-all duration-150 active:scale-[0.98] ${
                        isFeatured ? featuredCtaClass : ""
                      }`}
                      size="default"
                      onClick={handleJoinClick}
                      disabled={!poolId}
                      data-testid={`button-join-${id}`}
                    >
                      {isFeatured ? (
                        <FeaturedCtaIcon className="h-4 w-4 mr-1.5" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1.5" />
                      )}
                      {isFeatured ? featuredCtaCopy : "入座这一桌"}
                      {/* Subtle shimmer sweep on hover */}
                      {!prefersReducedMotion && (
                        <motion.span
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
                          initial={{ x: "-100%" }}
                          animate={{ x: isJoinHovered ? "100%" : "-100%" }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          aria-hidden="true"
                        />
                      )}
                    </Button>
                  </motion.div>
                  {onDetailsClick ? (
                    <Button
                      variant="outline"
                      size="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDetailsClick();
                      }}
                      data-testid={`button-details-${id}`}
                    >
                      了解
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFlip();
                          }}
                          aria-label="了解盲盒玩法"
                          data-testid={`button-flip-${id}`}
                        >
                          <HelpCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>怎么玩？</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* ── Trust framing: sealed invitation language ── */}
                <div className="flex items-center justify-center gap-2 mt-1.5 pt-1.5 border-t border-border/30">
                  <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/60">
                    <Eye className="h-2.5 w-2.5" aria-hidden="true" />
                    活动公开
                  </span>
                  <span className="text-[9px] text-muted-foreground/30">·</span>
                  <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/60">
                    <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                    桌友入座后揭晓
                  </span>
                  <span className="text-[9px] text-muted-foreground/30">·</span>
                  <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/60">
                    <Shield className="h-2.5 w-2.5" aria-hidden="true" />
                    可随时退出
                  </span>
                </div>

                {/* Flip hint */}
                <motion.div
                  className="flex items-center justify-center gap-1 mt-0.5"
                  initial={{ opacity: 0.8 }}
                  animate={prefersReducedMotion ? { opacity: 0.8 } : { opacity: [0.8, 0.3, 0.8] }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 2.5, repeat: 2, ease: "easeInOut" }}
                >
                  <span className="text-[9px] text-muted-foreground/50 select-none">🎲 点卡片了解玩法</span>
                </motion.div>
              </div>
            </Card>
          </div>
          <div 
            className="absolute inset-0"
            style={{ 
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)"
            }}
          >
            <Card
              className="h-full relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10"
              data-testid={`card-blindbox-back-${id}`}
            >
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-2 border-primary/20" />
                <div className="absolute bottom-4 left-4 w-24 h-24 rounded-full border-2 border-primary/20" />
              </div>

              <div className="p-3 h-full flex flex-col relative">
                <div className="flex items-center gap-1.5 mb-2">
                  <Gift className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">JoyJoin 怎么玩？</h3>
                </div>

                {/* 三步流程 */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  {gameplaySteps.map((step, index) => (
                    <motion.div
                      key={index}
                      className="flex-1 flex flex-col items-center text-center"
                      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                      animate={{ opacity: isFlipped ? 1 : 0, y: isFlipped ? 0 : (prefersReducedMotion ? 0 : 10) }}
                      transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.1 + 0.2 }}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                        <step.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-xs font-semibold">{step.title}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{step.desc}</span>
                    </motion.div>
                  ))}
                </div>

                {/* 进度指示器 */}
                <div className="flex items-center justify-center gap-1 mb-2">
                  <div className="h-1 w-8 rounded-full bg-primary" />
                  <div className="h-1 w-8 rounded-full bg-primary/40" />
                  <div className="h-1 w-8 rounded-full bg-primary/20" />
                </div>

                {/* 安心保障 — 3-point trust (what's known / blind / exit) */}
                <div className="flex items-center justify-between gap-1 py-1.5 px-2 rounded-lg bg-background/60 border border-primary/10 mb-2">
                  {trustPoints.map((point, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <point.icon className="h-3 w-3 text-primary" />
                      <span className="text-[9px] text-muted-foreground">{point.text}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button
                    className="flex-1"
                    size="default"
                    onClick={handleJoinClick}
                    disabled={!poolId}
                    data-testid={`button-join-back-${id}`}
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    入座这一桌
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlip();
                        }}
                        aria-label="返回活动详情"
                        data-testid={`button-flip-back-${id}`}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>返回活动详情</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </Card>
          </div>
        </motion.div>
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
