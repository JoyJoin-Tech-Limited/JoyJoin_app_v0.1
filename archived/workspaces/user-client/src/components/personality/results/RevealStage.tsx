/**
 * RevealStage - Card materialization moment between unlock and full results.
 *
 * Shows the PremiumCard scaling into view with a subtle glow pulse.
 */

import { PremiumCard } from './PremiumCard';
import type { PersonalityResultViewModel } from '@joyjoin/shared/personality/resultViewModel';
import type { StageProps } from './stageTypes';

interface RevealStageProps extends StageProps {
  viewModel: PersonalityResultViewModel;
}

export function RevealStage({ viewModel, onComplete }: RevealStageProps) {
  const record = viewModel.archetypeRecord;
  const gradient = record?.displayTokens.gradientKey ?? 'from-purple-500 to-pink-500';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <PremiumCard
        archetypeName={viewModel.primaryArchetype}
        nickname={record?.narrative.nickname ?? ''}
        tagline={record?.narrative.tagline ?? ''}
        avatarUrl={undefined} // Avatar loaded in ResultStage
        rarityPercentage={record?.insights.rarityPercentage}
        typeNo={viewModel.typeNo}
        skillSet={viewModel.skillSet}
        isDecisive={viewModel.isDecisive}
        gradientClass={gradient}
        onMaterializeComplete={onComplete}
      />
    </div>
  );
}
