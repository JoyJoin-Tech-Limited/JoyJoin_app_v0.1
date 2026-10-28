import { Text, View } from '@tarojs/components'
import { haptics } from '../../../lib/utils/haptics'

export interface HostTableBriefPopoverProps {
  paceShort: string
  anchorLabel?: string
  avoidDomain?: string
  onClose: () => void
}

/**
 * Host-only, optional in-context hint. No profile narrative, no score, no
 * coverage count, no "why" that could identify a member. Closed by default;
 * the host never needs to open it to run the table.
 */
export function HostTableBriefPopover({
  paceShort,
  anchorLabel,
  avoidDomain,
  onClose,
}: HostTableBriefPopoverProps) {
  const handleClose = () => {
    haptics('light')
    onClose()
  }

  return (
    <View className='host-table-brief' role='dialog' aria-label='桌边小提示'>
      <View className='host-table-brief__card'>
        <View className='host-table-brief__header'>
          <Text className='host-table-brief__title'>桌边小提示</Text>
          <View
            className='host-table-brief__close'
            onClick={handleClose}
            role='button'
            aria-label='收起桌边小提示'
            hoverClass='host-table-brief__close--pressed'
          >
            <Text className='host-table-brief__close-text'>收起</Text>
          </View>
        </View>
        <Text className='host-table-brief__line host-table-brief__line--pace'>{paceShort}</Text>
        {anchorLabel ? (
          <Text className='host-table-brief__line'>「{anchorLabel}」会比较好接</Text>
        ) : null}
        <Text className='host-table-brief__line host-table-brief__line--quiet'>
          {avoidDomain ?? '不想答就跳过，先听也可以'}
        </Text>
      </View>
    </View>
  )
}

export default HostTableBriefPopover
