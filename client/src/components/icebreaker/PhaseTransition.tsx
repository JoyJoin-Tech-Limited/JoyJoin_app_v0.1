import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users, MessageCircle, PartyPopper, Star, Check, ClipboardCheck, Hash, Coffee, Heart } from 'lucide-react';

export type TransitionType = 'checkin_to_number' | 'number_to_icebreaker' | 'icebreaker_to_end';

interface PhaseTransitionProps {
  type: TransitionType;
  isVisible: boolean;
  onComplete?: () => void;
}

const JOURNEY_STEPS = [
  { id: 'checkin', label: '签到', icon: ClipboardCheck },
  { id: 'number', label: '号码牌', icon: Hash },
  { id: 'icebreaker', label: '破冰', icon: Coffee },
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
  },
  number_to_icebreaker: {
    icon: MessageCircle,
    title: '准备开始破冰',
    subtitle: '让我们开始愉快的交流吧！',
    xiaoYueMessage: '号码牌已就位！准备好认识新朋友了吗？让我们开始愉快的破冰之旅吧~',
    color: 'text-green-500',
    bgGradient: 'from-green-500/20 via-green-500/10 to-transparent',
    particleColors: ['bg-green-400', 'bg-emerald-400', 'bg-teal-400'],
    currentStep: 2,
  },
  icebreaker_to_end: {
    icon: PartyPopper,
    title: '破冰结束',
    subtitle: '感谢大家的参与！',
    xiaoYueMessage: '今天的破冰圆满结束啦！希望你们都交到了新朋友，期待下次再见~',
    color: 'text-amber-500',
    bgGradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
    particleColors: ['bg-amber-400', 'bg-orange-400', 'bg-yellow-400'],
    currentStep: 3,
  },
};

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
        const isPending = index > currentStep;

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

export function PhaseTransition({ type, isVisible, onComplete }: PhaseTransitionProps) {
  const config = transitionConfig[type];
  const Icon = config.icon;

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
    if (isVisible && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  return (
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
            className="relative flex flex-col items-center text-center px-4 sm:px-8"
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: -20 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
          >
            <JourneyProgress currentStep={config.currentStep} />
            
            <motion.div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-background shadow-xl flex items-center justify-center mb-4 sm:mb-6 ${config.color} relative`}
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
              <Icon className="w-12 h-12 relative z-10" />
            </motion.div>

            <motion.div
              className="flex items-center gap-2 mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <Sparkles className="w-5 h-5 text-primary" />
              </motion.div>
              <h2 className="text-2xl font-bold">{config.title}</h2>
              <motion.div
                animate={{ rotate: [0, -15, 15, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <Sparkles className="w-5 h-5 text-primary" />
              </motion.div>
            </motion.div>

            <motion.p
              className="text-muted-foreground mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {config.subtitle}
            </motion.p>

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
              className="mt-8 flex gap-1.5"
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
