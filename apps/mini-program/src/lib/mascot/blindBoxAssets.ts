/**
 * Lovart blind box layered asset paths.
 *
 * Option C architecture: layered transparent images + procedural CSS animation.
 * Each layer is a 600×600 transparent WebP with the element positioned in-frame.
 * Layers overlay with CSS position:absolute for perfect alignment.
 *
 * Assets are animated via CSS keyframes (float, lid-lift, box-bounce, aura, spark).
 * Reduced motion: animations disabled, static layers still visible.
 */

import { cdnAsset } from '../utils/cdnAssets'

const BASE = cdnAsset('/assets/illustrations')

export const BLIND_BOX_BODY_ASSET = `${BASE}/lovart-blind-box-body.webp`
export const BLIND_BOX_LID_ASSET = `${BASE}/lovart-blind-box-lid.webp`
export const BLIND_BOX_INTERIOR_ASSET = `${BASE}/lovart-blind-box-interior.webp`

/** Accessibility labels for each layer */
export const BLIND_BOX_ALT = {
  body: '礼盒',
  lid: '礼盒盖子',
  interior: '礼盒内的光芒',
} as const
