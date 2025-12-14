import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageCircle, 
  Gamepad2, 
  Shuffle, 
  Clock, 
  Users, 
  ChevronRight,
  Sparkles,
  Zap,
  Palette,
  Heart,
  Target,
  RefreshCw,
} from 'lucide-react';
import type { TopicCard } from '@shared/topicCards';
import { icebreakerGames, gameCategories, getRandomGame, type IcebreakerGame } from '@shared/icebreakerGames';

export interface RecommendedTopic {
  topic: TopicCard;
  reason: string;
  score?: number;
}

interface IcebreakerToolkitProps {
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
}

const difficultyColors = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  deep: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const categoryIcons = {
  quick: Zap,
  creative: Palette,
  deep: Heart,
  active: Target,
};

export function IcebreakerToolkit({
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
}: IcebreakerToolkitProps) {
  const [activeTab, setActiveTab] = useState<'topics' | 'games'>('topics');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(autoReadyTimeoutSeconds);
  const [autoVoteTriggered, setAutoVoteTriggered] = useState(false);

  useEffect(() => {
    if (isReady) {
      return;
    }
    
    setCountdown(autoReadyTimeoutSeconds);
    setAutoVoteTriggered(false);
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setAutoVoteTriggered(true);
          onReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isReady, autoReadyTimeoutSeconds, onReady]);

  const filteredGames = useMemo(() => {
    if (!selectedCategory) return icebreakerGames;
    return icebreakerGames.filter(g => g.category === selectedCategory);
  }, [selectedCategory]);

  const handleRandomTopic = () => {
    if (isOffline || topics.length === 0) return;
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    onSelectTopic(randomTopic);
  };

  const handleRandomGame = () => {
    if (isOffline) return;
    const game = getRandomGame();
    onSelectGame(game);
  };

  const handleTopicClick = (topic: TopicCard) => {
    if (isOffline) return;
    onSelectTopic(topic);
  };

  const handleGameClick = (game: IcebreakerGame) => {
    if (isOffline) return;
    onSelectGame(game);
  };

  return (
    <div className="flex flex-col h-full" data-testid="icebreaker-toolkit">
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              破冰工具包
            </h2>
            <p className="text-sm text-muted-foreground">选择一个话题或游戏开始互动</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {participantCount} 人
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => !isOffline && setActiveTab(v as 'topics' | 'games')} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
          <TabsTrigger value="topics" disabled={isOffline} className="flex items-center gap-2" data-testid="tab-topics">
            <MessageCircle className="w-4 h-4" />
            话题卡
          </TabsTrigger>
          <TabsTrigger value="games" disabled={isOffline} className="flex items-center gap-2" data-testid="tab-games">
            <Gamepad2 className="w-4 h-4" />
            小游戏
          </TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="flex-1 flex flex-col mt-0 overflow-hidden">
          <div className="px-4 py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRandomTopic}
              disabled={isOffline}
              className="w-full"
              data-testid="button-random-topic"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              随机推荐一个话题
            </Button>
          </div>

          <ScrollArea className="flex-1 px-4 pb-20">
            {recommendedTopics && recommendedTopics.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    小悦推荐
                  </h3>
                  {onRefreshTopics && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onRefreshTopics}
                      disabled={isRefreshingTopics || isOffline}
                      className="text-xs text-primary"
                      data-testid="button-refresh-topics"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshingTopics ? 'animate-spin' : ''}`} />
                      换一批
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {recommendedTopics.map((rec, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card 
                        className={`${isOffline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover-elevate'} border-primary/30`}
                        onClick={() => handleTopicClick(rec.topic)}
                        data-testid={`recommended-topic-${idx}`}
                      >
                        <CardContent className="p-3">
                          <p className="font-medium text-sm mb-1">{rec.topic.question}</p>
                          <p className="text-xs text-primary">{rec.reason}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {rec.topic.category}
                            </Badge>
                            <Badge className={`text-xs ${difficultyColors[rec.topic.difficulty]}`}>
                              {rec.topic.difficulty === 'easy' ? '轻松' : rec.topic.difficulty === 'medium' ? '适中' : '深度'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">全部话题</h3>
              <div className="space-y-2">
                <AnimatePresence>
                  {topics.map((topic, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                    >
                      <Card 
                        className={`${isOffline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover-elevate'}`}
                        onClick={() => handleTopicClick(topic)}
                        data-testid={`topic-card-${idx}`}
                      >
                        <CardContent className="p-3">
                          <p className="font-medium text-sm mb-2">{topic.question}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {topic.category}
                            </Badge>
                            <Badge className={`text-xs ${difficultyColors[topic.difficulty]}`}>
                              {topic.difficulty === 'easy' ? '轻松' : topic.difficulty === 'medium' ? '适中' : '深度'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="games" className="flex-1 flex flex-col mt-0 overflow-hidden">
          <div className="px-4 py-2 space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRandomGame}
              disabled={isOffline}
              className="w-full"
              data-testid="button-random-game"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              随机推荐一个游戏
            </Button>
            
            <div className="flex gap-1 flex-wrap">
              <Button
                variant={selectedCategory === null ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                disabled={isOffline}
                data-testid="filter-all"
              >
                全部
              </Button>
              {Object.entries(gameCategories).map(([key, cat]) => {
                const Icon = categoryIcons[key as keyof typeof categoryIcons];
                return (
                  <Button
                    key={key}
                    variant={selectedCategory === key ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedCategory(key)}
                    disabled={isOffline}
                    data-testid={`filter-${key}`}
                  >
                    {Icon && <Icon className="w-3 h-3 mr-1" />}
                    {cat.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <ScrollArea className="flex-1 px-4 pb-20">
            <div className="grid gap-3">
              <AnimatePresence>
                {filteredGames.map((game, idx) => {
                  const CategoryIcon = categoryIcons[game.category];
                  return (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <Card 
                        className={`${isOffline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover-elevate'}`}
                        onClick={() => handleGameClick(game)}
                        data-testid={`game-card-${game.id}`}
                      >
                        <CardHeader className="p-3 pb-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {CategoryIcon && (
                                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                                  <CategoryIcon className="w-4 h-4 text-primary" />
                                </div>
                              )}
                              <div>
                                <CardTitle className="text-sm">{game.name}</CardTitle>
                                <CardDescription className="text-xs line-clamp-1">
                                  {game.description}
                                </CardDescription>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {game.minPlayers}-{game.maxPlayers}人
                            </Badge>
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {game.duration}
                            </Badge>
                            <Badge className={`text-xs ${difficultyColors[game.difficulty]}`}>
                              {game.difficulty === 'easy' ? '简单' : game.difficulty === 'medium' ? '适中' : '有挑战'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">
            {readyCount} / {totalCount} 人已准备进入下一环节
          </span>
          <div className="h-2 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(readyCount / Math.max(totalCount, 1)) * 100}%` }}
            />
          </div>
        </div>
        
        {!isReady && countdown > 0 && (
          <div className="flex items-center justify-center gap-2 mb-3 text-sm text-muted-foreground">
            <div className="relative w-6 h-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted/30"
                />
                <motion.circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={countdown <= 10 ? 'text-orange-500' : 'text-primary'}
                  strokeDasharray={2 * Math.PI * 10}
                  animate={{ strokeDashoffset: 2 * Math.PI * 10 * (1 - countdown / autoReadyTimeoutSeconds) }}
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
}
