import { View, Text } from '@tarojs/components'
import Card from '../../../components/ui/Card'
import { PhaseHeaderIcon } from '../phaseViews'
import { ICE_TOOL_BADGE_MINI_SCRIPT } from '@shared/copy/icebreakerSession'

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
            {/* Wave 2 (AC-09/AC-15): 「抓马」→「推理」 — user language, no jargon. */}
            <Text className='icebreaker__tool-card-badge-text'>{ICE_TOOL_BADGE_MINI_SCRIPT}</Text>
          </View>
          <View className='icebreaker__tool-card-icon'>
            <PhaseHeaderIcon phase='mini_script' size={48} />
          </View>
          <Text className='icebreaker__tool-card-title'>迷你剧本杀</Text>
          <Text className='icebreaker__tool-card-sub'>轻量共创剧本</Text>
        </Card>
      </View>
    </View>
  )
}
