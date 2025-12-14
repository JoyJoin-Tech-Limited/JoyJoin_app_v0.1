import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, ChevronUp, Sparkles, MessageCircle, Heart, Lightbulb } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useQuery } from "@tanstack/react-query";

interface CuratedTopic {
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "deep";
  recommendReason?: string;
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
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
    duration: 25,
    dragFree: false,
  });
  
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const sceneConfig = isGirlsNight ? GIRLS_NIGHT_CONFIG : SCENE_CONFIG[eventType];
  const isDimEnvironment = venueIsDim ?? sceneConfig.isDarkVenue;

  const { data: curatedData, isLoading } = useQuery<CuratedTopicsResponse>({
    queryKey: ["/api/icebreakers/curated", eventId],
    enabled: !!eventId && open,
  });

  const topics = curatedData?.curatedTopics || [];
  const currentTopic = topics[currentIndex];
  const totalTopics = topics.length;

  const onSelect = useCallback(() => {
    if (emblaApi && topics.length > 0) {
      const index = emblaApi.selectedScrollSnap();
      setCurrentIndex(index % topics.length);
    }
  }, [emblaApi, topics.length]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      if (emblaApi) {
        emblaApi.scrollTo(0);
      }
    }
  }, [open, emblaApi]);

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
  const difficultyConfig = currentTopic ? DIFFICULTY_CONFIG[currentTopic.difficulty] : DIFFICULTY_CONFIG.easy;
  const CategoryIcon = currentTopic?.category ? (CATEGORY_ICONS[currentTopic.category] || Sparkles) : Sparkles;

  const handleNextTopic = () => {
    if (emblaApi) {
      if (currentIndex >= totalTopics - 1) {
        emblaApi.scrollTo(0);
      } else {
        emblaApi.scrollNext();
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className={`h-[95vh] rounded-t-3xl border-0 p-0 ${sceneConfig.background} [&>button]:hidden`}
        data-testid="sheet-icebreaker-cards"
      >
        <div className="relative h-full overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-t ${sceneConfig.particles} pointer-events-none`} />

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
                  className="text-white/80 hover:text-white hover:bg-white/10 relative z-50"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-close-icebreaker"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </SheetHeader>

            <div className="flex-1 flex flex-col items-center justify-center py-6 overflow-hidden">
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <p className="text-white/70 text-sm">小悦正在精选话题...</p>
                </div>
              ) : totalTopics > 0 ? (
                <div className="w-full max-w-sm overflow-hidden" ref={emblaRef}>
                  <div className="flex touch-pan-y" style={{ touchAction: "pan-y" }}>
                    {topics.map((topic, idx) => (
                      <div
                        key={idx}
                        className="min-w-full flex items-center justify-center flex-shrink-0 p-4"
                        style={{ willChange: "transform" }}
                      >
                        <div
                          className={`relative ${cardStyles.cardBg} rounded-2xl p-6 shadow-md w-full ${
                            isDimEnvironment ? "ring-1 ring-white/10" : ""
                          }`}
                          data-testid={`card-icebreaker-topic-${idx}`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <CategoryIcon className={`h-4 w-4 ${
                                isDimEnvironment ? "text-white" : DIFFICULTY_CONFIG[topic.difficulty].color
                              }`} />
                              <Badge 
                                variant="secondary" 
                                className={`text-xs border-0 ${
                                  isDimEnvironment 
                                    ? "bg-white/20 text-white" 
                                    : `${DIFFICULTY_CONFIG[topic.difficulty].bgColor} ${DIFFICULTY_CONFIG[topic.difficulty].color}`
                                }`}
                              >
                                {DIFFICULTY_CONFIG[topic.difficulty].label}
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
                              {topic.category}
                            </Badge>
                          </div>

                          <p className={`${cardStyles.fontSize} font-medium ${cardStyles.textColor} leading-relaxed min-h-[80px] flex items-center break-words whitespace-pre-wrap overflow-hidden`}>
                            {topic.question}
                          </p>

                          {topic.recommendReason && (
                            <div className={`mt-4 rounded-xl p-3 ${
                              isDimEnvironment 
                                ? "bg-white/10 backdrop-blur-sm" 
                                : "bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10"
                            }`}>
                              <div className={`flex items-start gap-2 ${
                                isDimEnvironment ? "text-white/90" : "text-foreground/80"
                              }`}>
                                <Sparkles className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                                  isDimEnvironment ? "text-yellow-300" : "text-primary"
                                }`} />
                                <span className="text-sm leading-relaxed">{topic.recommendReason}</span>
                              </div>
                            </div>
                          )}

                          <div className={`mt-4 pt-4 border-t ${cardStyles.borderColor}`}>
                            <div className={`flex items-center justify-between text-xs ${cardStyles.mutedColor}`}>
                              <span>{idx + 1} / {totalTopics}</span>
                              <div className="flex items-center gap-1">
                                <ChevronUp className="h-3 w-3" />
                                <span>滑动换话题</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-white/70">
                  <p>暂无话题</p>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 space-y-4">
              <div className="flex justify-center gap-1.5">
                {topics.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentIndex 
                        ? "w-6 bg-white" 
                        : idx < currentIndex 
                          ? "w-1.5 bg-white/50" 
                          : "w-1.5 bg-white/30"
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="secondary"
                className="w-full bg-white/20 hover:bg-white/30 text-white border-0"
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
