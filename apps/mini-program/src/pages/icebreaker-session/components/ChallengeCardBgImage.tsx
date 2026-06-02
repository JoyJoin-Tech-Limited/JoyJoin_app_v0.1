import { Image } from '@tarojs/components'
import { cdnAsset } from '../../../lib/utils/cdnAssets'

const PHASE_BG_MAP: Record<string, string> = {
  'group-mirror': cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-group-mirror.jpg'),
  'undercover-word': cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-undercover-word.jpg'),
  'quip-battle': cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-quip-battle.jpg'),
}

interface ChallengeCardBgImageProps {
  phase: 'group-mirror' | 'undercover-word' | 'quip-battle'
}

/**
 * WeChat-safe background image for icebreaker challenge cards.
 *
 * WeChat WXSS does not reliably support network URLs in `background-image`.
 * Using an absolutely-positioned `<Image>` inside the card eliminates this
 * compatibility risk while preserving the readability overlay and text colours.
 *
 * The card's base gradient (defined in SCSS) remains as a fallback if this
 * image fails to load.
 */
export default function ChallengeCardBgImage({ phase }: ChallengeCardBgImageProps) {
  const src = PHASE_BG_MAP[phase]
  if (!src) return null

  return (
    <Image
      className='icebreaker__challenge-card-bg'
      src={src}
      mode='aspectFill'
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      lazyLoad
    />
  )
}
