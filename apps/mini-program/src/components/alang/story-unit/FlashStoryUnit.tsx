import Taro from '@tarojs/taro'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { getFlashStoryUnitDefinition, type FlashStoryUnitId } from '@shared/alang/flashStorySeason'
import {
  createAtuanFirstActProgress,
  getAtuanFirstActApproach,
  type AtuanFirstActSubmission,
} from '@shared/alang/atuanFirstAct'
import type { FlashDialogueQuestion, FlashEncounterView, FlashNpcReference } from '../../../lib/alang/flashTypes'
import { flashStoryAnalytics, type FlashStoryAnalyticsEventType } from '../../../lib/analytics/flashStoryAnalytics'
import { FlashButton, FlashNpcDialogueScene } from '../FlashUi'
import {
  AtuanFirstEncounterDialogue,
  AtuanFirstConversationScene,
  AtuanStoryDialogue,
  EMPTY_ATUAN_DIALOGUE_STATE,
  getAtuanOpeningOption,
  resolveAtuanSpeech,
  type AtuanDialogueState,
} from './AtuanFirstEncounterDialogue'
import { AtuanArrivalPrelude, type AtuanArrivalAssets } from './AtuanArrivalPrelude'
import { resolveNPCResponse } from './NPCResponseResolver'
import {
  createStoryUnitState,
  reconcileStoryUnitState,
  restoreStoryUnitState,
  storyUnitReducer,
  storyUnitStorageKey,
  type StoryUnitChoice,
  type StoryUnitState,
} from './StoryUnitRuntime'

type StoryEpisode = NonNullable<FlashEncounterView['storyEpisode']>

export interface FlashStoryUnitProps {
  encounterId: string
  npc: FlashNpcReference
  story: StoryEpisode
  question?: FlashDialogueQuestion | null
  motion: StoryEpisode['motion']
  storyPosition: number
  submitState: 'idle' | 'submitting' | 'retry' | 'terminal'
  submitError: string
  onSubmit: (choice: StoryUnitChoice) => Promise<void>
  onContinue: () => void
  atuanArrivalAssets?: AtuanArrivalAssets
}

function loadInitialState(
  unitId: FlashStoryUnitId,
  encounterId: string,
  storageKey: string,
  serverSettled: boolean,
  question?: FlashDialogueQuestion | null,
): StoryUnitState {
  let restored = createStoryUnitState(unitId)
  try {
    restored = restoreStoryUnitState(unitId, Taro.getStorageSync(storageKey), encounterId)
    const reconciled = reconcileStoryUnitState(unitId, restored, question)
    if (restored.stage !== 'INIT' && reconciled.stage === 'INIT') Taro.removeStorageSync(storageKey)
    restored = reconciled
  } catch {
    // Local recovery is a hint; the server remains completion authority.
  }
  if (!serverSettled) return restored
  return { ...restored, stage: 'NPC_RESPONSE', companionEvent: 'SUCCESS' }
}

export function FlashStoryUnit(props: FlashStoryUnitProps) {
  const { encounterId, npc, story, question, motion, storyPosition, submitState, submitError, onSubmit, onContinue, atuanArrivalAssets } = props
  const definition = getFlashStoryUnitDefinition(story.code)
  if (!definition || definition.npcSlug !== npc.slug || definition.phase !== story.phase || definition.objectCode !== story.objectCode) {
    return <View role='alert'><Text>这件旧物暂时没有接上，返回后再试一次。</Text></View>
  }

  const storageKey = storyUnitStorageKey(definition.unitId, encounterId, story.id)
  const serverSettled = Boolean(story.response)
  const [runtime, dispatch] = useReducer(
    storyUnitReducer,
    undefined,
    () => loadInitialState(definition.unitId, encounterId, storageKey, serverSettled, question),
  )
  const runtimeRef = useRef(runtime)
  const emittedRef = useRef(new Set<FlashStoryAnalyticsEventType>(runtime.analyticsSent))
  const restoredSolvedRef = useRef(runtime.stage === 'OBJECT_SUCCESS')
  const [atuanDialogue, setAtuanDialogue] = useState<AtuanDialogueState>(EMPTY_ATUAN_DIALOGUE_STATE)
  runtimeRef.current = runtime

  const transition = useCallback((action: Parameters<typeof storyUnitReducer>[1]) => {
    const next = storyUnitReducer(runtimeRef.current, action)
    runtimeRef.current = next
    if (!serverSettled) {
      try { Taro.setStorageSync(storageKey, next) } catch { /* fail-open */ }
    }
    dispatch(action)
  }, [serverSettled, storageKey])

  const emit = useCallback((event: FlashStoryAnalyticsEventType) => {
    if (emittedRef.current.has(event)) return
    emittedRef.current.add(event)
    flashStoryAnalytics.track(definition.unitId, event)
    dispatch({ type: 'ANALYTIC_RECORDED', event })
  }, [definition.unitId])

  useEffect(() => {
    if (serverSettled || runtime.stage !== 'INIT') return
    emit('story_start')
    dispatch({ type: 'ENTER' })
  }, [emit, runtime.stage, serverSettled])

  useEffect(() => {
    if (!serverSettled) return
    if (runtime.stage === 'OBJECT_SUCCESS') dispatch({ type: 'RESPONSE_RECEIVED' })
    else if (runtime.stage === 'NPC_RESPONSE') {
      emit('story_complete')
      dispatch({ type: 'COMPLETE' })
      try { Taro.removeStorageSync(storageKey) } catch { /* fail-open */ }
    }
  }, [emit, runtime.stage, serverSettled, storageKey])

  useEffect(() => {
    if (serverSettled) return
    try { Taro.setStorageSync(storageKey, runtime) } catch { /* fail-open */ }
  }, [runtime, serverSettled, storageKey])

  useEffect(() => () => {
    const latest = runtimeRef.current
    if (latest.stage === 'INIT' || latest.stage === 'COMPLETED' || emittedRef.current.has('exit_before_complete')) return
    emittedRef.current.add('exit_before_complete')
    flashStoryAnalytics.track(definition.unitId, 'exit_before_complete')
  }, [definition.unitId])

  const startInteraction = (choice: StoryUnitChoice) => {
    if (runtime.stage !== 'NPC_INTRO') return
    const atuanFirstAct = definition.unitId === 's1-p1-atuan'
      ? createAtuanFirstActProgress(
          encounterId,
          getAtuanFirstActApproach(question?.options.findIndex((item) => item.id === choice.optionId) ?? 0).id,
        )
      : undefined
    transition({ type: 'START_INTERACTION', choice, atuanFirstAct })
    if (definition.unitId === 's1-p1-atuan') {
      emit('object_interaction_start')
    } else if (definition.npcSlug !== 'atuan') {
      transition({ type: 'OBJECT_ALIGNED' })
      void onSubmit(choice)
    }
  }
  const completeObject = (storyPath?: AtuanFirstActSubmission) => {
    if (!runtime.choice || runtime.stage !== 'OBJECT_INTERACTION') return
    const settledChoice = storyPath ? { ...runtime.choice, storyPath } : runtime.choice
    transition({ type: 'OBJECT_ALIGNED', choice: settledChoice })
    emit('object_complete')
    void onSubmit(settledChoice)
  }
  const completeAtuanDialogue = () => {
    if (!runtime.choice || runtime.stage !== 'OBJECT_INTERACTION') return
    transition({ type: 'OBJECT_ALIGNED' })
    void onSubmit(runtime.choice)
  }
  const retrySubmit = () => {
    if (!runtime.choice || runtime.stage !== 'OBJECT_SUCCESS') return
    if (submitState !== 'retry' && !(restoredSolvedRef.current && submitState === 'idle')) return
    void onSubmit(runtime.choice)
  }

  const showResult = serverSettled
  const isAtuanStory = definition.npcSlug === 'atuan'
  const showGame = !showResult && (runtime.stage === 'OBJECT_INTERACTION' || runtime.stage === 'OBJECT_DIVERGED' || runtime.stage === 'OBJECT_SUCCESS')
  const showAtuanPrelude = definition.unitId === 's1-p1-atuan' && !showResult && (runtime.stage === 'INIT' || runtime.stage === 'NPC_INTRO')
  const showAtuanScene = definition.unitId === 's1-p1-atuan' && !showAtuanPrelude && Boolean(atuanArrivalAssets)
  const defaultSpeech = resolveNPCResponse(definition.unitId, runtime.companionEvent, {
    intro: story.opening,
    success: showResult ? story.response : definition.success,
  })
  const speech = isAtuanStory && !showResult
      ? resolveAtuanSpeech(definition.unitId, runtime.choice?.label ?? null, atuanDialogue)
    : defaultSpeech
  const storyAction = definition.unitId === 's1-p1-atuan'
    ? '阿团站在长椅旁，目光越过你，仍旧望着公园入口。'
    : story.action

  return (
    <View className='flash-page flash-dialogue flash-dialogue--story'>
      <View className={`flash-dialogue__story-stage${showResult ? ' flash-dialogue__story-stage--result' : ' flash-dialogue__story-stage--question'}${showGame ? ' flash-dialogue__story-stage--game' : ''}${definition.unitId === 's1-p1-atuan' ? ' flash-dialogue__story-stage--atuan-first' : ''}`} data-testid='flash-story-stage' data-story-unit-stage={runtime.stage} data-story-unit-id={definition.unitId}>
        {showAtuanPrelude && atuanArrivalAssets ? (
          <AtuanArrivalPrelude
            assets={atuanArrivalAssets}
            onBeginConversation={(approachIndex, label) => {
              const option = question?.options[approachIndex]
              if (!question || !option) return
              startInteraction({ questionId: question.id, optionId: option.id, label })
            }}
          />
        ) : showAtuanScene && atuanArrivalAssets ? (
          <AtuanFirstConversationScene assets={atuanArrivalAssets} />
        ) : (
          <FlashNpcDialogueScene npc={npc} speech={speech} spacious choicesEmbedded={!showResult} motion={motion} />
        )}
        <View className='flash-dialogue__story-ambient' aria-hidden='true' />
        {!showAtuanPrelude ? (
          <View className='flash-dialogue__story-index' aria-label={`第 ${story.phase} 幕，故事 ${storyPosition} 共 ${story.progress.total}`}>
            <Text className='flash-dialogue__story-index-phase'>第 {story.phase} 幕</Text>
            <Text className='flash-dialogue__story-index-count'>{storyPosition}/{story.progress.total}</Text>
          </View>
        ) : null}

        {showAtuanPrelude ? null : !showResult ? (
          <View className={`flash-dialogue__story-panel flash-dialogue__story-panel--choices${showAtuanScene ? ' flash-dialogue__story-panel--atuan-conversation' : ''}`} data-testid='flash-story-choice-panel'>
            <ScrollView className='flash-dialogue__story-panel-scroll' scrollY>
              <View className='flash-dialogue__story-panel-content'>
                {!isAtuanStory ? (
                  <>
                    <Text className='flash-dialogue__story-panel-season'>{story.seasonTitle}</Text>
                    <Text className='flash-dialogue__story-panel-title'>{story.title}</Text>
                    <Text className='flash-dialogue__story-action'>{storyAction}</Text>
                  </>
                ) : null}
                {runtime.stage === 'INIT' || runtime.stage === 'NPC_INTRO' ? (
                  question?.options.length ? (
                    <View className='flash-dialogue__story-choices' aria-label={question.text}>
                      {question.options.map((option, index) => {
                        const label = definition.unitId === 's1-p1-atuan'
                          ? getAtuanFirstActApproach(index).label
                          : isAtuanStory
                            ? getAtuanOpeningOption(definition.unitId, index).label
                          : option.label
                        return (
                          <View
                            key={option.id}
                            className='flash-dialogue__choice flash-dialogue__story-choice'
                            hoverClass='flash-dialogue__choice--pressed'
                            onClick={() => startInteraction({ questionId: question.id, optionId: option.id, label })}
                            role='button'
                            aria-label={label}
                          >
                            <Text className='flash-dialogue__choice-mark' aria-hidden='true'>·</Text>
                            <Text className='flash-dialogue__choice-text'>{label}</Text>
                          </View>
                        )
                      })}
                    </View>
                  ) : <Text className='flash-dialogue__story-panel-unavailable'>这句话暂时没接上，返回后再试一次。</Text>
                ) : (
                  <>
                    {definition.unitId === 's1-p1-atuan' && runtime.choice && runtime.atuanFirstAct ? (
                      <AtuanFirstEncounterDialogue
                        encounterId={encounterId}
                        progress={runtime.atuanFirstAct}
                        disabled={submitState === 'submitting'}
                        onStateChange={(progress) => transition({ type: 'ATUAN_FIRST_ACT_UPDATED', progress })}
                        onComplete={completeObject}
                      />
                    ) : isAtuanStory && runtime.choice ? (
                      <AtuanStoryDialogue
                        unitId={definition.unitId}
                        state={atuanDialogue}
                        disabled={submitState === 'submitting'}
                        onStateChange={setAtuanDialogue}
                        onComplete={completeAtuanDialogue}
                      />
                    ) : null}
                    {submitState === 'submitting' ? <View className='flash-dialogue__story-settling' role='status'><Text>旧物已经整理好，正在收下这次回应…</Text></View> : null}
                    {runtime.stage === 'OBJECT_SUCCESS' && (submitState === 'retry' || (restoredSolvedRef.current && submitState === 'idle')) ? <FlashButton variant='quiet' onClick={retrySubmit}>重新送出</FlashButton> : null}
                  </>
                )}
                {submitError ? <View className='flash-dialogue__story-error' role='alert'><Text>{submitError}</Text></View> : null}
              </View>
            </ScrollView>
          </View>
        ) : (
          <View className='flash-dialogue__story-panel flash-dialogue__story-panel--result' aria-live='polite'>
            <ScrollView className='flash-dialogue__story-panel-scroll' scrollY>
              <View className='flash-dialogue__story-panel-content'>
                <Text className='flash-dialogue__story-panel-season'>{story.seasonTitle} · 第 {story.phase} 幕</Text>
                <Text className='flash-dialogue__story-panel-title'>{story.title}</Text>
                {story.fragment ? <View className={`flash-dialogue__fragment flash-dialogue__fragment--${story.fragment.category}`}><Text className='flash-dialogue__fragment-label'>新故事碎片</Text><Text className='flash-dialogue__fragment-title'>{story.fragment.title}</Text><Text className='flash-dialogue__fragment-fact'>{story.fragment.fact}</Text></View> : null}
                {story.closing ? <Text className='flash-dialogue__story-panel-closing'>{story.closing}</Text> : null}
                <Text className='flash-dialogue__story-panel-progress'>本幕 {story.progress.completedInPhase}/{story.progress.totalInPhase} · 全季 {story.progress.completedTotal}/{story.progress.total}</Text>
                <FlashButton onClick={() => { emit('next_npc_click'); onContinue() }}>{story.progress.completedTotal >= story.progress.total ? '收好这一季' : '收好碎片，继续寻找'}</FlashButton>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  )
}
