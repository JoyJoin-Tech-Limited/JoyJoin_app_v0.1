import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import {
  createLaterActProgress,
  laterActStorageKey,
  LaterActStoryExperience,
  restoreLaterActProgress,
  type LaterActExperienceStage,
  type LaterActProgress,
} from './LaterActStoryExperience'
import { getCustomLaterActConfig, type AlangLaterActUnitId } from './LaterActStoryConfigs'

export type V2LaterActUnitId = AlangLaterActUnitId | 's1-p3-shiqi'

interface V2LaterActExperienceProps {
  encounterId: string
  unitId: V2LaterActUnitId
  nodeId: string
  availableChoiceIds: readonly string[]
  background: string
  character?: string
  disabled?: boolean
  onChoice: (choiceId: string) => void
  onContinue: () => void
  onComplete: () => Promise<boolean>
}

export function resolveAlangLaterActStage(nodeId: string, progress: LaterActProgress): LaterActExperienceStage {
  if (nodeId === 'n1_setup') return 'approach'
  if (nodeId === 'n2_object') return progress.objectOpened ? 'object' : 'explore'
  if (nodeId === 'n3_choice') return 'followup'
  if (nodeId === 'n5_close') return 'ending'
  return progress.gameComplete ? 'ending' : 'game'
}

export function V2LaterActExperience({
  encounterId,
  unitId,
  nodeId,
  availableChoiceIds,
  background,
  character,
  disabled = false,
  onChoice,
  onContinue,
  onComplete,
}: V2LaterActExperienceProps) {
  const config = getCustomLaterActConfig(unitId)
  const storageKey = laterActStorageKey(unitId, encounterId)
  const [progress, setProgress] = useState<LaterActProgress>(() => {
    try { return restoreLaterActProgress(config, Taro.getStorageSync(storageKey)) } catch { return createLaterActProgress(unitId) }
  })
  const stage = useMemo(() => resolveAlangLaterActStage(nodeId, progress), [nodeId, progress])

  useEffect(() => {
    try { Taro.setStorageSync(storageKey, progress) } catch { /* local recovery is best effort */ }
  }, [progress, storageKey])

  return (
    <LaterActStoryExperience
      config={config}
      stage={stage}
      background={background}
      character={character}
      progress={progress}
      disabled={disabled}
      variantKey={storageKey}
      onProgress={setProgress}
      onApproach={() => onContinue()}
      onExplorationComplete={() => onContinue()}
      onFollowup={(choice) => {
        if (availableChoiceIds.includes(choice.id)) onChoice(choice.id)
      }}
      onGameComplete={onContinue}
      onComplete={() => {
        void onComplete().then((settled) => {
          if (!settled) return
          try { Taro.removeStorageSync(storageKey) } catch { /* fail open */ }
        })
      }}
    />
  )
}
