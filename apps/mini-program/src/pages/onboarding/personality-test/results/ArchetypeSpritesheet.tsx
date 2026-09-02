import { Image, View } from '@tarojs/components'
import { memo, useCallback, useState } from 'react'
import spritesheetManifest from '../../assets/archetypes/archetype-spritesheet.json'
import { getArchetypeVisual, getArchetypeSpritesheetLocalPath, getArchetypeSpritesheetCdnPath } from '../visuals'

/** Local path (primary) — bundled in the preloaded onboarding subpackage. */
const LOCAL_SHEET = getArchetypeSpritesheetLocalPath()
/** CDN path (fallback) — loaded automatically if local path fails. */
const CDN_SHEET = getArchetypeSpritesheetCdnPath()
/**
 * Total spritesheet dimensions in logical pixels.
 * Used to scale the full spritesheet so each cell fills the container.
 */
const SHEET_W = spritesheetManifest.sheet.width
const SHEET_H = spritesheetManifest.sheet.height

type ArchetypeName =
  | 'corgi' | 'rooster' | 'hamster_praise' | 'fox' | 'dolphin_calm' | 'spider'
  | 'koala' | 'octopus' | 'owl' | 'elephant' | 'turtle' | 'cat'

interface ArchetypeSpritesheetProps {
  archetype: ArchetypeName | string
  size?: string
  className?: string
  fallbackColor?: string
}

/**
 * Render a single archetype thumbnail from the spritesheet.
 *
 * APPROACH: WeChat Mini Program CSS `backgroundImage` is unreliable —
 * it silently fails to render CDN/local URLs in many runtime versions,
 * leaving blank circles instead of archetype thumbnails during the slot
 * animation. This component uses a WeChat-safe overflow:hidden container
 * with a positioned <Image> element to crop the correct region from the
 * spritesheet. The <Image> component is the only reliably-loaded image
 * primitive in WeChat's rendering pipeline.
 *
 * FALLBACK CHAIN:
 * 1. Local bundled spritesheet (on-device, always available)
 * 2. CDN spritesheet (if local path errors)
 * 3. Soft coloured circle from archetype palette (visible while decoding)
 *
 * Note: The <Image> mode='aspectFill' ensures the image fills its
 * allocated dimensions. Combined with overflow:hidden on the container
 * and transform:translate, this crops the exact archetype region.
 */
function ArchetypeSpritesheet({
  archetype,
  size = '132rpx',
  className = '',
  fallbackColor,
}: ArchetypeSpritesheetProps) {
  const region = spritesheetManifest.mapping[archetype as ArchetypeName]
  /** True once the local sheet failed and the CDN fallback is being used. */
  const [useCdn, setUseCdn] = useState(false)
  /** Terminal failure — local AND CDN sheets both failed. */
  const [imgFailed, setImgFailed] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const softColor = fallbackColor ?? getArchetypeVisual(archetype).accentSoft

  const handleImageError = useCallback(() => {
    // Keep the complete placeholder (soft circle + shimmer) visible while the
    // CDN fallback starts. Otherwise WeChat can briefly expose a partially
    // decoded spritesheet in the circular crop, which looks like a
    // half-rendered archetype icon.
    setImgLoaded(false)
    if (useCdn) {
      // CDN fallback also failed — terminal: drop the shimmer so the soft
      // accent circle reads as the settled placeholder instead of pulsing
      // forever.
      setImgFailed(true)
    } else {
      setUseCdn(true)
    }
  }, [useCdn])

  if (!region) {
    return (
      <View
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: softColor,
        }}
      />
    )
  }

  const { x, y, width } = region
  const src = useCdn ? CDN_SHEET : LOCAL_SHEET

  /**
   * Scale the full spritesheet so that each archetype cell exactly fills
   * the container. The container is `sizeNum` rpx wide, each cell is
   * `width` px in the sheet → scale = sizeNum / width rpx-per-px.
   * The full image dimensions in rpx are sheet_dimensions × scale.
   * Translate by -(x, y) × scale to position the correct cell in view.
   */
  const sizeNum = parseInt(size, 10) || 132
  const scale = sizeNum / width
  const imgW = SHEET_W * scale
  const imgH = SHEET_H * scale
  const translateX = -x * scale
  const translateY = -y * scale

  return (
    <View
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: softColor,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* WS-4 (2026-09-02): designed interim state while the sheet decodes.
          useSpriteReadiness is a no-op on real devices (no DOM Image in
          WeChat JSCore), so the reel always starts before decode — this
          GPU-safe opacity-pulse shimmer (never background-position) covers
          the blank window. It keeps running during the CDN-fallback retry
          (imgLoaded stays false) and only unmounts on successful decode or
          terminal failure. Styles live in results/index.scss — this
          component is results-page-only, and the page SCSS is the subpackage
          WXSS authority. */}
      {!imgLoaded && !imgFailed ? (
        <View className='archetype-spritesheet__shimmer' aria-hidden='true' />
      ) : null}
      <Image
        src={src}
        mode='aspectFill'
        style={{
          width: `${imgW}rpx`,
          height: `${imgH}rpx`,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${translateX}rpx, ${translateY}rpx)`,
          opacity: imgLoaded ? 1 : 0,
        }}
        lazyLoad={false}
        onLoad={() => setImgLoaded(true)}
        onError={handleImageError}
      />
    </View>
  )
}

export default memo(ArchetypeSpritesheet)
