import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { useAuth } from '../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../lib/alang/alangAccess'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../lib/alang/alangAnalytics'
import { haptics } from '../../lib/utils/haptics'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import './AlangDiscoverCard.scss'

/**
 * A deliberately static entry. Discover must not fetch NPC state, pre-load the
 * Flash subpackage, or request location before the user explicitly enters.
 */
export default function AlangDiscoverCard() {
  const { user } = useAuth()
  if (!shouldShowAlangEntry(user)) return null

  const handleTap = () => {
    haptics('light')
    alangEvents.discoverCardTap()
    void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.alangEvent })
  }

  return (
    <View
      className='alang-discover-card'
      hoverClass='alang-discover-card--pressed'
      onClick={handleTap}
      role='button'
      aria-label='进入闪现，查看深圳当前在线的数字角色'
    >
      <View className='alang-discover-card__bolt' aria-hidden='true'>
        <JoyJoinIcon emoji='⚡' tier='phase' size={34} />
      </View>
      <View className='alang-discover-card__content'>
        <View className='alang-discover-card__title-row'>
          <Text className='alang-discover-card__title'>闪现</Text>
          <Text className='alang-discover-card__city'>深圳限定</Text>
        </View>
        <Text className='alang-discover-card__description'>城市里的数字角色，偶尔会出来聊两句</Text>
      </View>
      <Text className='alang-discover-card__arrow' aria-hidden='true'>›</Text>
    </View>
  )
}
