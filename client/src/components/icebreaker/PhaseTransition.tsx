import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users, MessageCircle, PartyPopper, Star, Check, ClipboardCheck, Hash, Coffee, Heart, Lightbulb, Gamepad2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIcebreakerOverlay } from './IcebreakerOverlayProvider';

export type TransitionType = 'checkin_to_number' | 'number_to_icebreaker' | 'icebreaker_to_end';

interface PhaseTransitionProps {
  type: TransitionType;
  isVisible: boolean;
  onComplete?: (type: TransitionType) => void;
}

const JOURNEY_STEPS = [
  { id: 'checkin', label: '签到', icon: ClipboardCheck },
  { id: 'number', label: '号码牌', icon: Hash },
  { id: 'icebreaker', label: '交流', icon: Coffee },
  { id: 'end', label: '结束', icon: Heart },
];

const transitionConfig = {
  checkin_to_number: {
    icon: Users,
    title: '签到完成',
    subtitle: '即将分配号码牌...',
    xiaoYueMessage: '太棒了！大家都到齐啦，马上给你们分配专属号码牌~',
    color: 'text-primary',
    bgGradient: 'from-primary/20 via-primary/10 to-transparent',
    particleColors: ['bg-purple-400', 'bg-pink-400', 'bg-indigo-400'],
    currentStep: 1,
    requiresConfirmation: false,
  },
  number_to_icebreaker: {
    icon: MessageCircle,
    title: '准备开始交流',
    subtitle: '了解一下活动工具包',
    xiaoYueMessage: '自我介绍结束啦！接下来我为你准备了一些有趣的工具，可以帮助大家打破僵局、活跃气氛~',
    color: 'text-green-500',
    bgGradient: 'from-green-500/20 via-green-500/10 to-transparent',
    particleColors: ['bg-green-400', 'bg-emerald-400', 'bg-teal-400'],
    currentStep: 2,
    requiresConfirmation: true,
  },
  icebreaker_to_end: {
    icon: PartyPopper,
    title: '活动结束',
    subtitle: '感谢大家的参与！',
    xiaoYueMessage: '今天的活动圆满结束啦！希望你们都交到了新朋友，期待下次再见~',
    color: 'text-amber-500',
    bgGradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
    particleColors: ['bg-amber-400', 'bg-orange-400', 'bg-yellow-400'],
    currentStep: 3,
    requiresConfirmation: false,
  },
};

const toolkitFeatures = [
  {
    icon: MessageCircle,
    title: '话题推荐',
    description: '小悦根据大家的性格精选话题',
  },
  {
    icon: Gamepad2,
    title: '互动游戏',
    description: '轻松有趣的破冰小游戏',
  },
  {
    icon: Lightbulb,
    title: '气氛调节',
    description: '遇到冷场？随时切换新话题',
  },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

interface ParticleProps {
  index: number;
  colorClass: string;
  type: 'sparkle' | 'star' | 'circle';
}

function Particle({ index, colorClass, type }: ParticleProps) {
  const size = 4 + seededRandom(index * 7) * 8;
  const startX = seededRandom(index * 11) * 100;
  const startY = seededRandom(index * 13) * 100;
  const duration = 2 + seededRandom(index * 17) * 2;
  const delay = seededRandom(index * 19) * 1;

  if (type === 'sparkle') {
    return (
      <motion.div
        className={`absolute rounded-full ${colorClass}`}
        style={{
          width: size,
          height: size,
          left: `${startX}%`,
          top: `${startY}%`,
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: [0, 1, 0],
          scale: [0, 1.5, 0],
          y: [0, -30, -60],
        }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    );
  }

  if (type === 'star') {
    return (
      <motion.div
        className={`absolute ${colorClass}`}
        style={{
          left: `${startX}%`,
          top: `${startY}%`,
        }}
        initial={{ opacity: 0, scale: 0, rotate: 0 }}
        animate={{
          opacity: [0, 1, 0],
          scale: [0, 1, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: duration * 1.5,
          delay,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Star className="w-3 h-3" fill="currentColor" />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`absolute w-1 h-1 rounded-full ${colorClass}`}
      style={{
        left: `${startX}%`,
        top: `${startY}%`,
      }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 0.8, 0],
        x: [0, (seededRandom(index * 23) - 0.5) * 100],
        y: [0, (seededRandom(index * 29) - 0.5) * 100],
      }}
      transition={{
        duration: duration * 0.8,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

function GlowRing({ delay, size, colorClass }: { delay: number; size: number; colorClass: string }) {
  return (
    <motion.div
      className={`absolute rounded-full border-2 ${colorClass}`}
      style={{
        width: size,
        height: size,
        left: '50%',
        top: '50%',
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{
        opacity: [0, 0.6, 0],
        scale: [0.5, 1.5, 2],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

function JourneyProgress({ currentStep }: { currentStep: number }) {
  return (
    <motion.div
      className="flex items-center justify-center gap-1 sm:gap-2 mb-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      {JOURNEY_STEPS.map((step, index) => {
        const StepIcon = step.icon;
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.id} className="flex items-center">
            <motion.div
              className={`relative flex flex-col items-center ${
                isCurrent ? 'scale-110' : ''
              }`}
              initial={isCompleted ? { scale: 0 } : { scale: 1 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: index * 0.1 }}
            >
              <motion.div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center relative ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
                animate={
                  isCurrent
                    ? {
                        boxShadow: [
                          '0 0 0 0 rgba(139, 92, 246, 0.4)',
                          '0 0 0 8px rgba(139, 92, 246, 0)',
                        ],
                      }
                    : {}
                }
                transition={
                  isCurrent
                    ? { duration: 1.5, repeat: Infinity, ease: 'easeOut' }
                    : {}
                }
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.5 }}
                  >
                    <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                  </motion.div>
                ) : (
                  <StepIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </motion.div>
              <span
                className={`text-xs mt-1 whitespace-nowrap ${
                  isCompleted
                    ? 'text-green-500 font-medium'
                    : isCurrent
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </motion.div>

            {index < JOURNEY_STEPS.length - 1 && (
              <div className="flex items-center mx-1 sm:mx-2 -mt-4">
                <motion.div
                  className={`h-0.5 w-4 sm:w-8 ${
                    index < currentStep ? 'bg-green-500' : 'bg-muted'
                  }`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  style={{ originX: 0 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </motion.div>
  );
}

function ToolkitGuide({ onConfirm }: { onConfirm: () => void }) {
  return (
    <motion.div
      className="w-full max-w-sm space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl p-4 border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-primary">小悦说</span>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed mb-4" data-testid="text-xiaoyue-message">
          自我介绍结束啦！接下来我为你准备了一些有趣的工具，可以帮助大家打破僵局、活跃气氛~
        </p>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            活动工具包可以帮你：
          </p>
          {toolkitFeatures.map((feature, index) => {
            const FeatureIcon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                className="flex items-start gap-3 bg-background/50 rounded-lg p-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FeatureIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Button
          className="w-full"
          size="lg"
          onClick={onConfirm}
          data-testid="button-understood"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          明白了！
        </Button>
      </motion.div>
    </motion.div>
  );
}

export function PhaseTransition({ type, isVisible, onComplete }: PhaseTransitionProps) {
  const config = transitionConfig[type];
  const Icon = config.icon;
  const [showGuide, setShowGuide] = useState(false);
  
  // Use overlay provider - component must be wrapped in IcebreakerOverlayProvider
  const { registerOverlay } = useIcebreakerOverlay();

  // Register with overlay provider when visible
  useEffect(() => {
    if (isVisible) {
      const unregister = registerOverlay();
      return unregister;
    }
  }, [isVisible, registerOverlay]);

  const particles = useMemo(() => {
    const items: ParticleProps[] = [];
    const types: ('sparkle' | 'star' | 'circle')[] = ['sparkle', 'star', 'circle'];
    
    for (let i = 0; i < 30; i++) {
      items.push({
        index: i,
        colorClass: config.particleColors[i % config.particleColors.length],
        type: types[i % types.length],
      });
    }
    return items;
  }, [config.particleColors]);

  useEffect(() => {
    if (isVisible && !config.requiresConfirmation && onComplete) {
      const timer = setTimeout(() => {
        onComplete(type);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete, config.requiresConfirmation, type]);

  useEffect(() => {
    if (isVisible && config.requiresConfirmation) {
      const timer = setTimeout(() => {
        setShowGuide(true);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setShowGuide(false);
    }
  }, [isVisible, config.requiresConfirmation]);

  const handleConfirm = () => {
    onComplete?.(type);
  };

  const overlayContent = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          data-testid={`phase-transition-${type}`}
        >
          <div className={`absolute inset-0 bg-gradient-radial ${config.bgGradient}`} />
          
          <div className="absolute inset-0 pointer-events-none motion-reduce:hidden">
            {particles.map((particle) => (
              <Particle key={particle.index} {...particle} />
            ))}
          </div>

          <div className="absolute inset-0 pointer-events-none motion-reduce:hidden">
            <GlowRing delay={0} size={120} colorClass="border-purple-400/30" />
            <GlowRing delay={0.5} size={160} colorClass="border-purple-400/20" />
            <GlowRing delay={1} size={200} colorClass="border-purple-400/10" />
          </div>
          
          <motion.div
            className="relative flex flex-col items-center text-center px-4 sm:px-8 max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: -20 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
          >
            <JourneyProgress currentStep={config.currentStep} />
            
            <motion.div
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-background shadow-xl flex items-center justify-center mb-3 sm:mb-4 ${config.color} relative`}
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', duration: 0.6, delay: 0.1, bounce: 0.4 }}
            >
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  boxShadow: [
                    `0 0 20px rgba(139, 92, 246, 0.3)`,
                    `0 0 40px rgba(139, 92, 246, 0.5)`,
                    `0 0 20px rgba(139, 92, 246, 0.3)`,
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <Icon className="w-8 h-8 sm:w-10 sm:h-10 relative z-10" />
            </motion.div>

            <motion.div
              className="flex items-center gap-2 mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <Sparkles className="w-4 h-4 text-primary" />
              </motion.div>
              <h2 className="text-xl sm:text-2xl font-bold">{config.title}</h2>
              <motion.div
                animate={{ rotate: [0, -15, 15, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <Sparkles className="w-4 h-4 text-primary" />
              </motion.div>
            </motion.div>

            <motion.p
              className="text-sm text-muted-foreground mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {config.subtitle}
            </motion.p>

            {config.requiresConfirmation && showGuide ? (
              <ToolkitGuide onConfirm={handleConfirm} />
            ) : !config.requiresConfirmation ? (
              <>
                <motion.div
                  className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl p-4 border border-primary/20 max-w-xs"
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-primary">小悦说</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed" data-testid="text-xiaoyue-message">
                    {config.xiaoYueMessage}
                  </p>
                </motion.div>

                <motion.div
                  className="mt-6 flex gap-1.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full ${config.color.replace('text-', 'bg-')}`}
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </motion.div>
              </>
            ) : (
              <motion.div
                className="mt-4 flex gap-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render via portal to document.body to ensure it's always on top of all layers
  return createPortal(overlayContent, document.body);
}
