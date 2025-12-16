import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Users,
  Sparkles,
  Wine,
  Utensils,
  Globe,
  MessageCircle,
} from 'lucide-react';
import type { TopicCard } from '@shared/topicCards';
import type { IcebreakerGame } from '@shared/icebreakerGames';
import { SpinWheel } from './SpinWheel';

interface ActivitySpotlightProps {
  open: boolean;
  onClose: () => void;
  item: {
    type: 'topic' | 'game';
    data: TopicCard | IcebreakerGame;
  } | null;
  participantCount: number;
  onFeedback?: (rating: 'good' | 'neutral' | 'bad') => void;
  onNextRecommendation?: () => void;
  participants?: Array<{ id: string; name: string }>;
}

const sceneIcons = {
  dinner: Utensils,
  bar: Wine,
  both: Globe,
};

const sceneLabels = {
  dinner: '饭局',
  bar: '酒局',
  both: '通用',
};

const difficultyLabels = {
  easy: '轻松',
  medium: '适中',
  hard: '有挑战',
  deep: '深度',
};

const gradients = {
  topic: 'from-purple-600 via-purple-500 to-pink-500',
  scene: {
    dinner: 'from-amber-500 via-orange-400 to-yellow-500',
    bar: 'from-fuchsia-500 via-purple-500 to-indigo-500',
    both: 'from-purple-600 via-violet-500 to-pink-500',
  },
};

export function ActivitySpotlight({
  open,
  onClose,
  item,
  participantCount,
  participants,
}: ActivitySpotlightProps) {
  const [showSpinWheel, setShowSpinWheel] = useState(false);

  const handleSpinWheelToggle = useCallback(() => {
    setShowSpinWheel(prev => !prev);
  }, []);

  if (!item) return null;

  const isGame = item.type === 'game';
  const game = isGame ? (item.data as IcebreakerGame) : null;
  const topic = !isGame ? (item.data as TopicCard) : null;

  const gradient = isGame && game
    ? gradients.scene[game.scene]
    : gradients.topic;

  const SceneIcon = isGame && game ? sceneIcons[game.scene] : MessageCircle;

  // Generate default participants if not provided
  const spinWheelParticipants = participants || 
    Array.from({ length: participantCount }, (_, i) => ({
      id: String(i + 1),
      name: `${i + 1}号`,
    }));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col"
          data-testid="activity-spotlight"
        >
          {/* Background layer */}
          <div 
            className={`absolute inset-0 bg-gradient-to-br ${gradient}`} 
            onClick={onClose}
          />
          
          {/* Content layer */}
          <div 
            className="relative flex-1 flex flex-col p-4 pt-safe pb-safe overflow-hidden pointer-events-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
                data-testid="button-close-spotlight"
              >
                <X className="w-6 h-6" />
              </Button>
              
              <Badge className="bg-white/30 text-white border-0" data-testid="badge-type">
                {isGame ? '游戏' : '话题'}
              </Badge>
              
              <Badge className="bg-white/30 text-white border-0 flex items-center gap-1" data-testid="badge-participants">
                <Users className="w-3 h-3" />
                {participantCount}人
              </Badge>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center text-center px-4 overflow-y-auto">
              {!showSpinWheel ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full space-y-6"
                >
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                    <SceneIcon className="w-10 h-10 text-white" />
                  </div>

                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {isGame ? game?.name : topic?.question}
                  </h2>
                  
                  <p className="text-white/80 text-base">
                    {isGame ? game?.description : topic?.targetDynamic}
                  </p>

                  {isGame && game?.rules && (
                    <div className="bg-white/20 rounded-xl p-4 text-left space-y-2 max-h-[30vh] overflow-y-auto">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        游戏规则
                      </h3>
                      <ol className="space-y-2">
                        {game.rules.map((rule, idx) => (
                          <li key={idx} className="text-white/90 text-sm flex items-start gap-2">
                            <span className="bg-white/30 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs">
                              {idx + 1}
                            </span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ol>
                      {game.tips && game.tips.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/20">
                          <p className="text-white/70 text-xs">
                            小贴士：{game.tips[0]}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-4">
                    {isGame && game && (
                      <>
                        <Badge className="bg-white/30 text-white border-0 flex items-center gap-1">
                          <SceneIcon className="w-3 h-3" />
                          {sceneLabels[game.scene]}
                        </Badge>
                        <Badge className="bg-white/30 text-white border-0">
                          {difficultyLabels[game.difficulty]}
                        </Badge>
                      </>
                    )}
                    {!isGame && topic && (
                      <Badge className="bg-white/30 text-white border-0">
                        {difficultyLabels[topic.difficulty as keyof typeof difficultyLabels] || topic.difficulty}
                      </Badge>
                    )}
                  </div>

                  {isGame && game?.drinkingWarning && (
                    <div className="bg-amber-500/30 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <Wine className="w-4 h-4 text-amber-200 flex-shrink-0 mt-0.5" />
                        <p className="text-amber-100 text-xs leading-relaxed">
                          {game.drinkingWarning}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Spin Wheel Button - Main CTA */}
                  <Button
                    onClick={handleSpinWheelToggle}
                    className="w-full bg-white/30 hover:bg-white/40 text-white border-0 h-12 text-base"
                    data-testid="button-open-spinwheel"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    随机选人发言
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full"
                >
                  <SpinWheel
                    participants={spinWheelParticipants}
                    title="选一个人先发言"
                  />
                  <Button
                    variant="ghost"
                    onClick={handleSpinWheelToggle}
                    className="w-full mt-4 text-white/70 hover:text-white hover:bg-white/10"
                    data-testid="button-back-to-content"
                  >
                    返回话题
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
