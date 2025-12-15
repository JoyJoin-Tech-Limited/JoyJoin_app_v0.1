import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useIcebreakerTopics, type ParticipantProfile } from '@/hooks/use-icebreaker-topics';
import { IcebreakerCheckinModal } from '@/components/icebreaker/IcebreakerCheckinModal';
import { NumberPlateDisplay } from '@/components/icebreaker/NumberPlateDisplay';
import { IcebreakerGallery } from '@/components/icebreaker/IcebreakerGallery';
import { GameDetailView } from '@/components/icebreaker/GameDetailView';
import { IcebreakerEndingScreen } from '@/components/icebreaker/IcebreakerEndingScreen';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, Monitor } from 'lucide-react';
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

const PHASE_LABELS: Record<DemoPhase, string> = {
  checkin: '签到',
  number_assign: '号码牌',
  icebreaker: '破冰工具箱',
  ended: '结束',
};

const PHASE_ORDER: DemoPhase[] = ['checkin', 'number_assign', 'icebreaker', 'ended'];

export default function IcebreakerDemoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<DemoPhase>('checkin');
  const [checkedInCount, setCheckedInCount] = useState(3);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasVotedReady, setHasVotedReady] = useState(false);
  const [selectedGame, setSelectedGame] = useState<IcebreakerGame | null>(null);

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
    toast({
      title: '签到成功',
      description: '请等待其他小伙伴签到...',
    });
    setTimeout(() => {
      setCheckedInCount(5);
      setTimeout(() => setPhase('number_assign'), 1000);
    }, 1500);
  }, [toast]);

  const handleSelectTopic = useCallback((topic: TopicCard) => {
    toast({
      title: '话题已选择',
      description: topic.question,
    });
  }, [toast]);

  const handleSelectGame = useCallback((game: IcebreakerGame) => {
    setSelectedGame(game);
  }, []);

  const handleReady = useCallback(() => {
    setHasVotedReady(true);
    toast({
      title: '已准备好',
      description: '等待其他人准备...',
    });
    setTimeout(() => {
      setPhase('icebreaker');
    }, 1500);
  }, [toast]);

  const handleLeave = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

  const goToPhase = (newPhase: DemoPhase) => {
    setPhase(newPhase);
    setSelectedGame(null);
    if (newPhase === 'checkin') {
      setHasCheckedIn(false);
      setCheckedInCount(3);
    }
    if (newPhase === 'number_assign' || newPhase === 'icebreaker') {
      setHasVotedReady(false);
    }
  };

  const currentPhaseIndex = PHASE_ORDER.indexOf(phase);
  const canGoBack = currentPhaseIndex > 0;
  const canGoForward = currentPhaseIndex < PHASE_ORDER.length - 1;

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
      <div className="fixed top-0 left-0 right-0 z-50 bg-purple-500/90 dark:bg-purple-600/90 backdrop-blur-sm">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">
              离线演示模式
            </span>
          </div>
          <div className="flex items-center gap-1">
            {PHASE_ORDER.map((p, i) => (
              <button
                key={p}
                onClick={() => goToPhase(p)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  phase === p 
                    ? 'bg-white text-purple-600 font-medium' 
                    : 'text-white/80 hover:bg-white/20'
                }`}
                data-testid={`phase-button-${p}`}
              >
                {PHASE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 right-4 z-40 flex justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => canGoBack && goToPhase(PHASE_ORDER[currentPhaseIndex - 1])}
          disabled={!canGoBack}
          className="bg-background/80 backdrop-blur-sm"
          data-testid="button-prev-phase"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          上一步
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => canGoForward && goToPhase(PHASE_ORDER[currentPhaseIndex + 1])}
          disabled={!canGoForward}
          className="bg-background/80 backdrop-blur-sm"
          data-testid="button-next-phase"
        >
          下一步
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="pt-12">
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
              <IcebreakerGallery
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
    </div>
  );
}
