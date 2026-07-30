import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { FlashButton, FlashFeatureClosed, FlashNpcPortrait, FlashNpcSceneBackdrop, FlashPageState, formatFlashDueDate } from '../../../components/alang/FlashUi'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import { getFlashApiErrorCode, getFlashLocationPermission, getOneShotFlashLocation } from '../../../lib/alang/flashApi'
import { resolveFlashTaskCategory } from '../../../lib/alang/flashNpcAssets'
import { redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import { useAbandonFlashAssignment, useArriveAtFlashAssignment, useFlashAssignment } from '../../../lib/alang/useFlash'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import { COLOR_DANGER } from '../../../lib/utils/uiConstants'
import '../flash.scss'

type ArrivalState = 'idle' | 'locating' | 'outside' | 'denied' | 'error'

export default function FlashTaskPage() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)
  const params = Taro.getCurrentInstance().router?.params ?? {}
  const assignmentId = params.assignmentId ?? ''
  const { data, isLoading, isError, error, refetch } = useFlashAssignment(assignmentId, enabled && !!assignmentId)
  const arriveMutation = useArriveAtFlashAssignment()
  const abandonMutation = useAbandonFlashAssignment()
  const [arrivalState, setArrivalState] = useState<ArrivalState>('idle')
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: '任务详情' })
  }, [])

  useDidShow(() => {
    if (assignmentId) void refetch()
  })

  useEffect(() => {
    if (!enabled || !data?.canonicalScreen || ['expired', 'withdrawn'].includes(data.status)) return
    void redirectToFlashCanonical(data, MINI_PROGRAM_ROUTES.alangCompanion)
  }, [data, enabled])

  const handleArrival = async () => {
    if (!enabled || !assignmentId || arriveMutation.isPending) return
    setArrivalState('locating')
    setDistanceMeters(null)
    try {
      const location = await getOneShotFlashLocation()
      const response = await arriveMutation.mutateAsync({ assignmentId, location })
      setDistanceMeters(typeof response.distanceMeters === 'number' ? response.distanceMeters : null)
      if (response.withinRange) {
        haptics('success')
        const redirected = await redirectToFlashCanonical(response, MINI_PROGRAM_ROUTES.alangCompanion)
        if (!redirected) {
          await Taro.redirectTo({
            url: `${MINI_PROGRAM_ROUTES.alangResult}?assignmentId=${encodeURIComponent(assignmentId)}`,
          })
        }
        return
      }
      setArrivalState('outside')
    } catch (arrivalError) {
      const code = getFlashApiErrorCode(arrivalError)
      if (code === 'FLASH_TASK_EXPIRED' || code === 'FLASH_ASSIGNMENT_EXPIRED' || code === 'FLASH_DESTINATION_WITHDRAWN' || code === 'EXPIRED' || code === 'WITHDRAWN') {
        await refetch()
        return
      }
      const permission = await getFlashLocationPermission()
      setArrivalState(permission === 'denied' ? 'denied' : 'error')
    }
  }

  const handleOpenSetting = async () => {
    try {
      const setting = await Taro.openSetting()
      setArrivalState(setting.authSetting?.['scope.userLocation'] === true ? 'idle' : 'denied')
    } catch {
      Taro.showToast({ title: '设置没有打开，请稍后再试', icon: 'none' })
    }
  }

  const handleAbandon = async () => {
    if (!enabled || !assignmentId || abandonMutation.isPending) return
    const modal = await Taro.showModal({
      title: '不继续这个任务了吗？',
      content: '放下后任务会从列表消失，不会有惩罚，也不会影响以后遇见这个角色。',
      confirmText: '放下任务',
      cancelText: '再想想',
      confirmColor: COLOR_DANGER,
    })
    if (!modal.confirm) return
    try {
      await abandonMutation.mutateAsync(assignmentId)
      await Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent })
    } catch {
      Taro.showToast({ title: '没有放下成功，任务还在', icon: 'none' })
    }
  }

  const handleOpenDestination = async () => {
    if (!data) return
    const latitude = data.destination?.latitude ?? data.destinationLatitude
    const longitude = data.destination?.longitude ?? data.destinationLongitude
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return
    try {
      await Taro.openLocation({
        latitude,
        longitude,
        name: data.destinationName || '任务地点',
        address: data.destinationAddress || data.districtName || '',
        scale: 16,
      })
    } catch {
      Taro.showToast({ title: '地图没有打开，请稍后再试', icon: 'none' })
    }
  }

  if (!enabled) return <FlashFeatureClosed />

  if (!assignmentId) {
    return (
      <View className='flash-page'>
        <FlashPageState title='这条旧任务链接已经失效' description='回到街头盲盒页，会显示服务端保存的当前任务。' action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }} actionLabel='返回街头盲盒' />
      </View>
    )
  }

  if (isError) {
    const code = getFlashApiErrorCode(error)
    const unavailable = code === 'FLASH_ASSIGNMENT_EXPIRED'
      || code === 'FLASH_TASK_EXPIRED'
      || code === 'FLASH_DESTINATION_WITHDRAWN'
      || code === 'EXPIRED'
      || code === 'WITHDRAWN'
    return (
      <View className='flash-page'>
        <FlashPageState
          tone={unavailable ? 'plain' : 'error'}
          title={unavailable ? '这个任务已经不能继续了' : '任务暂时没打开'}
          description={unavailable ? '可能已经超过 7 天，或地点因安全与运营原因被撤下。任务会从列表消失，也不会有惩罚。' : '任务仍保存在服务端，重新读取不会丢失。'}
          action={unavailable ? () => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) } : () => { void refetch() }}
          actionLabel={unavailable ? '返回街头盲盒' : '重新读取'}
        />
      </View>
    )
  }

  if (isLoading || !data) {
    return <View className='flash-page'><FlashPageState title='正在展开任务纸条…' /></View>
  }

  if (data.status === 'expired' || data.status === 'withdrawn') {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='这个任务已经不能继续了'
          description={data.status === 'expired'
            ? '任务已经超过 7 天，会从列表自然消失，也不会有任何惩罚。'
            : '地点因安全或运营原因被撤下了。任务会从列表消失，不会影响以后遇见这个角色。'}
          action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}
          actionLabel='返回街头盲盒'
        />
      </View>
    )
  }

  const category = resolveFlashTaskCategory(data.category)
  const readyToDeliver = data.status === 'ready_to_deliver'
  const isInvitation = data.invitationType === 'life_invitation' || data.invitationType === 'npc_message'

  return (
    <View className='flash-page flash-task'>
      <FlashNpcSceneBackdrop scene='task' />
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          <View className='flash-task__chapter'>
            <Text className='flash-task__chapter-label'>QUEST LOG</Text>
            <Text className='flash-task__chapter-count'>支线任务 · 已收藏</Text>
          </View>
          <View className='flash-task__sender'>
            <FlashNpcPortrait npc={data.npc} />
            <View className='flash-task__sender-copy'>
              <Text className='flash-task__sender-label'>{data.npc.name}托你的事</Text>
              <Text className='flash-task__due'>{readyToDeliver ? '等下次见面交付' : formatFlashDueDate(data.dueAt)}</Text>
            </View>
          </View>

          <View className='flash-task__paper'>
            <View className='flash-task__paper-binding'>
              <View /><View /><View />
            </View>
            <Text className='flash-task__category' style={{ color: category.text, backgroundColor: category.tint }}>{category.label}</Text>
            <Text className='flash-task__title'>{data.title}</Text>

            {!isInvitation ? <View className='flash-task__place'>
              <Text className='flash-task__place-label'>要去的地方</Text>
              <Text className='flash-task__place-name'>{data.destinationName || '任务地点'}</Text>
              <Text className='flash-task__place-address'>
                {[data.districtName, data.destinationAddress].filter(Boolean).join(' · ') || '到达附近后会由服务端确认'}
              </Text>
              {(data.destination
                || (typeof data.destinationLatitude === 'number' && typeof data.destinationLongitude === 'number')) ? (
                <View
                  className='flash-task__place-map'
                  onClick={() => { void handleOpenDestination() }}
                  role='button'
                  aria-label={`在地图中查看${data.destinationName || '任务地点'}`}
                >
                  <Text>在地图中查看</Text>
                </View>
              ) : null}
            </View> : null}

          </View>

          {isInvitation ? (
            <View className='flash-task__ready' role='status'>
              <Text className='flash-task__ready-kicker'>NEXT ENCOUNTER</Text>
              <Text className='flash-task__ready-title'>这件小事先替你留着</Text>
              <Text className='flash-task__ready-copy'>
                {data.invitationType === 'npc_message'
                  ? `以后真正遇见 ${data.followUpTargetNpc?.name ?? '指定角色'} 时，它会问你要不要把话带到。`
                  : `以后再次遇见 ${data.npc.name}，它会问你后来怎么样了。现在不需要填写反馈。`}
              </Text>
              <FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>看看谁在线</FlashButton>
              <FlashButton variant='quiet' disabled={abandonMutation.isPending} onClick={() => { void handleAbandon() }}>
                {abandonMutation.isPending ? '正在放下…' : '不再保留这个邀请'}
              </FlashButton>
            </View>
          ) : readyToDeliver ? (
            <View className='flash-task__ready' role='status'>
              <Text className='flash-task__ready-title'>这件事已经做好了</Text>
              <Text className='flash-task__ready-copy'>先把它留在任务里。下次遇见 {data.npc.name}，对话会优先让你交付。</Text>
              <FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>看看谁在线</FlashButton>
              <FlashButton variant='quiet' disabled={abandonMutation.isPending} onClick={() => { void handleAbandon() }}>
                {abandonMutation.isPending ? '正在放下…' : '不再保留这个任务'}
              </FlashButton>
            </View>
          ) : (
            <>
              {arrivalState === 'outside' ? (
                <View className='flash-task__arrival-state' role='status'>
                  <Text className='flash-task__arrival-title'>还没到任务地点附近</Text>
                  <Text className='flash-task__arrival-copy'>
                    {distanceMeters !== null ? `现在大约相距 ${Math.max(51, Math.round(distanceMeters))} 米。` : '再走近一点后可以重新确认。'}
                    进不进去都由你决定。
                  </Text>
                </View>
              ) : null}
              {arrivalState === 'denied' ? (
                <View className='flash-task__arrival-state flash-task__arrival-state--error' role='alert'>
                  <Text className='flash-task__arrival-title'>定位权限没有打开</Text>
                  <Text className='flash-task__arrival-copy'>需要定位才能判断是否到达；我们不会使用 IP 代替。</Text>
                  <FlashButton variant='secondary' onClick={() => { void handleOpenSetting() }}>打开定位设置</FlashButton>
                </View>
              ) : null}
              {arrivalState === 'error' ? (
                <View className='flash-task__arrival-state flash-task__arrival-state--error' role='alert'>
                  <Text className='flash-task__arrival-title'>这次没有确认成功</Text>
                  <Text className='flash-task__arrival-copy'>定位信号或网络可能暂时不稳定，任务进度没有改变。</Text>
                </View>
              ) : null}
              <View className='flash-task__actions'>
                <FlashButton disabled={arriveMutation.isPending || arrivalState === 'locating'} onClick={() => { void handleArrival() }}>
                  {arriveMutation.isPending || arrivalState === 'locating' ? '正在确认这一次位置…' : '我已到达'}
                </FlashButton>
                <FlashButton variant='quiet' disabled={abandonMutation.isPending} onClick={() => { void handleAbandon() }}>
                  {abandonMutation.isPending ? '正在放下…' : '放下这个任务'}
                </FlashButton>
              </View>
            </>
          )}

        </View>
      </ScrollView>
    </View>
  )
}
