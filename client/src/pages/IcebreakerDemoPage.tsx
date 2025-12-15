import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useIcebreakerTopics, type ParticipantProfile } from '@/hooks/use-icebreaker-topics';
import { IcebreakerCheckinModal } from '@/components/icebreaker/IcebreakerCheckinModal';
import { NumberPlateDisplay } from '@/components/icebreaker/NumberPlateDisplay';
import { IcebreakerToolkit } from '@/components/icebreaker/IcebreakerToolkit';
import { GameDetailView } from '@/components/icebreaker/GameDetailView';
import { IcebreakerEndingScreen } from '@/components/icebreaker/IcebreakerEndingScreen';
import { PhaseTransition, type TransitionType } from '@/components/icebreaker/PhaseTransition';
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

  const handleCheckin = useCallback(() => {
    setHasCheckedIn(true);
    setCheckedInCount(prev => Math.min(prev + 1, 5));
    setTimeout(() => {
      setCheckedInCount(5);
      setTimeout(() => {
        setTransitionType('checkin_to_number');
        setShowTransition(true);
        setTimeout(() => setShowTransition(false), 1500);
        setPhase('number_assign');
      }, 1000);
    }, 1500);
  }, []);

  const handleSelectTopic = useCallback((_topic: TopicCard) => {
    // Topic selection handled visually in the UI
  }, []);

  const handleSelectGame = useCallback((game: IcebreakerGame) => {
    setSelectedGame(game);
  }, []);

  const handleReady = useCallback(() => {
    setHasVotedReady(true);
    setTimeout(() => {
      setTransitionType('number_to_icebreaker');
      setShowTransition(true);
      setTimeout(() => setShowTransition(false), 1500);
      setPhase('icebreaker');
      setIcebreakerStartTime(Date.now());
    }, 1500);
  }, []);

  const handleLeave = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

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
                eventTitle="周末咖啡局"
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
                eventTitle="周末咖啡局"
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {transitionType && (
        <PhaseTransition
          type={transitionType}
          isVisible={showTransition}
          onComplete={() => setTransitionType(null)}
        />
      )}
    </div>
  );
}
