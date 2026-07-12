import { Image, View } from '@tarojs/components'
import { useCallback, useMemo, useState } from 'react'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
import { squadUnboxingAnalytics } from '../../lib/analytics/squadUnboxingAnalytics'

const CDN_PATH = '/assets/lovart/squad/squad-host-xiaoyue.webp'
const FALLBACK_PATH = '/assets/lovart/squad/squad-host-xiaoyue-fallback.webp'

type SrcStage = 'cdn' | 'local' | 'skeleton'

export interface XiaoyueHostImageProps {
  groupId?: string
  shouldReduceMotion?: boolean
}

/**
 * Locked Xiaoyue host mascot for the squad-unboxing ready hero. She presents the
 * (code-rendered) gift box beneath her — there is no box in this art. Decorative
 * only (aria-hidden, pointer-events none); the stage tap layer owns interaction.
 *
 * Never-blank chain: CDN WebP → local bundled fallback (<=60KB) → gradient skeleton.
 */
export default function XiaoyueHostImage({ groupId, shouldReduceMotion }: XiaoyueHostImageProps) {
  const [stage, setStage] = useState<SrcStage>('cdn')

  const cdnSrc = useMemo(() => cdnAsset(CDN_PATH), [])
  const localSrc = useMemo(() => localAsset(FALLBACK_PATH), [])

  const handleCdnError = useCallback(() => {
    setStage('local')
    squadUnboxingAnalytics.track('squad_unboxing_ready_hero_fallback', {
      screen: 'squad-unboxing',
      reason: 'cdn_error',
      groupId,
    })
  }, [groupId])

  const handleLocalError = useCallback(() => {
    setStage('skeleton')
  }, [])

  if (stage === 'skeleton') {
    return <View className='squad-unboxing__host-xiaoyue squad-unboxing__host-xiaoyue--skeleton' aria-hidden />
  }

  const src = stage === 'cdn' ? cdnSrc : localSrc
  const onError = stage === 'cdn' ? handleCdnError : handleLocalError

  return (
    <Image
      className={[
        'squad-unboxing__host-xiaoyue',
        shouldReduceMotion ? 'squad-unboxing__host-xiaoyue--reduce-motion' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      src={src}
      mode='aspectFit'
      onError={onError}
      // Eager: the host IS the ready screen — WeChat lazy-load is unreliable
      // for above-the-fold heroes and can leave a blank frame.
      lazyLoad={false}
      aria-hidden='true'
    />
  )
}
