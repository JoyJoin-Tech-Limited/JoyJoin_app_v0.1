import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
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
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
import { haptics } from '../../../lib/utils/haptics'
import '../flash.scss'

type OfferRevealPhase = 'sealed' | 'drawing' | 'revealed'

interface NpcBlindBoxCopy {
  intro: string
  draw: string
  drawing: string
  reveal: string
  accept: string
  reroll: string
  flashes: [string, string, string]
}

const NPC_BLIND_BOX_COPY: Record<string, NpcBlindBoxCopy> = {
  alang: {
    intro: '你今天像是把同一天过了很多遍。给我一下，你不用选，我替你换个今晚。',
    draw: '让阿浪替我抽',
    drawing: '阿浪正在替你换个今晚',
    reveal: '阿浪替你抽到了',
    accept: '收下这个今晚',
    reroll: '再信你一次',
    flashes: ['今晚别那么懂事', '把今天抢回来', '允许计划之外发生'],
  },
  lizi: {
    intro: '今天先别照旧过。你不用挑，我替你拆一件能让日子亮一点的事。',
    draw: '让栗子替我拆',
    drawing: '栗子正在翻找今天的小惊喜',
    reveal: '栗子替你拆到了',
    accept: '把这份惊喜收好',
    reroll: '再拆最后一次',
    flashes: ['给今天加一点甜', '去碰见一点开心', '让普通日子亮起来'],
  },
  momo: {
    intro: '你不用想一个正确答案。让我替你留一小段，只属于今天的安静。',
    draw: '让默默替我抽',
    drawing: '默默正在替你留一小段时间',
    reveal: '默默替你留下了',
    accept: '把这段时间收下',
    reroll: '再听你一次',
    flashes: ['不用向谁解释', '把声音调小一点', '给自己留一点空白'],
  },
  shiqi: {
    intro: '今天的剧情有点太好猜了。别选，让我从计划外替你抽一条支线。',
    draw: '让拾柒替我抽',
    drawing: '拾柒正在改写今天的支线',
    reveal: '拾柒替你翻到了',
    accept: '接住这条支线',
    reroll: '再偏航一次',
    flashes: ['从计划外开始', '换一种剧情', '给偶然留个位置'],
  },
  atuan: {
    intro: '今天还没有坏掉。你先别费力想怎么办，我替你抽一件能把它救回来一点的事。',
    draw: '让阿团替我抽',
    drawing: '阿团正在替你把今天接住',
    reveal: '阿团替你抽到了',
    accept: '今天就从这里开始',
    reroll: '再轻一点',
    flashes: ['先照顾好自己', '让今天暖回来', '不用一下子变好'],
  },
}

const DEFAULT_BLIND_BOX_COPY: NpcBlindBoxCopy = {
  intro: '今天不用什么都自己决定。让我替你从城市里抽一件值得期待的事。',
  draw: '让它替我抽',
  drawing: '正在替你打开今天的盲盒',
  reveal: '今天替你抽到了',
  accept: '收下这件事',
  reroll: '再信一次',
  flashes: ['换一种过法', '去见一点新鲜的', '让今天有点不一样'],
}

const OFFER_REVEAL_DELAY_MS = 480
const NPC_DIALOGUE_SCENES: Record<string, string> = {
  alang: '/pages/alang/assets/ui/flash-alang-dialogue-paper-v1.jpg',
  lizi: '/pages/alang/assets/ui/flash-lizi-dialogue-paper-v1.jpg',
  momo: '/pages/alang/assets/ui/flash-momo-dialogue-paper-v1.jpg',
  shiqi: '/pages/alang/assets/ui/flash-shiqi-dialogue-paper-v1.jpg',
  atuan: '/pages/alang/assets/ui/flash-atuan-dialogue-paper-v1.jpg',
}

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
  const [reducedMotion] = useState(() => getSystemReducedMotion())
  const [offerReveal, setOfferReveal] = useState<{ templateId: string; phase: OfferRevealPhase } | null>(null)
  const offerRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearOfferRevealTimer = () => {
    if (!offerRevealTimer.current) return
    clearTimeout(offerRevealTimer.current)
    offerRevealTimer.current = null
  }

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: data?.npc?.name ? `和${data.npc.name}聊聊` : '角色对话' })
  }, [data?.npc?.name])

  useEffect(() => {
    if (!enabled || !data?.canonicalScreen || data.status === 'expired') return
    void redirectToFlashCanonical(data, MINI_PROGRAM_ROUTES.alangDialogue)
  }, [data, enabled])

  useEffect(() => () => clearOfferRevealTimer(), [])

  useEffect(() => {
    const templateId = data?.taskOffer?.templateId
    clearOfferRevealTimer()
    setOfferReveal(templateId ? { templateId, phase: 'sealed' } : null)
  }, [data?.taskOffer?.templateId])

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
      const response = await deliverMutation.mutateAsync({
        encounterId,
        assignmentId,
        ...(answers ? { answers } : {}),
      })
      haptics('success')
      setDeliveryReply({
        message: response.deliveryMessage || '好，我记住了。下次碰见，我们再接着聊。',
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
    clearOfferRevealTimer()
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

  const revealOffer = (templateId: string) => {
    if (offerReveal?.templateId === templateId && offerReveal.phase !== 'sealed') return
    clearOfferRevealTimer()
    setActionError('')
    haptics('light')
    setOfferReveal({ templateId, phase: 'drawing' })

    const finishReveal = () => {
      offerRevealTimer.current = null
      setOfferReveal({ templateId, phase: 'revealed' })
      haptics('success')
    }

    if (reducedMotion) {
      finishReveal()
      return
    }
    offerRevealTimer.current = setTimeout(finishReveal, OFFER_REVEAL_DELAY_MS)
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
  const category = offer ? resolveFlashTaskCategory(offer.category) : null
  const offerCopy = NPC_BLIND_BOX_COPY[data.npc.slug] ?? DEFAULT_BLIND_BOX_COPY
  const offerPhase: OfferRevealPhase = offer && offerReveal?.templateId === offer.templateId
    ? offerReveal.phase
    : 'sealed'
  const dialogueScene = NPC_DIALOGUE_SCENES[data.npc.slug]
  const usesNarrativeScene = Boolean(dialogueScene)

  return (
    <View className={`flash-page flash-dialogue${usesNarrativeScene ? ' flash-dialogue--scene' : ''}`}>
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          {usesNarrativeScene ? (
            <View className='flash-dialogue__scene'>
              <Image className='flash-dialogue__scene-art' src={dialogueScene} mode='aspectFill' />
              <View className='flash-dialogue__scene-shade' />
              <View className='flash-dialogue__scene-head'>
                <Text className='flash-dialogue__chapter-index'>ENCOUNTER</Text>
                <View className='flash-dialogue__chapter-line' />
                <Text className='flash-dialogue__chapter-state'>故事进行中</Text>
              </View>
              <View className='flash-dialogue__scene-nameplate'>
                <Text className='flash-dialogue__scene-name'>{data.npc.name}</Text>
                <Text className='flash-dialogue__scene-role'>{data.npc.animal ?? '数字动物角色'} · 城市旅人</Text>
              </View>
            </View>
          ) : (
            <>
              <View className='flash-dialogue__chapter'>
                <Text className='flash-dialogue__chapter-index'>ENCOUNTER</Text>
                <View className='flash-dialogue__chapter-line' />
                <Text className='flash-dialogue__chapter-state'>故事进行中</Text>
              </View>
              <View className='flash-dialogue__host'>
                <View className='flash-dialogue__host-halo' />
                <FlashNpcPortrait npc={data.npc} size='large' />
                <View className='flash-dialogue__nameplate'>
                  <Text className='flash-dialogue__name'>{data.npc.name}</Text>
                  <Text className='flash-dialogue__animal'>{data.npc.animal ?? '数字动物角色'} · 城市旅人</Text>
                </View>
              </View>
            </>
          )}

          {deliveryReply ? (
            <View className='flash-dialogue__delivery-success' role='status'>
              <Text className='flash-dialogue__kicker'>STORY UPDATED · 这件事有了回音</Text>
              <Text className='flash-dialogue__bubble'>{deliveryReply.message}</Text>
              <FlashButton onClick={() => setDeliveryReply(null)}>
                {deliveryReply.canContinue ? '再聊两句' : '收好这次见面'}
              </FlashButton>
            </View>
          ) : data.pendingDelivery ? (
            <View className='flash-dialogue__delivery'>
              <Text className='flash-dialogue__kicker'>
                {data.pendingDelivery.invitationType === 'npc_message'
                  ? '有句话到了这里'
                  : data.pendingDelivery.invitationType === 'life_invitation'
                    ? '前阵子聊的那件事'
                    : '上次托你的事'}
              </Text>
              <Text className='flash-dialogue__delivery-title'>{data.pendingDelivery.taskTitle}</Text>
              <Text className='flash-dialogue__bubble'>
                {data.pendingDelivery.feedbackQuestions?.[0]?.prompt
                  ?? (data.pendingDelivery.invitationType ? '后来怎么样了？' : '你真的去过了？那先把这件事讲给我听吧。')}
              </Text>
              {data.pendingDelivery.feedbackQuestions?.[0] ? (
                <View className='flash-dialogue__choices'>
                  <View className='flash-dialogue__choices-heading' aria-hidden='true'>
                    <Text className='flash-dialogue__choices-spark flash-dialogue__choices-spark--purple'>✦</Text>
                    <Text className='flash-dialogue__choices-title'>选择你的回应</Text>
                    <Text className='flash-dialogue__choices-spark flash-dialogue__choices-spark--coral'>✦</Text>
                  </View>
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
                      <Text className='flash-dialogue__choice-spark flash-dialogue__choice-spark--purple' aria-hidden='true'>✦</Text>
                      <Text className='flash-dialogue__choice-label'>{option.label}</Text>
                      <Text className='flash-dialogue__choice-spark flash-dialogue__choice-spark--coral' aria-hidden='true'>✦</Text>
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
            <View className='flash-dialogue__conversation'>
              <View className='flash-dialogue__progress-row'>
                <Text className='flash-dialogue__progress'>DIALOGUE · {question.position ?? (data.answeredQuestionCount ?? 0) + 1}/{question.total ?? 2}</Text>
                <View className='flash-dialogue__progress-track'>
                  <View
                    className='flash-dialogue__progress-fill'
                    style={{ width: `${Math.min(100, ((question.position ?? (data.answeredQuestionCount ?? 0) + 1) / (question.total ?? 2)) * 100)}%` }}
                  />
                </View>
              </View>
              {data.openingLine ? <Text className='flash-dialogue__bubble'>{data.openingLine}</Text> : null}
              <Text className='flash-dialogue__question'>{question.text}</Text>
              <View className='flash-dialogue__choices'>
                <View className='flash-dialogue__choices-heading' aria-hidden='true'>
                  <Text className='flash-dialogue__choices-spark flash-dialogue__choices-spark--purple'>✦</Text>
                  <Text className='flash-dialogue__choices-title'>选择你的回应</Text>
                  <Text className='flash-dialogue__choices-spark flash-dialogue__choices-spark--coral'>✦</Text>
                </View>
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
                    <Text className='flash-dialogue__choice-spark flash-dialogue__choice-spark--purple' aria-hidden='true'>✦</Text>
                    <Text className='flash-dialogue__choice-label'>{option.label}</Text>
                    <Text className='flash-dialogue__choice-spark flash-dialogue__choice-spark--coral' aria-hidden='true'>✦</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : offer && category ? (
            <View className='flash-dialogue__offer'>
              {offerPhase === 'sealed' ? (
                <View className='flash-dialogue__blind-box flash-dialogue__blind-box--sealed'>
                  <View className='flash-dialogue__kicker-row'>
                    <Text className='flash-dialogue__kicker'>MYSTERY QUEST</Text>
                    <Text className='flash-dialogue__kicker-copy'>这次不让你选</Text>
                  </View>
                  <Text className='flash-dialogue__blind-box-intro'>{offerCopy.intro}</Text>
                  <View className='flash-dialogue__blind-box-visual' aria-hidden='true'>
                    <View className='flash-dialogue__blind-box-ray flash-dialogue__blind-box-ray--one' />
                    <View className='flash-dialogue__blind-box-ray flash-dialogue__blind-box-ray--two' />
                    <View className='flash-dialogue__blind-box-lid' />
                    <View className='flash-dialogue__blind-box-body'>
                      <Text className='flash-dialogue__blind-box-mark'>?</Text>
                    </View>
                  </View>
                  <FlashButton
                    ariaLabel={offerCopy.draw}
                    onClick={() => revealOffer(offer.templateId)}
                  >
                    {offerCopy.draw}
                  </FlashButton>
                  <Text className='flash-dialogue__blind-box-note'>这一件已经替你选好了，打开前不会偷偷换答案。</Text>
                </View>
              ) : offerPhase === 'drawing' ? (
                <View className='flash-dialogue__blind-box flash-dialogue__blind-box--drawing' role='status'>
                  <Text className='flash-dialogue__kicker'>正在打开城市盲盒</Text>
                  <Text className='flash-dialogue__blind-box-drawing-title'>{offerCopy.drawing}</Text>
                  <View className='flash-dialogue__blind-box-reel' aria-hidden='true'>
                    <View className='flash-dialogue__blind-box-reel-track'>
                      {offerCopy.flashes.map((line) => (
                        <Text key={line} className='flash-dialogue__blind-box-reel-line'>{line}</Text>
                      ))}
                    </View>
                  </View>
                  <View className='flash-dialogue__blind-box-pulse' aria-hidden='true'>
                    <View className='flash-dialogue__blind-box-pulse-core' />
                  </View>
                </View>
              ) : (
                <View className='flash-dialogue__blind-box flash-dialogue__blind-box--revealed' role='status'>
                  <Text className='flash-dialogue__kicker'>{offerCopy.reveal}</Text>
                  <Text className='flash-dialogue__bubble'>{offer.invitation}</Text>
                  <View className='flash-dialogue__offer-card'>
                    <Text className='flash-dialogue__offer-category' style={{ color: category.text, backgroundColor: category.tint }}>
                      {category.label}
                    </Text>
                    <Text className='flash-dialogue__offer-title'>{offer.title}</Text>
                    {offer.destinationName ? (
                      <Text className='flash-dialogue__offer-place'>{offer.districtName ? `${offer.districtName} · ` : ''}{offer.destinationName}</Text>
                    ) : null}
                    <Text className='flash-dialogue__offer-rule'>
                      {offer.invitationType === 'npc_message'
                        ? `以后遇见${offer.followUpTargetNpc?.name ?? '它'}时再决定要不要说；忘了也没关系。`
                        : offer.invitationType === 'life_invitation'
                          ? '如果现在来得及，就从今天开始。下次再碰见，它会记得听你讲后来。'
                          : '到附近点击到达即可；不要求消费，也不要求进店。'}
                    </Text>
                  </View>
                  <View className='flash-dialogue__offer-actions'>
                    <FlashButton
                      disabled={offerMutation.isPending || rerollMutation.isPending}
                      onClick={() => { void respondToOffer(true) }}
                    >
                      {offerMutation.isPending ? '正在替你收好…' : offerCopy.accept}
                    </FlashButton>
                    {data.canReroll && (data.rerollsRemaining ?? 1) > 0 ? (
                      <FlashButton
                        variant='secondary'
                        disabled={offerMutation.isPending || rerollMutation.isPending}
                        onClick={() => { void reroll() }}
                      >
                        {rerollMutation.isPending ? '正在重新抽取…' : offerCopy.reroll}
                      </FlashButton>
                    ) : null}
                    <FlashButton
                      variant='quiet'
                      disabled={offerMutation.isPending || rerollMutation.isPending}
                      onClick={() => { void respondToOffer(false) }}
                    >
                      这次真的不合适
                    </FlashButton>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View className='flash-dialogue__conversation'>
              <Text className='flash-dialogue__bubble'>{data.message || '今天先聊到这里吧，下次再碰见的时候再继续。'}</Text>
              <FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>回到闪现</FlashButton>
            </View>
          )}

          {actionError ? <View className='flash-dialogue__error' role='alert'><Text>{actionError}</Text></View> : null}
        </View>
      </ScrollView>
    </View>
  )
}
