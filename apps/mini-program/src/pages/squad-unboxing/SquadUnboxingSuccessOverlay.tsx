import { View, Text, Image } from '@tarojs/components'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'

interface SquadUnboxingSuccessOverlayProps {
  /** 邀请奖励到账行 (2026-10-14 PRD E19): rendered only when an available
   *  invitation_reward coupon was issued recently. Fail-closed — no line
   *  means no placeholder. */
  rewardLine?: string
  /** 卡包/月卡权益回显行 (PRD E19, degraded — no credit count available):
   *  rendered only for entitlement users. */
  entitlementLine?: string
  onRewardTap?: () => void
  onEntitlementTap?: () => void
}

export default function SquadUnboxingSuccessOverlay({
  rewardLine,
  entitlementLine,
  onRewardTap,
  onEntitlementTap,
}: SquadUnboxingSuccessOverlayProps) {
  return (
    <View className='squad-unboxing__success-overlay' role='status' aria-live='polite'>
      <View className='squad-unboxing__success-card'>
        <Image
          className='squad-unboxing__success-mascot'
          mode='aspectFit'
          src={getXiaoyueExpressionAsset('actionSuccess')}
          aria-hidden='true'
        />
        <Text className='squad-unboxing__success-title'>座位已锁定</Text>
        <Text className='squad-unboxing__success-subtitle'>解锁新羁绊 · 准备见面吧</Text>
        {/* 邀请奖励到账确认 (PRD E19): the strongest next-invite driver is
            seeing that the last one paid off. A quiet tappable row, never a
            competing button. */}
        {rewardLine ? (
          <View
            className='squad-unboxing__success-reward'
            hoverClass='squad-unboxing__success-reward--pressed'
            role='button'
            aria-label={rewardLine}
            onClick={onRewardTap}
          >
            <Text className='squad-unboxing__success-reward-text'>{rewardLine}</Text>
          </View>
        ) : null}
        {/* 权益回显 (PRD E19): pack/subscription users get a factual nudge
            back to Discover — retention, never a purchase surface. */}
        {entitlementLine ? (
          <View
            className='squad-unboxing__success-entitlement'
            hoverClass='squad-unboxing__success-entitlement--pressed'
            role='button'
            aria-label={entitlementLine}
            onClick={onEntitlementTap}
          >
            <Text className='squad-unboxing__success-entitlement-text'>{entitlementLine}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
