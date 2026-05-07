/**
 * PersonalityTestResultPage - Refactored with stage architecture and shared view model.
 *
 * Architecture:
 * - Data: buildResultViewModel from @joyjoin/shared (single source of truth)
 * - Stages: ResultStageLoader orchestrates loading | slot | unlock | reveal | result | error | empty
 * - Rendering: Each stage is a self-contained component in components/personality/results/
 *
 * Legacy hardcoded data (archetypeUniqueTraits, getFallbackAnalysis, getFallbackXiaoyueSnapshot,
 * ARCHETYPE_TRAIT_WEIGHTS, findDifferentiatingTrait) has been migrated to packages/shared.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAnonymousPersonalityTestResults } from '@/hooks/useAnonymousPersonalityTestResults';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { invalidateUserDerivedQueries } from '@/lib/userStateInvalidation';
import type { AuthUser } from '@/hooks/useAuth';
import { buildResultViewModel, type AssessmentResultInput } from '@joyjoin/shared/personality/resultViewModel';

import { ResultStageLoader } from '@/components/personality/results/ResultStageLoader';
import { SlotStage } from '@/components/personality/results/SlotStage';
import { RevealStage } from '@/components/personality/results/RevealStage';
import { ResultStage } from '@/components/personality/results/ResultStage';
import { ErrorStage } from '@/components/personality/results/ErrorStage';
import { EmptyStage } from '@/components/personality/results/EmptyStage';
import { UnlockOverlay } from '@/components/UnlockOverlay';
import { FancyLineLoadingScreen } from '@/components/FancyLineLoadingScreen';
import { SkipAnimationButton } from '@/components/SkipAnimationButton';
import type { ResultFlowStage } from '@/components/personality/results/stageTypes';

export default function PersonalityTestResultPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [stage, setStage] = useState<ResultFlowStage>('loading');

  // ─── Load Results ───
  const { data: authResult, isLoading: authLoading } = useQuery<AssessmentResultInput>({
    queryKey: ['/api/assessment/result'],
    enabled: isAuthenticated,
    retry: 3,
    retryDelay: 1000,
  });

  const { data: anonResult, isLoading: anonLoading } = useAnonymousPersonalityTestResults();

  const rawResult = isAuthenticated ? (authResult ?? anonResult) : anonResult;
  const isLoading = isAuthenticated ? (authLoading && !rawResult) : anonLoading;

  // ─── Build View Model ───
  const viewModel = rawResult ? buildResultViewModel(rawResult) : null;

  // ─── Stage Transitions ───
  const handleSlotComplete = useCallback(() => setStage('unlock'), []);
  const handleUnlockComplete = useCallback(() => setStage('reveal'), []);
  const handleRevealComplete = useCallback(() => setStage('result'), []);

  // ─── Skip Animation ───
  const handleSkipSlot = useCallback(() => setStage('unlock'), []);
  const handleSkipUnlock = useCallback(() => setStage('result'), []);

  // ─── Continue / Complete Test ───
  const completeTestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auth/complete-personality-test');
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['/api/auth/user'] });
      const previousUser = queryClient.getQueryData(['/api/auth/user']);
      queryClient.setQueryData(['/api/auth/user'], (old: any) => ({
        ...old,
        hasCompletedPersonalityTest: true,
      }));
      return { previousUser };
    },
    onSuccess: () => {
      setLocation('/onboarding/setup');
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(['/api/auth/user'], context.previousUser);
      }
      toast({ title: '出错了', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      invalidateUserDerivedQueries();
    },
  });

  // ─── Determine Stage ───
  useEffect(() => {
    if (isLoading) {
      setStage('loading');
      return;
    }
    if (!viewModel) {
      setStage('empty');
      return;
    }
    // If we're still in loading stage and data arrived, transition to slot
    if (stage === 'loading') {
      setStage('slot');
    }
  }, [isLoading, viewModel, stage]);

  // ─── Loading State ───
  if (stage === 'loading') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4">
        <FancyLineLoadingScreen loop visible />
        <p className="text-lg text-muted-foreground animate-pulse">
          正在生成您的测试结果...
        </p>
      </div>
    );
  }

  // ─── Empty State ───
  if (stage === 'empty' || !viewModel) {
    return <EmptyStage />;
  }

  // ─── Stage Content Map ───
  const stageContent = useMemo<Record<ResultFlowStage, React.ReactNode>>(() => ({
    loading: (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4">
        <FancyLineLoadingScreen loop visible />
        <p className="text-lg text-muted-foreground animate-pulse">
          正在生成您的测试结果...
        </p>
      </div>
    ),
    slot: (
      <SlotStage
        finalArchetype={viewModel.primaryArchetype}
        isDecisive={viewModel.isDecisive}
        onComplete={handleSlotComplete}
        onSkip={handleSkipSlot}
      />
    ),
    unlock: (
      <div className="relative">
        <UnlockOverlay
          archetype={viewModel.primaryArchetype}
          onComplete={handleUnlockComplete}
        />
        <SkipAnimationButton onSkip={handleSkipUnlock} delay={1000} />
      </div>
    ),
    reveal: (
      <RevealStage
        viewModel={viewModel}
        onComplete={handleRevealComplete}
      />
    ),
    result: (
      <ResultStage
        viewModel={viewModel}
        onContinue={() => completeTestMutation.mutate()}
        isContinuing={completeTestMutation.isPending}
      />
    ),
    error: (
      <ErrorStage
        onRetry={() => setStage('loading')}
        onSkip={() => setStage('result')}
      />
    ),
    empty: <EmptyStage />,
  }), [viewModel, handleSlotComplete, handleSkipSlot, handleUnlockComplete, handleRevealComplete, completeTestMutation, setStage]);

  return <ResultStageLoader stage={stage} children={stageContent} />;
}
