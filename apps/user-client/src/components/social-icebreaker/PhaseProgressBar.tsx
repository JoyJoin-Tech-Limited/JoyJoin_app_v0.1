import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { PHASE_CONFIG } from '@shared/socialIcebreaker';
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker';

interface PhaseProgressBarProps {
  currentPhase: SocialIcebreakerPhase;
  enabledPhases: SocialIcebreakerPhase[];
  completedPhases: SocialIcebreakerPhase[];
  isHost: boolean;
}

const ALL_PHASES: SocialIcebreakerPhase[] = [
  'warmup',
  'micro_challenge',
  'lie_detective',
  'auction',
  'personality_dice',
  'mini_script',
  'recap',
];

export function PhaseProgressBar({
  currentPhase,
  enabledPhases,
  completedPhases,
  isHost,
}: PhaseProgressBarProps) {
  return (
    <div
      className="sticky top-0 z-50 h-14 bg-background/80 backdrop-blur-md border-b border-border/50 flex items-center"
      data-testid="phase-progress-bar"
    >
      <div className="flex items-center gap-2 px-3 overflow-x-auto scrollbar-hide w-full">
        {ALL_PHASES.map((phase) => {
          const config = PHASE_CONFIG[phase];
          const isActive = phase === currentPhase;
          const isCompleted = completedPhases.includes(phase);
          const isEnabled = phase === 'recap' || enabledPhases.includes(phase);
          const isLocked = !isEnabled && !isCompleted && phase !== currentPhase;

          return (
            <motion.div
              key={phase}
              animate={
                isActive
                  ? { scale: 1.1 }
                  : isCompleted
                  ? { scale: 0.95 }
                  : { scale: 0.9 }
              }
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className={`
                flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                transition-all duration-300
                ${isActive
                  ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg`
                  : isCompleted
                  ? 'bg-muted text-muted-foreground'
                  : isLocked
                  ? 'bg-muted/40 text-muted-foreground/40'
                  : 'bg-muted text-muted-foreground'
                }
              `}
            >
              {isCompleted ? (
                <Check className="w-3 h-3" />
              ) : isLocked ? (
                <Lock className="w-3 h-3" />
              ) : (
                <span>{config.emoji}</span>
              )}
              <span>{config.name}</span>
            </motion.div>
          );
        })}
        {isHost && (
          <div className="flex-shrink-0 ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <span>👑</span>
          </div>
        )}
      </div>
    </div>
  );
}
