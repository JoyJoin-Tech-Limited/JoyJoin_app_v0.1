import Taro, { useDidShow } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import { FirstActDialogueChrome } from './FirstActDialogueChrome'
import { FirstActHighlightOverlay } from './FirstActHighlightOverlay'
import './FirstActAtuanTemplateExperience.scss'

export type FirstActApproachIndex = 0 | 1

export interface FirstActTemplateHighlight {
  id: string
  label: string
  clue: string
  placementClassName: string
}

export interface FirstActTemplateApproach {
  label: string
  response: string
  hint: string
}

export interface FirstActAtuanTemplateConfig {
  npcSlug: 'alang' | 'momo' | 'shiqi'
  npcName: string
  objectCode: string
  rootClassName: string
  testId: string
  sceneTestId: string
  fallbackTestId: string
  storageKey: (encounterId: string) => string
  highlights: readonly [FirstActTemplateHighlight, FirstActTemplateHighlight, FirstActTemplateHighlight, FirstActTemplateHighlight]
  unlockCopy: string
  eventLabel: string
  eventPrompt: string
  approaches: readonly [FirstActTemplateApproach, FirstActTemplateApproach]
  conversationNarration: string
  gameAction: string
  successSpeech: string
  successNarration: string
  completionLabel: string
}

type Stage = 'scene' | 'reveal' | 'event' | 'choice' | 'conversation' | 'success'

interface Progress {
  version: 'atuan-template-v1'
  stage: Stage
  seenIds: string[]
  activeId: string | null
  approachIndex: FirstActApproachIndex | null
}

function initialProgress(): Progress {
  return {
    version: 'atuan-template-v1',
    stage: 'scene',
    seenIds: [],
    activeId: null,
    approachIndex: null,
  }
}

function loadProgress(storageKey: string, config: FirstActAtuanTemplateConfig): Progress {
  try {
    const value = Taro.getStorageSync(storageKey) as Partial<Progress> | undefined
    if (value?.version !== 'atuan-template-v1') return initialProgress()
    const validIds = new Set(config.highlights.map(({ id }) => id))
    const seenIds = Array.isArray(value.seenIds) ? value.seenIds.filter((id): id is string => typeof id === 'string' && validIds.has(id)) : []
    const stage = ['scene', 'reveal', 'event', 'choice', 'conversation', 'success'].includes(value.stage ?? '') ? value.stage as Stage : 'scene'
    const approachIndex = value.approachIndex === 0 || value.approachIndex === 1 ? value.approachIndex : null
    return {
      version: 'atuan-template-v1',
      stage,
      seenIds,
      activeId: typeof value.activeId === 'string' && validIds.has(value.activeId) ? value.activeId : null,
      approachIndex,
    }
  } catch {
    return initialProgress()
  }
}

export function FirstActAtuanTemplateExperience({
  encounterId,
  scene,
  disabled = false,
  onSpeechChange,
  onComplete,
  config,
}: {
  encounterId: string
  scene: string
  disabled?: boolean
  onSpeechChange: (speech: string) => void
  onComplete: (approachIndex: FirstActApproachIndex) => void | Promise<void>
  config: FirstActAtuanTemplateConfig
}) {
  const storageKey = config.storageKey(encounterId)
  const gameKey = `${storageKey}:game`
  const [progress, setProgress] = useState<Progress>(() => loadProgress(storageKey, config))
  const progressRef = useRef(progress)
  const [sceneFailed, setSceneFailed] = useState(false)
  const primaryHighlights = config.highlights.slice(0, 3)
  const revealedHighlight = config.highlights[3]
  const activeHighlight = useMemo(
    () => config.highlights.find(({ id }) => id === progress.activeId) ?? null,
    [config.highlights, progress.activeId],
  )
  progressRef.current = progress

  useEffect(() => {
    try { Taro.setStorageSync(storageKey, progress) } catch { /* Local progress must not block the encounter. */ }
  }, [progress, storageKey])

  useEffect(() => {
    const speech = activeHighlight?.clue
      ?? (progress.approachIndex === null ? config.eventPrompt : config.approaches[progress.approachIndex].response)
    onSpeechChange(progress.stage === 'success' ? config.successSpeech : speech)
  }, [activeHighlight, config, onSpeechChange, progress.approachIndex, progress.stage])

  useDidShow(() => {
    if (progressRef.current.stage !== 'conversation') return
    const result = Taro.getStorageSync(gameKey)
    if (!Array.isArray(result) || result.length !== 3) return
    Taro.removeStorageSync(gameKey)
    haptics('success')
    setProgress((current) => ({ ...current, stage: 'success', activeId: null }))
  })

  const inspect = (id: string) => {
    if (disabled || progress.activeId || progress.seenIds.includes(id)) return
    haptics('light')
    setProgress((current) => ({
      ...current,
      activeId: id,
      seenIds: [...current.seenIds, id],
    }))
  }

  const closeClue = () => {
    if (!activeHighlight) return
    const isReveal = activeHighlight.id === revealedHighlight.id
    const primaryComplete = primaryHighlights.every(({ id }) => progress.seenIds.includes(id))
    haptics(isReveal || primaryComplete ? 'medium' : 'light')
    setProgress((current) => ({
      ...current,
      activeId: null,
      stage: isReveal ? 'event' : primaryComplete ? 'reveal' : 'scene',
    }))
  }

  const openGame = () => {
    if (disabled || progress.approachIndex === null) return
    haptics('medium')
    void Taro.navigateTo({
      url: `${MINI_PROGRAM_ROUTES.alangAtuanCards}?mode=${config.npcSlug}&key=${encodeURIComponent(gameKey)}&approach=${progress.approachIndex}`,
    })
  }

  const chooseApproach = (approachIndex: FirstActApproachIndex) => {
    if (disabled) return
    haptics('light')
    setProgress((current) => ({ ...current, stage: 'conversation', approachIndex }))
  }

  return (
    <View
      className={`${config.rootClassName} first-act-atuan-template${disabled ? ' first-act-atuan-template--disabled' : ''}`}
      data-testid={config.testId}
      data-object-code={config.objectCode}
      data-stage={progress.stage}
      data-scene={scene}
    >
      {!sceneFailed ? (
        <Image className={`${config.rootClassName}__scene`} src={scene} mode='aspectFit' data-testid={config.sceneTestId} onError={() => setSceneFailed(true)} aria-hidden='true' />
      ) : <View className={`${config.rootClassName}__scene-fallback`} data-testid={config.fallbackTestId} aria-hidden='true' />}
      <View className='first-act-scene-grade' aria-hidden='true' />

      {progress.stage === 'scene' && !activeHighlight ? (
        <FirstActHighlightOverlay
          npcSlug={config.npcSlug}
          targets={primaryHighlights}
          completedIds={progress.seenIds}
          activeId={null}
          disabled={disabled}
          onSelect={inspect}
        />
      ) : null}

      {progress.stage === 'reveal' && !activeHighlight ? (
        <>
          <View className='atuan-arrival__unlock-note' role='status' aria-live='polite'>
            <Text className='atuan-arrival__unlock-kicker'>三处线索已找到</Text>
            <Text className='atuan-arrival__unlock-copy'>{config.unlockCopy}</Text>
          </View>
          <FirstActHighlightOverlay
            npcSlug={config.npcSlug}
            targets={[revealedHighlight]}
            completedIds={[]}
            activeId={null}
            disabled={disabled}
            onSelect={inspect}
          />
        </>
      ) : null}

      {activeHighlight ? (
        <View
          className='atuan-arrival__clue'
          hoverClass='atuan-arrival__clue--pressed'
          onClick={closeClue}
          role='button'
          aria-label={`收下${activeHighlight.label}的线索，回到现场`}
          data-testid={`${config.npcSlug}-scene-clue`}
        >
          <Text className='atuan-arrival__clue-kicker'>{activeHighlight.id === revealedHighlight.id ? '第二层 · 新线索' : '现场线索'}</Text>
          <Text className='atuan-arrival__clue-title'>{activeHighlight.label}</Text>
          <Text className='atuan-arrival__clue-copy'>{activeHighlight.clue}</Text>
          <Text className='atuan-arrival__clue-action'>轻触收下线索</Text>
        </View>
      ) : null}

      {progress.stage === 'event' ? (
        <View className='first-act-atuan-template__event'>
          <View className='first-act-atuan-template__event-ribbon first-act-atuan-template__event-ribbon--one' />
          <View className='first-act-atuan-template__event-ribbon first-act-atuan-template__event-ribbon--two' />
          <View className='first-act-atuan-template__event-object' hoverClass='first-act-atuan-template__event-object--pressed' onClick={() => setProgress((current) => ({ ...current, stage: 'choice' }))} role='button' aria-label={config.eventLabel}>
            <View className='first-act-atuan-template__event-rule' />
          </View>
        </View>
      ) : null}

      {progress.stage === 'choice' ? (
        <View className='atuan-arrival__action-sheet' aria-label='选择你的现场动作'>
          <Text className='atuan-arrival__action-prompt'>{config.eventPrompt}</Text>
          <View className='atuan-arrival__action-cards'>
            {config.approaches.map((approach, index) => (
              <View key={approach.label} className={`atuan-arrival__action-card atuan-arrival__action-card--${index === 0 ? 'catch' : 'bag'}`} hoverClass='atuan-arrival__action-card--pressed' onClick={() => chooseApproach(index as FirstActApproachIndex)} role='button' aria-label={approach.label}>
                <View className='atuan-arrival__action-card-visual'><View className={index === 0 ? 'atuan-arrival__action-mini-card' : 'atuan-arrival__action-bag-mark'} /></View>
                <View className='atuan-arrival__action-card-copy'>
                  <Text className='atuan-arrival__action-card-text'>{approach.label}</Text>
                  <Text className='atuan-arrival__action-card-hint'>{approach.hint}</Text>
                </View>
                <Text className='atuan-arrival__action-card-arrow' aria-hidden='true'>›</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {progress.stage === 'conversation' && progress.approachIndex !== null ? (
        <FirstActDialogueChrome
          npcSlug={config.npcSlug}
          speaker={config.npcName}
          speech={config.approaches[progress.approachIndex].response}
          narration={config.conversationNarration}
          prompt='把刚才找到的线索整理一下。'
          action={{ label: config.gameAction, onClick: openGame }}
          disabled={disabled}
        />
      ) : null}

      {progress.stage === 'success' && progress.approachIndex !== null ? (
        <FirstActDialogueChrome
          npcSlug={config.npcSlug}
          speaker={config.npcName}
          speech={config.successSpeech}
          narration={config.successNarration}
          prompt='这一幕已经有了答案。'
          action={{ label: config.completionLabel, onClick: () => onComplete(progress.approachIndex!) }}
          disabled={disabled}
        />
      ) : null}
    </View>
  )
}
