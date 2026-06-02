/** Celebration frame asset map
 *
 * These are 600×600px hero illustrations (not transparent frames).
 * Display centered with text overlaid via CelebrationOverlay component.
 *
 * All assets processed:
 *   - Resized from 2048×2048 → 600×600
 *   - Quantized to 128 colors
 *   - PNG optimized
 *   - Total: ~753KB for 5 frames
 */

import { localAsset } from '../../lib/utils/cdnAssets'

export const CELEBRATION_FRAME_MAP = {
  auction_sold: localAsset('/assets/lovart/icebreaker/celebrations/celebration-auction-sold.png'),
  dice_reveal: localAsset('/assets/lovart/icebreaker/celebrations/celebration-dice-reveal.png'),
  undercover_secret: localAsset('/assets/lovart/icebreaker/celebrations/celebration-undercover-secret.png'),
  mirror_result: localAsset('/assets/lovart/icebreaker/celebrations/celebration-mirror-result.png'),
  quip_champion: localAsset('/assets/lovart/icebreaker/celebrations/celebration-quip-champion.png'),
} as const

export type CelebrationFrameKey = keyof typeof CELEBRATION_FRAME_MAP
