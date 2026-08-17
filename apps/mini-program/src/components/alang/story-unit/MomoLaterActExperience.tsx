import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import {
  createLaterActProgress,
  laterActStorageKey,
  LaterActStoryExperience,
  restoreLaterActProgress,
  type LaterActProgress,
} from './LaterActStoryExperience'
import { getCustomLaterActConfig, type FlatLaterActUnitId } from './LaterActStoryConfigs'

interface FlatLaterActExperienceProps {
  encounterId: string
  unitId: FlatLaterActUnitId
  background: string
  character?: string
  started: boolean
  disabled?: boolean
  onBegin: (approachIndex: 0 | 1, label: string) => void
  onComplete: () => void
}

export function FlatLaterActExperience({
  encounterId,
  unitId,
  background,
  character,
  started,
  disabled = false,
  onBegin,
  onComplete,
}: FlatLaterActExperienceProps) {
  const config = getCustomLaterActConfig(unitId)
  const storageKey = laterActStorageKey(unitId, encounterId)
  const [progress, setProgress] = useState<LaterActProgress>(() => {
    try { return restoreLaterActProgress(config, Taro.getStorageSync(storageKey)) } catch { return createLaterActProgress(unitId) }
  })

  useEffect(() => {
    try { Taro.setStorageSync(storageKey, progress) } catch { /* local recovery is best effort */ }
  }, [progress, storageKey])

  const effectiveStage = started && progress.stage === 'approach' ? 'explore' : progress.stage

  return (
    <LaterActStoryExperience
      config={config}
      stage={effectiveStage}
      background={background}
      character={character}
      progress={progress}
      disabled={disabled}
      onProgress={setProgress}
      onApproach={(index, choice) => onBegin(index, choice.label)}
      onExplorationComplete={() => undefined}
      onFollowup={() => undefined}
      onGameComplete={() => undefined}
      onComplete={() => {
        onComplete()
      }}
    />
  )
}
