import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { haptics } from '../../lib/utils/haptics'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'

interface ProfileNavBellProps {
  unread: number
}

/**
 * Profile notification bell — the shared TabPageNav right-slot affordance.
 *
 * Mirrors Discover's anatomy (72rpx circle, primary badge pill) but keeps the
 * deliberate 「9+」 cap (>9) instead of Discover's 99+ (UIUX memo §7 — do not
 * "fix" back). Position and capsule clearance are owned by TabPageNav.
 */
export default function ProfileNavBell({ unread }: ProfileNavBellProps) {
  return (
    <View
      className='profile-page__nav-bell'
      hoverClass='profile-page__nav-bell--active'
      onClick={() => {
        haptics('light')
        Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.notifications }).catch(() => {})
      }}
      role='button'
      aria-label={unread > 0 ? `通知，${unread} 条未读` : '通知'}
      data-testid='profile-notification-bell'
    >
      <JoyJoinIcon emoji='🔔' tier='semantic' size={22} />
      {unread > 0 ? (
        <View className='profile-page__nav-bell-badge' aria-hidden='true'>
          <Text className='profile-page__nav-bell-badge-text'>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
