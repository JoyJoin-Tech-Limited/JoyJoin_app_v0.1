import { View, Text } from '@tarojs/components'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import './PoolRegistrationDuoBanner.scss'

interface PoolRegistrationDuoBannerProps {
  inviterName: string
}

/**
 * PoolRegistrationDuoBanner — invitee context strip on pool-registration
 * steps 0–3. Flat tint, no border, no close button (it is context, not a
 * promo slot); ≤88rpx tall per C'-1.
 */
export default function PoolRegistrationDuoBanner({ inviterName }: PoolRegistrationDuoBannerProps) {
  return (
    <View className='pool-reg-duo-banner'>
      <JoyJoinIcon emoji='👥' tier='ui' size={28} className='pool-reg-duo-banner__icon' />
      <Text className='pool-reg-duo-banner__text'>{inviterName} 喊你一起，报名即成队</Text>
    </View>
  )
}
