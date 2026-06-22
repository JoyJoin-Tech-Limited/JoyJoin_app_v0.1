import { View, Image } from '@tarojs/components'
import { localAsset } from '../../../lib/utils/cdnAssets'

const META_ICON_SRC: Record<string, string> = {
  calendar: localAsset('/assets/icons/ui/icon-calendar.png'),
  location: localAsset('/assets/icons/ui/icon-location.png'),
  people: localAsset('/assets/icons/ui/icon-people.png'),
}

/** Proprietary meta icon using bundled UI assets.
 *  Zero emoji fallback — actual crisp WebP icons shipped in the package. */
interface EventMetaIconProps {
  kind: 'type' | 'calendar' | 'location' | 'people'
}

export default function EventMetaIcon({ kind }: EventMetaIconProps) {
  if (kind === 'type') {
    // CSS-only target icon — clean, scalable, no emoji, zero failure surface
    return (
      <View className='pool-reg__type-icon' aria-role='img' aria-label='活动类型'>
        <View className='pool-reg__type-icon-ring pool-reg__type-icon-ring--outer' />
        <View className='pool-reg__type-icon-ring pool-reg__type-icon-ring--inner' />
        <View className='pool-reg__type-icon-dot' />
      </View>
    )
  }
  return (
    <Image
      className='pool-reg__meta-icon-img'
      src={META_ICON_SRC[kind]}
      mode='aspectFit'
      lazyLoad={false}
      aria-role='img'
      aria-label={kind === 'calendar' ? '时间' : kind === 'location' ? '地区' : '报名人数'}
      onError={() => {
        // Silently degrade to blank if bundled asset is missing —
        // the adjacent label text carries the semantic meaning.
      }}
    />
  )
}
