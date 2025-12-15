import { useState, useMemo, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { motion } from 'framer-motion';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Gamepad2, 
  Shuffle, 
  Clock, 
  Users, 
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Palette,
  Heart,
  Target,
  RefreshCw,
  LogOut,
  Play,
  Check,
} from 'lucide-react';
import type { TopicCard } from '@shared/topicCards';
import { icebreakerGames, sceneLabels, type IcebreakerGame } from '@shared/icebreakerGames';
import { Wine, Utensils, Globe } from 'lucide-react';
import { ActivitySpotlight } from './ActivitySpotlight';
import { GameDetailView } from './GameDetailView';

export interface RecommendedTopic {
  topic: TopicCard;
  reason: string;
  score?: number;
}

interface GalleryItem {
  id: string;
  type: 'topic' | 'game';
  title: string;
  subtitle: string;
  category: string;
  difficulty: string;
  gradient: string;
  icon: typeof MessageCircle;
  data: TopicCard | IcebreakerGame;
  isRecommended?: boolean;
  reason?: string;
  scene?: 'dinner' | 'bar' | 'both';
  drinkingWarning?: string;
}

interface GameRecommendation {
  gameId: string;
  gameName: string;
  reason: string;
}

interface IcebreakerToolkitProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: TopicCard[];
  recommendedTopics?: RecommendedTopic[];
  onSelectTopic: (topic: TopicCard) => void;
  onSelectGame: (game: IcebreakerGame) => void;
  participantCount: number;
  readyCount: number;
  totalCount: number;
  isReady: boolean;
  onReady: (isAutoVote?: boolean) => void;
  autoReadyTimeoutSeconds?: number;
  onRefreshTopics?: () => void;
  isRefreshingTopics?: boolean;
  isOffline?: boolean;
  sessionStartTime?: number;
  onEndIcebreaker?: () => void;
  onRecommendGame?: (excludeGameIds?: string[]) => Promise<GameRecommendation | null>;
  isRecommendingGame?: boolean;
  recommendedGame?: GameRecommendation | null;
}

const gradients = {
  topic: [
    'from-purple-600 via-purple-500 to-pink-500',
    'from-violet-600 via-fuchsia-500 to-pink-400',
    'from-rose-600 via-pink-500 to-purple-400',
    'from-indigo-600 via-purple-500 to-pink-400',
    'from-pink-600 via-rose-500 to-orange-400',
  ],
  scene: {
    dinner: 'from-amber-500 via-orange-400 to-yellow-500',
    bar: 'from-fuchsia-500 via-purple-500 to-indigo-500',
    both: 'from-purple-600 via-violet-500 to-pink-500',
  },
};

const sceneIcons = {
  dinner: Utensils,
  bar: Wine,
  both: Globe,
};

const categoryIcons = {
  quick: Zap,
  creative: Palette,
  deep: Heart,
  active: Target,
};

const difficultyLabels = {
  easy: '轻松',
  medium: '适中',
  deep: '深度',
  hard: '有挑战',
};

export function IcebreakerToolkit({
  open,
  onOpenChange,
  topics,
  recommendedTopics,
  onSelectTopic,
  onSelectGame,
  participantCount,
  readyCount,
  totalCount,
  isReady,
  onReady,
  autoReadyTimeoutSeconds = 60,
  onRefreshTopics,
  isRefreshingTopics = false,
  isOffline = false,
  sessionStartTime,
  onEndIcebreaker,
  onRecommendGame,
  isRecommendingGame = false,
  recommendedGame,
}: IcebreakerToolkitProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false, 
    align: 'center',
    skipSnaps: false,
    dragFree: false,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [countdown, setCountdown] = useState(autoReadyTimeoutSeconds);
  const [showEndButton, setShowEndButton] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [usedItemId, setUsedItemId] = useState<string | null>(null);
  const [recommendedHistory, setRecommendedHistory] = useState<string[]>([]);
  const [spotlightItem, setSpotlightItem] = useState<{
    type: 'topic' | 'game';
    data: TopicCard | IcebreakerGame;
  } | null>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<GalleryItem | null>(null);

  useEffect(() => {
    if (open) {
      setRecommendedHistory([]);
    }
  }, [open]);

  const galleryItems = useMemo(() => {
    const items: GalleryItem[] = [];
    
    if (recommendedTopics && recommendedTopics.length > 0) {
      recommendedTopics.slice(0, 3).forEach((rec, idx) => {
        items.push({
          id: `rec-topic-${idx}`,
          type: 'topic',
          title: rec.topic.question,
          subtitle: rec.reason,
          category: rec.topic.category,
          difficulty: rec.topic.difficulty,
          gradient: gradients.topic[idx % gradients.topic.length],
          icon: MessageCircle,
          data: rec.topic,
          isRecommended: true,
          reason: rec.reason,
        });
      });
    }
    
    icebreakerGames.forEach((game) => {
      const SceneIcon = sceneIcons[game.scene] || Globe;
      const isAIRecommended = recommendedGame?.gameId === game.id;
      items.push({
        id: `game-${game.id}`,
        type: 'game',
        title: game.name,
        subtitle: isAIRecommended ? recommendedGame.reason : game.description,
        category: game.category,
        difficulty: game.difficulty,
        gradient: gradients.scene[game.scene],
        icon: SceneIcon,
        data: game,
        scene: game.scene,
        drinkingWarning: game.drinkingWarning,
        isRecommended: isAIRecommended,
        reason: isAIRecommended ? recommendedGame.reason : undefined,
      });
    });
    
    topics.slice(0, 5).forEach((topic, idx) => {
      const alreadyRecommended = recommendedTopics?.some(r => r.topic.question === topic.question);
      if (!alreadyRecommended) {
        items.push({
          id: `topic-${idx}`,
          type: 'topic',
          title: topic.question,
          subtitle: topic.targetDynamic,
          category: topic.category,
          difficulty: topic.difficulty,
          gradient: gradients.topic[(idx + 3) % gradients.topic.length],
          icon: MessageCircle,
          data: topic,
        });
      }
    });
    
    return items;
  }, [topics, recommendedTopics, recommendedGame]);

  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    
    emblaApi.on('select', onSelect);
    onSelect();
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!sessionStartTime) return;
    
    const checkElapsed = () => {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 60000);
      setElapsedMinutes(elapsed);
      if (elapsed >= 60) {
        setShowEndButton(true);
      }
    };
    
    checkElapsed();
    const timer = setInterval(checkElapsed, 60000);
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  useEffect(() => {
    if (isReady) return;
    
    setCountdown(autoReadyTimeoutSeconds);
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isReady, autoReadyTimeoutSeconds, onReady]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const handleCardClick = useCallback((item: GalleryItem) => {
    if (isOffline) return;
    
    setUsedItemId(item.id);
    setSelectedDetailItem(item);
  }, [isOffline]);

  const handleDetailBack = useCallback(() => {
    setSelectedDetailItem(null);
  }, []);

  const handleStartActivity = useCallback(() => {
    if (!selectedDetailItem) return;
    
    setSpotlightItem({
      type: selectedDetailItem.type,
      data: selectedDetailItem.data,
    });
    setSpotlightOpen(true);
  }, [selectedDetailItem]);

  const handleSpotlightClose = useCallback(() => {
    setSpotlightOpen(false);
    setSpotlightItem(null);
  }, []);

  const handleSpotlightFeedback = useCallback((rating: 'good' | 'neutral' | 'bad') => {
    setSpotlightOpen(false);
    setSpotlightItem(null);
  }, []);

  const handleNextRecommendation = useCallback(async () => {
    setSpotlightOpen(false);
    setSpotlightItem(null);
    
    if (onRecommendGame && emblaApi) {
      try {
        const recommendation = await onRecommendGame(recommendedHistory);
        if (recommendation) {
          setRecommendedHistory(prev => [...prev, recommendation.gameId]);
          const gameIndex = galleryItems.findIndex(
            item => item.type === 'game' && item.id === `game-${recommendation.gameId}`
          );
          if (gameIndex !== -1) {
            emblaApi.scrollTo(gameIndex);
          }
        }
      } catch {
        if (emblaApi && galleryItems.length > 0) {
          const currentIndex = emblaApi.selectedScrollSnap();
          const nextIndex = (currentIndex + 1) % galleryItems.length;
          emblaApi.scrollTo(nextIndex);
        }
      }
    } else if (emblaApi && galleryItems.length > 0) {
      const currentIndex = emblaApi.selectedScrollSnap();
      const nextIndex = (currentIndex + 1) % galleryItems.length;
      emblaApi.scrollTo(nextIndex);
    }
  }, [emblaApi, galleryItems, onRecommendGame, recommendedHistory]);

  const handleRandomPick = useCallback(() => {
    if (isOffline || !emblaApi || galleryItems.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * galleryItems.length);
    emblaApi.scrollTo(randomIndex);
    
    setTimeout(() => {
      const item = galleryItems[randomIndex];
      handleCardClick(item);
    }, 500);
  }, [isOffline, emblaApi, galleryItems, handleCardClick]);

  const [recommendError, setRecommendError] = useState(false);
  const [allGamesRecommended, setAllGamesRecommended] = useState(false);

  const handleAIRecommend = useCallback(async () => {
    if (isOffline || !onRecommendGame || !emblaApi) return;
    
    setRecommendError(false);
    setAllGamesRecommended(false);
    
    try {
      const recommendation = await onRecommendGame(recommendedHistory);
      if (recommendation === undefined) {
        return;
      }
      if (recommendation) {
        setRecommendedHistory(prev => [...prev, recommendation.gameId]);
        const gameIndex = galleryItems.findIndex(
          item => item.type === 'game' && item.id === `game-${recommendation.gameId}`
        );
        if (gameIndex !== -1) {
          emblaApi.scrollTo(gameIndex);
        }
      } else {
        setAllGamesRecommended(true);
        setTimeout(() => setAllGamesRecommended(false), 3000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('excluded') || errorMessage.includes('no more') || errorMessage.includes('all games')) {
        setAllGamesRecommended(true);
        setTimeout(() => setAllGamesRecommended(false), 3000);
      } else {
        setRecommendError(true);
        setTimeout(() => setRecommendError(false), 3000);
      }
    }
  }, [isOffline, onRecommendGame, emblaApi, galleryItems, recommendedHistory]);

  const content = (
    <div className="flex flex-col h-full overflow-hidden rounded-t-3xl" data-testid="icebreaker-toolkit">
      <div className="flex items-center justify-center">
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mt-3 mb-2" />
      </div>
      
      <div className="px-4 py-2 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            破冰工具箱
          </h2>
          <p className="text-sm text-muted-foreground">左右滑动选择话题或游戏</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-participant-count">
            <Users className="w-3 h-3" />
            {participantCount} 人
          </Badge>
          {onRefreshTopics && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefreshTopics}
              disabled={isRefreshingTopics || isOffline}
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingTopics ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={scrollPrev}
            className="rounded-full bg-background/80 backdrop-blur-sm shadow-lg h-10 w-10"
            data-testid="button-scroll-prev"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </div>
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={scrollNext}
            className="rounded-full bg-background/80 backdrop-blur-sm shadow-lg h-10 w-10"
            data-testid="button-scroll-next"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>

        <div className="h-full overflow-hidden px-4" ref={emblaRef}>
          <div className="flex h-full items-center gap-4">
            {galleryItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isUsed = usedItemId === item.id;
              const Icon = item.icon;
              
              return (
                <div
                  key={item.id}
                  className={`flex-shrink-0 transition-transform duration-200 ease-out will-change-transform ${
                    isSelected ? 'scale-100' : 'scale-[0.85]'
                  }`}
                  style={{
                    width: 'min(75vw, 300px)',
                    minWidth: 'min(75vw, 300px)',
                  }}
                  data-testid={`gallery-card-${item.id}`}
                >
                  <div
                    onClick={() => handleCardClick(item)}
                    className={`
                      relative h-[45vh] min-h-[280px] max-h-[400px] rounded-2xl overflow-hidden
                      cursor-pointer transition-all duration-200
                      ${isOffline ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                      ${isUsed ? 'shadow-2xl ring-3 ring-green-400/80' : isSelected ? 'shadow-2xl ring-2 ring-white/30' : 'shadow-lg'}
                    `}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
                    
                    <div className="relative h-full flex flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isUsed && (
                            <Badge className="bg-green-500/80 text-white border-0 text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              已使用
                            </Badge>
                          )}
                          {item.isRecommended && !isUsed && (
                            <Badge className="bg-white/30 text-white border-0 text-xs">
                              <Sparkles className="w-3 h-3 mr-1" />
                              小悦推荐
                            </Badge>
                          )}
                          <Badge className="bg-white/30 text-white border-0 text-xs">
                            {item.type === 'topic' ? '话题' : '游戏'}
                          </Badge>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white/30 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center py-3">
                        <h3 className="text-xl font-bold text-white leading-tight mb-2 line-clamp-3">
                          {item.title}
                        </h3>
                        <p className="text-white/80 text-sm line-clamp-2">
                          {item.subtitle}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.scene && (
                            <Badge className={`border-0 text-xs flex items-center gap-1 ${
                              item.scene === 'dinner' ? 'bg-amber-600/80 text-white' :
                              item.scene === 'bar' ? 'bg-fuchsia-600/80 text-white' :
                              'bg-white/30 text-white'
                            }`}>
                              {item.scene === 'dinner' && <Utensils className="w-3 h-3" />}
                              {item.scene === 'bar' && <Wine className="w-3 h-3" />}
                              {item.scene === 'both' && <Globe className="w-3 h-3" />}
                              {sceneLabels[item.scene]?.label || '通用'}
                            </Badge>
                          )}
                          <Badge className="bg-white/30 text-white border-0 text-xs">
                            {difficultyLabels[item.difficulty as keyof typeof difficultyLabels] || item.difficulty}
                          </Badge>
                          {item.type === 'game' && (
                            <>
                              <Badge className="bg-white/20 text-white border-0 text-xs flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {(item.data as IcebreakerGame).minPlayers}-{(item.data as IcebreakerGame).maxPlayers}人
                              </Badge>
                              <Badge className="bg-white/20 text-white border-0 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {(item.data as IcebreakerGame).duration}
                              </Badge>
                            </>
                          )}
                        </div>
                        
                        {item.drinkingWarning && isSelected && (
                          <div className="bg-white/20 rounded-lg p-2 mt-1 animate-in fade-in duration-150">
                            <div className="flex items-start gap-2">
                              <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 text-xs">
                                悦
                              </div>
                              <p className="text-white/90 text-xs leading-relaxed">
                                {item.drinkingWarning}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {isSelected && (
                          <div className="animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <Button
                              className={`w-full border-0 ${
                                isUsed 
                                  ? 'bg-green-500/80 hover:bg-green-500/90 text-white' 
                                  : 'bg-white/30 hover:bg-white/40 text-white'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardClick(item);
                              }}
                              disabled={isOffline}
                              data-testid={`button-select-${item.id}`}
                            >
                              {isUsed ? (
                                <>
                                  <Check className="w-4 h-4 mr-2" />
                                  {item.type === 'topic' ? '已选择此话题' : '已选择此游戏'}
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-2" />
                                  {item.type === 'topic' ? '使用这个话题' : '开始这个游戏'}
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center gap-1.5 py-3">
          {galleryItems.map((_, index) => (
            <button
              key={index}
              onClick={() => emblaApi?.scrollTo(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === selectedIndex 
                  ? 'w-6 bg-primary' 
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
              data-testid={`dot-${index}`}
            />
          ))}
        </div>
      </div>

      <div className="p-3 bg-background/95 backdrop-blur-sm border-t space-y-2">
        {showEndButton && onEndIcebreaker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-2"
          >
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">小悦提示</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                已破冰 {elapsedMinutes} 分钟啦！如果大家聊得开心，可以延长到 90 或 120 分钟哦~
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/30"
              onClick={onEndIcebreaker}
              disabled={isOffline}
              data-testid="button-end-icebreaker"
            >
              <LogOut className="w-4 h-4 mr-2" />
              结束破冰
            </Button>
          </motion.div>
        )}

        {sessionStartTime && elapsedMinutes > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
            <Clock className="w-4 h-4" />
            <span data-testid="text-elapsed-time">已破冰 {elapsedMinutes} 分钟</span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant={recommendError ? "destructive" : allGamesRecommended ? "secondary" : "outline"}
              onClick={onRecommendGame ? handleAIRecommend : handleRandomPick}
              disabled={isOffline || isRecommendingGame}
              className="flex-1"
              data-testid="button-ai-recommend"
            >
              {isRecommendingGame ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  小悦思考中...
                </>
              ) : recommendError ? (
                <>
                  <Shuffle className="w-4 h-4 mr-2" />
                  推荐失败，再试一次
                </>
              ) : allGamesRecommended ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  已推荐全部游戏
                </>
              ) : recommendedHistory.length > 0 ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  换一个推荐
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  小悦推荐
                </>
              )}
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span data-testid="text-ready-count">{readyCount}/{totalCount}</span>
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden" data-testid="progress-ready">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${(readyCount / Math.max(totalCount, 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {recommendedGame && !allGamesRecommended && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-primary/10 rounded-lg px-2 py-1.5"
              data-testid="recommendation-reason"
            >
              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-[10px] text-primary">
                悦
              </div>
              <p className="text-xs text-foreground/80 line-clamp-1">
                {recommendedGame.reason}
              </p>
            </motion.div>
          )}
        </div>
        
        {!isReady && countdown > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="relative w-5 h-5">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted/30"
                />
                <motion.circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={countdown <= 10 ? 'text-orange-500' : 'text-primary'}
                  strokeDasharray={2 * Math.PI * 8}
                  animate={{ strokeDashoffset: 2 * Math.PI * 8 * (1 - countdown / autoReadyTimeoutSeconds) }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </svg>
            </div>
            <span className={countdown <= 10 ? 'text-orange-500 font-medium' : ''} data-testid="text-countdown">
              {countdown}秒后自动准备
            </span>
          </div>
        )}
        
        <Button
          className="w-full"
          size="lg"
          onClick={() => onReady(false)}
          disabled={isReady || isOffline}
          data-testid="button-ready-next"
        >
          {isOffline ? '网络已断开...' : isReady ? '等待其他人准备...' : '准备好了，结束破冰'}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content 
            className="fixed bottom-0 left-0 right-0 z-50 h-[85vh] bg-gradient-to-b from-primary/10 via-background to-background rounded-t-3xl shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300"
            data-testid="icebreaker-toolkit-dialog"
            aria-describedby={undefined}
          >
            <VisuallyHidden>
              <DialogPrimitive.Title>破冰工具箱</DialogPrimitive.Title>
            </VisuallyHidden>
            {selectedDetailItem && selectedDetailItem.type === 'game' ? (
              <GameDetailView
                game={selectedDetailItem.data as IcebreakerGame}
                onBack={handleDetailBack}
                onGameChange={(game) => {
                  setSelectedDetailItem({
                    ...selectedDetailItem,
                    data: game,
                    title: game.name,
                    subtitle: game.description,
                  });
                }}
                participantCount={participantCount}
                onStartActivity={handleStartActivity}
              />
            ) : selectedDetailItem && selectedDetailItem.type === 'topic' ? (
              <div className="h-full flex flex-col">
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={handleDetailBack} data-testid="button-back-topic">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">话题详情</h2>
                  </div>
                </div>
                <div className="flex-1 p-4 space-y-4">
                  <div className={`rounded-xl p-6 bg-gradient-to-br ${selectedDetailItem.gradient} text-white`}>
                    <h3 className="text-xl font-bold mb-2">{selectedDetailItem.title}</h3>
                    <p className="text-white/80">{selectedDetailItem.subtitle}</p>
                  </div>
                  <Button className="w-full" size="lg" onClick={handleStartActivity} data-testid="button-start-topic">
                    <Play className="w-4 h-4 mr-2" />
                    发起话题
                  </Button>
                </div>
              </div>
            ) : (
              content
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ActivitySpotlight
        open={spotlightOpen}
        onClose={handleSpotlightClose}
        item={spotlightItem}
        participantCount={participantCount}
        onFeedback={handleSpotlightFeedback}
        onNextRecommendation={handleNextRecommendation}
      />
    </>
  );
}
