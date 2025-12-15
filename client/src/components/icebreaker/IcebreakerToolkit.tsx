import { useState, useMemo, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import type { TopicCard } from '@shared/topicCards';
import { icebreakerGames, type IcebreakerGame } from '@shared/icebreakerGames';

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
}

const gradients = {
  topic: [
    'from-purple-600 via-purple-500 to-pink-500',
    'from-violet-600 via-fuchsia-500 to-pink-400',
    'from-rose-600 via-pink-500 to-purple-400',
    'from-indigo-600 via-purple-500 to-pink-400',
    'from-pink-600 via-rose-500 to-orange-400',
  ],
  game: {
    quick: 'from-yellow-500 via-orange-500 to-red-500',
    creative: 'from-pink-500 via-purple-500 to-indigo-500',
    deep: 'from-blue-600 via-indigo-500 to-purple-600',
    active: 'from-green-500 via-emerald-500 to-teal-500',
  },
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
    
    icebreakerGames.forEach((game, idx) => {
      const CategoryIcon = categoryIcons[game.category] || Gamepad2;
      items.push({
        id: `game-${game.id}`,
        type: 'game',
        title: game.name,
        subtitle: game.description,
        category: game.category,
        difficulty: game.difficulty,
        gradient: gradients.game[game.category],
        icon: CategoryIcon,
        data: game,
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
  }, [topics, recommendedTopics]);

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
    
    if (item.type === 'topic') {
      onSelectTopic(item.data as TopicCard);
    } else {
      onSelectGame(item.data as IcebreakerGame);
    }
  }, [isOffline, onSelectTopic, onSelectGame]);

  const handleRandomPick = useCallback(() => {
    if (isOffline || !emblaApi || galleryItems.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * galleryItems.length);
    emblaApi.scrollTo(randomIndex);
    
    setTimeout(() => {
      const item = galleryItems[randomIndex];
      handleCardClick(item);
    }, 500);
  }, [isOffline, emblaApi, galleryItems, handleCardClick]);

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
            <AnimatePresence mode="popLayout">
              {galleryItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                const Icon = item.icon;
                
                return (
                  <motion.div
                    key={item.id}
                    className="flex-shrink-0"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: 1, 
                      scale: isSelected ? 1 : 0.85,
                    }}
                    transition={{ 
                      duration: 0.3,
                      ease: 'easeOut',
                    }}
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
                        cursor-pointer transition-all duration-300
                        ${isOffline ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                        ${isSelected ? 'shadow-2xl ring-2 ring-white/30' : 'shadow-lg'}
                      `}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
                      
                      <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
                        <div className="absolute bottom-8 left-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-black/10 blur-3xl" />
                      </div>
                      
                      <div className="relative h-full flex flex-col p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.isRecommended && (
                              <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-xs">
                                <Sparkles className="w-3 h-3 mr-1" />
                                推荐
                              </Badge>
                            )}
                            <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-xs">
                              {item.type === 'topic' ? '话题' : '游戏'}
                            </Badge>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
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
                            <Badge className="bg-white/20 text-white border-0 text-xs">
                              {item.category}
                            </Badge>
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
                          
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 }}
                            >
                              <Button
                                className="w-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCardClick(item);
                                }}
                                disabled={isOffline}
                                data-testid={`button-select-${item.id}`}
                              >
                                <Play className="w-4 h-4 mr-2" />
                                {item.type === 'topic' ? '使用这个话题' : '开始这个游戏'}
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
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

      <div className="p-4 bg-background/95 backdrop-blur-sm border-t space-y-3">
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

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRandomPick}
            disabled={isOffline}
            className="flex-1"
            data-testid="button-random-pick"
          >
            <Shuffle className="w-4 h-4 mr-2" />
            随机一个
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
          {content}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
