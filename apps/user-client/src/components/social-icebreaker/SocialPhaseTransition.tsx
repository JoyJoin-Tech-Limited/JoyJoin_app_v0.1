import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SocialPhaseTransitionProps {
  type: 'warmup_to_challenge' | 'challenge_to_detective' | 'detective_to_recap' | null;
  isVisible: boolean;
  onComplete?: () => void;
}

const TRANSITION_CONFIG = {
  warmup_to_challenge: {
    emoji: '⚡',
    title: '进入微挑战',
    subtitle: '时间到了，接受挑战吧！',
    message: '热身完毕！接下来是微挑战环节，大家准备好了吗？',
    bgClass: 'from-cyan-900 via-blue-900 to-indigo-900',
    particleColors: ['bg-cyan-400', 'bg-blue-400', 'bg-indigo-400'],
  },
  challenge_to_detective: {
    emoji: '🕵️',
    title: '谎言侦探开始',
    subtitle: '谁是最佳说谎者？',
    message: '侦探们，仔细听每一句话，找出谎言！',
    bgClass: 'from-slate-900 via-purple-950 to-slate-900',
    particleColors: ['bg-purple-400', 'bg-violet-400', 'bg-fuchsia-400'],
  },
  detective_to_recap: {
    emoji: '✨',
    title: '精彩回顾',
    subtitle: '今晚的破冰之旅圆满结束！',
    message: '感谢大家的参与！看看今晚的精彩回顾吧～',
    bgClass: 'from-violet-900 via-purple-900 to-fuchsia-900',
    particleColors: ['bg-amber-400', 'bg-orange-400', 'bg-yellow-400'],
  },
};

function Particle({ index, colorClass }: { index: number; colorClass: string }) {
  const size = 4 + (index % 3) * 4;
  const x = ((index * 13) % 100);
  const y = ((index * 17) % 100);
  return (
    <motion.div
      className={`absolute rounded-full ${colorClass}`}
      style={{ width: size, height: size, left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], y: [-20, -80] }}
      transition={{ duration: 1.5, delay: (index % 8) * 0.15, ease: 'easeOut' }}
    />
  );
}

export function SocialPhaseTransition({ type, isVisible, onComplete }: SocialPhaseTransitionProps) {
  const completedRef = useRef(false);

  // Reset guard when visibility changes
  useEffect(() => {
    if (!isVisible) {
      completedRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }, 2200);
    return () => clearTimeout(timer);
  }, [isVisible, onComplete]);

  if (!type) return null;
  const config = TRANSITION_CONFIG[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`fixed inset-0 z-[60] bg-gradient-to-br ${config.bgClass} flex flex-col items-center justify-center overflow-hidden`}
          data-testid="social-phase-transition"
        >
          {/* Particles */}
          {Array.from({ length: 20 }).map((_, i) => (
            <Particle
              key={i}
              index={i}
              colorClass={config.particleColors[i % config.particleColors.length]}
            />
          ))}

          {/* Content */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.1, 1], opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
            className="text-center z-10 px-8"
          >
            <div className="text-7xl mb-4">{config.emoji}</div>
            <h2 className="text-3xl font-black text-white mb-2">{config.title}</h2>
            <p className="text-white/70 text-base mb-6">{config.subtitle}</p>
            <div className="bg-white/10 rounded-2xl px-5 py-3 max-w-xs mx-auto">
              <p className="text-white/90 text-sm leading-relaxed">
                小悦: {config.message}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
