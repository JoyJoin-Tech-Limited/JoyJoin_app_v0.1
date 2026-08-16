import Taro from '@tarojs/taro'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useDidShow } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import { getFlashStoryUnitDefinition, type FlashStoryUnitId } from '@shared/alang/flashStorySeason'
import { getFlashFirstActExperienceContract } from '@shared/alang/flashFirstActExperience'
import {
  createAtuanFirstActProgress,
  getAtuanFirstActApproach,
  type AtuanFirstActSubmission,
} from '@shared/alang/atuanFirstAct'
import {
  createAtuanLaterActProgress,
  getAtuanLaterActApproach,
  getAtuanLaterActDefinition,
  isAtuanLaterActUnitId,
  type AtuanLaterActSubmission,
} from '@shared/alang/atuanLaterActs'
import type { FlashDialogueQuestion, FlashEncounterView, FlashNpcReference } from '../../../lib/alang/flashTypes'
import { flashStoryAnalytics, type FlashStoryAnalyticsEventType } from '../../../lib/analytics/flashStoryAnalytics'
import { FlashButton, FlashNpcDialogueScene } from '../FlashUi'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import {
  AtuanFirstEncounterDialogue,
  AtuanFirstConversationScene,
  AtuanStoryDialogue,
  EMPTY_ATUAN_DIALOGUE_STATE,
  getAtuanOpeningOption,
  resolveAtuanFirstActSpeech,
  resolveAtuanSpeech,
  type AtuanDialogueState,
} from './AtuanFirstEncounterDialogue'
import { AtuanArrivalPrelude, type AtuanArrivalAssets } from './AtuanArrivalPrelude'
import { resolveNPCResponse } from './NPCResponseResolver'
import { resolveFlashNpcTheme } from '../../../lib/alang/flashNpcAssets'
import { AlangFirstActExperience } from './AlangFirstActExperience'
import { LiziFirstActExperience } from './LiziFirstActExperience'
import { MomoFirstActExperience } from './MomoFirstActExperience'
import { ShiqiFirstActExperience } from './ShiqiFirstActExperience'
import { AtuanLaterActExperience, AtuanLaterActPrelude, AtuanLaterActScene } from './AtuanLaterActExperience'
import { FlatLaterActExperience } from './MomoLaterActExperience'
import { getCustomLaterActConfig, isFlatLaterActUnitId } from './LaterActStoryConfigs'
import { laterActStorageKey } from './LaterActStoryExperience'
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

const CUSTOM_FIRST_ACT_IDS = new Set<FlashStoryUnitId>([
  's1-p1-alang',
  's1-p1-lizi',
  's1-p1-momo',
  's1-p1-shiqi',
])

const ignoreFirstActSpeech = () => undefined

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
  momoLaterActScenes?: { second: string; third: string }
  momoLaterActCharacter?: string
  liziLaterActScenes?: { second: string; third: string }
  liziLaterActCharacter?: string
  shiqiSecondActScene?: string
  shiqiLaterActCharacter?: string
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
  const {
    encounterId,
    npc,
    story,
    question,
    motion,
    storyPosition,
    submitState,
    submitError,
    onSubmit,
    onContinue,
    atuanArrivalAssets,
    momoLaterActScenes,
    momoLaterActCharacter,
    liziLaterActScenes,
    liziLaterActCharacter,
    shiqiSecondActScene,
    shiqiLaterActCharacter,
  } = props
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
  const [atuanDialogue, setAtuanDialogue] = useState<AtuanDialogueState>(EMPTY_ATUAN_DIALOGUE_STATE)
  const atuanGameKey = `${storageKey}:atuan-cards`
  runtimeRef.current = runtime

  const transition = useCallback((action: Parameters<typeof storyUnitReducer>[1]) => {
    const next = storyUnitReducer(runtimeRef.current, action)
    runtimeRef.current = next
    if (!serverSettled) {
      try { Taro.setStorageSync(storageKey, next) } catch { /* fail-open */ }
    }
    dispatch(action)
  }, [serverSettled, storageKey])

  useDidShow(() => {
    if (definition.unitId !== 's1-p1-atuan') return
    const cardPlacements = Taro.getStorageSync(atuanGameKey)
    if (!Array.isArray(cardPlacements) || cardPlacements.length !== 3 || !runtimeRef.current.atuanFirstAct) return
    transition({ type: 'ATUAN_FIRST_ACT_UPDATED', progress: { ...runtimeRef.current.atuanFirstAct, cardPlacements, benchReached: true } })
    Taro.removeStorageSync(atuanGameKey)
  })

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
      if (isFlatLaterActUnitId(definition.unitId)) {
        try { Taro.removeStorageSync(laterActStorageKey(definition.unitId, encounterId)) } catch { /* fail-open */ }
      }
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
    const optionIndex = question?.options.findIndex((item) => item.id === choice.optionId) ?? 0
    const atuanFirstAct = definition.unitId === 's1-p1-atuan'
      ? createAtuanFirstActProgress(
          encounterId,
          getAtuanFirstActApproach(optionIndex).id,
        )
      : undefined
    const atuanLaterAct = definition.unitId === 's1-p2-atuan'
      ? createAtuanLaterActProgress('s1-p2-atuan', getAtuanLaterActApproach('s1-p2-atuan', optionIndex).id)
      : definition.unitId === 's1-p3-atuan'
        ? createAtuanLaterActProgress('s1-p3-atuan', getAtuanLaterActApproach('s1-p3-atuan', optionIndex).id)
        : undefined
    transition({ type: 'START_INTERACTION', choice, atuanFirstAct, atuanLaterAct })
    if (definition.unitId === 's1-p1-atuan' || isAtuanLaterActUnitId(definition.unitId)) {
      emit('object_interaction_start')
    } else if (definition.npcSlug !== 'atuan' && !isFlatLaterActUnitId(definition.unitId)) {
      transition({ type: 'OBJECT_ALIGNED' })
      void onSubmit(choice)
    }
  }
  const completeObject = (storyPath?: AtuanFirstActSubmission | AtuanLaterActSubmission) => {
    if (!runtime.choice || (runtime.stage !== 'OBJECT_INTERACTION' && runtime.stage !== 'OBJECT_SUCCESS')) return
    const settledChoice = storyPath ? { ...runtime.choice, storyPath } : runtime.choice
    if (runtime.stage === 'OBJECT_INTERACTION') {
      transition({ type: 'OBJECT_ALIGNED', choice: settledChoice })
      emit('object_complete')
    }
    void onSubmit(settledChoice)
  }
  const completeAtuanDialogue = () => {
    if (!runtime.choice || (runtime.stage !== 'OBJECT_INTERACTION' && runtime.stage !== 'OBJECT_SUCCESS')) return
    if (runtime.stage === 'OBJECT_INTERACTION') transition({ type: 'OBJECT_ALIGNED' })
    void onSubmit(runtime.choice)
  }
  const completeCustomFirstAct = (approachIndex: 0 | 1) => {
    if (runtime.stage === 'OBJECT_SUCCESS' && runtime.choice) {
      void onSubmit(runtime.choice)
      return
    }
    if (runtime.stage !== 'NPC_INTRO' || !question) return
    const option = question.options[approachIndex]
    if (!option) return
    const approach = getFlashFirstActExperienceContract(definition.unitId)?.approaches[approachIndex]
    startInteraction({ questionId: question.id, optionId: option.id, label: approach?.label ?? option.label })
  }

  const showResult = serverSettled
  const isAtuanStory = definition.npcSlug === 'atuan'
  const isCustomFirstAct = CUSTOM_FIRST_ACT_IDS.has(definition.unitId)
  const npcTheme = resolveFlashNpcTheme(npc.slug, npc.name)
  const customFirstActScene = npcTheme.dialogueSceneSrc
  const showCustomFirstAct = isCustomFirstAct && !showResult && Boolean(customFirstActScene)
  const customFirstActDisabled = submitState === 'submitting'
    || (runtime.stage !== 'NPC_INTRO' && runtime.stage !== 'OBJECT_SUCCESS')
  const showGame = !showResult && (runtime.stage === 'OBJECT_INTERACTION' || runtime.stage === 'OBJECT_DIVERGED' || runtime.stage === 'OBJECT_SUCCESS')
  const showAtuanPrelude = definition.unitId === 's1-p1-atuan' && !showResult && (runtime.stage === 'INIT' || runtime.stage === 'NPC_INTRO')
  const showAtuanScene = definition.unitId === 's1-p1-atuan' && !showAtuanPrelude && Boolean(atuanArrivalAssets)
  const atuanLaterActBackground = definition.unitId === 's1-p2-atuan'
    ? atuanArrivalAssets?.secondScene
    : definition.unitId === 's1-p3-atuan'
      ? atuanArrivalAssets?.thirdScene
      : undefined
  const showAtuanLaterScene = isAtuanLaterActUnitId(definition.unitId) && Boolean(atuanLaterActBackground && atuanArrivalAssets)
  const showAtuanLaterPrelude = showAtuanLaterScene && !showResult && (runtime.stage === 'INIT' || runtime.stage === 'NPC_INTRO')
  const showAtuanLaterExperience = showAtuanLaterScene && !showResult && Boolean(runtime.atuanLaterAct) && runtime.stage !== 'INIT' && runtime.stage !== 'NPC_INTRO'
  const flatLaterActBackground = definition.unitId === 's1-p2-momo'
    ? momoLaterActScenes?.second
    : definition.unitId === 's1-p3-momo'
      ? momoLaterActScenes?.third
      : definition.unitId === 's1-p2-lizi'
        ? liziLaterActScenes?.second
        : definition.unitId === 's1-p3-lizi'
          ? liziLaterActScenes?.third
          : definition.unitId === 's1-p2-shiqi'
            ? shiqiSecondActScene
      : undefined
  const flatLaterActCharacter = definition.npcSlug === 'momo'
    ? momoLaterActCharacter
    : definition.npcSlug === 'lizi'
      ? liziLaterActCharacter
      : definition.npcSlug === 'shiqi'
        ? shiqiLaterActCharacter
        : undefined
  const showFlatLaterAct = isFlatLaterActUnitId(definition.unitId) && !showResult && Boolean(flatLaterActBackground)
  const showDedicatedSubmitStatus = (showCustomFirstAct || showAtuanLaterExperience || showFlatLaterAct) && (
    submitState === 'submitting'
    || Boolean(submitError)
  )
  const defaultSpeech = resolveNPCResponse(definition.unitId, runtime.companionEvent, {
    intro: story.opening,
    success: showResult ? story.response : definition.success,
  })
  const speech = isAtuanStory && !showResult
      ? resolveAtuanSpeech(definition.unitId, runtime.choice?.label ?? null, atuanDialogue)
    : defaultSpeech
  const atuanSceneSpeech = definition.unitId === 's1-p1-atuan'
    ? (runtime.atuanFirstAct ? resolveAtuanFirstActSpeech(encounterId, runtime.atuanFirstAct) : speech)
    : speech
  const atuanLaterOpening = isAtuanLaterActUnitId(definition.unitId)
    ? getAtuanLaterActDefinition(definition.unitId).opening
    : ''
  const atuanLaterResult = definition.unitId === 's1-p2-atuan'
    ? { title: '没写完的座位图', closing: '邀请可以说清楚，舒服的距离与最后的回答仍留给默默。' }
    : definition.unitId === 's1-p3-atuan'
      ? { title: '回来的第六张卡', closing: '阿团只放好自己的名字。另一边空着，也是一份完整而不催促的等待。' }
      : null
  const customLaterResult = isFlatLaterActUnitId(definition.unitId)
    ? getCustomLaterActConfig(definition.unitId).result
    : atuanLaterResult
  const displayedFragment = definition.unitId === 's1-p2-atuan'
    ? { category: 'relationship', title: '没有替人回答的邀请', fact: '座位图能表达阿团想靠近的心意，但不能替默默决定距离。' }
    : definition.unitId === 's1-p3-atuan'
      ? { category: 'key', title: '回来的第六张卡', fact: '第六张卡一直留在箱底夹层；它是一份迟到的邀请，不是默默的回答。' }
      : isFlatLaterActUnitId(definition.unitId)
        ? getCustomLaterActConfig(definition.unitId).result.fragment
      : story.fragment
  const storyAction = definition.unitId === 's1-p1-atuan'
    ? '阿团站在长椅旁，目光越过你，仍旧望着公园入口。'
    : story.action
  const customFirstAct = customFirstActScene ? (() => {
    const sharedProps = {
      encounterId,
      scene: customFirstActScene,
      disabled: customFirstActDisabled,
      onSpeechChange: ignoreFirstActSpeech,
      onComplete: completeCustomFirstAct,
    }
    switch (definition.unitId) {
      case 's1-p1-alang': return <AlangFirstActExperience {...sharedProps} />
      case 's1-p1-lizi': return <LiziFirstActExperience {...sharedProps} />
      case 's1-p1-momo': return <MomoFirstActExperience {...sharedProps} />
      case 's1-p1-shiqi': return <ShiqiFirstActExperience {...sharedProps} />
      default: return null
    }
  })() : null

  return (
    <View className='flash-page flash-dialogue flash-dialogue--story'>
      <View className={`flash-dialogue__story-stage${showResult ? ' flash-dialogue__story-stage--result' : ' flash-dialogue__story-stage--question'}${showGame ? ' flash-dialogue__story-stage--game' : ''}${definition.unitId === 's1-p1-atuan' ? ' flash-dialogue__story-stage--atuan-first' : ''}${showCustomFirstAct ? ' flash-dialogue__story-stage--custom-first' : ''}`} data-testid='flash-story-stage' data-story-unit-stage={runtime.stage} data-story-unit-id={definition.unitId}>
        {showCustomFirstAct && customFirstAct ? customFirstAct : showFlatLaterAct && flatLaterActBackground && isFlatLaterActUnitId(definition.unitId) ? (
          <FlatLaterActExperience
            encounterId={encounterId}
            unitId={definition.unitId}
            background={flatLaterActBackground}
            character={flatLaterActCharacter ?? npcTheme.imageSrc}
            started={runtime.stage !== 'INIT' && runtime.stage !== 'NPC_INTRO'}
            disabled={submitState === 'submitting' || ((runtime.stage === 'INIT' || runtime.stage === 'NPC_INTRO') && !question?.options.length)}
            onBegin={(approachIndex, label) => {
              const option = question?.options[approachIndex]
              if (!question || !option) return
              startInteraction({ questionId: question.id, optionId: option.id, label })
            }}
            onComplete={() => completeObject()}
          />
        ) : showAtuanPrelude && atuanArrivalAssets ? (
          <AtuanArrivalPrelude
            assets={atuanArrivalAssets}
            onBeginConversation={(approachIndex, label) => {
              const option = question?.options[approachIndex]
              if (!question || !option) return
              startInteraction({ questionId: question.id, optionId: option.id, label })
            }}
          />
        ) : showAtuanLaterPrelude && atuanArrivalAssets && atuanLaterActBackground && isAtuanLaterActUnitId(definition.unitId) ? (
          <AtuanLaterActPrelude
            unitId={definition.unitId}
            background={atuanLaterActBackground}
            character={atuanArrivalAssets.character}
            disabled={!question?.options.length}
            onBegin={(approachIndex, label) => {
              const option = question?.options[approachIndex]
              if (!question || !option) return
              startInteraction({ questionId: question.id, optionId: option.id, label })
            }}
          />
        ) : showAtuanLaterExperience && runtime.atuanLaterAct && atuanArrivalAssets && atuanLaterActBackground && isAtuanLaterActUnitId(definition.unitId) ? (
          <AtuanLaterActExperience
            unitId={definition.unitId}
            background={atuanLaterActBackground}
            character={atuanArrivalAssets.character}
            progress={runtime.atuanLaterAct}
            disabled={submitState === 'submitting'}
            onProgress={(progress) => transition({ type: 'ATUAN_LATER_ACT_UPDATED', progress })}
            onComplete={completeObject}
          />
        ) : showAtuanLaterScene && atuanArrivalAssets && atuanLaterActBackground && isAtuanLaterActUnitId(definition.unitId) ? (
          <AtuanLaterActScene unitId={definition.unitId} background={atuanLaterActBackground} character={atuanArrivalAssets.character} speech={showResult ? (story.response ?? atuanLaterOpening) : atuanLaterOpening} />
        ) : showAtuanScene && atuanArrivalAssets ? (
          <AtuanFirstConversationScene assets={atuanArrivalAssets} speech={atuanSceneSpeech} />
        ) : (
          <FlashNpcDialogueScene npc={npc} speech={speech} spacious choicesEmbedded={!showResult} motion={motion} />
        )}
        {!showCustomFirstAct && !showAtuanLaterScene && !showFlatLaterAct ? <View className='flash-dialogue__story-ambient' aria-hidden='true' /> : null}
        {!showCustomFirstAct && !showAtuanPrelude && !showAtuanLaterScene && !showFlatLaterAct ? (
          <View className='flash-dialogue__story-index' aria-label={`第 ${story.phase} 幕，故事 ${storyPosition} 共 ${story.progress.total}`}>
            <Text className='flash-dialogue__story-index-phase'>第 {story.phase} 幕</Text>
            <Text className='flash-dialogue__story-index-count'>{storyPosition}/{story.progress.total}</Text>
          </View>
        ) : null}

        {showDedicatedSubmitStatus ? (
          <View className='flash-dialogue__custom-story-status'>
            {submitState === 'submitting' ? <View role='status'><Text>正在收下这段故事…</Text></View> : null}
            {submitError ? <View role='alert'><Text>{submitError}</Text></View> : null}
          </View>
        ) : showCustomFirstAct ? null : showFlatLaterAct ? null : showAtuanPrelude ? null : showAtuanLaterPrelude ? null : showAtuanLaterExperience ? null : !showResult ? (
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
                          : isAtuanLaterActUnitId(definition.unitId)
                            ? getAtuanLaterActApproach(definition.unitId, index).label
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
                        onOpenGame={() => { void Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangAtuanCards}?key=${encodeURIComponent(atuanGameKey)}&approach=${runtime.atuanFirstAct?.approachId ?? 'notice_wait'}` }) }}
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
                  </>
                )}
                {submitError ? <View className='flash-dialogue__story-error' role='alert'><Text>{submitError}</Text></View> : null}
              </View>
            </ScrollView>
          </View>
        ) : (
          <View className='flash-dialogue__story-panel flash-dialogue__story-panel--result' aria-live='polite'>
            <View className='flash-dialogue__story-panel-content'>
              <Text className='flash-dialogue__story-panel-season'>{story.seasonTitle} · 第 {story.phase} 幕</Text>
              <Text className='flash-dialogue__story-panel-title'>{customLaterResult?.title ?? story.title}</Text>
              {displayedFragment ? <View className={`flash-dialogue__fragment flash-dialogue__fragment--${displayedFragment.category}`}><Text className='flash-dialogue__fragment-label'>新故事碎片</Text><Text className='flash-dialogue__fragment-title'>{displayedFragment.title}</Text><Text className='flash-dialogue__fragment-fact'>{displayedFragment.fact}</Text></View> : null}
              {(customLaterResult?.closing ?? story.closing) ? <Text className='flash-dialogue__story-panel-closing'>{customLaterResult?.closing ?? story.closing}</Text> : null}
              <Text className='flash-dialogue__story-panel-progress'>本幕 {story.progress.completedInPhase}/{story.progress.totalInPhase} · 全季 {story.progress.completedTotal}/{story.progress.total}</Text>
            </View>
            <View className='flash-dialogue__story-result-exit' data-testid='flash-story-result-exit'>
              <FlashButton onClick={() => { emit('next_npc_click'); onContinue() }}>{story.progress.completedTotal >= story.progress.total ? '收好这一季' : '收好碎片，继续寻找'}</FlashButton>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
