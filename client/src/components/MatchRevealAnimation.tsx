/**
 * Match Reveal Animation Component
 * 三幕式匹配揭晓动画 - 盲盒开启体验
 * 
 * Act 1: 盲盒晃动 (1.0-1.4s) - 神秘感与期待 [A/B测试中]
 * Act 2: 用户角色飞出 (2s) - 个人身份认同
 * Act 3: 队友汇聚成圈 (2.5s) - 团队归属感
 */

import { useState, useEffect, useCallback, memo } from 'react';
import { getOrAssignVariant, getTimingConfig } from '@/lib/abTestingFramework';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Sparkles, RotateCcw, RotateCw, Theater, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingProgressTracker } from '@/lib/loadingProgressTracker';
import { AnimationLoadingScreen } from '@/components/AnimationLoadingScreen';
import { archetypeAvatars, archetypeGradients } from '@/lib/archetypeAvatars';
import { 
  archetypeAnimations, 
  getEventTypeTheme,
  generateEndingMessage,
  calculateTeammateEntryOrder,
  getMicroInteraction,
  getMicroInteractionAnimation,
  type TeammateEntry,
  type EventTypeTheme
} from '@/lib/archetypeAnimations';

interface Participant {
  userId: string;
  displayName: string;
  archetype: string;
  compatibilityScore?: number;
}

interface MatchRevealAnimationProps {
  eventId: string;
  eventTitle: string;
  eventType?: string;
  userArchetype: string;
  userName: string;
  participants: Participant[];
  onComplete: () => void;
  onSkip: () => void;
  onShare?: () => void;
  onReplay?: () => void;
}

type AnimationAct = 'loading' | 'act1' | 'act2' | 'act3' | 'ending' | 'complete';

function MatchRevealAnimationComponent({
  eventId,
  eventTitle,
  eventType,
  userArchetype,
  userName,
  participants,
  onComplete,
  onSkip,
  onShare,
  onReplay,
}: MatchRevealAnimationProps) {
  const [currentAct, setCurrentAct] = useState<AnimationAct>('loading');
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showSkip, setShowSkip] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [hasRetried, setHasRetried] = useState(false);

  const theme = getEventTypeTheme(eventType);
  const userImage = archetypeAvatars[userArchetype];
  const userGradient = archetypeGradients[userArchetype] || 'from-purple-500 to-pink-500';
  const userAnimation = archetypeAnimations[userArchetype];

  // Note: participants array is already filtered by userId in the backend
  // Don't filter by archetype - teammates can have the same archetype as the user
  const teammateEntries = calculateTeammateEntryOrder(
    userArchetype,
    participants
  );

  const avgCompatibility = participants.length > 0
    ? Math.round(participants.reduce((sum, p) => sum + (p.compatibilityScore || 50), 0) / participants.length)
    : 0;

  const endingMessage = generateEndingMessage(
    userArchetype,
    participants.map(p => p.archetype),
    avgCompatibility
  );

  // Get A/B test variant for timing optimization
  const testVariant = getOrAssignVariant();
  const timingConfig = getTimingConfig(testVariant);

  // Preload images with progress tracking
  useEffect(() => {
    const imageUrls = [
      userImage,
      ...participants.map(p => archetypeAvatars[p.archetype]).filter(Boolean)
    ];

    if (imageUrls.length === 0) {
      setImagesLoaded(true);
      return;
    }

    const progressTracker = new LoadingProgressTracker(imageUrls.length);
    progressTracker.onProgress((state) => {
      setLoadProgress(state.percentage);
      if (state.isComplete) {
        setImagesLoaded(true);
      }
    });

    const timeout = setTimeout(() => {
      if (!imagesLoaded) {
        setLoadError(true);
      }
    }, 5000); // 5s timeout

    imageUrls.forEach(url => {
      if (!url) {
        progressTracker.increment();
        return;
      }
      const img = new Image();
      img.onload = () => progressTracker.increment();
      img.onerror = () => progressTracker.increment();
      img.src = url;
    });

    return () => clearTimeout(timeout);
  }, [userImage, participants, imagesLoaded]);

  // Animation sequence
  useEffect(() => {
    if (loadError) {
      // Skip to ending on error
      setCurrentAct('ending');
      return;
    }

    if (!imagesLoaded) {
      setCurrentAct('loading');
      return;
    }

    // Start animation sequence
    setCurrentAct('act1');

    const timers: NodeJS.Timeout[] = [];

    // Use dynamic timing based on A/B test variant
    const act1End = timingConfig.act1Duration;
    const act2End = act1End + timingConfig.act2Duration;
    const act3End = act2End + timingConfig.act3Duration;

    // Act 1 → Act 2
    timers.push(setTimeout(() => setCurrentAct('act2'), act1End));

    // Act 2 → Act 3
    timers.push(setTimeout(() => setCurrentAct('act3'), act2End));

    // Act 3 → Ending
    timers.push(setTimeout(() => setCurrentAct('ending'), act3End));

    // Ending → Complete (hide skip button after ending screen)
    timers.push(setTimeout(() => {
      setShowSkip(false);
    }, act3End));

    return () => timers.forEach(clearTimeout);
  }, [imagesLoaded, loadError]);

  const handleSkip = useCallback(() => {
    setCurrentAct('ending');
    setTimeout(onComplete, 1500);
  }, [onComplete]);

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Loading state with progress indicator
  if (currentAct === 'loading' && !loadError) {
    return (
      <AnimationLoadingScreen 
        progress={loadProgress}
        eventTheme={theme}
        message={loadProgress < 100 ? '小悦正在组局...' : '就要揭晓了...'}
      />
    );
  }

  // Error fallback with retry option
  if (loadError) {
    const handleRetry = () => {
      setLoadError(false);
      setLoadProgress(0);
      setImagesLoaded(false);
      setHasRetried(true);
    };

    return (
      <motion.div 
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center max-w-sm">
          <div className="flex justify-center -space-x-4 mb-6">
            {participants.slice(0, 5).map((p, i) => (
              <div
                key={p.userId}
                className={`w-16 h-16 rounded-full bg-gradient-to-br ${archetypeGradients[p.archetype] || 'from-purple-500 to-pink-500'} flex items-center justify-center border-2 border-background`}
                style={{ zIndex: 5 - i }}
              >
                {archetypeAvatars[p.archetype] ? (
                  <img 
                    src={archetypeAvatars[p.archetype]} 
                    alt={p.archetype}
                    className="w-12 h-12 object-contain"
                  />
                ) : (
                  <Theater className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
          <h2 className="text-xl font-bold mb-2">加载出了点问题</h2>
          <p className="text-muted-foreground mb-6">别担心，我们已经为你找好了这些队友。点击下方重试或继续查看详情。</p>
          <div className="flex gap-3 justify-center">
            <Button 
              variant="outline"
              onClick={handleRetry}
              data-testid="button-retry-animation"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              重试
            </Button>
            <Button onClick={onComplete} data-testid="button-continue-to-event">
              查看活动详情
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.primaryGradient} opacity-20`} />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Skip button */}
      <AnimatePresence>
        {showSkip && currentAct !== 'ending' && (
          <motion.div
            className="absolute top-4 right-4 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-skip-animation"
            >
              <X className="w-4 h-4 mr-1" />
              跳过
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main animation container */}
      <div className="relative w-full max-w-md h-[60vh] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {/* ACT 1: Blind Box Shake */}
          {currentAct === 'act1' && (
            <motion.div
              key="act1"
              className="flex flex-col items-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="w-40 h-40 rounded-3xl shadow-2xl flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: theme.blindBoxColor }}
                animate={{
                  rotate: [-5, 5, -5, 5, -3, 3, 0],
                  scale: [1, 1.05, 1, 1.05, 1.02, 1],
                }}
                transition={{
                  duration: 1.2,
                  ease: "easeInOut",
                }}
              >
                {/* Glow effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/30 to-white/0"
                  animate={{
                    y: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 1,
                    repeat: 1,
                    ease: "easeInOut",
                  }}
                />
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 1.5,
                    ease: "easeInOut",
                  }}
                >
                  <Sparkles className="w-16 h-16" style={{ color: theme.accentColor }} />
                </motion.div>
              </motion.div>
              <motion.p
                className="mt-6 text-lg text-muted-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                盲盒开启中...
              </motion.p>
            </motion.div>
          )}

          {/* ACT 2: User Archetype Emerges */}
          {currentAct === 'act2' && (
            <motion.div
              key="act2"
              className="flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              {/* User archetype with custom animation */}
              <motion.div
                className="relative"
                initial={userAnimation?.keyframes.initial || { scale: 0, opacity: 0 }}
                animate={userAnimation?.keyframes.animate || { scale: 1, opacity: 1 }}
                transition={{
                  duration: userAnimation?.duration || 0.8,
                  ease: [0.34, 1.56, 0.64, 1], // Spring-like
                }}
              >
                {/* Gradient glow behind */}
                <motion.div
                  className={`absolute inset-0 rounded-full bg-gradient-to-br ${userGradient} blur-xl`}
                  animate={{
                    scale: [1, 1.3, 1.1],
                    opacity: [0.5, 0.8, 0.6],
                  }}
                  transition={{
                    duration: 1.5,
                    ease: "easeOut",
                  }}
                  style={{ transform: 'scale(1.5)' }}
                />
                
                {/* Character image */}
                <motion.div
                  className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${userGradient} p-1 shadow-2xl`}
                >
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                    {userImage ? (
                      <img 
                        src={userImage} 
                        alt={userArchetype}
                        className="w-24 h-24 object-contain"
                      />
                    ) : (
                      <Theater className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>
                </motion.div>

                {/* Particle effects */}
                <ParticleEffect 
                  type={userAnimation?.particleEffect.type || 'sparkle'}
                  color={userAnimation?.particleEffect.color || theme.accentColor}
                  count={userAnimation?.particleEffect.count || 8}
                />
              </motion.div>

              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-2xl font-bold">{userArchetype}</p>
                <p className="text-muted-foreground mt-1">{userName}，这就是你</p>
              </motion.div>
            </motion.div>
          )}

          {/* ACT 3: Teammates Converge */}
          {currentAct === 'act3' && (
            <motion.div
              key="act3"
              className="flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Circle of characters */}
              <div className="relative w-72 h-72">
                {/* User in center */}
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${userGradient} p-0.5 shadow-xl`}>
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                      {userImage ? (
                        <img src={userImage} alt={userArchetype} className="w-14 h-14 object-contain" />
                      ) : (
                        <Theater className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Teammates arranged in circle */}
                {teammateEntries.map((teammate, index) => {
                  const angle = (2 * Math.PI * index) / teammateEntries.length - Math.PI / 2;
                  const radius = 100; // px from center
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;
                  const teammateImage = archetypeAvatars[teammate.archetype];
                  const teammateGradient = archetypeGradients[teammate.archetype] || 'from-purple-500 to-pink-500';
                  const microInteraction = getMicroInteraction(index, teammateEntries.length);
                  const microAnimation = getMicroInteractionAnimation(microInteraction, index);

                  return (
                    <motion.div
                      key={teammate.userId}
                      className="absolute top-1/2 left-1/2"
                      initial={{ 
                        x: x * 3, 
                        y: y * 3, 
                        opacity: 0,
                        scale: 0.3,
                      }}
                      animate={{ 
                        x: x - 28, // offset for center
                        y: y - 28,
                        opacity: 1,
                        scale: 1,
                      }}
                      transition={{
                        delay: 0.3 + teammate.entryDelay / 1000,
                        duration: 0.6,
                        type: "spring",
                        stiffness: 150,
                      }}
                    >
                      <motion.div
                        className="h-full"
                        initial={microAnimation.initial}
                        animate={microAnimation.animate}
                        transition={microAnimation.transition}
                        style={{ transformOrigin: 'center' }}
                      >
                        <div className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${teammateGradient} p-0.5 shadow-lg ${teammate.isHighlight ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-background' : ''}`}>
                          <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                            {teammateImage ? (
                              <img src={teammateImage} alt={teammate.archetype} className="w-10 h-10 object-contain" />
                            ) : (
                              <Theater className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          {/* Highlight effect for best match */}
                          {teammate.isHighlight && (
                            <motion.div
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center"
                              initial={{ scale: 0 }}
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ delay: 1.5, duration: 0.3 }}
                            >
                              <Sparkles className="w-3 h-3 text-yellow-900" />
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })}

                {/* Connecting lines animation */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {teammateEntries.map((teammate, index) => {
                    const angle = (2 * Math.PI * index) / teammateEntries.length - Math.PI / 2;
                    const radius = 100;
                    const x = Math.cos(angle) * radius + 144; // center offset
                    const y = Math.sin(angle) * radius + 144;
                    
                    return (
                      <motion.line
                        key={`line-${teammate.userId}`}
                        x1="144"
                        y1="144"
                        x2={x}
                        y2={y}
                        stroke={theme.accentColor}
                        strokeWidth="1"
                        strokeOpacity="0.3"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
                      />
                    );
                  })}
                </svg>
              </div>

              <motion.p
                className="mt-6 text-lg text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                {participants.length + 1}位伙伴，即将相遇
              </motion.p>
            </motion.div>
          )}

          {/* ENDING: Final message */}
          {currentAct === 'ending' && (
            <motion.div
              key="ending"
              className="flex flex-col items-center text-center px-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Mini circle of avatars */}
              <div className="flex justify-center -space-x-3 mb-6">
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${userGradient} p-0.5 border-2 border-background z-10`}>
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                    {userImage ? (
                      <img src={userImage} alt={userArchetype} className="w-10 h-10 object-contain" />
                    ) : (
                      <Theater className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                </div>
                {participants.slice(0, 4).map((p, i) => (
                  <div
                    key={p.userId}
                    className={`w-14 h-14 rounded-full bg-gradient-to-br ${archetypeGradients[p.archetype] || 'from-purple-500 to-pink-500'} p-0.5 border-2 border-background`}
                    style={{ zIndex: 9 - i }}
                  >
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                      {archetypeAvatars[p.archetype] ? (
                        <img src={archetypeAvatars[p.archetype]} alt={p.archetype} className="w-10 h-10 object-contain" />
                      ) : (
                        <Theater className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Compatibility highlight */}
              {endingMessage.compatibilityHighlight && (
                <motion.div
                  className="mb-4 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    {endingMessage.compatibilityHighlight}
                  </span>
                </motion.div>
              )}

              <motion.h2
                className="text-2xl font-bold mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {endingMessage.main}
              </motion.h2>

              <motion.p
                className="text-muted-foreground mb-4 text-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {endingMessage.sub}
              </motion.p>
              
              {/* User education - highlight replay feature */}
              {onReplay && (
                <motion.div
                  className="text-xs text-muted-foreground mb-6 px-3 py-2 rounded bg-accent/10"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <span className="flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    提示：点击「重看」可以再次欣赏这段精彩的队伍汇聚
                  </span>
                </motion.div>
              )}

              <motion.div
                className="flex gap-3 flex-wrap justify-center mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {onReplay && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onReplay}
                    data-testid="button-replay-animation"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    重看
                  </Button>
                )}
                {onShare && (
                  <Button
                    onClick={onShare}
                    data-testid="button-share-match"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    分享给好友
                  </Button>
                )}
                <Button
                  onClick={handleComplete}
                  data-testid="button-view-event-details"
                >
                  查看活动详情
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Particle effect component
function ParticleEffect({ 
  type, 
  color, 
  count 
}: { 
  type: string; 
  color: string; 
  count: number;
}) {
  const particles = Array.from({ length: count }, (_, i) => i);
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((i) => {
        const angle = (2 * Math.PI * i) / count;
        const distance = 60 + Math.random() * 40;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const size = 4 + Math.random() * 4;
        const delay = Math.random() * 0.3;

        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 rounded-full"
            style={{
              width: size,
              height: size,
              backgroundColor: color,
              boxShadow: `0 0 ${size * 2}px ${color}`,
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{
              x: x,
              y: y,
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 1,
              delay: delay,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
}

const MemoizedMatchRevealAnimation = memo(MatchRevealAnimationComponent, (prev, next) => {
  return (
    prev.eventId === next.eventId &&
    prev.userArchetype === next.userArchetype &&
    prev.participants.length === next.participants.length &&
    prev.participants.every((p, i) => 
      p.userId === next.participants[i]?.userId &&
      p.compatibilityScore === next.participants[i]?.compatibilityScore
    )
  );
});

export default MemoizedMatchRevealAnimation;
