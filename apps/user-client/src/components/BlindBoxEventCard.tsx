import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, MapPin, Sparkles, Users, Shield, Heart, RotateCcw, Lock, CheckCircle2, Clock } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import BlindBoxInfoSheet from "./BlindBoxInfoSheet";
import JoinBlindBoxSheet from "./JoinBlindBoxSheet";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { differenceInHours, differenceInDays, format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

type PriceTier = "150以下" | "150-200" | "200-300" | "300-500";

function formatDeadline(deadline: string): { text: string; isUrgent: boolean } {
  const deadlineDate = parseISO(deadline);
  const now = new Date();
  const hoursLeft = differenceInHours(deadlineDate, now);
  const daysLeft = differenceInDays(deadlineDate, now);
  
  if (hoursLeft <= 0) {
    return { text: "报名已截止", isUrgent: true };
  } else if (hoursLeft < 24) {
    return { text: `还剩${hoursLeft}小时`, isUrgent: true };
  } else if (daysLeft <= 3) {
    return { text: `还剩${daysLeft}天`, isUrgent: false };
  } else {
    return { text: `截止 ${format(deadlineDate, "M月d日 HH:mm", { locale: zhCN })}`, isUrgent: false };
  }
}

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

  const promises = [
    { icon: Heart, text: "AI精准匹配志趣相投" },
    { icon: Shield, text: "活动前隐藏真实身份" },
    { icon: Lock, text: "聊天记录不留痕" },
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
                          {date} {time}
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

                  <div className="relative">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
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

                {registrationDeadline && (
                  <div 
                    className={`flex items-center gap-1.5 text-xs mb-2 ${
                      formatDeadline(registrationDeadline).isUrgent 
                        ? 'text-destructive font-medium' 
                        : 'text-muted-foreground'
                    }`}
                    data-testid={`deadline-${id}`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDeadline(registrationDeadline).text}</span>
                  </div>
                )}

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
                        aria-label="查看保障"
                        data-testid={`button-flip-${id}`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>查看保障</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </Card>
          </div>

          {/* 背面 - 匹配承诺与隐私保障 */}
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
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">我们的承诺</h3>
                </div>

                <div className="space-y-2 flex-1">
                  {promises.map((promise, index) => (
                    <motion.div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded-lg bg-background/80 border border-primary/10"
                      initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                      animate={{ opacity: isFlipped ? 1 : 0, x: isFlipped ? 0 : (prefersReducedMotion ? 0 : -20) }}
                      transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.1 + 0.2 }}
                    >
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <promise.icon className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-xs font-medium leading-tight">{promise.text}</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />
                    </motion.div>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    className="flex-1"
                    size="default"
                    onClick={handleJoinClick}
                    data-testid={`button-join-back-${id}`}
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    立即参与
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlip();
                    }}
                    data-testid={`button-flip-back-${id}`}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
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
