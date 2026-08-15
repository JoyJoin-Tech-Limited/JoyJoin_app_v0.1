import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { getFlashStoryUnitDefinition, isFlashV2PilotUnitId } from '@shared/alang/flashStorySeason'
import type { AtuanFirstActSubmission } from '@shared/alang/atuanFirstAct'
import type { AtuanLaterActSubmission } from '@shared/alang/atuanLaterActs'
import { FlashStoryUnit } from '../../../components/alang/story-unit/FlashStoryUnit'
import { FlashStoryV2Stage } from '../../../components/alang/FlashStoryV2Stage'
import { FlashButton, FlashFeatureClosed, FlashNpcDialogueScene, FlashPageState, FlashTaskCategoryBadge } from '../../../components/alang/FlashUi'
import { shouldShowStreetBlindBoxEntry } from '../../../lib/alang/alangAccess'
import { getFlashApiErrorCode } from '../../../lib/alang/flashApi'
import { getApiErrorStatusCode, isTransportApiError } from '../../../lib/api/authSession'
import { redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import {
  useAdvanceFlashStoryNode,
  useAnswerFlashEncounter,
  useDeliverFlashTask,
  useFlashEncounter,
  useRerollFlashEncounter,
  useRespondToFlashTaskOffer,
} from '../../../lib/alang/useFlash'
import type { FlashCanonicalSnapshot } from '../../../lib/alang/flashTypes'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import atuanArrivalScene from '../assets/ui/flash-atuan-park-clean-v3.jpg'
import atuanArrivalCharacter from '../assets/ui/flash-atuan-character-lowpoly-v3.png'
import atuanArrivalBag from '../assets/ui/flash-atuan-bag-cutout-v2.png'
import atuanSecondActScene from '../assets/ui/flash-atuan-second-act-pavilion-v1.jpg'
import atuanThirdActScene from '../assets/ui/flash-atuan-third-act-table-v1.jpg'
import '../flash.scss'

function dialogueActionError(error: unknown, fallback: string): string {
  switch (getFlashApiErrorCode(error)) {
    case 'FLASH_TASK_LIMIT_REACHED':
      return '手上已经有三个任务了，先完成或放下一个再来接。'
    case 'FLASH_NPC_TASK_LIMIT_REACHED':
      return '你已经有这位角色的一件任务了，先把那件事做完吧。'
    case 'FLASH_REROLL_ALREADY_USED':
      return '这次已经换过一次任务了，原来的选择仍然有效。'
    case 'FLASH_NO_TASK_AVAILABLE':
      return '暂时没有另一件合适的任务，这次可以先不接。'
    case 'FLASH_INVALID_DIALOGUE_OPTION':
      return '这个回答已经变化了，重新读取后再选一次。'
    case 'FLASH_INVALID_TASK_STATE':
      return '状态刚刚发生了变化，任务和对话进度都没有丢。'
    case 'FLASH_STORY_GENERATION_PENDING':
      return '这条时间线还在收拢，稍后点同一个选择就会继续，不会重复结算。'
    default:
      return fallback
  }
}

const LEGACY_STORY_CHOICE_COPY: Record<string, { legacy: string; approved: string }> = {
  'notice-action': {
    legacy: '它刚才做的动作',
    approved: '我想问：你为什么这样做？',
  },
  'notice-object': {
    legacy: '这件旧物留下的痕迹',
    approved: '我想看看：旧物还留下了什么？',
  },
  'notice-relationship': {
    legacy: '它没有直接说出的关系',
    approved: '等等，这件旧物和谁有关？',
  },
}

const LEGACY_STORY_RESPONSE_COPY: Record<string, string> = {
  '你注意到了它怎样处理，而不是只听它解释。': '你先留意了那个动作。有时候，动作比解释更诚实。',
  '物件上的使用痕迹把过去说得更具体了。': '你把目光留在旧物上。那些不起眼的痕迹，替过去补上了一小段。',
  '这件旧物与另一个角色的关系变得清楚了一点。': '你追问了那段没说完的关系。旧物和另一个角色，终于连上了一点。',
}

const SHIQI_LEGACY_STATIC_EPISODES = new Set([
  's1-p1-shiqi',
  's1-p2-shiqi',
  's1-p3-shiqi',
])

function storyChoiceLabel(option: { id: string; label: string }): string {
  const replacement = LEGACY_STORY_CHOICE_COPY[option.id]
  return replacement?.legacy === option.label ? replacement.approved : option.label
}

function storyQuestionText(text?: string): string {
  return text === '你想先注意哪一件事？' ? '你最想接着问哪一句？' : (text ?? '你最想接着问哪一句？')
}

function storyResponseText(text: string): string {
  return LEGACY_STORY_RESPONSE_COPY[text] ?? text
}

type StorySubmitState = 'idle' | 'submitting' | 'retry' | 'terminal'

function classifyStorySubmitFailure(error: unknown): 'retry' | 'refresh' | 'exit' {
  const code = getFlashApiErrorCode(error)
  const status = getApiErrorStatusCode(error)
  if (code === 'FLASH_STORY_GENERATION_PENDING' || isTransportApiError(error) || status === undefined || status >= 500) return 'retry'
  if (code === 'FLASH_INVALID_DIALOGUE_OPTION' || status === 400 || status === 409) return 'refresh'
  return 'exit'
}

export default function FlashDialoguePage() {
  const enabled = shouldShowStreetBlindBoxEntry()
  const params = Taro.getCurrentInstance().router?.params ?? {}
  const encounterId = params.encounterId ?? ''
  const replay = params.replay === '1'
  const { data, isLoading, isError, error, refetch } = useFlashEncounter(encounterId, enabled && !!encounterId, replay)
  const answerMutation = useAnswerFlashEncounter()
  const advanceMutation = useAdvanceFlashStoryNode()
  const rerollMutation = useRerollFlashEncounter()
  const offerMutation = useRespondToFlashTaskOffer()
  const deliverMutation = useDeliverFlashTask()
  const [actionError, setActionError] = useState('')
  const [fragmentRevealed, setFragmentRevealed] = useState(false)
  const [storySubmitState, setStorySubmitState] = useState<StorySubmitState>('idle')
  const storySubmitInFlightRef = useRef(false)

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: data?.npc?.name ? `和${data.npc.name}聊聊` : '角色对话' })
  }, [data?.npc?.name])

  useEffect(() => {
    if (data?.storyEpisode?.code === 'season-finale') {
      void Taro.redirectTo({ url: `${MINI_PROGRAM_ROUTES.alangFinale}?encounterId=${encodeURIComponent(encounterId)}` })
      return
    }
    if (!enabled || !data?.canonicalScreen || data.status === 'expired') return
    void redirectToFlashCanonical(data, MINI_PROGRAM_ROUTES.alangDialogue)
  }, [data, enabled, encounterId])

  useEffect(() => {
    setFragmentRevealed(false)
    setStorySubmitState('idle')
    setActionError('')
    storySubmitInFlightRef.current = false
  }, [data?.storyEpisode?.id])

  const applyResponse = async (response: FlashCanonicalSnapshot) => {
    if ('storyEpisode' in response && response.storyEpisode?.code === 'season-finale') {
      await Taro.redirectTo({ url: `${MINI_PROGRAM_ROUTES.alangFinale}?encounterId=${encodeURIComponent(encounterId)}` })
      return
    }
    const redirected = await redirectToFlashCanonical(response, MINI_PROGRAM_ROUTES.alangDialogue)
    if (!redirected && !('npc' in response)) await refetch()
  }

  const answer = async (questionId: string, optionId: string) => {
    if (!enabled || answerMutation.isPending) return
    setActionError('')
    try {
      haptics('light')
      const response = await answerMutation.mutateAsync({ encounterId, questionId, optionId })
      await applyResponse(response)
    } catch (caughtError) {
      if (getFlashApiErrorCode(caughtError) === 'FLASH_ENCOUNTER_EXPIRED') {
        await refetch()
        return
      }
      setActionError(dialogueActionError(caughtError, '刚才那句话没有送到，再选一次就好。'))
    }
  }

  const advance = async () => {
    if (!enabled || advanceMutation.isPending) return
    setActionError('')
    try {
      haptics('light')
      const response = await advanceMutation.mutateAsync(encounterId)
      await applyResponse(response)
    } catch (caughtError) {
      if (getFlashApiErrorCode(caughtError) === 'FLASH_ENCOUNTER_EXPIRED') {
        await refetch()
        return
      }
      setActionError(dialogueActionError(caughtError, '故事没有接上，再试一次就好。'))
    }
  }

  const submitStoryChoice = async (choice: { questionId: string; optionId: string; label: string; storyPath?: AtuanFirstActSubmission | AtuanLaterActSubmission }) => {
    if (!enabled || storySubmitInFlightRef.current) return
    const payload = {
      encounterId,
      questionId: choice.questionId,
      optionId: choice.optionId,
      ...(choice.storyPath ? { storyPath: choice.storyPath } : {}),
      ...(replay ? { replay: true } : {}),
    }
    storySubmitInFlightRef.current = true
    setStorySubmitState('submitting')
    setActionError('')
    try {
      const response = await answerMutation.mutateAsync(payload)
      haptics('success')
      await applyResponse(response)
      setStorySubmitState('idle')
    } catch (caughtError) {
      const disposition = classifyStorySubmitFailure(caughtError)
      if (disposition === 'retry') {
        setStorySubmitState('retry')
        setActionError('这句话没有送出去，再试一次就好。')
      } else {
        setStorySubmitState('terminal')
        setActionError(disposition === 'refresh' ? '故事状态刚刚变化，正在重新接上。' : '这次见面已经结束。')
        await refetch()
        if (disposition === 'exit') await Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent })
      }
    } finally {
      storySubmitInFlightRef.current = false
    }
  }

  const deliver = async (
    assignmentId: string,
    answers?: Array<{ promptId: string; optionId: string }>,
  ) => {
    if (!enabled || deliverMutation.isPending) return
    setActionError('')
    try {
      const response = await deliverMutation.mutateAsync({ encounterId, assignmentId, answers })
      haptics('success')
      await applyResponse(response)
    } catch (caughtError) {
      if (getFlashApiErrorCode(caughtError) === 'FLASH_ENCOUNTER_EXPIRED') {
        await refetch()
        return
      }
      setActionError(dialogueActionError(caughtError, '任务还在你这里，没有丢。稍后再交一次就好。'))
    }
  }

  const reroll = async () => {
    if (!enabled || rerollMutation.isPending) return
    setActionError('')
    try {
      haptics('light')
      const response = await rerollMutation.mutateAsync(encounterId)
      await applyResponse(response)
    } catch (caughtError) {
      setActionError(dialogueActionError(caughtError, '这次没有换成功，原来的任务还为你留着。'))
    }
  }

  const respondToOffer = async (accepted: boolean) => {
    if (!enabled || offerMutation.isPending) return
    setActionError('')
    try {
      const response = await offerMutation.mutateAsync({ encounterId, accepted })
      if (accepted) haptics('success')
      await applyResponse(response)
    } catch (caughtError) {
      setActionError(dialogueActionError(caughtError, accepted ? '任务没有接稳，再点一次就好。' : '这次选择没有送到，请再试一下。'))
    }
  }

  if (!enabled) return <FlashFeatureClosed />

  if (!encounterId) {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='这段旧对话已经收好了'
          description='回到街头盲盒，可以从刚才停下的地方继续。'
          action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}
          actionLabel='返回街头盲盒'
        />
      </View>
    )
  }

  if (isError) {
    const expired = getFlashApiErrorCode(error) === 'FLASH_ENCOUNTER_EXPIRED'
    return (
      <View className='flash-page'>
        <FlashPageState
          tone={expired ? 'plain' : 'error'}
          title={expired ? '这段对话已经聊完了' : '刚才的话暂时没接上'}
          description={expired ? '解锁后的对话会保留 24 小时。现在可以回去看看有没有其他角色在线。' : '刚才的进度还在，重新接上不会从头开始。'}
          action={expired ? () => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) } : () => { void refetch() }}
          actionLabel={expired ? '返回街头盲盒' : '重新接上'}
        />
      </View>
    )
  }

  if (isLoading || !data) {
    return <View className='flash-page'><FlashPageState title='正在接上刚才的话…' description='聊上以后，即使角色下线，这段对话也能继续完成。' /></View>
  }

  if (data.status === 'expired') {
    return (
      <View className='flash-page'>
        <FlashPageState title='这段对话已经聊完了' description='解锁后的对话会保留 24 小时。现在可以回去看看有没有其他角色在线。' action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }} actionLabel='返回街头盲盒' />
      </View>
    )
  }

  const question = data.currentQuestion
  const offer = data.taskOffer
  const story = data.storyEpisode
  if (story?.code === 'season-finale') {
    return <View className='flash-page'><FlashPageState title='正在展开你的平行宇宙…' description='十五次选择已经收拢成一个只属于你的结局。' /></View>
  }

  if (story) {
    const v2View = isFlashV2PilotUnitId(story.code) ? story.storyV2 : null
    if (v2View) {
      return (
        <View className='flash-page flash-dialogue flash-dialogue--story'>
          <FlashStoryV2Stage
            npc={data.npc}
            segments={v2View.segments}
            choices={v2View.choices}
            isChoice={v2View.type === 'choice'}
            isTerminal={v2View.type === 'ending'}
            isClosure={v2View.type === 'closure'}
            echo={v2View.echo}
            echoTier={v2View.echoTier}
            seasonTitle={story.seasonTitle}
            phase={story.phase}
            busy={answerMutation.isPending || advanceMutation.isPending}
            onChoice={(choiceId) => { void answer(v2View.nodeId, choiceId) }}
            onContinue={() => { void advance() }}
          />
        </View>
      )
    }
    const unitDefinition = getFlashStoryUnitDefinition(story.code)
    if (unitDefinition) {
      const unitMotion = story.motion.ambient === 'none' && SHIQI_LEGACY_STATIC_EPISODES.has(story.code)
        ? { ...story.motion, ambient: 'breathe' as const }
        : story.motion
      const unitPosition = Math.min(story.progress.total, story.progress.completedTotal + (story.response ? 0 : 1))
      return (
        <FlashStoryUnit
          key={`${encounterId}:${story.id}`}
          encounterId={encounterId}
          npc={data.npc}
          story={story}
          question={question}
          motion={unitMotion}
          storyPosition={unitPosition}
          submitState={storySubmitState}
          submitError={actionError}
          atuanArrivalAssets={{
            scene: atuanArrivalScene,
            character: atuanArrivalCharacter,
            bag: atuanArrivalBag,
            secondScene: atuanSecondActScene,
            thirdScene: atuanThirdActScene,
          }}
          onSubmit={submitStoryChoice}
          onContinue={() => {
            const url = story.progress.completedTotal >= story.progress.total
              ? `${MINI_PROGRAM_ROUTES.alangFinale}?encounterId=${encodeURIComponent(encounterId)}`
              : MINI_PROGRAM_ROUTES.alangEvent
            void Taro.redirectTo({ url })
          }}
        />
      )
    }
    const storySettled = fragmentRevealed || !story.fragment
    const motion = story.motion.ambient === 'none' && SHIQI_LEGACY_STATIC_EPISODES.has(story.code)
      ? { ...story.motion, ambient: 'breathe' as const }
      : story.motion
    const responseCopy = story.response ? storyResponseText(story.response) : ''
    const storyPosition = Math.min(
      story.progress.total,
      story.progress.completedTotal + (story.response ? 0 : 1),
    )

    return (
      <View className='flash-page flash-dialogue flash-dialogue--story'>
        <View
          className={`flash-dialogue__story-stage${story.response ? ' flash-dialogue__story-stage--result' : ' flash-dialogue__story-stage--question'}`}
          data-testid='flash-story-stage'
        >
          <FlashNpcDialogueScene
            npc={data.npc}
            speech={story.response ? responseCopy : story.discovery}
            intro={story.opening}
            spacious
            choicesEmbedded={!story.response}
            motion={motion}
          />
          <View className='flash-dialogue__story-ambient' aria-hidden='true' />
          <View className='flash-dialogue__story-index' aria-label={`第 ${story.phase} 幕，故事 ${storyPosition} 共 ${story.progress.total}`}>
            <Text className='flash-dialogue__story-index-phase'>第 {story.phase} 幕</Text>
            <Text className='flash-dialogue__story-index-count'>{storyPosition}/{story.progress.total}</Text>
          </View>

          {!story.response ? (
            <View className='flash-dialogue__story-panel flash-dialogue__story-panel--choices' data-testid='flash-story-choice-panel'>
              <Text className='flash-dialogue__story-panel-season'>{story.seasonTitle}</Text>
              <Text className='flash-dialogue__story-panel-title'>{story.title}</Text>
              <Text className='flash-dialogue__story-panel-action'>{story.action}</Text>
              <Text className='flash-dialogue__story-panel-prompt'>{storyQuestionText(question?.text)}</Text>
              {question ? (
                <View className='flash-dialogue__story-choices'>
                  {question.options.map((option) => {
                    const label = storyChoiceLabel(option)
                    return (
                      <View
                        key={option.id}
                        className={`flash-dialogue__choice flash-dialogue__story-choice${answerMutation.isPending ? ' flash-dialogue__choice--disabled' : ''}`}
                        hoverClass={answerMutation.isPending ? '' : 'flash-dialogue__choice--pressed'}
                        onClick={() => { void answer(question.id, option.id) }}
                        role='button'
                        aria-label={label}
                        aria-disabled={answerMutation.isPending}
                      >
                        <Text className='flash-dialogue__choice-mark' aria-hidden='true'>·</Text>
                        <Text className='flash-dialogue__choice-text'>{label}</Text>
                      </View>
                    )
                  })}
                </View>
              ) : (
                <Text className='flash-dialogue__story-panel-unavailable'>这句话暂时没接上，返回后再试一次。</Text>
              )}
            </View>
          ) : (
            <View className='flash-dialogue__story-panel flash-dialogue__story-panel--result' aria-live='polite'>
              <Text className='flash-dialogue__story-panel-season'>{story.seasonTitle} · 第 {story.phase} 幕</Text>
              <Text className='flash-dialogue__story-panel-title'>{story.title}</Text>
              {!storySettled && story.fragment ? (
                <>
                  {story.echo ? (
                    <View className='flash-dialogue__echo' data-testid='flash-story-echo'>
                      <Text className='flash-dialogue__echo-label'>来自另一段选择的回声</Text>
                      <Text className='flash-dialogue__echo-copy'>{story.echo}</Text>
                    </View>
                  ) : null}
                  {story.storyMode === 'personalized' ? (
                    <Text className='flash-dialogue__ai-note'>专属剧情 · {story.renderKind === 'ai' ? 'AI 编排' : '审核内容回退'}</Text>
                  ) : null}
                  <FlashButton onClick={() => { haptics('success'); setFragmentRevealed(true) }}>揭开这块故事碎片</FlashButton>
                </>
              ) : (
                <>
                  {story.fragment ? (
                    <View className={`flash-dialogue__fragment flash-dialogue__fragment--${story.fragment.category}`}>
                      <Text className='flash-dialogue__fragment-label'>新故事碎片</Text>
                      <Text className='flash-dialogue__fragment-title'>{story.fragment.title}</Text>
                      <Text className='flash-dialogue__fragment-fact'>{story.fragment.fact}</Text>
                    </View>
                  ) : null}
                  {story.closing ? <Text className='flash-dialogue__story-panel-closing'>{story.closing}</Text> : null}
                  {story.nextStoryHint ? (
                    <View className='flash-dialogue__next-hint' data-testid='flash-story-next-hint' aria-live='polite'>
                      <Text className='flash-dialogue__next-hint-label'>还有一件事没有答案</Text>
                      <Text className='flash-dialogue__next-hint-copy'>{story.nextStoryHint}</Text>
                    </View>
                  ) : null}
                  <Text className='flash-dialogue__story-panel-progress'>本幕 {story.progress.completedInPhase}/{story.progress.totalInPhase} · 全季 {story.progress.completedTotal}/{story.progress.total}</Text>
                  <FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>
                    {story.progress.completedTotal >= story.progress.total ? '收好这一季' : '收好碎片，继续寻找'}
                  </FlashButton>
                </>
              )}
            </View>
          )}

          {actionError ? <View className='flash-dialogue__story-error' role='alert'><Text>{actionError}</Text></View> : null}
        </View>
      </View>
    )
  }

  const sceneSpeech = data.pendingDelivery
    ? (data.pendingDelivery.feedbackQuestions?.[0]?.prompt
      ?? (data.pendingDelivery.invitationType ? '后来怎么样了？' : '你真的去过了？那先把这件事讲给我听吧。'))
    : question
      ? question.text
      : offer
        ? offer.invitation
        : data.message || '今天先聊到这里吧，下次再碰见的时候再继续。'

  return (
    <View className='flash-page flash-dialogue'>
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          <FlashNpcDialogueScene
            npc={data.npc}
            speech={sceneSpeech}
            intro={question ? data.openingLine : undefined}
            compact={Boolean(offer)}
            spacious={!offer}
            choicesEmbedded={Boolean(question || offer || data.pendingDelivery?.feedbackQuestions?.[0])}
            deliveryEmbedded={Boolean(data.pendingDelivery?.feedbackQuestions?.[0])}
          />

          {data.pendingDelivery ? (
            <View className={`flash-dialogue__delivery${data.pendingDelivery.feedbackQuestions?.[0] ? ' flash-dialogue__delivery--embedded' : ''}`}>
              <Text className='flash-dialogue__kicker'>
                {data.pendingDelivery.invitationType === 'npc_message'
                  ? '有句话到了这里'
                  : data.pendingDelivery.invitationType === 'life_invitation'
                    ? '上次接住的那件事'
                    : '上次托你的事'}
              </Text>
              <Text className='flash-dialogue__delivery-title'>{data.pendingDelivery.taskTitle}</Text>
              {data.pendingDelivery.feedbackQuestions?.[0] ? (
                <View className='flash-dialogue__choices'>
                  {data.pendingDelivery.feedbackQuestions[0].options.map((option) => (
                    <View
                      key={option.id}
                      className={`flash-dialogue__choice${deliverMutation.isPending ? ' flash-dialogue__choice--disabled' : ''}`}
                      onClick={() => {
                        const prompt = data.pendingDelivery?.feedbackQuestions?.[0]
                        if (!prompt) return
                        void deliver(data.pendingDelivery!.assignmentId, [{
                          promptId: prompt.promptId ?? prompt.id,
                          optionId: option.id,
                        }])
                      }}
                      role='button'
                      aria-label={option.label}
                    >
                      <Text className='flash-dialogue__choice-mark' aria-hidden='true'>✦</Text>
                      <Text className='flash-dialogue__choice-text'>{option.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <FlashButton
                  disabled={deliverMutation.isPending}
                  onClick={() => { void deliver(data.pendingDelivery!.assignmentId) }}
                >
                  {deliverMutation.isPending ? '正在交付…' : `交给${data.npc.name}`}
                </FlashButton>
              )}
            </View>
          ) : question ? (
            <View className='flash-dialogue__conversation flash-dialogue__conversation--embedded'>
              <Text className='flash-dialogue__progress'>聊两句 · {question.position ?? (data.answeredQuestionCount ?? 0) + 1}/{question.total ?? 2}</Text>
              <View className='flash-dialogue__choices'>
                {question.options.map((option) => (
                  <View
                    key={option.id}
                    className={`flash-dialogue__choice${answerMutation.isPending ? ' flash-dialogue__choice--disabled' : ''}`}
                    hoverClass={answerMutation.isPending ? '' : 'flash-dialogue__choice--pressed'}
                    onClick={() => { void answer(question.id, option.id) }}
                    role='button'
                    aria-label={option.label}
                    aria-disabled={answerMutation.isPending}
                  >
                    <Text className='flash-dialogue__choice-mark' aria-hidden='true'>✦</Text>
                    <Text className='flash-dialogue__choice-text'>{option.label}</Text>
                  </View>
                ))}
              </View>
              <Text className='flash-dialogue__hint'>慢慢选，没有标准答案 ( ´ ▽ ` )</Text>
            </View>
          ) : offer ? (
            <View className='flash-dialogue__offer flash-dialogue__offer--embedded'>
              <Text className='flash-dialogue__kicker'>有件小事想拜托你</Text>
              <View
                key={offer.templateId}
                className='flash-dialogue__offer-paper'
                data-testid='flash-task-reveal'
                aria-live='polite'
              >
                <View className='flash-dialogue__offer-fold flash-dialogue__offer-fold--top' aria-hidden='true' />
                <View className='flash-dialogue__offer-fold flash-dialogue__offer-fold--bottom' aria-hidden='true' />
                <View className='flash-dialogue__offer-paper-heading'>
                  <FlashTaskCategoryBadge category={offer.category} className='flash-dialogue__offer-category' />
                  {data.canReroll && (data.rerollsRemaining ?? 1) > 0 ? (
                    <View
                      className={`flash-dialogue__reroll${rerollMutation.isPending ? ' flash-dialogue__reroll--disabled' : ''}`}
                      hoverClass={rerollMutation.isPending ? '' : 'flash-dialogue__reroll--pressed'}
                      onClick={() => { void reroll() }}
                      role='button'
                      aria-label='换一个小邀请'
                      aria-disabled={rerollMutation.isPending}
                    >
                      <Text className='flash-dialogue__reroll-mark' aria-hidden='true'>◇</Text>
                      <Text className='flash-dialogue__reroll-text'>
                        {rerollMutation.isPending ? '正在展开…' : '换一个'}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className='flash-dialogue__offer-title'>{offer.title}</Text>
                {offer.destinationName ? (
                  <Text className='flash-dialogue__offer-place'>{offer.districtName ? `${offer.districtName} · ` : ''}{offer.destinationName}</Text>
                ) : null}
                <Text className='flash-dialogue__offer-rule'>
                  {offer.invitationType === 'npc_message'
                    ? `以后遇见${offer.followUpTargetNpc?.name ?? '它'}时再决定要不要说；忘了也没关系。`
                    : offer.invitationType === 'life_invitation'
                      ? '不用打卡，也不用证明。下次见面时，再聊聊后来怎么样。'
                      : '到附近点击到达即可；不要求消费，也不要求进店。'}
                </Text>
              </View>
              <View className='flash-dialogue__offer-actions'>
                <FlashButton disabled={offerMutation.isPending} onClick={() => { void respondToOffer(true) }}>
                  {offerMutation.isPending ? '正在收好邀请…' : '好，我想试试看'}
                </FlashButton>
                <FlashButton variant='quiet' disabled={offerMutation.isPending} onClick={() => { void respondToOffer(false) }}>
                  今天先不了
                </FlashButton>
              </View>
            </View>
          ) : (
            <View className='flash-dialogue__conversation'>
              <FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>回到街头盲盒</FlashButton>
            </View>
          )}

          {actionError ? <View className='flash-dialogue__error' role='alert'><Text>{actionError}</Text></View> : null}
        </View>
      </ScrollView>
    </View>
  )
}
