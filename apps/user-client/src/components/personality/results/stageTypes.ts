/**
 * Stage types for the personality result page animation sequence.
 * Aligned with the mini-program's proven stage architecture.
 */

export type ResultFlowStage = 'loading' | 'slot' | 'unlock' | 'reveal' | 'result' | 'error' | 'empty';

export interface StageProps {
  onComplete?: () => void;
  onSkip?: () => void;
}
