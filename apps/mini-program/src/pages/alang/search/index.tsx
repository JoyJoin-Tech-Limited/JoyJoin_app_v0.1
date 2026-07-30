import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { FlashButton, FlashFeatureClosed, FlashPageState, formatFlashRemainingTime } from '../../../components/alang/FlashUi'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import { getFlashApiErrorCode, getFlashLocationPermission, getOneShotFlashLocation } from '../../../lib/alang/flashApi'
import { decodeFlashRouteParam, redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import { useLocateFlashAppearance } from '../../../lib/alang/useFlash'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import '../flash.scss'

type LocateState = 'idle' | 'locating' | 'outside' | 'denied' | 'ended' | 'rate_limited' | 'error'

export default function FlashRadarPage() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)
  const params = Taro.getCurrentInstance().router?.params ?? {}
  const appearanceId = decodeFlashRouteParam(params.appearanceId)
  const npcName = decodeFlashRouteParam(params.npcName, '这位朋友')
  const districtName = decodeFlashRouteParam(params.districtName, '深圳')
  const locationAddress = decodeFlashRouteParam(params.locationAddress)
  const endsAt = decodeFlashRouteParam(params.endsAt)
  const locateMutation = useLocateFlashAppearance()
  const [state, setState] = useState<LocateState>('idle')

  const isPossiblyLate = useMemo(() => {
    if (!endsAt) return false
    const remaining = new Date(endsAt).getTime() - Date.now()
    return Number.isFinite(remaining) && remaining > 0 && remaining <= 15 * 60 * 1000
  }, [endsAt])

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: `寻找${npcName}` })
  }, [npcName])

  const handleLocate = async () => {
    if (!enabled || !appearanceId || locateMutation.isPending) return
    setState('locating')
    try {
      const location = await getOneShotFlashLocation()
      const response = await locateMutation.mutateAsync({ appearanceId, location })
      if (response.canonicalScreen === 'unavailable') {
        setState('ended')
        return
      }
      if (response.withinRange) {
        haptics('success')
        const redirected = await redirectToFlashCanonical(response, MINI_PROGRAM_ROUTES.alangSearch)
        if (!redirected && response.encounterId) {
          await Taro.redirectTo({
            url: `${MINI_PROGRAM_ROUTES.alangDialogue}?encounterId=${encodeURIComponent(response.encounterId)}`,
          })
        }
        return
      }
      setState('outside')
    } catch (error) {
      const code = getFlashApiErrorCode(error)
      if (code === 'FLASH_APPEARANCE_ENDED' || code === 'FLASH_APPEARANCE_NOT_FOUND' || code === 'NOT_FOUND') {
        setState('ended')
        return
      }
      if (code === 'FLASH_LOCATE_RATE_LIMITED') {
        setState('rate_limited')
        return
      }
      const permission = await getFlashLocationPermission()
      setState(permission === 'denied' ? 'denied' : 'error')
    }
  }

  const handleOpenSetting = async () => {
    try {
      const setting = await Taro.openSetting()
      if (setting.authSetting?.['scope.userLocation'] === true) {
        setState('idle')
      } else {
        setState('denied')
      }
    } catch {
      Taro.showToast({ title: '设置没有打开，请稍后再试', icon: 'none' })
    }
  }

  if (!enabled) return <FlashFeatureClosed />

  if (!appearanceId) {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='这次街头盲盒已经散场了'
          description='入口信息不完整，回到街头盲盒页看看还有谁在线。'
          action={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}
          actionLabel='返回街头盲盒'
        />
      </View>
    )
  }

  return (
    <View className='flash-page flash-radar'>
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content flash-radar__content'>
          <View className='flash-radar__clue'>
            <Text className='flash-radar__clue-kicker'>ENCOUNTER SEARCH</Text>
            <Text className='flash-radar__clue-title'>今晚，去碰个运气</Text>
            <Text className='flash-radar__clue-meta'>{npcName}在{districtName} · {formatFlashRemainingTime(undefined, endsAt)}</Text>
            {locationAddress ? <Text className='flash-radar__clue-address'>{locationAddress}</Text> : null}
            <Text className='flash-radar__clue-copy'>先到这个公共片区，再打开雷达寻找。真正找到以前，角色不会提前现身。</Text>
          </View>

          <View className='flash-radar__instrument' aria-label='隐藏位置雷达，不显示角色坐标'>
            <View className='flash-radar__grid' />
            <View className='flash-radar__sweep' />
            <View className='flash-radar__crosshair flash-radar__crosshair--horizontal' />
            <View className='flash-radar__crosshair flash-radar__crosshair--vertical' />
            <View className='flash-radar__ring flash-radar__ring--outer' />
            <View className='flash-radar__ring flash-radar__ring--middle' />
            <View className='flash-radar__ring flash-radar__ring--inner' />
            <View className='flash-radar__tick flash-radar__tick--north'><Text>N</Text></View>
            <View className='flash-radar__tick flash-radar__tick--east'><Text>E</Text></View>
            <View className='flash-radar__tick flash-radar__tick--south'><Text>S</Text></View>
            <View className='flash-radar__tick flash-radar__tick--west'><Text>W</Text></View>
            <View className='flash-radar__blip flash-radar__blip--one' />
            <View className='flash-radar__blip flash-radar__blip--two' />
            <View className='flash-radar__signal'><Text>?</Text></View>
            <View className='flash-radar__instrument-status'>
              <Text className='flash-radar__instrument-status-dot' />
              <Text>{state === 'locating' ? '正在扫描' : '等待启动'}</Text>
            </View>
          </View>

          <Text className='flash-radar__title'>到了你觉得对的附近，再确认一次</Text>
          <Text className='flash-radar__copy'>我们不会给出角色的精确坐标。每次点击只读取一次你的位置，用来判断是否进入 100 米范围。</Text>

          {isPossiblyLate ? (
            <View className='flash-radar__warning' role='status'>
              <Text>可能有点来不及了，但去不去还是你决定。角色到点会正常离开。</Text>
            </View>
          ) : null}

          {state === 'outside' ? (
            <View className='flash-radar__result' role='status'>
              <Text className='flash-radar__result-title'>还没有到附近</Text>
              <Text className='flash-radar__result-copy'>再走近一点后，可以重新确认。这里不会显示角色的距离或方向。</Text>
            </View>
          ) : null}

          {state === 'ended' ? (
            <View className='flash-radar__result' role='status'>
              <Text className='flash-radar__result-title'>刚好散场了</Text>
              <Text className='flash-radar__result-copy'>角色到点就会离开，不接受预约，也不会为这次寻找延长时间。</Text>
              <FlashButton variant='secondary' onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>看看还有谁在线</FlashButton>
            </View>
          ) : null}

          {state === 'denied' ? (
            <View className='flash-radar__result flash-radar__result--error' role='alert'>
              <Text className='flash-radar__result-title'>定位权限没有打开</Text>
              <Text className='flash-radar__result-copy'>拒绝定位就无法参加街头盲盒，我们也不会改用 IP 定位。</Text>
              <FlashButton variant='secondary' onClick={() => { void handleOpenSetting() }}>打开定位设置</FlashButton>
            </View>
          ) : null}

          {state === 'rate_limited' ? (
            <View className='flash-radar__result flash-radar__result--error' role='alert'>
              <Text className='flash-radar__result-title'>先歇一会儿再确认</Text>
              <Text className='flash-radar__result-copy'>为了保护角色的隐藏地点，同一次街头盲盒 10 分钟内最多确认 6 次。稍后再试就好。</Text>
            </View>
          ) : null}

          {state === 'error' ? (
            <View className='flash-radar__result flash-radar__result--error' role='alert'>
              <Text className='flash-radar__result-title'>这次没有确认成功</Text>
              <Text className='flash-radar__result-copy'>定位信号或网络可能暂时不稳定，稍后可以再点一次。</Text>
            </View>
          ) : null}

          <View className='flash-radar__actions'>
            <FlashButton
              disabled={state === 'locating' || locateMutation.isPending}
              onClick={() => { void handleLocate() }}
            >
              {state === 'locating' || locateMutation.isPending ? '正在确认这一次位置…' : '我到附近了'}
            </FlashButton>
            <FlashButton
              variant='quiet'
              onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}
            >
              先不去了
            </FlashButton>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
