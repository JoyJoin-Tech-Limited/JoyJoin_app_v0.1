import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, MapPin, Sparkles, Users, Shield, Heart, HelpCircle, Timer, Flame, Gift, UserCheck, Utensils } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import BlindBoxInfoSheet from "./BlindBoxInfoSheet";
import JoinBlindBoxSheet from "./JoinBlindBoxSheet";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { getCountdown, formatTimeStringToChinese, type UrgencyLevel } from "@/lib/chineseDateTime";

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
}: BlindBoxEventCardProps) {
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("[BlindBoxEventCard] opening JoinBlindBoxSheet with poolId:", poolId);
    setJoinSheetOpen(true);
  };

  const handleFlip = () => {
    triggerHaptic();
    setIsFlipped(!isFlipped);
  };

  const chineseTime = formatTimeStringToChinese(time);

  const gameplaySteps = [
    { icon: Gift, title: "盲抽匹配", desc: "AI为你挑选志趣相投的同伴" },
    { icon: UserCheck, title: "组队成功", desc: "确认参与，认识新朋友" },
    { icon: Utensils, title: "线下见面", desc: "享受精心策划的小聚" },
  ];

  const trustPoints = [
    { icon: Shield, text: "实名认证" },
    { icon: Heart, text: "匿名评价" },
  ];

  return (
    <>
      <div 
        className="relative h-[220px]"
        style={{ perspective: "1000px" }}
      >
        <motion.div
          className="relative w-full h-full cursor-pointer"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }}
          onClick={handleFlip}
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
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full pointer-events-none" />
              
              <div className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <h3 className="font-brand font-bold text-lg text-muted-foreground/60 mb-2">
                      {mysteryTitle}
                    </h3>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>
                          {date} {chineseTime}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-xs px-2 py-0.5 rounded-md"
                        data-testid={`badge-event-type-${eventType}`}
                      >
                        {eventType}
                      </Badge>
                      {isGirlsNight && (
                        <Badge
                          variant="default"
                          className="text-xs px-2 py-0.5 rounded-md bg-pink-500 hover:bg-pink-600"
                          data-testid="badge-girls-night"
                        >
                          Girls Night
                        </Badge>
                      )}
                    </div>
                  </div>

                  {registrationDeadline && (
                    <CountdownBadge deadline={registrationDeadline} />
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-4 w-4" />
                  <span>{area}</span>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>4-6人</span>
                    <span className="text-xs">
                      • {isGirlsNight ? "仅限女生" : "男女比例平衡"}
                    </span>
                  </div>
                  
                  {registrationCount >= 10 ? (
                    <div className="flex items-center gap-1.5" data-testid={`social-proof-${id}`}>
                      <div className="flex -space-x-2">
                        {sampleArchetypes.slice(0, 3).map((archetype, index) => {
                          const imgSrc = getArchetypeImage(archetype);
                          return imgSrc ? (
                            <div
                              key={index}
                              className="w-6 h-6 rounded-full border-2 border-background bg-muted overflow-hidden"
                              style={{ zIndex: 3 - index }}
                            >
                              <img 
                                src={imgSrc} 
                                alt={archetype}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : null;
                        })}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {registrationCount}人已报名
                      </span>
                    </div>
                  ) : sampleArchetypes.length > 0 && (
                    <div className="flex -space-x-2" data-testid={`avatars-${id}`}>
                      {sampleArchetypes.slice(0, 3).map((archetype, index) => {
                        const imgSrc = getArchetypeImage(archetype);
                        return imgSrc ? (
                          <div
                            key={index}
                            className="w-6 h-6 rounded-full border-2 border-background bg-muted overflow-hidden"
                            style={{ zIndex: 3 - index }}
                          >
                            <img 
                              src={imgSrc} 
                              alt={archetype}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button
                    className="flex-1"
                    size="default"
                    onClick={handleJoinClick}
                    data-testid={`button-join-${id}`}
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    立即参与
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
                        aria-label="了解盲盒玩法"
                        data-testid={`button-flip-${id}`}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>了解盲盒玩法</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </Card>
          </div>

          {/* 背面 - 盲盒玩法引导 */}
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
                  <h3 className="font-semibold text-sm">盲盒玩法</h3>
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

                {/* 安心保障 */}
                <div className="flex items-center justify-center gap-3 py-1.5 px-2 rounded-lg bg-background/60 border border-primary/10 mb-2">
                  {trustPoints.map((point, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <point.icon className="h-3 w-3 text-primary" />
                      <span className="text-[10px] text-muted-foreground">{point.text}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button
                    className="flex-1"
                    size="default"
                    onClick={handleJoinClick}
                    data-testid={`button-join-back-${id}`}
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    立即参与
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

      <JoinBlindBoxSheet
        open={joinSheetOpen}
        onOpenChange={setJoinSheetOpen}
        eventData={{
          poolId: poolId ?? null,
          date,
          time,
          eventType,
          area,
          priceTier,
          isAA,
          isGirlsNight,
          city,
        }}
      />
    </>
  );
}
