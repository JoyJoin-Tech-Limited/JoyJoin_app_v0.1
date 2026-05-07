import { View, Text } from '@tarojs/components'
import Card from '../../../components/ui/Card'
import { PhaseHeaderIcon } from '../phaseViews'

type IcebreakerToolSelectorProps = {
  onOpenMiniScript: () => void
}

/** 同桌破冰 — 工具卡入口（迷你剧本杀等） */
export function IcebreakerToolSelector({ onOpenMiniScript }: IcebreakerToolSelectorProps) {
  return (
    <View className='icebreaker__tool-strip'>
      <Text className='icebreaker__tool-strip-title'>同桌工具</Text>
      <View className='icebreaker__tool-cards'>
        <Card className='icebreaker__tool-card' onClick={onOpenMiniScript}>
          <View className='icebreaker__tool-card-badge'>
            <Text className='icebreaker__tool-card-badge-text'>抓马</Text>
          </View>
          <View className='icebreaker__tool-card-icon'>
            <PhaseHeaderIcon phase="mini_script" size={48} />
          </View>
          <Text className='icebreaker__tool-card-title'>迷你剧本杀</Text>
          <Text className='icebreaker__tool-card-sub'>轻量共创剧本</Text>
        </Card>
      </View>
    </View>
  )
}
