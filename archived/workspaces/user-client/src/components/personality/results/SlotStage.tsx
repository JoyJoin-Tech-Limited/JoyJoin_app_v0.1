/**
 * SlotStage - Wraps the existing ArchetypeSlotMachine for the result stage machine.
 */

import { ArchetypeSlotMachine } from '@/components/slot-machine';
import { SkipAnimationButton } from '@/components/SkipAnimationButton';
import type { StageProps } from './stageTypes';

interface SlotStageProps extends StageProps {
  finalArchetype: string;
  isDecisive?: boolean;
}

export function SlotStage({ finalArchetype, isDecisive, onComplete, onSkip }: SlotStageProps) {
  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center">
      <ArchetypeSlotMachine
        finalArchetype={finalArchetype}
        confidence={isDecisive ? 0.9 : undefined}
        onComplete={onComplete ?? (() => {})}
      />
      {onSkip && <SkipAnimationButton onSkip={onSkip} delay={2000} />}
    </div>
  );
}
