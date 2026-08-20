import { useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { haptics } from '../../../lib/utils/haptics'
import { deterministicGameOrder, getFailureAssistance } from '../../../lib/alang/flashGameDifficulty'
import {
  FLASH_STORY_EXPERIENCE_SKELETON_VERSION,
  FLASH_STORY_SHARED_SETTLEMENT_KIND,
  resolveLaterActSkeletonStep,
} from './FlashStoryExperienceSkeleton'
import './LaterActStoryExperience.scss'

export type LaterActExperienceStage = 'approach' | 'explore' | 'object' | 'followup' | 'game' | 'ending'

export interface LaterActChoice {
  id: string
  label: string
  response: string
  hint?: string
  narration?: string
}

export interface LaterActHighlight {
  id: string
  label: string
  clue: string
  placementClassName: string
}

export interface LaterActObjectDetail {
  id: string
  label: string
  clue: string
}

export interface LaterActGameChoice {
  id: string
  label: string
  correct: boolean
  feedback: string
}

export interface LaterActGameStep {
  id: string
  prompt: string
  choices: readonly [LaterActGameChoice, LaterActGameChoice]
}

export interface LaterActStoryConfig {
  unitId: string
  npcName: string
  rootClassName: string
  chapter: string
  title: string
  opening: string
  approaches: readonly [LaterActChoice, LaterActChoice]
  highlights: readonly [LaterActHighlight, LaterActHighlight, LaterActHighlight]
  objectTarget: { label: string; placementClassName: string }
  objectExploration: {
    title: string
    shortLabel: string
    intro: string
    details: readonly [LaterActObjectDetail, LaterActObjectDetail, LaterActObjectDetail]
  }
  followUpPrompt: string
  followUps: readonly [LaterActChoice, LaterActChoice]
  game: {
    eyebrow: string
    title: string
    intro: string
    startLabel: string
    steps: readonly [LaterActGameStep, LaterActGameStep, LaterActGameStep]
  }
  ending: {
    eyebrow: string
    speech: string
    narration: string
    completionLabel: string
  }
  result: {
    title: string
    closing: string
    fragment: { category: 'object' | 'past' | 'relationship' | 'key'; title: string; fact: string }
  }
}

export interface LaterActProgress {
  version: 'npc-later-act-v2'
  unitId: string
  stage: LaterActExperienceStage
  approachId: string | null
  seenHighlightIds: string[]
  objectOpened: boolean
  seenDetailIds: string[]
  followupId: string | null
  gameStarted: boolean
  gameStep: number
  gameComplete: boolean
  mistakes: number
  stepMistakes: number[]
  selectedEvidenceId: string | null
  wrongChoiceId: string | null
}

export const laterActStorageKey = (unitId: string, encounterId: string) => `joyjoin:flash:later-act:v1:${unitId}:${encounterId}`

export function createLaterActProgress(unitId: string): LaterActProgress {
  return {
    version: 'npc-later-act-v2',
    unitId,
    stage: 'approach',
    approachId: null,
    seenHighlightIds: [],
    objectOpened: false,
    seenDetailIds: [],
    followupId: null,
    gameStarted: false,
    gameStep: 0,
    gameComplete: false,
    mistakes: 0,
    stepMistakes: [0, 0, 0],
    selectedEvidenceId: null,
    wrongChoiceId: null,
  }
}

export function restoreLaterActProgress(config: LaterActStoryConfig, value: unknown): LaterActProgress {
  const fallback = createLaterActProgress(config.unitId)
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<LaterActProgress>
  const storedVersion = (candidate as { version?: unknown }).version
  if ((storedVersion !== 'npc-later-act-v1' && storedVersion !== 'npc-later-act-v2') || candidate.unitId !== config.unitId) return fallback
  const highlightIds = new Set(config.highlights.map(({ id }) => id))
  const detailIds = new Set(config.objectExploration.details.map(({ id }) => id))
  const approachIds = new Set(config.approaches.map(({ id }) => id))
  const followupIds = new Set(config.followUps.map(({ id }) => id))
  const maxGameStep = config.game.steps.length
  const approachId = typeof candidate.approachId === 'string' && approachIds.has(candidate.approachId) ? candidate.approachId : null
  if (!approachId) return fallback

  const seenHighlightIds = Array.isArray(candidate.seenHighlightIds)
    ? [...new Set(candidate.seenHighlightIds.filter((id): id is string => typeof id === 'string' && highlightIds.has(id)))]
    : []
  const base = { ...fallback, approachId, seenHighlightIds, stage: 'explore' as LaterActExperienceStage }
  if (seenHighlightIds.length < config.highlights.length || candidate.objectOpened !== true) return base

  const seenDetailIds = Array.isArray(candidate.seenDetailIds)
    ? [...new Set(candidate.seenDetailIds.filter((id): id is string => typeof id === 'string' && detailIds.has(id)))]
    : []
  const objectProgress = { ...base, objectOpened: true, seenDetailIds, stage: 'object' as LaterActExperienceStage }
  if (seenDetailIds.length < config.objectExploration.details.length) return objectProgress

  const followupId = typeof candidate.followupId === 'string' && followupIds.has(candidate.followupId) ? candidate.followupId : null
  const followupProgress = { ...objectProgress, followupId, stage: 'followup' as LaterActExperienceStage }
  if (!followupId) return followupProgress

  const rawGameStep = Number.isInteger(candidate.gameStep) ? Math.max(0, Math.min(Number(candidate.gameStep), maxGameStep)) : 0
  const gameComplete = candidate.gameComplete === true && rawGameStep === maxGameStep
  const gameStep = gameComplete ? maxGameStep : Math.min(rawGameStep, maxGameStep - 1)
  const currentChoiceIds = new Set(config.game.steps[gameStep]?.choices.map(({ id }) => id) ?? [])
  const evidenceIds = new Set(config.objectExploration.details.map(({ id }) => id))
  const expectedEvidenceId = config.objectExploration.details[gameStep]?.id
  const selectedEvidenceId = storedVersion === 'npc-later-act-v2' && typeof candidate.selectedEvidenceId === 'string' && evidenceIds.has(candidate.selectedEvidenceId) && candidate.selectedEvidenceId === expectedEvidenceId
    ? candidate.selectedEvidenceId
    : null
  const wrongChoiceId = typeof candidate.wrongChoiceId === 'string' && (currentChoiceIds.has(candidate.wrongChoiceId) || (candidate.wrongChoiceId.startsWith('evidence:') && evidenceIds.has(candidate.wrongChoiceId.slice(9))))
    ? candidate.wrongChoiceId
    : null
  const stepMistakes = storedVersion === 'npc-later-act-v2' && Array.isArray(candidate.stepMistakes)
    ? config.game.steps.map((_, index) => Math.max(0, Math.min(20, Number(candidate.stepMistakes?.[index]) || 0)))
    : config.game.steps.map(() => 0)
  return {
    ...followupProgress,
    stage: gameComplete ? 'ending' : 'game',
    gameStarted: candidate.gameStarted === true,
    gameStep,
    gameComplete,
    mistakes: Number.isInteger(candidate.mistakes) ? Math.max(0, Number(candidate.mistakes)) : 0,
    stepMistakes,
    selectedEvidenceId: gameComplete ? null : selectedEvidenceId,
    wrongChoiceId,
  }
}

interface LaterActStoryExperienceProps {
  config: LaterActStoryConfig
  stage: LaterActExperienceStage
  background: string
  character?: string
  progress: LaterActProgress
  disabled?: boolean
  variantKey?: string
  onProgress: (progress: LaterActProgress) => void
  onApproach: (index: 0 | 1, choice: LaterActChoice) => void
  onExplorationComplete: () => void
  onFollowup: (choice: LaterActChoice) => void
  onGameComplete: () => void
  onComplete: () => void
}

function findLatestSpeech(config: LaterActStoryConfig, progress: LaterActProgress, stage: LaterActExperienceStage): string {
  if (stage === 'ending') return config.ending.speech
  if (progress.wrongChoiceId && stage === 'game') {
    if (progress.wrongChoiceId.startsWith('evidence:')) return '这条细节解释不了当前动作。先找和这一小步直接相关的痕迹。'
    const step = config.game.steps[Math.min(progress.gameStep, config.game.steps.length - 1)]
    return step?.choices.find(({ id }) => id === progress.wrongChoiceId)?.feedback ?? config.game.intro
  }
  if (stage === 'game') {
    if (progress.gameComplete) return config.ending.speech
    if (progress.gameStarted) return config.game.steps[progress.gameStep]?.prompt ?? config.game.intro
    return config.game.intro
  }
  if (progress.followupId) return config.followUps.find(({ id }) => id === progress.followupId)?.response ?? config.opening
  const latestDetailId = progress.seenDetailIds[progress.seenDetailIds.length - 1]
  if (latestDetailId) return config.objectExploration.details.find(({ id }) => id === latestDetailId)?.clue ?? config.opening
  const latestHighlightId = progress.seenHighlightIds[progress.seenHighlightIds.length - 1]
  if (latestHighlightId) return config.highlights.find(({ id }) => id === latestHighlightId)?.clue ?? config.opening
  if (progress.approachId) return config.approaches.find(({ id }) => id === progress.approachId)?.response ?? config.opening
  return config.opening
}

export function LaterActStoryExperience({
  config,
  stage,
  background,
  character,
  progress,
  disabled = false,
  variantKey = config.unitId,
  onProgress,
  onApproach,
  onExplorationComplete,
  onFollowup,
  onGameComplete,
  onComplete,
}: LaterActStoryExperienceProps) {
  const [backgroundFailed, setBackgroundFailed] = useState(false)
  const [characterFailed, setCharacterFailed] = useState(false)
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null)
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null)
  const [objectRevealOpen, setObjectRevealOpen] = useState(false)

  const highlightsComplete = progress.seenHighlightIds.length === config.highlights.length
  const detailsComplete = progress.seenDetailIds.length === config.objectExploration.details.length
  const activeHighlight = config.highlights.find(({ id }) => id === activeHighlightId) ?? null
  const activeDetail = config.objectExploration.details.find(({ id }) => id === activeDetailId) ?? null
  const showObjectReveal = stage === 'explore' && highlightsComplete && !progress.objectOpened && !activeHighlight && objectRevealOpen
  const speech = findLatestSpeech(config, progress, stage)
  const update = (patch: Partial<LaterActProgress>) => onProgress({ ...progress, ...patch })

  const settleHighlight = () => {
    if (!activeHighlight) return
    const seenHighlightIds = progress.seenHighlightIds.includes(activeHighlight.id)
      ? progress.seenHighlightIds
      : [...progress.seenHighlightIds, activeHighlight.id]
    update({ seenHighlightIds })
    setActiveHighlightId(null)
    haptics('light')
  }

  const settleDetail = () => {
    if (!activeDetail) return
    const seenDetailIds = progress.seenDetailIds.includes(activeDetail.id)
      ? progress.seenDetailIds
      : [...progress.seenDetailIds, activeDetail.id]
    update({ seenDetailIds })
    setActiveDetailId(null)
    haptics('light')
  }

  const currentGameStep = config.game.steps[Math.min(progress.gameStep, config.game.steps.length - 1)]
  const correctEvidence = config.objectExploration.details[Math.min(progress.gameStep, config.objectExploration.details.length - 1)]
  const evidenceChoices = deterministicGameOrder(config.objectExploration.details, `${variantKey}:${progress.gameStep}`)
  const currentStepMistakes = progress.stepMistakes[progress.gameStep] ?? 0
  const assistance = getFailureAssistance(currentStepMistakes)

  const recordGameMistake = (wrongChoiceId: string) => {
    const nextStepMistakes = [...progress.stepMistakes]
    nextStepMistakes[progress.gameStep] = Math.min(20, currentStepMistakes + 1)
    update({ wrongChoiceId, mistakes: progress.mistakes + 1, stepMistakes: nextStepMistakes })
  }

  const chooseEvidence = (evidenceId: string) => {
    if (disabled || progress.wrongChoiceId || progress.gameComplete || !correctEvidence) return
    haptics(evidenceId === correctEvidence.id ? 'light' : 'medium')
    if (evidenceId !== correctEvidence.id) {
      recordGameMistake(`evidence:${evidenceId}`)
      return
    }
    update({ selectedEvidenceId: evidenceId, wrongChoiceId: null })
  }

  const chooseGameOption = (choice: LaterActGameChoice) => {
    if (disabled || progress.wrongChoiceId || progress.gameComplete || progress.selectedEvidenceId !== correctEvidence?.id) return
    haptics(choice.correct ? 'light' : 'medium')
    if (!choice.correct) {
      recordGameMistake(choice.id)
      return
    }
    const nextStep = progress.gameStep + 1
    const gameComplete = nextStep >= config.game.steps.length
    update({ gameStep: nextStep, gameComplete, selectedEvidenceId: null, wrongChoiceId: null, stage: gameComplete ? 'ending' : 'game' })
    if (gameComplete) {
      haptics('success')
      onGameComplete()
    }
  }

  return (
    <View
      className={`later-act-experience ${config.rootClassName} later-act-experience--${stage}`}
      data-testid='later-act-experience'
      data-unit-id={config.unitId}
      data-experience-skeleton={FLASH_STORY_EXPERIENCE_SKELETON_VERSION}
      data-experience-step={resolveLaterActSkeletonStep(stage)}
      data-experience-settlement={FLASH_STORY_SHARED_SETTLEMENT_KIND}
    >
      <View className={`later-act-scene${backgroundFailed ? ' later-act-scene--fallback' : ''}`} data-testid='later-act-scene'>
        {!backgroundFailed ? (
          <Image className='later-act-scene__background' src={background} mode='aspectFit' onError={() => setBackgroundFailed(true)} data-testid='later-act-background' aria-hidden='true' />
        ) : null}
        <View className='later-act-scene__wash' aria-hidden='true' />
        {character && !characterFailed ? (
          <Image className='later-act-scene__character' src={character} mode='aspectFit' onError={() => setCharacterFailed(true)} data-testid='later-act-character' aria-hidden='true' />
        ) : null}

        {stage === 'explore' && !showObjectReveal ? (
          <View className='later-act-scene__hotspots' aria-label='探索现场细节'>
            {config.highlights.map((highlight) => {
              const seen = progress.seenHighlightIds.includes(highlight.id)
              const focused = activeHighlightId === highlight.id
              return (
                <View
                  key={highlight.id}
                  className={`later-act-scene__hotspot ${highlight.placementClassName}${seen ? ' later-act-scene__hotspot--seen' : ''}${focused ? ' later-act-scene__hotspot--focused' : ''}`}
                  hoverClass={disabled || seen ? '' : 'later-act-scene__hotspot--pressed'}
                  role='button'
                  aria-label={`${seen ? '已查看' : '查看'}${highlight.label}`}
                  aria-disabled={disabled || seen}
                  onClick={() => {
                    if (disabled || seen) return
                    haptics('light')
                    setActiveHighlightId(highlight.id)
                  }}
                >
                  <View className='later-act-scene__hotspot-ring' aria-hidden='true' />
                </View>
              )
            })}
            {highlightsComplete ? (
              <View
                className={`later-act-scene__hotspot later-act-scene__hotspot--object ${config.objectTarget.placementClassName}`}
                hoverClass={disabled ? '' : 'later-act-scene__hotspot--pressed'}
                role='button'
                aria-label={`打开${config.objectTarget.label}`}
                aria-disabled={disabled}
                onClick={() => {
                  if (disabled) return
                  haptics('medium')
                  setObjectRevealOpen(true)
                }}
              >
                <View className='later-act-scene__hotspot-ring' aria-hidden='true' />
              </View>
            ) : null}
          </View>
        ) : null}

        <View className='later-act-scene__speech' role='status' aria-live='polite' aria-atomic='true'>
          <Text className='later-act-scene__speaker'>{config.npcName}</Text>
          <Text className='later-act-scene__speech-copy'>{speech}</Text>
        </View>
      </View>

      {activeHighlight ? (
        <View className='later-act-clue' data-testid='later-act-highlight-clue'>
          <Text className='later-act-clue__eyebrow'>现场线索</Text>
          <Text className='later-act-clue__title'>{activeHighlight.label}</Text>
          <Text className='later-act-clue__copy'>{activeHighlight.clue}</Text>
          <View className='later-act-clue__action' role='button' aria-label={`收下${activeHighlight.label}的线索，回到现场`} onClick={settleHighlight}>
            <Text>收下线索，回到现场</Text>
          </View>
        </View>
      ) : null}

      {showObjectReveal ? (
        <View className='later-act-object-reveal' data-testid='later-act-object-reveal' role='dialog' aria-label={`第二层旧物：${config.objectExploration.title}`}>
          <Text className='later-act-object-reveal__eyebrow'>第二层 · 旧物</Text>
          <Text className='later-act-object-reveal__title'>{config.objectTarget.label}</Text>
          <Text className='later-act-object-reveal__copy'>{config.objectExploration.intro}</Text>
          <View
            className='later-act-object-reveal__action'
            hoverClass={disabled ? '' : 'later-act-object-reveal__action--pressed'}
            role='button'
            aria-label={`打开${config.objectExploration.shortLabel}`}
            aria-disabled={disabled}
            onClick={() => {
              if (disabled) return
              haptics('medium')
              setObjectRevealOpen(false)
              update({ objectOpened: true, stage: 'object' })
            }}
          ><Text>打开{config.objectExploration.shortLabel}</Text></View>
        </View>
      ) : null}

      <View className='later-act-experience__panel'>
        {stage === 'ending' ? (
          // Keep the terminal submit outside the native ScrollView. WeChat can
          // swallow taps on absolute-positioned actions inside that layer.
          <View className='later-act-experience__section later-act-experience__section--ending'>
            <Text className='later-act-experience__eyebrow'>{config.ending.eyebrow}</Text>
            <Text className='later-act-experience__prompt'>{config.ending.speech}</Text>
            <Text className='later-act-experience__copy'>{config.ending.narration}</Text>
            <View
              className='later-act-experience__primary-action'
              hoverClass={disabled ? '' : 'later-act-experience__primary-action--pressed'}
              role='button'
              aria-label={config.ending.completionLabel}
              aria-disabled={disabled}
              onClick={() => { if (!disabled) { haptics('success'); onComplete() } }}
            ><Text>{config.ending.completionLabel}</Text></View>
          </View>
        ) : (
          <ScrollView className='later-act-experience__scroll' scrollY>
          {stage === 'approach' ? (
            <View className='later-act-experience__section'>
              <Text className='later-act-experience__eyebrow'>{config.title}</Text>
              <Text className='later-act-experience__prompt'>你先从哪里接近这件旧物？</Text>
              <View className='later-act-experience__choices'>
                {config.approaches.map((choice, index) => (
                  <View
                    key={choice.id}
                    className='later-act-experience__choice'
                    hoverClass={disabled ? '' : 'later-act-experience__choice--pressed'}
                    role='button'
                    aria-label={choice.label}
                    aria-disabled={disabled}
                    onClick={() => {
                      if (disabled) return
                      haptics('light')
                      onProgress({ ...progress, approachId: choice.id, stage: 'explore' })
                      onApproach(index as 0 | 1, choice)
                    }}
                  >
                    <Text className='later-act-experience__choice-copy'>{choice.label}</Text>
                    {choice.hint ? <Text className='later-act-experience__choice-hint'>{choice.hint}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {stage === 'object' ? (
            <View className='later-act-experience__section' data-testid='later-act-object-panel'>
              <Text className='later-act-experience__eyebrow'>{config.objectExploration.shortLabel}内部</Text>
              <Text className='later-act-experience__prompt'>{config.objectExploration.title}</Text>
              <Text className='later-act-experience__copy'>{config.objectExploration.intro}</Text>
              <View className='later-act-object' aria-label={`探索${config.objectExploration.title}`}>
                {config.objectExploration.details.map((detail, index) => {
                  const seen = progress.seenDetailIds.includes(detail.id)
                  return (
                    <View
                      key={detail.id}
                      className={`later-act-object__detail later-act-object__detail--${index + 1}${seen ? ' later-act-object__detail--seen' : ''}`}
                      hoverClass={disabled || seen ? '' : 'later-act-object__detail--pressed'}
                      role='button'
                      aria-label={`${seen ? '已查看' : '查看'}${detail.label}`}
                      aria-disabled={disabled || seen}
                      onClick={() => {
                        if (disabled || seen) return
                        haptics('light')
                        setActiveDetailId(detail.id)
                      }}
                    >
                      <View className='later-act-object__dot' aria-hidden='true' />
                      <Text>{detail.label}</Text>
                    </View>
                  )
                })}
              </View>
              {activeDetail ? (
                <View className='later-act-object__clue' data-testid='later-act-object-clue'>
                  <Text className='later-act-object__clue-title'>{activeDetail.label}</Text>
                  <Text className='later-act-object__clue-copy'>{activeDetail.clue}</Text>
                  <View className='later-act-object__clue-action' hoverClass={disabled ? '' : 'later-act-object__clue-action--pressed'} role='button' aria-label={`收下${activeDetail.label}的细节`} aria-disabled={disabled} onClick={settleDetail}><Text>收下这处细节</Text></View>
                </View>
              ) : null}
              {detailsComplete && !activeDetail ? (
                <View
                  className='later-act-experience__primary-action'
                  hoverClass={disabled ? '' : 'later-act-experience__primary-action--pressed'}
                  role='button'
                  aria-label='继续追问'
                  aria-disabled={disabled}
                  onClick={() => {
                    if (disabled) return
                    haptics('medium')
                    update({ stage: 'followup' })
                    onExplorationComplete()
                  }}
                ><Text>继续追问</Text></View>
              ) : null}
            </View>
          ) : null}

          {stage === 'followup' ? (
            <View className='later-act-experience__section'>
              <Text className='later-act-experience__eyebrow'>把看见的事问清楚</Text>
              <Text className='later-act-experience__prompt'>{config.followUpPrompt}</Text>
              <View className='later-act-experience__choices'>
                {config.followUps.map((choice) => (
                  <View
                    key={choice.id}
                    className='later-act-experience__choice'
                    hoverClass={disabled ? '' : 'later-act-experience__choice--pressed'}
                    role='button'
                    aria-label={choice.label}
                    aria-disabled={disabled}
                    onClick={() => {
                      if (disabled) return
                      haptics('light')
                      onProgress({ ...progress, followupId: choice.id, stage: 'game' })
                      onFollowup(choice)
                    }}
                  ><Text className='later-act-experience__choice-copy'>{choice.label}</Text></View>
                ))}
              </View>
            </View>
          ) : null}

          {stage === 'game' ? (
            <View className='later-act-experience__section'>
              <Text className='later-act-experience__eyebrow'>{config.game.eyebrow}</Text>
              <Text className='later-act-experience__prompt'>{config.game.title}</Text>
              <Text className='later-act-experience__copy'>{config.game.intro}</Text>
              <View className='later-act-game__progress' aria-label={`已完成 ${progress.gameStep} 步，共 ${config.game.steps.length} 步`}>
                {config.game.steps.map((step, index) => <View key={step.id} className={`later-act-game__progress-dot${index < progress.gameStep ? ' later-act-game__progress-dot--active' : ''}`} />)}
              </View>
              {!progress.gameStarted ? (
                <View
                  className='later-act-experience__primary-action'
                  hoverClass={disabled ? '' : 'later-act-experience__primary-action--pressed'}
                  role='button'
                  aria-label={config.game.startLabel}
                  aria-disabled={disabled}
                  onClick={() => { if (!disabled) { haptics('medium'); update({ gameStarted: true }) } }}
                ><Text>{config.game.startLabel}</Text></View>
              ) : progress.gameComplete ? (
                <View className='later-act-game__complete' role='status'><Text>三步已经放好，故事正在接回结尾。</Text></View>
              ) : progress.wrongChoiceId ? (
                <View className='later-act-game__retry' role='alert'>
                  <Text>{findLatestSpeech(config, progress, 'game')}</Text>
                  {assistance.showClue ? <Text className='later-act-game__clue'>线索：{correctEvidence?.clue}</Text> : null}
                  <View className='later-act-game__retry-action' hoverClass={disabled ? '' : 'later-act-game__retry-action--pressed'} role='button' aria-label='再看一次' aria-disabled={disabled} onClick={() => { if (!disabled) update({ wrongChoiceId: null }) }}><Text>再看一次</Text></View>
                </View>
              ) : (
                <View className='later-act-game'>
                  <Text className='later-act-game__step'>第 {progress.gameStep + 1} 步</Text>
                  <Text className='later-act-game__prompt'>{currentGameStep?.prompt}</Text>
                  {!progress.selectedEvidenceId ? (
                    <>
                      <Text className='later-act-game__instruction'>先从刚才看过的细节里，找出能证明这一步的痕迹。</Text>
                      <View className='later-act-game__evidence-grid'>
                        {evidenceChoices.map((detail) => (
                          <View key={detail.id} className='later-act-game__evidence' hoverClass={disabled ? '' : 'later-act-game__evidence--pressed'} role='button' aria-label={`选择证据：${detail.label}`} aria-disabled={disabled} onClick={() => chooseEvidence(detail.id)}><Text>{detail.label}</Text></View>
                        ))}
                      </View>
                      {assistance.assist && correctEvidence ? <View className='later-act-game__assist' hoverClass={disabled ? '' : 'later-act-game__assist--pressed'} role='button' aria-label='请角色标出关键痕迹' aria-disabled={disabled} onClick={() => { if (!disabled) update({ selectedEvidenceId: correctEvidence.id, wrongChoiceId: null }) }}><Text>请{config.npcName}标出关键痕迹</Text></View> : null}
                    </>
                  ) : (
                    <>
                      <View className='later-act-game__evidence-lock' role='status'><Text>证据已锁定：{correctEvidence?.label}</Text></View>
                      <Text className='later-act-game__instruction'>现在根据这条痕迹完成实际操作。</Text>
                      <View className='later-act-experience__choices'>
                    {currentGameStep?.choices.map((choice) => (
                      <View
                        key={choice.id}
                        className='later-act-experience__choice'
                        hoverClass={disabled ? '' : 'later-act-experience__choice--pressed'}
                        role='button'
                        aria-label={choice.label}
                        aria-disabled={disabled}
                        onClick={() => chooseGameOption(choice)}
                      ><Text className='later-act-experience__choice-copy'>{choice.label}</Text></View>
                    ))}
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          ) : null}

          </ScrollView>
        )}
      </View>
    </View>
  )
}
