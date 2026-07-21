import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { FlashButton, FlashFeatureClosed, FlashNpcPortrait, FlashPageState } from '../../../components/alang/FlashUi'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import { resolveFlashTaskCategory } from '../../../lib/alang/flashNpcAssets'
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
  const [deliveryReply, setDeliveryReply] = useState<{ message: string; canContinue: boolean } | null>(null)

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: data?.npc?.name ? `和${data.npc.name}聊聊` : '角色对话' })
  }, [data?.npc?.name])

  useEffect(() => {
    if (!enabled || !data?.canonicalScreen || data.status === 'expired') return
    void redirectToFlashCanonical(data, MINI_PROGRAM_ROUTES.alangDialogue)
  }, [data, enabled])

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

  const deliver = async (assignmentId: string) => {
    if (!enabled || deliverMutation.isPending) return
    setActionError('')
    try {
      const response = await deliverMutation.mutateAsync({ encounterId, assignmentId })
      haptics('success')
      setDeliveryReply({
        message: response.deliveryMessage || `${response.npc.name}认真收好了你的回话。谢谢你真的替我去看了。`,
        canContinue: Boolean(response.currentQuestion),
      })
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
          description='回到街头盲盒页，可以从服务端保存的最新状态继续。'
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
          description={expired ? '解锁后的对话会保留 24 小时。现在可以回去看看有没有其他角色在线。' : '进度保存在服务端，重新读取不会从头开始。'}
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
  const category = offer ? resolveFlashTaskCategory(offer.category) : null

  return (
    <View className='flash-page flash-dialogue'>
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          <View className='flash-dialogue__host'>
            <FlashNpcPortrait npc={data.npc} size='large' />
            <Text className='flash-dialogue__name'>{data.npc.name}</Text>
            <Text className='flash-dialogue__animal'>{data.npc.animal ?? '数字动物角色'}</Text>
          </View>

          {deliveryReply ? (
            <View className='flash-dialogue__delivery-success' role='status'>
              <Text className='flash-dialogue__kicker'>这件事有了回音</Text>
              <Text className='flash-dialogue__bubble'>{deliveryReply.message}</Text>
              <FlashButton onClick={() => setDeliveryReply(null)}>
                {deliveryReply.canContinue ? '再聊两句' : '收好这次见面'}
              </FlashButton>
            </View>
          ) : data.pendingDelivery ? (
            <View className='flash-dialogue__delivery'>
              <Text className='flash-dialogue__kicker'>上次托你的事</Text>
              <Text className='flash-dialogue__delivery-title'>{data.pendingDelivery.taskTitle}</Text>
              <Text className='flash-dialogue__bubble'>你真的去过了？那先把这件事讲给我听吧。</Text>
              <FlashButton
                disabled={deliverMutation.isPending}
                onClick={() => { void deliver(data.pendingDelivery!.assignmentId) }}
              >
                {deliverMutation.isPending ? '正在交付…' : `交给${data.npc.name}`}
              </FlashButton>
            </View>
          ) : question ? (
            <View className='flash-dialogue__conversation'>
              <Text className='flash-dialogue__progress'>聊两句 · {question.position ?? (data.answeredQuestionCount ?? 0) + 1}/{question.total ?? 2}</Text>
              {data.openingLine ? <Text className='flash-dialogue__bubble'>{data.openingLine}</Text> : null}
              <Text className='flash-dialogue__question'>{question.text}</Text>
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
                    <Text>{option.label}</Text>
                  </View>
                ))}
              </View>
              <Text className='flash-dialogue__hint'>慢慢选，没有标准答案 ( ´ ▽ ` )</Text>
            </View>
          ) : offer && category ? (
            <View className='flash-dialogue__offer'>
              <Text className='flash-dialogue__kicker'>有件小事想拜托你</Text>
              <Text className='flash-dialogue__bubble'>{offer.invitation}</Text>
              <View className='flash-dialogue__offer-card'>
                <Text className='flash-dialogue__offer-category' style={{ color: category.text, backgroundColor: category.tint }}>
                  {category.label}
                </Text>
                <Text className='flash-dialogue__offer-title'>{offer.title}</Text>
                {offer.destinationName ? (
                  <Text className='flash-dialogue__offer-place'>{offer.districtName ? `${offer.districtName} · ` : ''}{offer.destinationName}</Text>
                ) : null}
                <Text className='flash-dialogue__offer-rule'>到附近点击到达即可；不要求消费，也不要求进店。</Text>
              </View>
              <View className='flash-dialogue__offer-actions'>
                <FlashButton disabled={offerMutation.isPending} onClick={() => { void respondToOffer(true) }}>
                  {offerMutation.isPending ? '正在收好任务…' : '好，我替你去看看'}
                </FlashButton>
                {data.canReroll && (data.rerollsRemaining ?? 1) > 0 ? (
                  <FlashButton variant='secondary' disabled={rerollMutation.isPending} onClick={() => { void reroll() }}>
                    {rerollMutation.isPending ? '正在想另一个…' : '换一件事'}
                  </FlashButton>
                ) : null}
                <FlashButton variant='quiet' disabled={offerMutation.isPending} onClick={() => { void respondToOffer(false) }}>
                  这次先不了
                </FlashButton>
              </View>
            </View>
          ) : (
            <View className='flash-dialogue__conversation'>
              <Text className='flash-dialogue__bubble'>{data.message || '今天先聊到这里吧，下次再碰见的时候再继续。'}</Text>
              <FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>回到街头盲盒</FlashButton>
            </View>
          )}

          {actionError ? <View className='flash-dialogue__error' role='alert'><Text>{actionError}</Text></View> : null}
          <Text className='flash-dialogue__safety'>对话已解锁后可以聊完，不会因为角色下线突然中断。</Text>
        </View>
      </ScrollView>
    </View>
  )
}
