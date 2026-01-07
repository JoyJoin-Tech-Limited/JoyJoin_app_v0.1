import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useIcebreakerWebSocket, type IcebreakerPhase } from "@/hooks/useIcebreakerWebSocket";
import { useIcebreakerTopics, type ParticipantProfile } from "@/hooks/use-icebreaker-topics";
import { useWelcomeMessage, useClosingMessage } from "@/hooks/use-icebreaker-messages";
import { useGameRecommendation } from "@/hooks/useGameRecommendation";
import { IcebreakerCheckinModal } from "@/components/icebreaker/IcebreakerCheckinModal";
import { NumberPlateDisplay } from "@/components/icebreaker/NumberPlateDisplay";
import { IcebreakerToolkit } from "@/components/icebreaker/IcebreakerToolkit";
import { GameDetailView } from "@/components/icebreaker/GameDetailView";
import { IcebreakerEndingScreen } from "@/components/icebreaker/IcebreakerEndingScreen";
import { NetworkStatusBanner } from "@/components/icebreaker/NetworkStatusBanner";
import { PhaseTransition, type TransitionType } from "@/components/icebreaker/PhaseTransition";
import { IcebreakerOverlayProvider, IcebreakerSurface } from "@/components/icebreaker/IcebreakerOverlayProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, WifiOff, RefreshCcw } from "lucide-react";
import type { TopicCard } from "@shared/topicCards";
import type { IcebreakerGame } from "@shared/icebreakerGames";

interface SessionData {
  id: string;
  eventId: string;
  eventTitle?: string;
  expectedAttendees: number;
  atmosphereType: string;
  participants: Array<{
    userId: string;
    displayName: string;
    archetype: string | null;
    interests?: string[];
    topicsHappy?: string[];
    topicsAvoid?: string[];
  }>;
}

interface BlindBoxEventData {
  id: string;
  title: string;
  eventType: string;
  dateTime: string;
}

export default function IcebreakerSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  
  const [selectedGame, setSelectedGame] = useState<IcebreakerGame | null>(null);
  const [hasVotedReady, setHasVotedReady] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionType, setTransitionType] = useState<TransitionType | null>(null);
  const [previousPhase, setPreviousPhase] = useState<IcebreakerPhase | null>(null);
  const [icebreakerStartTime, setIcebreakerStartTime] = useState<number | null>(null);

  const { data: user } = useQuery<{ id: string; displayName: string }>({
    queryKey: ['/api/auth/user'],
  });

  const { data: sessionData, isLoading: sessionLoading } = useQuery<SessionData>({
    queryKey: ['/api/icebreaker/session', sessionId],
    enabled: !!sessionId,
  });

  // Get blind box event details for title (silently fails for non-blind-box events)
  const { data: eventData } = useQuery<BlindBoxEventData>({
    queryKey: ['/api/blind-box-events', sessionData?.eventId],
    enabled: !!sessionData?.eventId,
    retry: false,
    staleTime: Infinity,
  });

  // Use event title from blind box event, fallback to session eventTitle or default
  const eventTitle = eventData?.title || sessionData?.eventTitle || '活动';

  const participantProfiles: ParticipantProfile[] = (sessionData?.participants || []).map(p => ({
    displayName: p.displayName,
    archetype: p.archetype || '',
    interests: p.interests,
    topicsHappy: p.topicsHappy,
    topicsAvoid: p.topicsAvoid,
  }));

  const { 
    recommendedTopics, 
    allTopics, 
    isLoading: topicsLoading,
    isAIPowered,
    isFallback,
    refreshTopics,
    isRefreshing: isRefreshingTopics,
  } = useIcebreakerTopics(
    participantProfiles,
    sessionData?.atmosphereType || 'balanced',
    true
  );

  const welcomeParticipants = participantProfiles.map(p => ({
    displayName: p.displayName,
    archetype: p.archetype || null,
    interests: p.interests,
  }));
  
  const { data: welcomeData } = useWelcomeMessage(
    welcomeParticipants,
    sessionData?.eventId,
    participantProfiles.length > 0
  );
  
  const closingMutation = useClosingMessage();
  const [closingMessage, setClosingMessage] = useState<string | null>(null);

  const {
    recommend: recommendGame,
    isLoading: isRecommendingGame,
    reset: resetGameRecommendation,
  } = useGameRecommendation();

  const [recommendedGame, setRecommendedGame] = useState<{ gameId: string; gameName: string; reason: string } | null>(null);

  const handleRecommendGame = useCallback(async (excludeGameIds?: string[]): Promise<{ gameId: string; gameName: string; reason: string } | null> => {
    const participants = (sessionData?.participants || []).map(p => ({
      displayName: p.displayName,
      archetype: p.archetype,
      interests: p.interests,
    }));
    if (participants.length === 0) return null;
    resetGameRecommendation();
    setRecommendedGame(null);
    return new Promise((resolve) => {
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
  }, [recommendGame, resetGameRecommendation, sessionData?.participants]);

  const {
    state: icebreakerState,
    isConnected,
    isReconnecting,
    isDemoMode,
    checkin,
    voteReady,
    selectTopic,
    startGame,
    leave,
  } = useIcebreakerWebSocket({
    sessionId: sessionId || '',
    userId: user?.id || '',
    expectedAttendees: sessionData?.expectedAttendees || 0,
    onPhaseChange: (phase, prevPhase) => {
      if (prevPhase && prevPhase !== phase) {
        let transition: TransitionType | null = null;
        if (prevPhase === 'checkin' && phase === 'number_assign') {
          transition = 'checkin_to_number';
        } else if (prevPhase === 'number_assign' && phase === 'icebreaker') {
          transition = 'number_to_icebreaker';
          setIcebreakerStartTime(Date.now());
        } else if (phase === 'ended') {
          transition = 'icebreaker_to_end';
        }
        
        if (transition) {
          setTransitionType(transition);
          setShowTransition(true);
          setTimeout(() => setShowTransition(false), 4000);
        }
        setPreviousPhase(phase);
      }
    },
    onNumberAssigned: () => {
      // Number assignment shown in UI
    },
    onRateLimited: (data) => {
      // Rate limit handled silently
    },
  });

  const isOffline = !isConnected && !isReconnecting;

  const handleCheckin = useCallback(() => {
    if (isOffline) {
      return;
    }
    checkin();
  }, [checkin, isOffline]);

  const handleSelectTopic = useCallback((topic: TopicCard) => {
    if (isOffline) {
      return;
    }
    selectTopic(topic.question, topic.question);
  }, [selectTopic, isOffline]);

  const handleSelectGame = useCallback((game: IcebreakerGame) => {
    setSelectedGame(game);
  }, []);

  const handleStartGame = useCallback((game: IcebreakerGame) => {
    if (isOffline) {
      return;
    }
    startGame(game.id, game.name);
  }, [startGame, isOffline]);

  const handleReady = useCallback((isAutoVote: boolean = false) => {
    if (isOffline) {
      return;
    }
    voteReady('icebreaker', isAutoVote);
    setHasVotedReady(true);
  }, [voteReady, isOffline]);

  const handleLeave = useCallback(() => {
    if (!isOffline) {
      leave();
    }
    setLocation('/events');
  }, [leave, setLocation, isOffline]);

  const handleEndIcebreaker = useCallback(() => {
    if (isOffline) return;
    voteReady('ended', false);
  }, [voteReady, isOffline]);

  useEffect(() => {
    if (icebreakerState.phase === 'ended' && !closingMessage && !closingMutation.isPending) {
      const durationMinutes = Math.max(1, Math.round((icebreakerState.duration || 60) / 60));
      closingMutation.mutate({
        participants: welcomeParticipants.length > 0 ? welcomeParticipants : [{ displayName: '参与者', archetype: null }],
        durationMinutes,
      }, {
        onSuccess: (data) => {
          setClosingMessage(data.message);
        },
      });
    }
  }, [icebreakerState.phase, icebreakerState.duration, closingMessage, welcomeParticipants]);

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="icebreaker-no-session">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">无效的会话ID</p>
            <Button onClick={() => setLocation('/events')} className="mt-4">
              返回活动列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="icebreaker-loading">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">加载会话信息...</p>
        </div>
      </div>
    );
  }


  return (
    <IcebreakerOverlayProvider>
      <div className="min-h-screen bg-background" data-testid="icebreaker-session-page">
        <IcebreakerSurface>
          {!showTransition && (
            <AnimatePresence mode="wait">
            {icebreakerState.phase === 'waiting' && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center min-h-screen"
              >
                <Card>
                  <CardContent className="p-6 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="mt-4">等待活动开始...</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {icebreakerState.phase === 'checkin' && (
              <motion.div
                key="checkin"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <IcebreakerCheckinModal
                  open={true}
                  onOpenChange={() => {}}
                  sessionId={sessionId || ''}
                  checkedInCount={icebreakerState.checkedInCount}
                  expectedAttendees={icebreakerState.expectedAttendees}
                  checkins={icebreakerState.checkins}
                  isConnected={isConnected}
                  isReconnecting={isReconnecting}
                  hasCheckedIn={icebreakerState.checkins.some(c => c.userId === user?.id)}
                  onCheckin={handleCheckin}
                  welcomeMessage={welcomeData?.message}
                  eventTitle={eventTitle}
                />
              </motion.div>
            )}

            {icebreakerState.phase === 'number_assign' && icebreakerState.myNumberPlate && (
              <motion.div
                key="number_assign"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <NumberPlateDisplay
                  open={true}
                  onOpenChange={() => {}}
                  myNumberPlate={icebreakerState.myNumberPlate}
                  myUserId={user?.id || ''}
                  assignments={icebreakerState.numberAssignments}
                  readyCount={icebreakerState.readyCount}
                  totalCount={icebreakerState.checkedInCount}
                  onReady={handleReady}
                  isReady={hasVotedReady}
                  eventTitle={eventTitle}
                />
              </motion.div>
            )}

            {icebreakerState.phase === 'icebreaker' && !selectedGame && (
              <motion.div
                key="icebreaker"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-screen relative"
              >
                {topicsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        {isAIPowered ? '小悦正在为你们挑选话题...' : '加载话题中...'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {isFallback && (
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-3 py-1 rounded-full text-xs">
                          使用本地推荐模式
                        </div>
                      </div>
                    )}
                    <IcebreakerToolkit
                      open={true}
                      onOpenChange={() => {}}
                      topics={allTopics}
                      recommendedTopics={recommendedTopics}
                      onSelectTopic={handleSelectTopic}
                      onSelectGame={handleSelectGame}
                      participantCount={icebreakerState.checkedInCount}
                      readyCount={icebreakerState.readyCount}
                      totalCount={icebreakerState.checkedInCount}
                      isReady={hasVotedReady}
                      onReady={handleReady}
                      autoReadyTimeoutSeconds={60}
                      onRefreshTopics={refreshTopics}
                      isRefreshingTopics={isRefreshingTopics}
                      isOffline={isOffline}
                      sessionStartTime={icebreakerStartTime || undefined}
                      onEndIcebreaker={handleEndIcebreaker}
                      onRecommendGame={handleRecommendGame}
                      isRecommendingGame={isRecommendingGame}
                      recommendedGame={recommendedGame}
                      eventType={eventData?.eventType as "饭局" | "酒局" | "咖啡" | "徒步" | "桌游" | "其他" | undefined}
                    />
                  </>
                )}
              </motion.div>
            )}

            {selectedGame && (
              <motion.div
                key="game-detail"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="h-screen"
              >
                <GameDetailView
                  game={selectedGame}
                  onBack={() => setSelectedGame(null)}
                  onGameChange={(game: IcebreakerGame) => setSelectedGame(game)}
                  participantCount={icebreakerState.checkedInCount}
                />
              </motion.div>
            )}

            {icebreakerState.phase === 'ended' && (
              <motion.div
                key="ended"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <IcebreakerEndingScreen
                  closingMessage={icebreakerState.aiClosingMessage || closingMessage}
                  durationMinutes={Math.max(1, Math.round(icebreakerState.duration / 60))}
                  participantCount={icebreakerState.checkedInCount}
                  onLeave={handleLeave}
                  eventId={sessionData?.eventId}
                />
              </motion.div>
            )}
            </AnimatePresence>
          )}
        </IcebreakerSurface>

        <NetworkStatusBanner 
          isConnected={isConnected} 
          isReconnecting={isReconnecting}
          isDemoMode={isDemoMode}
          onRetry={() => window.location.reload()}
        />

        {transitionType && (
          <PhaseTransition
            type={transitionType}
            isVisible={showTransition}
            onComplete={() => {
              setShowTransition(false);
              setTransitionType(null);
            }}
          />
        )}
      </div>
    </IcebreakerOverlayProvider>
  );
}
