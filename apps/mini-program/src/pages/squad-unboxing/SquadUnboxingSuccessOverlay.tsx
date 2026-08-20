import { View, Text, Image } from '@tarojs/components'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'

export default function SquadUnboxingSuccessOverlay() {
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
      </View>
    </View>
  )
}
