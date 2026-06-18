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

import { cdnAsset } from '../../lib/utils/cdnAssets'

export const CELEBRATION_FRAME_MAP = {
  auction_sold: cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-auction-sold.webp'),
  dice_reveal: cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-dice-reveal.webp'),
  undercover_secret: cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-undercover-secret.webp'),
  mirror_result: cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-mirror-result.webp'),
  quip_champion: cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-quip-champion.webp'),
} as const

export type CelebrationFrameKey = keyof typeof CELEBRATION_FRAME_MAP
