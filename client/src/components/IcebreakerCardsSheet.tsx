import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, ChevronUp, Sparkles, MessageCircle, Heart, Lightbulb } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

interface CuratedTopic {
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "deep";
}

interface CuratedTopicsResponse {
  atmospherePrediction: {
    type: string;
    title: string;
    description: string;
    energyScore: number;
    highlight: string;
    suggestedTopics: string[];
  };
  curatedTopics: CuratedTopic[];
  isArchitectCurated: boolean;
  commonInterests?: string[];
}

type VenueScene = "饭局" | "酒局" | "咖啡" | "徒步" | "桌游" | "其他";

interface IcebreakerCardsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventType?: VenueScene;
  isGirlsNight?: boolean;
  reducedMotion?: boolean;
  venueIsDim?: boolean;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  easy: { 
    label: "聊着玩", 
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10"
  },
  medium: { 
    label: "有点意思", 
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10"
  },
  deep: { 
    label: "走心聊", 
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10"
  },
};

const CATEGORY_ICONS: Record<string, typeof Sparkles> = {
  "聊着玩": MessageCircle,
  "走心聊": Heart,
  "看情况": Lightbulb,
};

const SCENE_CONFIG: Record<VenueScene, { 
  background: string; 
  particles: string;
  isDarkVenue: boolean;
}> = {
  "饭局": {
    background: "bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-500",
    particles: "from-purple-300/20 to-fuchsia-300/10",
    isDarkVenue: false,
  },
  "酒局": {
    background: "bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950",
    particles: "from-indigo-400/15 to-purple-400/10",
    isDarkVenue: true,
  },
  "咖啡": {
    background: "bg-gradient-to-br from-amber-700 via-orange-600 to-yellow-500",
    particles: "from-amber-300/20 to-orange-300/10",
    isDarkVenue: false,
  },
  "徒步": {
    background: "bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500",
    particles: "from-emerald-300/20 to-teal-300/10",
    isDarkVenue: false,
  },
  "桌游": {
    background: "bg-gradient-to-br from-blue-700 via-indigo-600 to-purple-500",
    particles: "from-blue-300/20 to-indigo-300/10",
    isDarkVenue: false,
  },
  "其他": {
    background: "bg-gradient-to-br from-gray-700 via-slate-600 to-zinc-500",
    particles: "from-gray-300/20 to-slate-300/10",
    isDarkVenue: false,
  },
};

const GIRLS_NIGHT_CONFIG = {
  background: "bg-gradient-to-br from-pink-600 via-rose-500 to-pink-400",
  particles: "from-pink-300/20 to-rose-300/10",
  isDarkVenue: false,
};

export default function IcebreakerCardsSheet({
  open,
  onOpenChange,
  eventId,
  eventType = "饭局",
  isGirlsNight = false,
  reducedMotion = false,
  venueIsDim,
}: IcebreakerCardsSheetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const sceneConfig = isGirlsNight ? GIRLS_NIGHT_CONFIG : SCENE_CONFIG[eventType];
  const isDimEnvironment = venueIsDim ?? sceneConfig.isDarkVenue;
  
  const y = useMotionValue(0);
  const opacity = reducedMotion ? undefined : useTransform(y, [-100, 0], [0.5, 1]);
  const scale = reducedMotion ? undefined : useTransform(y, [-100, 0], [0.95, 1]);

  const { data: curatedData, isLoading } = useQuery<CuratedTopicsResponse>({
    queryKey: ["/api/icebreakers/curated", eventId],
    enabled: !!eventId && open,
  });

  const topics = curatedData?.curatedTopics || [];
  const currentTopic = topics[currentIndex];
  const totalTopics = topics.length;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y < -50 && !isAnimating && currentIndex < totalTopics - 1) {
      setIsAnimating(true);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const handleNextTopic = () => {
    if (!isAnimating && currentIndex < totalTopics - 1) {
      setIsAnimating(true);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 300);
    } else if (currentIndex >= totalTopics - 1) {
      setCurrentIndex(0);
    }
  };

  const getCardStyles = () => {
    if (isDimEnvironment) {
      return {
        cardBg: "bg-slate-900/95 dark:bg-slate-950/95",
        textColor: "text-white",
        mutedColor: "text-white/70",
        borderColor: "border-white/20",
        fontSize: "text-xl",
      };
    }
    return {
      cardBg: "bg-white/95 dark:bg-gray-900/95",
      textColor: "text-foreground",
      mutedColor: "text-muted-foreground",
      borderColor: "border-muted/30",
      fontSize: "text-lg",
    };
  };
  
  const cardStyles = getCardStyles();

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
    }
  }, [open]);

  const difficultyConfig = currentTopic ? DIFFICULTY_CONFIG[currentTopic.difficulty] : DIFFICULTY_CONFIG.easy;
  const CategoryIcon = currentTopic?.category ? (CATEGORY_ICONS[currentTopic.category] || Sparkles) : Sparkles;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className={`h-[95vh] rounded-t-3xl border-0 p-0 ${sceneConfig.background}`}
        data-testid="sheet-icebreaker-cards"
      >
        <div className="relative h-full overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-t ${sceneConfig.particles} pointer-events-none`} />
          {!reducedMotion && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(isDimEnvironment ? 3 : 6)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute w-32 h-32 rounded-full blur-2xl ${
                    isDimEnvironment ? "bg-white/3" : "bg-white/5"
                  }`}
                  animate={{
                    x: [0, 30, 0],
                    y: [0, -20, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 4 + i,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.5,
                  }}
                  style={{
                    left: `${10 + i * 15}%`,
                    top: `${20 + (i % 3) * 25}%`,
                  }}
                />
              ))}
            </div>
          )}

          <div className="relative z-10 flex flex-col h-full p-4">
            <SheetHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white/30">
                    <AvatarFallback className="bg-white/20 text-white text-sm font-medium">
                      小悦
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <SheetTitle className="text-white text-base font-semibold">
                      小悦为你们准备的话题
                    </SheetTitle>
                    <p className="text-white/70 text-xs mt-0.5">
                      {curatedData?.commonInterests?.length 
                        ? `基于共同兴趣：${curatedData.commonInterests.slice(0, 2).join("、")}`
                        : `基于${totalTopics}位伙伴的性格精选`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-close-icebreaker"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </SheetHeader>

            <div className="flex-1 flex flex-col items-center justify-center py-6">
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <p className="text-white/70 text-sm">小悦正在精选话题...</p>
                </div>
              ) : currentTopic ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    className="relative w-full max-w-sm"
                    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 50, scale: 0.9 }}
                    animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -100, scale: 0.9 }}
                    transition={reducedMotion 
                      ? { duration: 0.15 } 
                      : { type: "spring", stiffness: 300, damping: 25 }
                    }
                  >
                    {!reducedMotion && (
                      <>
                        <div className="absolute -bottom-2 left-4 right-4 h-full rounded-2xl bg-white/10 backdrop-blur-sm" />
                        <div className="absolute -bottom-4 left-8 right-8 h-full rounded-2xl bg-white/5 backdrop-blur-sm" />
                      </>
                    )}
                    
                    <motion.div
                      className={`relative ${cardStyles.cardBg} backdrop-blur-xl rounded-2xl p-6 shadow-2xl cursor-grab active:cursor-grabbing ${
                        isDimEnvironment ? "ring-1 ring-white/10" : ""
                      }`}
                      style={reducedMotion ? {} : { y, opacity, scale }}
                      drag={reducedMotion ? false : "y"}
                      dragConstraints={{ top: 0, bottom: 0 }}
                      dragElastic={0.2}
                      onDragEnd={handleDragEnd}
                      whileTap={reducedMotion ? {} : { scale: 0.98 }}
                      data-testid="card-icebreaker-topic"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className={`h-4 w-4 ${
                            isDimEnvironment ? "text-white" : difficultyConfig.color
                          }`} />
                          <Badge 
                            variant="secondary" 
                            className={`text-xs border-0 ${
                              isDimEnvironment 
                                ? "bg-white/20 text-white" 
                                : `${difficultyConfig.bgColor} ${difficultyConfig.color}`
                            }`}
                          >
                            {difficultyConfig.label}
                          </Badge>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            isDimEnvironment 
                              ? "text-white/80 border-white/30" 
                              : "text-muted-foreground"
                          }`}
                        >
                          {currentTopic.category}
                        </Badge>
                      </div>

                      <p className={`${cardStyles.fontSize} font-medium ${cardStyles.textColor} leading-relaxed min-h-[80px] flex items-center`}>
                        {currentTopic.question}
                      </p>

                      <div className={`mt-6 pt-4 border-t ${cardStyles.borderColor}`}>
                        <div className={`flex items-center justify-between text-xs ${cardStyles.mutedColor}`}>
                          <span>{currentIndex + 1} / {totalTopics}</span>
                          <div className="flex items-center gap-1">
                            <ChevronUp className="h-3 w-3" />
                            <span>{reducedMotion ? "点击换话题" : "上滑换话题"}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="text-center text-white/70">
                  <p>暂无话题</p>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 space-y-4">
              <div className="flex justify-center gap-1.5">
                {topics.map((_, idx) => (
                  reducedMotion ? (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentIndex 
                          ? "w-6 bg-white" 
                          : idx < currentIndex 
                            ? "w-1.5 bg-white/50" 
                            : "w-1.5 bg-white/30"
                      }`}
                    />
                  ) : (
                    <motion.div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentIndex 
                          ? "w-6 bg-white" 
                          : idx < currentIndex 
                            ? "w-1.5 bg-white/50" 
                            : "w-1.5 bg-white/30"
                      }`}
                      layoutId={`dot-${idx}`}
                    />
                  )
                ))}
              </div>

              <Button
                variant="secondary"
                className="w-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                onClick={handleNextTopic}
                data-testid="button-next-topic"
              >
                {currentIndex >= totalTopics - 1 ? "从头开始" : "下一个话题"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
