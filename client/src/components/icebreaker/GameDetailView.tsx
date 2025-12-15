import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft,
  Shuffle, 
  RotateCcw,
  Clock, 
  Users,
  Zap,
  Palette,
  Heart,
  Target,
  Lightbulb,
  CheckCircle2,
  Play,
} from 'lucide-react';
import { icebreakerGames, getRandomGame, type IcebreakerGame } from '@shared/icebreakerGames';

interface GameDetailViewProps {
  game: IcebreakerGame;
  onBack: () => void;
  onGameChange: (game: IcebreakerGame) => void;
  participantCount?: number;
  onStartActivity?: () => void;
}

const difficultyColors = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const categoryIcons = {
  quick: Zap,
  creative: Palette,
  deep: Heart,
  active: Target,
};

const categoryLabels = {
  quick: '快速破冰',
  creative: '创意游戏',
  deep: '深度交流',
  active: '活力互动',
};

export function GameDetailView({
  game,
  onBack,
  onGameChange,
  participantCount = 0,
  onStartActivity,
}: GameDetailViewProps) {
  const [currentRuleIndex, setCurrentRuleIndex] = useState(0);
  const [showAllRules, setShowAllRules] = useState(false);
  
  const CategoryIcon = categoryIcons[game.category];

  const handleSwitchGame = useCallback(() => {
    let newGame = getRandomGame();
    while (newGame.id === game.id && icebreakerGames.length > 1) {
      newGame = getRandomGame();
    }
    setCurrentRuleIndex(0);
    setShowAllRules(false);
    onGameChange(newGame);
  }, [game.id, onGameChange]);

  const handleRestart = useCallback(() => {
    setCurrentRuleIndex(0);
    setShowAllRules(false);
  }, []);

  const handleNextRule = useCallback(() => {
    if (currentRuleIndex < game.rules.length - 1) {
      setCurrentRuleIndex(prev => prev + 1);
    } else {
      setShowAllRules(true);
    }
  }, [currentRuleIndex, game.rules.length]);

  const isPlayerCountSuitable = participantCount >= game.minPlayers && participantCount <= game.maxPlayers;

  return (
    <div className="flex flex-col h-full" data-testid="game-detail-view">
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {CategoryIcon && (
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <CategoryIcon className="w-4 h-4 text-primary" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold" data-testid="text-game-name">{game.name}</h2>
                <p className="text-xs text-muted-foreground">{categoryLabels[game.category]}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 pb-32">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {game.minPlayers}-{game.maxPlayers}人
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {game.duration}
            </Badge>
            <Badge className={difficultyColors[game.difficulty]}>
              {game.difficulty === 'easy' ? '简单' : game.difficulty === 'medium' ? '适中' : '有挑战'}
            </Badge>
            {participantCount > 0 && (
              <Badge 
                variant={isPlayerCountSuitable ? 'default' : 'destructive'}
                className="flex items-center gap-1"
              >
                {isPlayerCountSuitable ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    人数合适
                  </>
                ) : (
                  <>当前{participantCount}人</>
                )}
              </Badge>
            )}
          </div>

          <Card className="border-primary/20">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground" data-testid="text-game-description">
                {game.description}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-bold">
                {game.rules.length}
              </span>
              游戏规则
            </h3>

            <AnimatePresence mode="wait">
              {!showAllRules ? (
                <motion.div
                  key={`rule-${currentRuleIndex}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                >
                  <Card 
                    className="cursor-pointer hover-elevate min-h-[120px] flex items-center"
                    onClick={handleNextRule}
                    data-testid={`rule-card-${currentRuleIndex}`}
                  >
                    <CardContent className="p-6 w-full">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
                          {currentRuleIndex + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-medium leading-relaxed" data-testid="text-current-rule">
                            {game.rules[currentRuleIndex]}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-1">
                      {game.rules.map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            idx <= currentRuleIndex ? 'bg-primary' : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextRule}
                      data-testid="button-next-rule"
                    >
                      {currentRuleIndex < game.rules.length - 1 ? '下一条' : '查看全部'}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="all-rules"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  {game.rules.map((rule, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card data-testid={`rule-item-${idx}`}>
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                            {idx + 1}
                          </div>
                          <p className="text-base leading-relaxed pt-0.5">{rule}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {game.tips && game.tips.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                小贴士
              </h3>
              <div className="space-y-2">
                {game.tips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-sm text-muted-foreground pl-6"
                    data-testid={`tip-item-${idx}`}
                  >
                    <span className="text-yellow-500">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t space-y-3">
        {onStartActivity && (
          <Button
            className="w-full"
            size="lg"
            onClick={onStartActivity}
            data-testid="button-start-game"
          >
            <Play className="w-4 h-4 mr-2" />
            发起游戏
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleSwitchGame}
            className="flex items-center gap-2"
            data-testid="button-switch-game"
          >
            <Shuffle className="w-4 h-4" />
            换一个
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleRestart}
            className="flex items-center gap-2"
            data-testid="button-restart-game"
          >
            <RotateCcw className="w-4 h-4" />
            再来一轮
          </Button>
        </div>
      </div>
    </div>
  );
}
