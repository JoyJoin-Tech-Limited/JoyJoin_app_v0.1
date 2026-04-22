/**
 * ResultStageLoader - Orchestrates the personality result animation stage machine.
 *
 * Stages: loading → slot → unlock → reveal → result → [error | empty]
 *
 * This component replaces the monolithic animation phase state in the legacy
 * PersonalityTestResultPage. Each stage is a self-contained component with
 * explicit props and lifecycle callbacks.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { ResultFlowStage } from './stageTypes';

interface ResultStageLoaderProps {
  stage: ResultFlowStage;
  children: Record<ResultFlowStage, ReactNode>;
  onStageChange?: (stage: ResultFlowStage) => void;
}

const stageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.4 },
};

export function ResultStageLoader({ stage, children }: ResultStageLoaderProps) {
  const prefersReducedMotion = useReducedMotion();

  const content = children[stage];
  if (!content) return null;

  if (prefersReducedMotion) {
    return <>{content}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stage}
        {...stageTransition}
        className="min-h-screen"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
