import { View, Image } from '@tarojs/components'
import { useCdnFirstSrc } from '../../../lib/utils/cdnAssets'

const META_ICON_KEYS: Record<string, string> = {
  calendar: '/assets/icons/ui/icon-calendar.webp',
  location: '/assets/icons/ui/icon-location.webp',
  people: '/assets/icons/ui/icon-people.webp',
}

/** Proprietary meta icon using CDN-first UI assets with a local fallback. */
interface EventMetaIconProps {
  kind: 'type' | 'calendar' | 'location' | 'people'
}

export default function EventMetaIcon({ kind }: EventMetaIconProps) {
  const iconPath = META_ICON_KEYS[kind] ?? ''
  const { src, onError } = useCdnFirstSrc(iconPath)

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
      src={src}
      mode='aspectFit'
      lazyLoad={false}
      aria-role='img'
      aria-label={kind === 'calendar' ? '时间' : kind === 'location' ? '地区' : '报名人数'}
      onError={onError}
    />
  )
}
