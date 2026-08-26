import { useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { isFlashStoryUnitId, type FlashStoryUnitId } from '@shared/alang/flashStorySeason'
import type { FlashStoryV2Interaction } from '@shared/schema/flash'
import type { FlashNpcReference } from '../../../lib/alang/flashTypes'
import {
  flashStoryAnalytics,
  type FlashStoryAnalyticsMetadata,
} from '../../../lib/analytics/flashStoryAnalytics'
import { haptics } from '../../../lib/utils/haptics'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { FlashButton, FlashNpcPortrait } from '../FlashUi'
import {
  interactionPositionCount,
  mistakeGuidance,
  resultIdAtPosition,
} from './interactionOutcome'
import {
  OverlayGesture,
  PairingGesture,
  PathGesture,
  PrivacyGesture,
  SpacingGesture,
  type FlashGestureProps,
} from './gestures'

export interface FlashStoryInteractionStageProps {
  npc: FlashNpcReference
  /** 幕 id（story.code），仅用于枚举化埋点；非法值时静默放弃埋点。 */
  unitId: string
  nodeId: string
  interaction: FlashStoryV2Interaction
  segments: Array<{ speaker?: string; text: string }>
  seasonTitle: string
  phase: number
  busy: boolean
  error?: string
  onSubmit: (resultId: string) => void
}

const GESTURE_BY_TEMPLATE: Record<
  FlashStoryV2Interaction['template'],
  (props: FlashGestureProps) => JSX.Element
> = {
  spacing: SpacingGesture,
  pairing: PairingGesture,
  path: PathGesture,
  overlay: OverlayGesture,
  privacy: PrivacyGesture,
}

/**
 * 叙事动作层舞台（AC-04）：渲染 interaction 节点的可见目标、最多 2 条轻提示、
 * 模板手势与结果确认。无硬失败/次数惩罚/死路：错误手势只展示审核过的引导
 * 文案（firstMistake 无独立字段，按契约取第一条提示）。手势进度只存在本地，
 * 提交体严格为 { nodeId, resultId }（AC-03）。
 */
export function FlashStoryInteractionStage({
  npc,
  unitId,
  nodeId,
  interaction,
  segments,
  seasonTitle,
  phase,
  busy,
  error,
  onSubmit,
}: FlashStoryInteractionStageProps) {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const [position, setPosition] = useState<number | null>(null)
  const [guidance, setGuidance] = useState('')
  const [revealedHints, setRevealedHints] = useState(0)
  const trackedUnitId: FlashStoryUnitId | null = isFlashStoryUnitId(unitId) ? unitId : null
  const startedRef = useRef(false)
  const mistakeFiredRef = useRef(false)
  const submittedRef = useRef(false)

  const track = (event: Parameters<typeof flashStoryAnalytics.track>[1], metadata?: FlashStoryAnalyticsMetadata) => {
    if (!trackedUnitId) return
    flashStoryAnalytics.track(trackedUnitId, event, metadata ? { template: interaction.template, ...metadata } : { template: interaction.template })
  }

  // action_shown：动作节点每次渲染只记一次。
  useEffect(() => {
    if (!trackedUnitId) return
    flashStoryAnalytics.track(trackedUnitId, 'action_shown', { template: interaction.template })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  // exit_before_complete（=action_exited）：手势开始后未提交就离开。
  useEffect(() => () => {
    if (!startedRef.current || submittedRef.current || !trackedUnitId) return
    flashStoryAnalytics.track(trackedUnitId, 'exit_before_complete', { template: interaction.template })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGestureStart = () => {
    if (startedRef.current) return
    startedRef.current = true
    haptics('light')
    track('object_interaction_start')
  }

  const handleProgress = (nextPosition: number | null) => {
    setGuidance('')
    setPosition(nextPosition)
  }

  const handleMistake = () => {
    setGuidance(mistakeGuidance(interaction))
    if (mistakeFiredRef.current) return
    mistakeFiredRef.current = true
    track('first_mistake')
  }

  const revealHint = () => {
    const hints = interaction.hints ?? []
    if (revealedHints >= hints.length || revealedHints >= 2) return
    haptics('light')
    setRevealedHints(revealedHints + 1)
    track('hint_shown')
  }

  const resetGesture = () => {
    haptics('light')
    setPosition(null)
    setGuidance('')
  }

  const confirm = () => {
    if (busy || position === null || submittedRef.current) return
    const resultId = resultIdAtPosition(interaction, position)
    submittedRef.current = true
    haptics('medium')
    track('result_chosen', { resultId })
    track('object_complete')
    onSubmit(resultId)
  }

  const hints = (interaction.hints ?? []).slice(0, 2)
  const positionCount = interactionPositionCount(interaction)
  const Gesture = GESTURE_BY_TEMPLATE[interaction.template] ?? SpacingGesture

  return (
    <View className='flash-dialogue__story-stage flash-dialogue__story-stage--v2' data-testid='flash-interaction-stage'>
      <FlashNpcPortrait npc={npc} size='medium' />
      <View className='flash-dialogue__story-ambient' aria-hidden='true' />
      <View className='flash-dialogue__story-index' aria-label={`第 ${phase} 幕`}>
        <Text className='flash-dialogue__story-index-phase'>第 {phase} 幕</Text>
      </View>
      <View className='flash-dialogue__story-panel flash-dialogue__story-panel--v2' aria-live='polite'>
        <Text className='flash-dialogue__story-panel-season'>{seasonTitle}</Text>
        <ScrollView className='flash-dialogue__story-panel-scroll flash-story-v2__scroll' scrollY>
          {segments.length > 0 ? (
            <View className='flash-story-v2__segments'>
              {segments.slice(0, 3).map((segment, index) => (
                <Text key={index} className={`flash-story-v2__segment${segment.speaker ? ' flash-story-v2__segment--dialogue' : ''}`}>
                  {segment.text}
                </Text>
              ))}
            </View>
          ) : null}

          <View className='flash-interaction' data-template={interaction.template}>
            <Text className='flash-interaction__goal' data-testid='flash-interaction-goal'>{interaction.goal}</Text>

            <Gesture
              positionCount={positionCount}
              disabled={busy}
              reducedMotion={shouldReduceMotion}
              onGestureStart={handleGestureStart}
              onProgress={handleProgress}
              onMistake={handleMistake}
            />

            {guidance ? (
              <View className='flash-interaction__guidance' role='status' data-testid='flash-interaction-guidance'>
                <Text className='flash-interaction__guidance-text'>{guidance}</Text>
              </View>
            ) : null}

            {revealedHints > 0 ? (
              <View className='flash-interaction__hints'>
                {hints.slice(0, revealedHints).map((hint, index) => (
                  <Text key={index} className='flash-interaction__hint' data-testid='flash-interaction-hint'>{hint}</Text>
                ))}
              </View>
            ) : null}

            {hints.length > revealedHints ? (
              <View
                className='flash-interaction__hint-toggle'
                hoverClass='flash-interaction__hint-toggle--pressed'
                role='button'
                aria-label='给我一点提示'
                onClick={revealHint}
              >
                <Text className='flash-interaction__hint-toggle-text'>想要一点提示</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {error ? (
          <View className='flash-interaction__error' role='alert'><Text>{error}</Text></View>
        ) : null}

        <View className='flash-interaction__confirm'>
          {position !== null ? (
            <FlashButton onClick={confirm} disabled={busy} ariaLabel='就这样收好'>
              {busy ? '正在收好…' : '就这样收好'}
            </FlashButton>
          ) : (
            <Text className='flash-interaction__confirm-hint'>先动手试一试，好了再来收。</Text>
          )}
          {startedRef.current && position !== null && !busy ? (
            <View
              className='flash-interaction__reset'
              hoverClass='flash-interaction__reset--pressed'
              role='button'
              aria-label='重新整理'
              onClick={resetGesture}
            >
              <Text className='flash-interaction__reset-text'>重新整理</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
