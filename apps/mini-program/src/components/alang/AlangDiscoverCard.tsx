import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { useAuth } from '../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../lib/alang/alangAccess'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../lib/alang/alangAnalytics'
import { haptics } from '../../lib/utils/haptics'
import { FLASH_STREET_BOX_ICON } from '../../lib/alang/flashNpcAssets'
import './AlangDiscoverCard.scss'

/**
 * A deliberately static entry. Discover must not fetch NPC state, pre-load the
 * Flash subpackage, or request location before the user explicitly enters.
 */
export default function AlangDiscoverCard() {
  const { user } = useAuth()
  if (!shouldShowAlangEntry(user)) return null

  const handleTap = async () => {
    haptics('light')
    alangEvents.discoverCardTap()
    try {
      await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.alangEvent })
    } catch (error) {
      // A stale development build can contain the Discover entry without the
      // matching Flash subpackage. Never swallow that failure: make the
      // recovery action visible and keep the native error in the realtime log.
      console.error('[Flash] failed to open street blind box subpackage', error)
      await Taro.showToast({
        title: '街头盲盒打开失败，请更新小程序后重试',
        icon: 'none',
      })
    }
  }

  return (
    <View
      className='alang-discover-card'
      hoverClass='alang-discover-card--pressed'
      onClick={handleTap}
      role='button'
      aria-label='进入街头盲盒，查看深圳当前在线的数字角色'
    >
      <View className='alang-discover-card__bolt' aria-hidden='true'>
        <Image className='alang-discover-card__icon' src={FLASH_STREET_BOX_ICON} mode='aspectFill' />
      </View>
      <View className='alang-discover-card__content'>
        <View className='alang-discover-card__title-row'>
          <Text className='alang-discover-card__title'>街头盲盒</Text>
          <Text className='alang-discover-card__city'>深圳限定</Text>
        </View>
        <Text className='alang-discover-card__description'>城市里的数字角色，偶尔会出来聊两句</Text>
      </View>
      <Text className='alang-discover-card__arrow' aria-hidden='true'>›</Text>
    </View>
  )
}
