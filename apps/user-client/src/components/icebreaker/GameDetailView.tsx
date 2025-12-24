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
  RotateCw,
  Crown,
  Sparkles,
} from 'lucide-react';
import { icebreakerGames, getRandomGame, type IcebreakerGame } from '@joyjoin/shared/icebreakerGames';

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
}

interface GameDetailViewProps {
  game: IcebreakerGame;
  onBack: () => void;
  onGameChange: (game: IcebreakerGame) => void;
  participantCount?: number;
  participants?: Participant[];
  onStartActivity?: () => void;
  onActivityComplete?: () => void;
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

const defaultColors = [
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
];

const defaultParticipants: Participant[] = [
  { id: '1', name: '1号' },
  { id: '2', name: '2号' },
  { id: '3', name: '3号' },
  { id: '4', name: '4号' },
  { id: '5', name: '5号' },
];

export function GameDetailView({
  game,
  onBack,
  onGameChange,
  participantCount = 0,
  participants = defaultParticipants,
  onStartActivity,
  onActivityComplete,
}: GameDetailViewProps) {
  const [currentRuleIndex, setCurrentRuleIndex] = useState(0);
  const [showAllRules, setShowAllRules] = useState(false);
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);
  
  const CategoryIcon = categoryIcons[game.category];
  
  const effectiveParticipants = participants.length > 0 ? participants : defaultParticipants;
  
  const participantsWithColors = effectiveParticipants.map((p, i) => ({
    ...p,
    color: p.color || defaultColors[i % defaultColors.length],
  }));
  
  const segmentAngle = 360 / effectiveParticipants.length;

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
    setShowSpinWheel(false);
    setShowResult(false);
    setSelectedParticipant(null);
  }, []);
  
  const handleStartGame = useCallback(() => {
    // Directly show the spin wheel - skip ActivitySpotlight countdown/timer
    setShowSpinWheel(true);
  }, []);
  
  const handleSpin = useCallback(() => {
    if (isSpinning) return;

    setIsSpinning(true);
    setShowResult(false);
    setSelectedParticipant(null);

    const spins = 5 + Math.random() * 3;
    const randomExtraAngle = Math.random() * 360;
    const totalSpinAngle = spins * 360 + randomExtraAngle;
    const newRotation = rotation + totalSpinAngle;
    
    setRotation(newRotation);

    setTimeout(() => {
      setIsSpinning(false);
      const finalMod360 = ((newRotation % 360) + 360) % 360;
      const angleAtTop = (360 - finalMod360 + 360) % 360;
      const n = effectiveParticipants.length;
      let actualIndex = Math.round((angleAtTop / segmentAngle - 0.5 + n) % n);
      if (actualIndex < 0) actualIndex += n;
      if (actualIndex >= n) actualIndex = actualIndex % n;
      
      setSelectedParticipant(participantsWithColors[actualIndex]);
      setShowResult(true);
      onActivityComplete?.();
    }, 4000);
  }, [isSpinning, effectiveParticipants.length, segmentAngle, participantsWithColors, rotation, onActivityComplete]);

  const handleResetWheel = useCallback(() => {
    setShowResult(false);
    setSelectedParticipant(null);
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

      <AnimatePresence mode="wait">
        {showSpinWheel ? (
          <motion.div
            key="spin-wheel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center p-6 pb-32"
            data-testid="spin-wheel-view"
          >
            <div className="flex items-center gap-2 mb-6">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {effectiveParticipants.length} 人
              </Badge>
              <span className="text-sm text-muted-foreground">谁先开始?</span>
            </div>

            <div className="relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
              </div>

              <motion.div
                className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-primary/30 shadow-xl"
                animate={{ rotate: rotation }}
                transition={{ 
                  duration: 4, 
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                {participantsWithColors.map((participant, index) => {
                  const startAngle = index * segmentAngle;
                  const endAngle = (index + 1) * segmentAngle;
                  const midAngle = (startAngle + endAngle) / 2;
                  const textRadius = 70;
                  const textX = 128 + textRadius * Math.cos((midAngle - 90) * Math.PI / 180);
                  const textY = 128 + textRadius * Math.sin((midAngle - 90) * Math.PI / 180);

                  return (
                    <div
                      key={participant.id}
                      className="absolute inset-0"
                      style={{
                        clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((endAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((endAngle - 90) * Math.PI / 180)}%)`,
                      }}
                    >
                      <div className={`w-full h-full ${participant.color}`} />
                      <div
                        className="absolute text-white font-bold text-sm drop-shadow-md whitespace-nowrap"
                        style={{
                          left: `${textX}px`,
                          top: `${textY}px`,
                          transform: `translate(-50%, -50%) rotate(${midAngle}deg)`,
                        }}
                      >
                        {participant.name}
                      </div>
                    </div>
                  );
                })}

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center border-2 border-primary/30">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </motion.div>
            </div>

            <AnimatePresence>
              {showResult && selectedParticipant && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -20 }}
                  className="w-full max-w-xs mt-6"
                >
                  <Card className="border-2 border-primary bg-primary/5">
                    <CardContent className="p-4 text-center space-y-2">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
                        className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30"
                      >
                        <Crown className="w-6 h-6 text-amber-600" />
                      </motion.div>
                      <p className="text-lg font-bold text-primary">
                        {selectedParticipant.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        先来开始 {game.name}!
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 mt-6">
              <Button
                size="lg"
                onClick={handleSpin}
                disabled={isSpinning}
                className="min-w-[120px]"
                data-testid="button-spin"
              >
                <RotateCw className={`w-5 h-5 mr-2 ${isSpinning ? 'animate-spin' : ''}`} />
                {isSpinning ? '转动中...' : '开始转!'}
              </Button>

              {showResult && (
                <Button
                  variant="outline"
                  onClick={handleResetWheel}
                  data-testid="button-reset-wheel"
                >
                  再来一次
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="rules-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <ScrollArea className="h-full pb-32">
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
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t space-y-3">
        {!showSpinWheel && (
          <Button
            className="w-full"
            size="lg"
            onClick={handleStartGame}
            data-testid="button-start-game"
          >
            <Play className="w-4 h-4 mr-2" />
            开始游戏
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
            {showSpinWheel ? '返回规则' : '重新开始'}
          </Button>
        </div>
      </div>
    </div>
  );
}
