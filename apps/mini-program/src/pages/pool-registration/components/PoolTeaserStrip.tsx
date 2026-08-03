import { Image, Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import {
  POOL_TEASER_NODES,
  POOL_TEASER_VOICE_LINE,
  type PoolTeaserNodeIconId,
} from '@shared/copy/poolTeaserCopy'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import './PoolTeaserStrip.scss'

const TEASER_NODE_ICON_SRC: Record<PoolTeaserNodeIconId, string> = {
  spot_locked: cdnAsset('/assets/icons/flow-icons/flow-1.webp'),
  yuezai_matching: cdnAsset('/assets/icons/flow-icons/flow-2.webp'),
  table_formed: cdnAsset('/assets/icons/flow-icons/flow-3.webp'),
  event_reveal: cdnAsset('/assets/icons/flow-icons/flow-4.webp'),
  offline_meet: cdnAsset('/assets/icons/flow-icons/flow-5.webp'),
  story_kept: cdnAsset('/assets/icons/flow-icons/flow-7.webp'),
}

interface PoolTeaserStripProps {
  animate: boolean
}

export default function PoolTeaserStrip({ animate }: PoolTeaserStripProps) {
  const [armed, setArmed] = useState(false)
  const [failedIcons, setFailedIcons] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (armed) return
    const raf = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(raf)
  }, [armed])

  useResetOnShow(setArmed)

  const entering = animate && armed
  const idle = animate && !armed

  const rootClass = idle ? 'pool-teaser--idle' : entering ? 'pool-teaser--enter' : 'pool-teaser--static'

  return (
    <View className={['pool-teaser', rootClass].join(' ')}>
      <View className='pool-teaser__divider' aria-hidden='true' />
      <Text className='pool-teaser__voice'>{POOL_TEASER_VOICE_LINE}</Text>
      <View className='pool-teaser__nodes' role='group' ariaLabel='入座之后的流程'>
        {POOL_TEASER_NODES.map((node, index) => {
          const isLast = index === POOL_TEASER_NODES.length - 1
          return (
            <View
              key={node.iconId}
              className={[
                'pool-teaser__node',
                `pool-teaser__node--delay-${index}`,
                isLast ? 'pool-teaser__node--last' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {failedIcons.has(node.iconId) ? (
                <View className='pool-teaser__node-icon-fallback' aria-hidden='true' />
              ) : (
                <Image
                  className='pool-teaser__node-icon'
                  src={TEASER_NODE_ICON_SRC[node.iconId]}
                  mode='aspectFit'
                  aria-hidden='true'
                  onError={() =>
                    setFailedIcons((current) => {
                      if (current.has(node.iconId)) return current
                      const next = new Set(current)
                      next.add(node.iconId)
                      return next
                    })
                  }
                />
              )}
              <Text className='pool-teaser__node-label'>{node.label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
