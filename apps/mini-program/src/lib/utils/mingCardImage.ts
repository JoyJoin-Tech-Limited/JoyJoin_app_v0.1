/**
 * Mini-program adapter for the shared 命格卡 generator (`@shared/ui/mingCard`).
 *
 * Follows the codebase-canonical canvas pattern: legacy `Taro.createCanvasContext`
 * + hidden `<Canvas canvasId>` (mounted in `results/index.tsx`) + `canvasHelpers`
 * + `exportCanvasWithRetry`. Introduced 2026-07-19 (slice 4).
 */

import Taro from '@tarojs/taro'
import {
  drawMingCard,
  MING_CARD_HEIGHT,
  MING_CARD_WIDTH,
  type MingCardInput,
  type MingCardPainter,
} from '@shared/ui/mingCard'
import {
  clipRoundedRect,
  exportCanvasWithRetry,
  fillRoundedRect,
  strokeRoundedRect,
} from './canvasHelpers'
import { logError } from './logger'

export const MING_CARD_CANVAS_ID = 'ming-card-canvas'

function createPainter(ctx: Taro.CanvasContext): MingCardPainter {
  return {
    fillRoundedRect: (x, y, w, h, r, color) => fillRoundedRect(ctx, x, y, w, h, r, color),
    strokeRoundedRect: (x, y, w, h, r, color, lineWidth) =>
      strokeRoundedRect(ctx, x, y, w, h, r, color, lineWidth),
    fillText: (text, x, y, opts) => {
      ctx.save()
      ctx.setFillStyle(opts.color)
      ctx.setFontSize(opts.size)
      ctx.setTextAlign(opts.align ?? 'left')
      ctx.setTextBaseline('middle')
      // Legacy CanvasContext has no font-weight/italic support; size carries hierarchy.
      ctx.fillText(text, x, y)
      ctx.restore()
    },
    clipRoundedRect: (x, y, w, h, r) => clipRoundedRect(ctx, x, y, w, h, r),
    drawImageCover: (path, x, y, w, h, imgW, imgH) => {
      const scale = Math.max(w / imgW, h / imgH)
      const dw = imgW * scale
      const dh = imgH * scale
      ctx.drawImage(path, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
    },
    save: () => ctx.save(),
    restore: () => ctx.restore(),
  }
}

/**
 * Draw the 命格卡 onto the hidden canvas and export a temp image file.
 * Returns null on any failure — callers must fall back to their existing visuals.
 */
export async function generateMingCardImage(input: MingCardInput): Promise<string | null> {
  try {
    // Resolve art dimensions when the caller didn't (legacy drawImage needs numbers
    // for cover-crop math). On failure the card still renders — without art.
    let resolvedInput = input
    if (input.artImagePath && !input.artImageSize) {
      try {
        const info = await Taro.getImageInfo({ src: input.artImagePath })
        resolvedInput = { ...input, artImageSize: { width: info.width, height: info.height } }
      } catch {
        resolvedInput = { ...input, artImagePath: undefined }
      }
    }
    const ctx = Taro.createCanvasContext(MING_CARD_CANVAS_ID)
    drawMingCard(createPainter(ctx), resolvedInput)
    // Legacy draw callback has no error channel; the timeout guards a hung callback
    // and the export step surfaces real failures.
    await Promise.race([
      new Promise<void>((resolve) => ctx.draw(false, () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 800)),
    ])
    return await exportCanvasWithRetry(MING_CARD_CANVAS_ID, MING_CARD_WIDTH, MING_CARD_HEIGHT)
  } catch (error) {
    logError('[MingCard] generation failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
