import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, Textarea, View } from '@tarojs/components'
import { FlashButton, FlashFeatureClosed, FlashNpcPortrait, FlashNpcSceneBackdrop, FlashPageState } from '../../../components/alang/FlashUi'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import { getFlashApiErrorCode } from '../../../lib/alang/flashApi'
import { redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import { useFlashAssignment, useRetryFlashAssignment, useSubmitFlashFeedback } from '../../../lib/alang/useFlash'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import '../flash.scss'

export default function FlashFeedbackPage() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)
  const params = Taro.getCurrentInstance().router?.params ?? {}
  const assignmentId = params.assignmentId ?? ''
  const { data, isLoading, isError, refetch } = useFlashAssignment(assignmentId, enabled && !!assignmentId)
  const submitMutation = useSubmitFlashFeedback()
  const retryMutation = useRetryFlashAssignment()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [privateReply, setPrivateReply] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: '写下反馈' })
  }, [])

  useEffect(() => {
    if (!enabled || submitted || !data?.canonicalScreen || ['expired', 'withdrawn'].includes(data.status)) return
    void redirectToFlashCanonical(data, MINI_PROGRAM_ROUTES.alangResult)
  }, [data, enabled, submitted])

  const prompts = data?.feedbackQuestions ?? []
  const allAnswered = useMemo(
    () => prompts.length > 0 && prompts.every((prompt) => Boolean(answers[prompt.promptId ?? prompt.id])),
    [answers, prompts],
  )

  const handleSubmit = async () => {
    if (!enabled || !assignmentId || !allAnswered || submitMutation.isPending) return
    setSubmitError('')
    try {
      await submitMutation.mutateAsync({
        assignmentId,
        answers: prompts.map((prompt) => ({
          promptId: prompt.promptId ?? prompt.id,
          optionId: answers[prompt.promptId ?? prompt.id],
        })),
        privateReply,
      })
      haptics('success')
      setPrivateReply('')
      setAnswers({})
      setSubmitted(true)
    } catch (error) {
      const code = getFlashApiErrorCode(error)
      if (code === 'FLASH_TASK_EXPIRED' || code === 'FLASH_DESTINATION_WITHDRAWN') {
        await refetch()
        return
      }
      setSubmitError(code === 'FLASH_INVALID_TASK_STATE'
        ? '任务状态刚刚变化了，重新读取后再确认一次。'
        : '反馈没有送到，内容还留在这里，可以再试一次。')
    }
  }

  const handleRetryTask = async () => {
    if (!assignmentId || retryMutation.isPending) return
    const modal = await Taro.showModal({
      title: '从头复测这个任务？',
      content: '会清除本轮到达和反馈进度，并回到任务起点。',
      confirmText: '从头复测',
      cancelText: '继续当前进度',
      confirmColor: '#8B5CF6',
    })
    if (!modal.confirm) return
    try {
      await retryMutation.mutateAsync(assignmentId)
      setAnswers({})
      setPrivateReply('')
      setSubmitted(false)
      await Taro.redirectTo({
        url: `${MINI_PROGRAM_ROUTES.alangCompanion}?assignmentId=${encodeURIComponent(assignmentId)}`,
      })
    } catch {
      Taro.showToast({ title: '复测没有启动，请确认后台开关仍开启', icon: 'none' })
    }
  }

  if (!enabled) return <FlashFeatureClosed />

  if (!assignmentId) {
    return (
      <View className='flash-page'>
        <FlashPageState title='这条旧反馈链接已经失效' description='回到街头盲盒页，会从服务端保存的任务状态继续。' action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }} actionLabel='返回街头盲盒' />
      </View>
    )
  }

  if (isError) {
    return (
      <View className='flash-page'>
        <FlashPageState tone='error' title='反馈页暂时没打开' description='到达状态已经保存，不用重新跑一趟。' action={() => { void refetch() }} actionLabel='重新读取' />
      </View>
    )
  }

  if (isLoading || !data) {
    return <View className='flash-page'><FlashPageState title='正在收好这次到达…' /></View>
  }

  if (data.status === 'expired' || data.status === 'withdrawn') {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='这项任务已经结束了'
          description='可能已经超过 7 天，或任务地点被安全撤下；不会有惩罚。'
          action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}
          actionLabel='返回街头盲盒'
        />
      </View>
    )
  }

  const alreadyReady = data.status === 'ready_to_deliver' || Boolean(data.feedbackSubmittedAt)
  if (submitted || alreadyReady) {
    return (
      <View className='flash-page flash-feedback-success'>
        <View className='flash-feedback-success__content'>
          <FlashNpcPortrait npc={data.npc} size='large' />
          <Text className='flash-feedback-success__title'>这件事，先替你收好了</Text>
          <Text className='flash-feedback-success__copy'>
            下次再遇见 {data.npc.name}，对话会先让你交付这项任务。角色今天下线也没关系。
          </Text>
          <View className='flash-feedback-success__actions'>
            {user?.features?.flashTaskRetryTestEnabled ? (
              <FlashButton variant='secondary' disabled={retryMutation.isPending} onClick={() => { void handleRetryTask() }}>
                {retryMutation.isPending ? '正在重置…' : '从头复测本任务'}
              </FlashButton>
            ) : null}
            <FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>回到街头盲盒</FlashButton>
          </View>
          <Text className='flash-feedback-success__note'>没有积分或奖品；这段经历会让下次见面更完整。</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='flash-page flash-feedback'>
      <FlashNpcSceneBackdrop scene='feedback' />
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          <View className='flash-feedback__hero'>
            <FlashNpcPortrait npc={data.npc} />
            <View className='flash-feedback__hero-copy'>
              <Text className='flash-feedback__eyebrow'>已经到达</Text>
              <Text className='flash-feedback__title'>给 {data.npc.name} 留点真实感受</Text>
            </View>
          </View>

          <View className='flash-feedback__form'>
            {prompts.map((prompt, index) => {
              const key = prompt.promptId ?? prompt.id
              return (
                <View key={key} className='flash-feedback__prompt'>
                  <Text className='flash-feedback__prompt-number'>0{index + 1}</Text>
                  <Text className='flash-feedback__prompt-title'>{prompt.prompt}</Text>
                  <View className='flash-feedback__options'>
                    {prompt.options.map((option) => {
                      const selected = answers[key] === option.id
                      return (
                        <View
                          key={option.id}
                          className={`flash-feedback__option${selected ? ' flash-feedback__option--selected' : ''}`}
                          hoverClass='flash-feedback__option--pressed'
                          onClick={() => setAnswers((current) => ({ ...current, [key]: option.id }))}
                          role='button'
                          aria-label={option.label}
                          aria-pressed={selected}
                        >
                          <Text>{option.label}</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )
            })}

            <View className='flash-feedback__reply'>
              <View className='flash-feedback__reply-head'>
                <Text className='flash-feedback__reply-title'>想单独回他一句吗？</Text>
                <Text className='flash-feedback__reply-count'>{privateReply.length}/100</Text>
              </View>
              <Textarea
                className='flash-feedback__textarea'
                value={privateReply}
                maxlength={100}
                placeholder='可不填。说说你看见了什么，或当时是什么感觉。'
                onInput={(event) => setPrivateReply(event.detail.value.slice(0, 100))}
                aria-label='给角色的私密回信，最多100字'
              />
              <Text className='flash-visually-hidden'>回信不用于用户画像、数据分析、个人故事或模型训练；交付后 30 天删除。</Text>
            </View>
          </View>

          {prompts.length === 0 ? (
            <View className='flash-feedback__error' role='alert'>反馈题还没准备好，请稍后重新读取。</View>
          ) : null}
          {submitError ? <View className='flash-feedback__error' role='alert'><Text>{submitError}</Text></View> : null}

          <View className='flash-feedback__actions'>
            <FlashButton disabled={!allAnswered || submitMutation.isPending} onClick={() => { void handleSubmit() }}>
              {submitMutation.isPending ? '正在收好…' : '保存，等下次交付'}
            </FlashButton>
            {user?.features?.flashTaskRetryTestEnabled ? (
              <FlashButton variant='secondary' disabled={retryMutation.isPending} onClick={() => { void handleRetryTask() }}>
                {retryMutation.isPending ? '正在重置…' : '从头复测本任务'}
              </FlashButton>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
