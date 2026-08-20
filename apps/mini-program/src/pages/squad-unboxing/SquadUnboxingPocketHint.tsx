import { View, Text, Image } from '@tarojs/components'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { SQUAD_DECK_POCKETED_HINT_TEXT } from './squadUnboxingViewModels'

export default function SquadUnboxingPocketHint() {
  return (
    <View className='squad-unboxing__pocket-hint' role='status'>
      <Image
        className='squad-unboxing__pocket-hint-mascot'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset('homeWelcome')}
        aria-hidden='true'
      />
      <Text className='squad-unboxing__pocket-hint-text'>{SQUAD_DECK_POCKETED_HINT_TEXT}</Text>
    </View>
  )
}
