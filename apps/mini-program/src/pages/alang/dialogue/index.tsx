import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { FlashButton, FlashFeatureClosed, FlashNpcDialogueScene, FlashPageState, FlashTaskCategoryBadge } from '../../../components/alang/FlashUi'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import { getFlashApiErrorCode } from '../../../lib/alang/flashApi'
import { redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import {
  useAnswerFlashEncounter,
  useDeliverFlashTask,
  useFlashEncounter,
  useRerollFlashEncounter,
  useRespondToFlashTaskOffer,
} from '../../../lib/alang/useFlash'
import type { FlashCanonicalSnapshot } from '../../../lib/alang/flashTypes'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
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
    default:
      return fallback
  }
}

export default function FlashDialoguePage() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)
  const params = Taro.getCurrentInstance().router?.params ?? {}
  const encounterId = params.encounterId ?? ''
  const { data, isLoading, isError, error, refetch } = useFlashEncounter(encounterId, enabled && !!encounterId)
  const answerMutation = useAnswerFlashEncounter()
  const rerollMutation = useRerollFlashEncounter()
  const offerMutation = useRespondToFlashTaskOffer()
  const deliverMutation = useDeliverFlashTask()
  const [actionError, setActionError] = useState('')
  const [fragmentRevealed, setFragmentRevealed] = useState(false)

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: data?.npc?.name ? `和${data.npc.name}聊聊` : '角色对话' })
  }, [data?.npc?.name])

  useEffect(() => {
    if (!enabled || !data?.canonicalScreen || data.status === 'expired') return
    void redirectToFlashCanonical(data, MINI_PROGRAM_ROUTES.alangDialogue)
  }, [data, enabled])

  useEffect(() => {
    setFragmentRevealed(false)
  }, [data?.storyEpisode?.id])

  const applyResponse = async (response: FlashCanonicalSnapshot) => {
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
    } catch (error) {
      if (getFlashApiErrorCode(error) === 'FLASH_ENCOUNTER_EXPIRED') {
        await refetch()
        return
      }
      setActionError(dialogueActionError(error, '刚才那句话没有送到，再选一次就好。'))
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
    } catch (error) {
      if (getFlashApiErrorCode(error) === 'FLASH_ENCOUNTER_EXPIRED') {
        await refetch()
        return
      }
      setActionError(dialogueActionError(error, '任务还在你这里，没有丢。稍后再交一次就好。'))
    }
  }

  const reroll = async () => {
    if (!enabled || rerollMutation.isPending) return
    setActionError('')
    try {
      haptics('light')
      const response = await rerollMutation.mutateAsync(encounterId)
      await applyResponse(response)
    } catch (error) {
      setActionError(dialogueActionError(error, '这次没有换成功，原来的任务还为你留着。'))
    }
  }

  const respondToOffer = async (accepted: boolean) => {
    if (!enabled || offerMutation.isPending) return
    setActionError('')
    try {
      const response = await offerMutation.mutateAsync({ encounterId, accepted })
      if (accepted) haptics('success')
      await applyResponse(response)
    } catch (error) {
      setActionError(dialogueActionError(error, accepted ? '任务没有接稳，再点一次就好。' : '这次选择没有送到，请再试一下。'))
    }
  }

  if (!enabled) return <FlashFeatureClosed />

  if (!encounterId) {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='这段旧对话已经收好了'
          description='回到闪现页，可以从服务端保存的最新状态继续。'
          action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}
          actionLabel='返回闪现'
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
          description={expired ? '解锁后的对话会保留 24 小时。现在可以回去看看有没有其他角色在线。' : '进度保存在服务端，重新读取不会从头开始。'}
          action={expired ? () => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) } : () => { void refetch() }}
          actionLabel={expired ? '返回闪现' : '重新接上'}
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
        <FlashPageState title='这段对话已经聊完了' description='解锁后的对话会保留 24 小时。现在可以回去看看有没有其他角色在线。' action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }} actionLabel='返回闪现' />
      </View>
    )
  }

  const question = data.currentQuestion
  const offer = data.taskOffer
  const story = data.storyEpisode
  const storySettled = Boolean(story && (fragmentRevealed || !story.fragment))
  const sceneSpeech = story
    ? (story.response ?? story.discovery)
    : data.pendingDelivery
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
            intro={story?.opening ?? (question ? data.openingLine : undefined)}
            compact={Boolean(offer)}
            spacious={!offer}
            choicesEmbedded={Boolean(question || offer || data.pendingDelivery?.feedbackQuestions?.[0])}
            deliveryEmbedded={Boolean(data.pendingDelivery?.feedbackQuestions?.[0])}
            motion={story?.motion}
          />

          {story ? (
            <View className='flash-dialogue__story' data-testid='flash-story-episode'>
              <View className='flash-dialogue__story-heading'>
                <Text className='flash-dialogue__kicker'>{story.seasonTitle} · 第 {story.phase} 幕</Text>
                <Text className='flash-dialogue__story-title'>{story.title}</Text>
                <Text className='flash-dialogue__story-progress'>已收集 {story.progress.completedTotal}/{story.progress.total} 个故事碎片</Text>
              </View>
              {!story.response ? (
                <View className='flash-dialogue__conversation flash-dialogue__conversation--embedded'>
                  <Text className='flash-dialogue__story-action'>{story.action}</Text>
                  {question ? (
                    <View className='flash-dialogue__choices'>
                      {question.options.map((option) => (
                        <View
                          key={option.id}
                          className={`flash-dialogue__choice${answerMutation.isPending ? ' flash-dialogue__choice--disabled' : ''}`}
                          hoverClass={answerMutation.isPending ? '' : 'flash-dialogue__choice--pressed'}
                          onClick={() => { void answer(question.id, option.id) }}
                          role='button'
                          aria-label={option.label}
                        >
                          <Text className='flash-dialogue__choice-mark' aria-hidden='true'>·</Text>
                          <Text className='flash-dialogue__choice-text'>{option.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : (
                <View className='flash-dialogue__story-result' aria-live='polite'>
                  {!fragmentRevealed && story.fragment ? (
                    <View className='flash-dialogue__fragment-sealed'>
                      <Text className='flash-dialogue__fragment-sealed-mark' aria-hidden='true'>◇</Text>
                      <Text className='flash-dialogue__story-closing'>{story.response}</Text>
                      <FlashButton onClick={() => { haptics('success'); setFragmentRevealed(true) }}>揭开这块故事碎片</FlashButton>
                    </View>
                  ) : null}
                  {fragmentRevealed && story.fragment ? (
                    <View className={`flash-dialogue__fragment flash-dialogue__fragment--${story.fragment.category}`}>
                      <Text className='flash-dialogue__fragment-label'>新故事碎片</Text>
                      <Text className='flash-dialogue__fragment-title'>{story.fragment.title}</Text>
                      <Text className='flash-dialogue__fragment-fact'>{story.fragment.fact}</Text>
                    </View>
                  ) : null}
                  {storySettled && story.closing ? <Text className='flash-dialogue__story-closing'>{story.closing}</Text> : null}
                  {storySettled ? <><Text className='flash-dialogue__story-progress'>本幕 {story.progress.completedInPhase}/{story.progress.totalInPhase} · 全季 {story.progress.completedTotal}/{story.progress.total}</Text><FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>{story.progress.completedTotal >= story.progress.total ? '收好这一季' : '收好碎片，继续寻找'}</FlashButton></> : null}
                </View>
              )}
            </View>
          ) : data.pendingDelivery ? (
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
              <FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>回到闪现</FlashButton>
            </View>
          )}

          {actionError ? <View className='flash-dialogue__error' role='alert'><Text>{actionError}</Text></View> : null}
        </View>
      </ScrollView>
    </View>
  )
}
