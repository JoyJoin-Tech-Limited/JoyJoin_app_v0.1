import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useIcebreakerTopics, type ParticipantProfile } from '@/hooks/use-icebreaker-topics';
import { useGameRecommendation } from '@/hooks/useGameRecommendation';
import { IcebreakerCheckinModal } from '@/components/icebreaker/IcebreakerCheckinModal';
import { NumberPlateDisplay } from '@/components/icebreaker/NumberPlateDisplay';
import { IcebreakerToolkit } from '@/components/icebreaker/IcebreakerToolkit';
import { GameDetailView } from '@/components/icebreaker/GameDetailView';
import { IcebreakerEndingScreen } from '@/components/icebreaker/IcebreakerEndingScreen';
import { PhaseTransition, type TransitionType } from '@/components/icebreaker/PhaseTransition';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LogOut, Clock, Info, Smartphone, Wifi } from 'lucide-react';
import type { TopicCard } from '@shared/topicCards';
import type { IcebreakerGame } from '@shared/icebreakerGames';

type DemoPhase = 'checkin' | 'number_assign' | 'icebreaker' | 'ended';

const DEMO_PARTICIPANTS = [
  { userId: 'demo-1', displayName: '小明', archetype: '开心柯基', interests: ['旅行', '摄影', '美食'] },
  { userId: 'demo-2', displayName: '小红', archetype: '灵感章鱼', interests: ['音乐', '绘画', '阅读'] },
  { userId: 'demo-3', displayName: '小华', archetype: '沉思猫头鹰', interests: ['科技', '游戏', '电影'] },
  { userId: 'demo-4', displayName: '小李', archetype: '太阳鸡', interests: ['运动', '健身', '户外'] },
  { userId: 'demo-you', displayName: '你', archetype: '暖心熊', interests: ['咖啡', '阅读', '旅行'] },
];

export default function IcebreakerDemoPage() {
  const [, setLocation] = useLocation();
  
  const [phase, setPhase] = useState<DemoPhase>('checkin');
  const [checkedInCount, setCheckedInCount] = useState(3);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasVotedReady, setHasVotedReady] = useState(false);
  const [selectedGame, setSelectedGame] = useState<IcebreakerGame | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionType, setTransitionType] = useState<TransitionType | null>(null);
  const [icebreakerStartTime, setIcebreakerStartTime] = useState<number | null>(null);

  const participantProfiles: ParticipantProfile[] = DEMO_PARTICIPANTS.map(p => ({
    displayName: p.displayName,
    archetype: p.archetype,
    interests: p.interests,
  }));

  const { 
    recommendedTopics, 
    allTopics, 
    isLoading: topicsLoading,
    refreshTopics,
    isRefreshing: isRefreshingTopics,
  } = useIcebreakerTopics(participantProfiles, 'balanced', true);

  const {
    recommend: recommendGame,
    isLoading: isRecommendingGame,
    reset: resetGameRecommendation,
  } = useGameRecommendation();

  const [recommendedGame, setRecommendedGame] = useState<{ gameId: string; gameName: string; reason: string } | null>(null);

  const handleRecommendGame = useCallback(async (excludeGameIds?: string[]) => {
    resetGameRecommendation();
    setRecommendedGame(null);
    const participants = DEMO_PARTICIPANTS.map(p => ({
      displayName: p.displayName,
      archetype: p.archetype,
      interests: p.interests,
    }));
    return new Promise<{ gameId: string; gameName: string; reason: string } | null>((resolve) => {
      recommendGame(
        { participants, scene: 'both', excludeGameIds },
        {
          onSuccess: (data) => {
            setRecommendedGame(data);
            resolve(data);
          },
          onError: () => {
            setRecommendedGame(null);
            resolve(null);
          },
        }
      );
    });
  }, [recommendGame, resetGameRecommendation]);

  const handleCheckin = useCallback(() => {
    setHasCheckedIn(true);
    setCheckedInCount(prev => Math.min(prev + 1, 5));
    setTimeout(() => {
      setCheckedInCount(5);
      setTimeout(() => {
        setTransitionType('checkin_to_number');
        setShowTransition(true);
        setTimeout(() => setShowTransition(false), 4000);
        setPhase('number_assign');
      }, 1000);
    }, 1500);
  }, []);

  const handleSelectTopic = useCallback((_topic: TopicCard) => {
    // Topic selection handled visually in the UI
  }, []);

  const handleSelectGame = useCallback((_game: IcebreakerGame) => {
    // Game selection handled in ActivitySpotlight - do not set selectedGame
    // to avoid overlapping with GameDetailView during demo
  }, []);

  const handleReady = useCallback(() => {
    setHasVotedReady(true);
    setTimeout(() => {
      setTransitionType('number_to_icebreaker');
      setShowTransition(true);
    }, 1500);
  }, []);

  const handleTransitionComplete = useCallback((completedType: TransitionType) => {
    console.log('[IcebreakerDemoPage] handleTransitionComplete called with:', completedType);
    setShowTransition(false);
    setTransitionType(null);
    
    if (completedType === 'number_to_icebreaker') {
      console.log('[IcebreakerDemoPage] Setting phase to icebreaker');
      setPhase('icebreaker');
      setIcebreakerStartTime(Date.now());
    } else if (completedType === 'checkin_to_number') {
      setPhase('number_assign');
    } else if (completedType === 'icebreaker_to_end') {
      setPhase('ended');
    }
  }, []);

  const handleLeave = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

  const handleEndIcebreaker = useCallback(() => {
    setTransitionType('icebreaker_to_end');
    setShowTransition(true);
    setTimeout(() => setShowTransition(false), 4000);
    setPhase('ended');
  }, []);

  const numberAssignments = DEMO_PARTICIPANTS.map((p, i) => ({
    userId: p.userId,
    displayName: p.displayName,
    numberPlate: i + 1,
    archetype: p.archetype,
  }));

  const checkins = DEMO_PARTICIPANTS.slice(0, checkedInCount).map((p, i) => ({
    userId: p.userId,
    displayName: p.displayName,
    archetype: p.archetype,
    numberPlate: i + 1,
  }));

  return (
    <div className="min-h-screen bg-background" data-testid="icebreaker-demo-page">
      {phase === 'checkin' && (
        <div className="absolute top-4 left-4 right-4 z-20">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">演示模式说明</h4>
                  <div className="space-y-1 text-blue-800 dark:text-blue-200">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      <span><strong>单设备模式</strong>：一台设备上操作，适合现场演示（如国王游戏本地模式）</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4" />
                      <span><strong>多设备模式</strong>：每人一台设备，通过 WebSocket 实时同步（如国王游戏多设备模式）</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="">
        <AnimatePresence mode="wait">
          {phase === 'checkin' && (
            <motion.div
              key="checkin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <IcebreakerCheckinModal
                open={true}
                onOpenChange={() => {}}
                sessionId="demo-session"
                checkedInCount={checkedInCount}
                expectedAttendees={5}
                checkins={checkins}
                isConnected={true}
                isReconnecting={false}
                hasCheckedIn={hasCheckedIn}
                onCheckin={handleCheckin}
                welcomeMessage="欢迎来到今天的小聚！我是小悦，很高兴认识大家。看到这么多有趣的朋友聚在一起，今天一定会很开心！"
                eventTitle="周三南山神秘饭局"
              />
            </motion.div>
          )}

          {phase === 'number_assign' && (
            <motion.div
              key="number_assign"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <NumberPlateDisplay
                open={true}
                onOpenChange={() => {}}
                myNumberPlate={5}
                myUserId="demo-you"
                assignments={numberAssignments}
                readyCount={hasVotedReady ? 3 : 2}
                totalCount={5}
                onReady={handleReady}
                isReady={hasVotedReady}
                eventTitle="周三南山神秘饭局"
              />
            </motion.div>
          )}

          {phase === 'icebreaker' && !selectedGame && (
            <motion.div
              key="icebreaker"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-screen relative"
            >
              <div className="absolute top-4 right-4 z-20">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEndIcebreaker}
                  className="bg-background/80 backdrop-blur-sm"
                  data-testid="button-demo-end"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  模拟结束
                </Button>
              </div>
              <IcebreakerToolkit
                open={true}
                onOpenChange={() => {}}
                topics={allTopics}
                recommendedTopics={recommendedTopics}
                onSelectTopic={handleSelectTopic}
                onSelectGame={handleSelectGame}
                participantCount={5}
                readyCount={hasVotedReady ? 3 : 2}
                totalCount={5}
                isReady={hasVotedReady}
                onReady={handleReady}
                autoReadyTimeoutSeconds={120}
                onRefreshTopics={refreshTopics}
                isRefreshingTopics={isRefreshingTopics}
                isOffline={false}
                sessionStartTime={icebreakerStartTime || undefined}
                onEndIcebreaker={handleEndIcebreaker}
                onRecommendGame={handleRecommendGame}
                isRecommendingGame={isRecommendingGame}
                recommendedGame={recommendedGame}
                demoMode={true}
                sessionId="demo-session"
                icebreakerSessionId="demo-icebreaker-session"
                userId="demo-you"
                displayName="你"
              />
            </motion.div>
          )}

          {selectedGame && (
            <motion.div
              key="game-detail"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-screen pt-4"
            >
              <GameDetailView
                game={selectedGame}
                onBack={() => setSelectedGame(null)}
                onGameChange={(game: IcebreakerGame) => setSelectedGame(game)}
                participantCount={5}
                participants={DEMO_PARTICIPANTS.map(p => ({
                  id: p.userId,
                  name: p.displayName,
                }))}
              />
            </motion.div>
          )}

          {phase === 'ended' && (
            <motion.div
              key="ended"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <IcebreakerEndingScreen
                closingMessage="今天的小聚到此结束啦！感谢大家的参与，希望你们都交到了新朋友。期待下次再见！"
                durationMinutes={25}
                participantCount={5}
                onLeave={handleLeave}
                eventName="周三南山神秘饭局"
                onBack={handleLeave}
                eventId="demo"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {transitionType && (
        <PhaseTransition
          type={transitionType}
          isVisible={showTransition}
          onComplete={handleTransitionComplete}
        />
      )}
    </div>
  );
}
