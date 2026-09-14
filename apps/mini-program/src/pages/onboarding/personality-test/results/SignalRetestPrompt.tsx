import { Image, Text, View } from '@tarojs/components'
import Button from '../../../../components/ui/Button'
import CloseIcon from '../../../../components/ui/CloseIcon'
import { cdnAsset } from '../../../../lib/utils/cdnAssets'

interface SignalRetestPromptProps {
  onRetest: () => void
  onDismiss: () => void
}

/**
 * P5a signal-quality retest prompt (2026-09-14).
 *
 * Quiet mascot-voiced banner on the FinalStage result surface — a SECONDARY
 * affordance only: never blocking, never a modal, never between the user and
 * their result. Copy is PM-approved and must not drift:
 * 「悦仔有点拿不准你的风格，要不要再聊一轮？」 + CTA 「重新测一次」.
 *
 * Visibility/suppression logic lives in hooks/useSignalRetestPrompt.ts;
 * this component is pure presentation. Styles live in ./index.scss —
 * do NOT add a component-level SCSS import (subpackage WXSS splitting guard,
 * see AGENTS.md §7).
 */
export default function SignalRetestPrompt({ onRetest, onDismiss }: SignalRetestPromptProps) {
  return (
    <View className='personality-results__signal-retest' role='note' aria-label='悦仔的重测建议'>
      <Image
        className='personality-results__signal-retest-avatar'
        mode='aspectFit'
        src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
        aria-hidden='true'
      />
      <View className='personality-results__signal-retest-body'>
        <Text className='personality-results__signal-retest-copy'>
          悦仔有点拿不准你的风格，要不要再聊一轮？
        </Text>
        <Button
          variant='secondary'
          size='sm'
          onClick={onRetest}
          hoverClass='joy-button--active'
        >
          重新测一次
        </Button>
      </View>
      <View
        className='personality-results__signal-retest-dismiss'
        onClick={onDismiss}
        hoverClass='personality-results__signal-retest-dismiss--pressed'
        role='button'
        aria-label='关闭提示'
      >
        <CloseIcon size={24} className='personality-results__signal-retest-dismiss-icon' />
      </View>
    </View>
  )
}
