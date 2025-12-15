import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Crown, 
  Shuffle, 
  Users, 
  ArrowLeft,
  Sparkles,
  X,
  Check,
  Dumbbell,
  Music,
  Laugh,
  MessageCircle,
  Heart,
  Zap,
} from 'lucide-react';
import { KingGameCardDeck } from './KingGameCardDeck';

interface KingGameControllerProps {
  onBack: () => void;
  participantCount?: number;
}

type GamePhase = 'setup' | 'playing' | 'commanding' | 'executing';

interface Command {
  id: string;
  text: string;
  category: 'physical' | 'performance' | 'social' | 'funny' | 'dare';
  icon: typeof Dumbbell;
  intensity: 'light' | 'medium' | 'spicy';
}

const commandSuggestions: Command[] = [
  { id: '1', text: '做10个俯卧撑', category: 'physical', icon: Dumbbell, intensity: 'medium' },
  { id: '2', text: '唱一首歌的副歌部分', category: 'performance', icon: Music, intensity: 'medium' },
  { id: '3', text: '讲一个冷笑话', category: 'funny', icon: Laugh, intensity: 'light' },
  { id: '4', text: '说出自己最尴尬的一件事', category: 'social', icon: MessageCircle, intensity: 'medium' },
  { id: '5', text: '表演一个动物', category: 'performance', icon: Sparkles, intensity: 'light' },
  { id: '6', text: '金鸡独立30秒', category: 'physical', icon: Dumbbell, intensity: 'light' },
  { id: '7', text: '对窗外/镜子大喊"我是最棒的"', category: 'dare', icon: Zap, intensity: 'spicy' },
  { id: '8', text: '表演一段10秒即兴舞蹈', category: 'performance', icon: Music, intensity: 'medium' },
  { id: '9', text: '用方言说一句话', category: 'funny', icon: Laugh, intensity: 'light' },
  { id: '10', text: '夸在座某人3句真心话', category: 'social', icon: Heart, intensity: 'medium' },
  { id: '11', text: '模仿在座某人的招牌动作', category: 'funny', icon: Laugh, intensity: 'medium' },
  { id: '12', text: '和X号手拉手转一圈', category: 'social', icon: Heart, intensity: 'light' },
  { id: '13', text: '闭眼画一只猪', category: 'funny', icon: Sparkles, intensity: 'light' },
  { id: '14', text: '说出今天最开心的事', category: 'social', icon: MessageCircle, intensity: 'light' },
  { id: '15', text: '做一个搞怪表情并保持5秒', category: 'funny', icon: Laugh, intensity: 'light' },
];

const intensityLabels = {
  light: { label: '轻松', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  medium: { label: '适中', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  spicy: { label: '刺激', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const categoryLabels = {
  physical: '体力',
  performance: '表演',
  social: '社交',
  funny: '搞笑',
  dare: '挑战',
};

export function KingGameController({
  onBack,
  participantCount = 5,
}: KingGameControllerProps) {
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [playerCount, setPlayerCount] = useState(Math.min(Math.max(participantCount, 4), 6));
  const [kingNumber, setKingNumber] = useState<number | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [roundCount, setRoundCount] = useState(0);

  const handleStartGame = useCallback(() => {
    setPhase('playing');
    setKingNumber(null);
    setSelectedCommand(null);
    setTargetNumber(null);
  }, []);

  const handleKingRevealed = useCallback((tableCardNumber: number) => {
    setKingNumber(tableCardNumber);
    setPhase('commanding');
  }, []);

  const handleSelectCommand = useCallback((command: Command) => {
    setSelectedCommand(command);
  }, []);

  const handleSelectTarget = useCallback((num: number) => {
    setTargetNumber(num);
    setPhase('executing');
  }, []);

  const handleCompleteRound = useCallback(() => {
    setRoundCount(prev => prev + 1);
    setPhase('setup');
    setKingNumber(null);
    setSelectedCommand(null);
    setTargetNumber(null);
  }, []);

  return (
    <div className="flex flex-col h-full" data-testid="king-game-controller">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back-king-game"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-amber-500/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">国王游戏</h2>
                <p className="text-xs text-muted-foreground">
                  第 {roundCount + 1} 轮 · {playerCount} 人
                </p>
              </div>
            </div>
          </div>
          {roundCount > 0 && (
            <Badge variant="secondary">
              已玩 {roundCount} 轮
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <AnimatePresence mode="wait">
          {/* Setup Phase */}
          {phase === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-6"
            >
              {/* Rules Summary */}
              <Card className="border-amber-200 dark:border-amber-800">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    游戏规则
                  </h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>1. {playerCount}人游戏，共{playerCount + 1}张牌</p>
                    <p>2. 每人抽一张，记住自己的数字</p>
                    <p>3. 抽到国王牌的人亮牌成为"国王"</p>
                    <p>4. 剩下的一张牌就是国王的号码（国王不能看）</p>
                    <p>5. 国王发号施令："X号做XXX"</p>
                    <p>6. 被点到的人执行任务!</p>
                  </div>
                </CardContent>
              </Card>

              {/* Player Count Selector */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  选择人数
                </h3>
                <div className="flex gap-2">
                  {[4, 5, 6].map(count => (
                    <Button
                      key={count}
                      variant={playerCount === count ? 'default' : 'outline'}
                      onClick={() => setPlayerCount(count)}
                      className="flex-1"
                      data-testid={`button-player-${count}`}
                    >
                      {count} 人
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  将使用 {playerCount + 1} 张牌 (1-{playerCount}号 + 国王牌)
                </p>
              </div>

              {/* Start Button */}
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
                onClick={handleStartGame}
                data-testid="button-start-king-game"
              >
                <Shuffle className="w-5 h-5 mr-2" />
                开始发牌
              </Button>
            </motion.div>
          )}

          {/* Playing Phase - Card Deck */}
          {phase === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <KingGameCardDeck
                playerCount={playerCount}
                onKingRevealed={handleKingRevealed}
              />
            </motion.div>
          )}

          {/* Commanding Phase */}
          {phase === 'commanding' && (
            <motion.div
              key="commanding"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-4"
            >
              <div className="text-center py-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-3"
                >
                  <Crown className="w-8 h-8 text-amber-600" />
                </motion.div>
                <h3 className="text-xl font-bold">国王发号施令!</h3>
                <p className="text-muted-foreground">选择一个命令和目标号码</p>
              </div>

              {/* Command Selection */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  命令建议 (点击选择)
                </h4>
                <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-2">
                  {commandSuggestions.map(cmd => {
                    const Icon = cmd.icon;
                    const isSelected = selectedCommand?.id === cmd.id;
                    return (
                      <motion.div
                        key={cmd.id}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className={`cursor-pointer transition-all hover-elevate ${
                            isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                          }`}
                          onClick={() => handleSelectCommand(cmd)}
                          data-testid={`command-${cmd.id}`}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{cmd.text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs py-0">
                                  {categoryLabels[cmd.category]}
                                </Badge>
                                <Badge className={`text-xs py-0 ${intensityLabels[cmd.intensity].color}`}>
                                  {intensityLabels[cmd.intensity].label}
                                </Badge>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-5 h-5 text-primary" />
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Target Number Selection */}
              {selectedCommand && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <h4 className="font-medium text-sm">选择目标号码</h4>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Array.from({ length: playerCount }, (_, i) => i + 1).map(num => (
                      <Button
                        key={num}
                        variant="outline"
                        size="lg"
                        className="w-14 h-14 text-xl font-bold"
                        onClick={() => handleSelectTarget(num)}
                        data-testid={`target-${num}`}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    记得不要点自己的号码哦~
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Executing Phase */}
          {phase === 'executing' && selectedCommand && targetNumber && (
            <motion.div
              key="executing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-4 space-y-6"
            >
              <div className="text-center py-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
                  className="space-y-4"
                >
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary text-primary-foreground text-4xl font-bold">
                    {targetNumber}
                  </div>
                  <h3 className="text-2xl font-bold">
                    {targetNumber}号!
                  </h3>
                </motion.div>
              </div>

              <Card className="border-2 border-primary">
                <CardContent className="p-6 text-center">
                  <p className="text-lg font-medium">
                    {selectedCommand.text}
                  </p>
                </CardContent>
              </Card>

              <div className="text-center space-y-3">
                <p className="text-muted-foreground">
                  被点到的人请执行命令~
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleCompleteRound}
                  data-testid="button-complete-round"
                >
                  <Check className="w-5 h-5 mr-2" />
                  执行完毕，下一轮
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCompleteRound}
                  data-testid="button-skip-round"
                >
                  <X className="w-4 h-4 mr-2" />
                  跳过
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}

export default KingGameController;
