import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Loader2,
  UserCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { KingGameCardDeck } from './KingGameCardDeck';
import { useKingGameWebSocket, KingGameState, KingGamePhase } from '@/hooks/useKingGameWebSocket';
import { archetypeAvatars } from '@/lib/archetypeAvatars';

interface KingGameControllerProps {
  onBack: () => void;
  participantCount?: number;
  sessionId?: string;
  icebreakerSessionId?: string;
  userId?: string;
  displayName?: string;
  useWebSocket?: boolean;
}

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

type LocalGamePhase = 'setup' | 'playing' | 'commanding' | 'executing';

const demoPlayers = [
  { id: 'demo-player-1', name: '小明', archetype: 'corgi' },
  { id: 'demo-player-2', name: '小红', archetype: 'octopus' },
  { id: 'demo-player-3', name: '小刚', archetype: 'rooster' },
  { id: 'demo-player-4', name: '小美', archetype: 'koala' },
];

function MultiDeviceKingGame({
  onBack,
  sessionId,
  icebreakerSessionId,
  userId,
  displayName,
  participantCount,
}: {
  onBack: () => void;
  sessionId: string;
  icebreakerSessionId: string;
  userId: string;
  displayName: string;
  participantCount: number;
}) {
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [demoState, setDemoState] = useState<{
    simulatedPlayers: { id: string; name: string; archetype?: string; isReady: boolean }[];
    phase: 'waiting' | 'dealing' | 'commanding' | 'executing';
    myCardNumber: number | null;
    myIsKing: boolean;
    myIsReady: boolean;
    kingPlayerId: string | null;
    kingDisplayName: string | null;
    targetNumber: number | null;
    currentCommand: string | null;
    mysteryNumber: number | null;
    roundNumber: number;
    drawnCount: number;
  }>({
    simulatedPlayers: [],
    phase: 'waiting',
    myCardNumber: null,
    myIsKing: false,
    myIsReady: false,
    kingPlayerId: null,
    kingDisplayName: null,
    targetNumber: null,
    currentCommand: null,
    mysteryNumber: null,
    roundNumber: 1,
    drawnCount: 0,
  });

  const isDemoMode = sessionId.includes('demo');
  const demoInitializedRef = useRef(false);

  const {
    state,
    isConnected,
    isReconnecting,
    setReady,
    drawCard,
    issueCommand,
    completeRound,
  } = useKingGameWebSocket({
    sessionId,
    icebreakerSessionId,
    userId,
    displayName,
    playerCount: participantCount,
    onDealStart: () => {
      // Only reset in non-demo mode; demo mode handles its own state
      if (!isDemoMode) {
        setHasDrawn(false);
        setSelectedCommand(null);
      }
    },
    onRoundComplete: () => {
      // Only reset in non-demo mode; demo mode handles its own state
      if (!isDemoMode) {
        setHasDrawn(false);
        setSelectedCommand(null);
      }
    },
  });

  // Demo mode: Simulate players joining (runs only once)
  useEffect(() => {
    if (!isDemoMode) return;
    if (demoInitializedRef.current) return; // Already initialized
    demoInitializedRef.current = true;
    
    const playersNeeded = Math.min(participantCount - 1, demoPlayers.length);

    // Add players with staggered delays
    for (let i = 0; i < playersNeeded; i++) {
      setTimeout(() => {
        setDemoState(prev => {
          // Check if player already exists
          if (prev.simulatedPlayers.some(p => p.id === demoPlayers[i].id)) {
            return prev;
          }
          return {
            ...prev,
            simulatedPlayers: [
              ...prev.simulatedPlayers,
              { ...demoPlayers[i], isReady: false }
            ]
          };
        });
      }, 800 + i * 600);
    }
  }, [isDemoMode, participantCount]);

  // Demo mode: Auto-ready simulated players after user is ready
  useEffect(() => {
    if (!isDemoMode) return;
    if (!demoState.myIsReady) return;
    if (demoState.simulatedPlayers.length === 0) return;

    const unreadyPlayers = demoState.simulatedPlayers.filter(p => !p.isReady);
    const timers: NodeJS.Timeout[] = [];
    
    unreadyPlayers.forEach((player, idx) => {
      timers.push(setTimeout(() => {
        setDemoState(prev => ({
          ...prev,
          simulatedPlayers: prev.simulatedPlayers.map(p =>
            p.id === player.id ? { ...p, isReady: true } : p
          )
        }));
      }, 500 + idx * 400));
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [isDemoMode, demoState.myIsReady, demoState.simulatedPlayers]);

  // Demo mode: Auto start dealing when all ready
  useEffect(() => {
    if (!isDemoMode) return;
    if (demoState.phase !== 'waiting') return;
    if (!demoState.myIsReady) return;
    
    const allSimulatedReady = demoState.simulatedPlayers.length >= participantCount - 1 &&
      demoState.simulatedPlayers.every(p => p.isReady);
    
    if (allSimulatedReady) {
      setTimeout(() => {
        setDemoState(prev => ({ ...prev, phase: 'dealing' }));
      }, 800);
    }
  }, [isDemoMode, demoState.simulatedPlayers, demoState.phase, demoState.myIsReady, participantCount]);

  // Demo mode: Handle set ready
  const handleDemoSetReady = useCallback(() => {
    setDemoState(prev => ({ ...prev, myIsReady: true }));
  }, []);

  // Demo mode: Handle draw card
  const handleDemoDrawCard = useCallback(() => {
    if (hasDrawn) return;
    
    const totalPlayers = demoState.simulatedPlayers.length + 1;
    const isKing = Math.random() < (1 / totalPlayers);
    const cardNumber = isKing ? null : Math.floor(Math.random() * (totalPlayers - 1)) + 1;
    const mysteryNum = Math.floor(Math.random() * (totalPlayers - 1)) + 1;
    
    let kingId: string;
    let kingName: string;
    if (isKing) {
      kingId = userId;
      kingName = displayName;
    } else {
      const randomKing = demoState.simulatedPlayers[Math.floor(Math.random() * demoState.simulatedPlayers.length)];
      kingId = randomKing?.id || userId;
      kingName = randomKing?.name || displayName;
    }
    
    setDemoState(prev => ({
      ...prev,
      myCardNumber: cardNumber,
      myIsKing: isKing,
      kingPlayerId: kingId,
      kingDisplayName: kingName,
      mysteryNumber: mysteryNum,
      drawnCount: totalPlayers,
      phase: 'commanding',
    }));
    setHasDrawn(true);
  }, [hasDrawn, demoState.simulatedPlayers, userId, displayName]);

  // Demo mode: Handle issue command
  const handleDemoIssueCommand = useCallback((command: string, target: number) => {
    setDemoState(prev => ({
      ...prev,
      currentCommand: command,
      targetNumber: target,
      phase: 'executing',
    }));
  }, []);

  // Demo mode: Complete round
  const handleDemoCompleteRound = useCallback(() => {
    setDemoState(prev => ({
      ...prev,
      phase: 'waiting',
      myCardNumber: null,
      myIsKing: false,
      myIsReady: false,
      kingPlayerId: null,
      kingDisplayName: null,
      targetNumber: null,
      currentCommand: null,
      mysteryNumber: null,
      drawnCount: 0,
      roundNumber: prev.roundNumber + 1,
      simulatedPlayers: prev.simulatedPlayers.map(p => ({ ...p, isReady: false })),
    }));
    setHasDrawn(false);
    setSelectedCommand(null);
  }, []);

  // Reset hasDrawn/selectedCommand when phase changes (only for non-demo mode)
  useEffect(() => {
    if (isDemoMode) return; // Demo mode handles its own state
    if (state.phase === 'waiting' || state.phase === 'dealing') {
      setHasDrawn(false);
      setSelectedCommand(null);
    }
  }, [isDemoMode, state.phase]);

  // For demo mode, create fully self-contained state (no dependency on WebSocket state)
  const effectiveState = isDemoMode ? {
    sessionId,
    phase: demoState.phase as KingGamePhase,
    playerCount: 1 + demoState.simulatedPlayers.length,
    requiredPlayers: participantCount,
    players: [
      { userId, displayName, isReady: demoState.myIsReady, archetype: 'koala' },
      ...demoState.simulatedPlayers.map(p => ({ userId: p.id, displayName: p.name, isReady: p.isReady, archetype: p.archetype })),
    ],
    readyCount: (demoState.myIsReady ? 1 : 0) + demoState.simulatedPlayers.filter(p => p.isReady).length,
    roundNumber: demoState.roundNumber,
    dealerId: null,
    dealerName: '系统',
    kingUserId: demoState.kingPlayerId,
    kingDisplayName: demoState.kingDisplayName,
    mysteryNumber: demoState.mysteryNumber,
    currentCommand: demoState.currentCommand,
    targetNumber: demoState.targetNumber,
    myCardNumber: demoState.myCardNumber,
    myIsKing: demoState.myIsKing,
    drawnCount: demoState.drawnCount,
  } : state;

  const myPlayer = useMemo(() => 
    effectiveState.players.find(p => p.userId === userId),
    [effectiveState.players, userId]
  );

  const isKing = effectiveState.kingUserId === userId;
  const hasEnoughPlayers = effectiveState.playerCount >= effectiveState.requiredPlayers;
  const allReady = hasEnoughPlayers && effectiveState.readyCount >= effectiveState.playerCount;

  const handleDrawCard = useCallback(() => {
    if (isDemoMode) {
      handleDemoDrawCard();
    } else if (!hasDrawn) {
      drawCard();
      setHasDrawn(true);
    }
  }, [isDemoMode, hasDrawn, drawCard, handleDemoDrawCard]);

  const handleSelectTarget = useCallback((num: number) => {
    if (selectedCommand && isKing) {
      if (isDemoMode) {
        handleDemoIssueCommand(selectedCommand.text, num);
      } else {
        issueCommand(selectedCommand.text, num);
      }
    }
  }, [selectedCommand, isKing, isDemoMode, issueCommand, handleDemoIssueCommand]);

  const handleCompleteRound = useCallback(() => {
    if (isDemoMode) {
      handleDemoCompleteRound();
    } else {
      completeRound();
      setSelectedCommand(null);
      setHasDrawn(false);
    }
  }, [isDemoMode, completeRound, handleDemoCompleteRound]);

  return (
    <div className="flex flex-col h-full" data-testid="king-game-controller">
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
                  第 {effectiveState.roundNumber} 轮 · {effectiveState.playerCount}/{effectiveState.requiredPlayers} 人
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemoMode ? (
              <Badge variant="outline" className="text-purple-600 border-purple-300">
                <Sparkles className="w-3 h-3 mr-1" />
                演示模式
              </Badge>
            ) : isConnected ? (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <Wifi className="w-3 h-3 mr-1" />
                已连接
              </Badge>
            ) : isReconnecting ? (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                重连中
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-300">
                <WifiOff className="w-3 h-3 mr-1" />
                离线
              </Badge>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <AnimatePresence mode="wait">
          {effectiveState.phase === 'waiting' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-4"
            >
              <Card className="border-amber-200 dark:border-amber-800">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-500" />
                    玩家列表 ({effectiveState.playerCount}/{effectiveState.requiredPlayers})
                  </h3>
                  <div className="space-y-2">
                    {effectiveState.players.map((player, idx) => {
                      const playerWithArchetype = player as typeof player & { archetype?: string };
                      const avatarSrc = playerWithArchetype.archetype ? archetypeAvatars[playerWithArchetype.archetype] : undefined;
                      return (
                      <div 
                        key={player.userId} 
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                        data-testid={`player-item-${idx}`}
                      >
                        <Avatar className="w-8 h-8">
                          {avatarSrc ? (
                            <AvatarImage src={avatarSrc} alt={playerWithArchetype.archetype} />
                          ) : null}
                          <AvatarFallback className="text-xs bg-primary/10">
                            {player.displayName.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 font-medium text-sm">
                          {player.displayName}
                          {player.userId === userId && (
                            <span className="text-muted-foreground"> (你)</span>
                          )}
                        </span>
                        {player.isReady ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Check className="w-3 h-3 mr-1" />
                            已准备
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            等待中
                          </Badge>
                        )}
                      </div>
                      );
                    })}
                    {effectiveState.playerCount < effectiveState.requiredPlayers && (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        等待其他玩家加入...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {!myPlayer?.isReady && hasEnoughPlayers && (
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
                  onClick={isDemoMode ? handleDemoSetReady : setReady}
                  data-testid="button-ready"
                >
                  <UserCheck className="w-5 h-5 mr-2" />
                  我准备好了!
                </Button>
              )}

              {myPlayer?.isReady && !allReady && (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  <p className="text-muted-foreground">等待其他玩家准备... ({effectiveState.readyCount}/{effectiveState.requiredPlayers})</p>
                </div>
              )}

              {allReady && (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  <p className="text-muted-foreground">所有玩家已准备，即将开始发牌...</p>
                </div>
              )}
            </motion.div>
          )}

          {effectiveState.phase === 'dealing' && (
            <motion.div
              key="dealing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              <div className="text-center py-4">
                <h3 className="text-lg font-semibold mb-2">发牌阶段</h3>
                <p className="text-muted-foreground text-sm">
                  {isDemoMode ? '系统' : effectiveState.dealerName} 正在发牌
                </p>
              </div>

              {!hasDrawn ? (
                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="inline-block"
                  >
                    <div className="w-24 h-32 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg cursor-pointer hover-elevate"
                      onClick={handleDrawCard}
                    >
                      <Crown className="w-10 h-10 text-white" />
                    </div>
                  </motion.div>
                  <p className="text-sm text-muted-foreground">点击抽取你的牌</p>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleDrawCard}
                    data-testid="button-draw-card"
                  >
                    <Shuffle className="w-5 h-5 mr-2" />
                    抽牌
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ rotateY: 180 }}
                    animate={{ rotateY: 0 }}
                    transition={{ duration: 0.6 }}
                    className="inline-block"
                  >
                    <div className={`w-24 h-32 rounded-lg flex items-center justify-center shadow-lg ${
                      effectiveState.myIsKing 
                        ? 'bg-gradient-to-br from-amber-400 to-yellow-500' 
                        : 'bg-white dark:bg-gray-800 border-2'
                    }`}>
                      {effectiveState.myIsKing ? (
                        <Crown className="w-10 h-10 text-white" />
                      ) : (
                        <span className="text-4xl font-bold">{effectiveState.myCardNumber}</span>
                      )}
                    </div>
                  </motion.div>
                  <p className="text-lg font-semibold">
                    {effectiveState.myIsKing ? '你是国王! 👑' : `你的号码: ${effectiveState.myCardNumber}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    记住你的{effectiveState.myIsKing ? '身份' : '号码'}，不要让别人看到!
                  </p>
                  <div className="text-sm text-muted-foreground">
                    等待其他玩家抽牌... ({effectiveState.drawnCount}/{effectiveState.playerCount})
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {effectiveState.phase === 'commanding' && (
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
                <h3 className="text-xl font-bold">
                  {isKing ? '你是国王! 发号施令吧!' : `${effectiveState.kingDisplayName} 是国王!`}
                </h3>
                <p className="text-muted-foreground">
                  {isKing ? '选择一个命令和目标号码' : '等待国王发号施令...'}
                </p>
                {effectiveState.mysteryNumber && !isKing && (
                  <p className="text-sm text-amber-600 mt-2">
                    神秘牌号码: {effectiveState.mysteryNumber} (国王的号码)
                  </p>
                )}
              </div>

              {isKing && (
                <>
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
                              onClick={() => setSelectedCommand(cmd)}
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

                  {selectedCommand && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <h4 className="font-medium text-sm">选择目标号码</h4>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {Array.from({ length: effectiveState.requiredPlayers }, (_, i) => i + 1).map(num => (
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
                        你的号码是神秘牌({effectiveState.mysteryNumber})，小心别点到自己~
                      </p>
                    </motion.div>
                  )}
                </>
              )}

              {!isKing && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-amber-500" />
                  <p className="text-muted-foreground">等待国王发号施令...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    你的号码是 <span className="font-bold">{effectiveState.myCardNumber}</span>
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {effectiveState.phase === 'executing' && (
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
                    {effectiveState.targetNumber}
                  </div>
                  <h3 className="text-2xl font-bold">
                    {effectiveState.targetNumber}号!
                  </h3>
                  {effectiveState.myCardNumber === effectiveState.targetNumber && (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      就是你!
                    </Badge>
                  )}
                </motion.div>
              </div>

              <Card className="border-2 border-primary">
                <CardContent className="p-6 text-center">
                  <p className="text-lg font-medium">
                    {effectiveState.currentCommand}
                  </p>
                </CardContent>
              </Card>

              <div className="text-center space-y-3">
                <p className="text-muted-foreground">
                  被点到的人请执行命令~
                </p>
                <p className="text-sm text-amber-600">
                  国王的号码是: {effectiveState.mysteryNumber}
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

function LocalKingGame({
  onBack,
  participantCount = 5,
}: {
  onBack: () => void;
  participantCount?: number;
}) {
  const [phase, setPhase] = useState<LocalGamePhase>('setup');
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
          {phase === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-6"
            >
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

              {selectedCommand && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 pb-6"
                >
                  <h4 className="font-medium text-sm text-center">选择目标号码</h4>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {Array.from({ length: playerCount }, (_, i) => i + 1).map(num => (
                      <Button
                        key={num}
                        variant="default"
                        size="lg"
                        className="w-16 h-16 text-2xl font-bold bg-gradient-to-br from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-lg"
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

export function KingGameController({
  onBack,
  participantCount = 5,
  sessionId,
  icebreakerSessionId,
  userId,
  displayName,
  useWebSocket = false,
}: KingGameControllerProps) {
  if (useWebSocket && sessionId && icebreakerSessionId && userId && displayName) {
    return (
      <MultiDeviceKingGame
        onBack={onBack}
        sessionId={sessionId}
        icebreakerSessionId={icebreakerSessionId}
        userId={userId}
        displayName={displayName}
        participantCount={participantCount}
      />
    );
  }

  return (
    <LocalKingGame
      onBack={onBack}
      participantCount={participantCount}
    />
  );
}

export default KingGameController;
