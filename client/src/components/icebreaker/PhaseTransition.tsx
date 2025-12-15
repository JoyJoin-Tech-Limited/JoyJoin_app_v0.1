import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users, MessageCircle, PartyPopper } from 'lucide-react';

export type TransitionType = 'checkin_to_number' | 'number_to_icebreaker' | 'icebreaker_to_end';

interface PhaseTransitionProps {
  type: TransitionType;
  isVisible: boolean;
  onComplete?: () => void;
}

const transitionConfig = {
  checkin_to_number: {
    icon: Users,
    title: '签到完成',
    subtitle: '即将分配号码牌...',
    color: 'text-primary',
    bgGradient: 'from-primary/20 via-primary/10 to-transparent',
  },
  number_to_icebreaker: {
    icon: MessageCircle,
    title: '准备开始破冰',
    subtitle: '让我们开始愉快的交流吧！',
    color: 'text-green-500',
    bgGradient: 'from-green-500/20 via-green-500/10 to-transparent',
  },
  icebreaker_to_end: {
    icon: PartyPopper,
    title: '破冰结束',
    subtitle: '感谢大家的参与！',
    color: 'text-amber-500',
    bgGradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
  },
};

export function PhaseTransition({ type, isVisible, onComplete }: PhaseTransitionProps) {
  const config = transitionConfig[type];
  const Icon = config.icon;

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          data-testid={`phase-transition-${type}`}
        >
          <div className={`absolute inset-0 bg-gradient-radial ${config.bgGradient}`} />
          
          <motion.div
            className="relative flex flex-col items-center text-center px-8"
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: -20 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
          >
            <motion.div
              className={`w-20 h-20 rounded-full bg-background shadow-lg flex items-center justify-center mb-6 ${config.color}`}
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', duration: 0.6, delay: 0.1, bounce: 0.4 }}
            >
              <Icon className="w-10 h-10" />
            </motion.div>

            <motion.div
              className="flex items-center gap-2 mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold">{config.title}</h2>
              <Sparkles className="w-5 h-5 text-primary" />
            </motion.div>

            <motion.p
              className="text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {config.subtitle}
            </motion.p>

            <motion.div
              className="mt-8 flex gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`}
                  animate={{
                    scale: [1, 1.2, 1],
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
