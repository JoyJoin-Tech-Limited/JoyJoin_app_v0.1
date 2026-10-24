import Taro from '@tarojs/taro'
import { CANVAS_PALETTE as PALETTE } from '@shared/personality/canvasPalette'
import {
  exportCanvasWithRetry,
  fillRoundedRect,
  resolveImagePath,
} from '../utils/canvasHelpers'
import { logInfo } from '../utils/logger'
import type { EquipmentItem, EquipmentOutfit } from './equipmentApi'
import {
  getPixelAvatarApprovedStarterLookUrl,
  getPixelAvatarBodyUrl,
  getPixelEquipmentLayerUrl,
  normalizePixelArchetypeId,
  PIXEL_AVATAR_EQUIPMENT_SLOTS,
} from './pixelAvatarAssets'

/**
 * Profile card poster (P2-3, 2026-10-22 — PM memo §8): 「存下这张卡」.
 *
 * Rebuilds the DELETED share-card pipeline (profilePoster.ts baked
 * city/age/interests/referralCode — structurally privacy-violating) on the
 * compliant insight-poster pattern: 1080×1560 canvas, QR fail-open
 * (copy-only band when undefined), temp-file unlink by the caller hook.
 *
 * Privacy contract: `ProfileCardPosterInput` structurally EXCLUDES city,
 * age, interests, bio, referral codes, and real-name fields — no field on
 * this type can carry them into any canvas primitive. No incentive wording
 * anywhere on the poster (WeChat 诱导分享 ban). No LLM content → no AIGC
 * label (fail-closed rule not triggered).
 */

export const PROFILE_CARD_CANVAS_ID = 'profile-card-poster-canvas'
export const PROFILE_CARD_WIDTH = 1080
export const PROFILE_CARD_HEIGHT = 1560
export const PROFILE_CARD_QR_COPY = '微信扫一扫，来悦聚认识我'

export interface ProfileCardPosterInput {
  /** Resolved page display name. */
  displayName: string
  archetypeName?: string | null
  /** P0-3 tribe family name. */
  familyName?: string | null
  /** 潮流值 (gamification XP). */
  growthValue?: number | null
  /** Static archetype tagline (curated registry copy, NOT AI) — fills the
   *  mid-card quiet line. Null/undefined renders nothing. */
  tagline?: string | null
  /** Pixel-avatar composite inputs; when the archetype is not pixel-supported
   *  (or no pixel id is passed) the archetype full-body art is used. */
  pixelArchetypeId?: string | null
  outfit?: EquipmentOutfit | null
  itemsById?: Map<string, EquipmentItem>
  /** Archetype full-body art URL (fail-open fallback portrait). */
  archetypeAsset?: string | null
  /** QR temp file path from fetchShareQrCodeImage(); undefined → copy-only band. */
  qrCodeImagePath?: string
}

const CARD_X = 28
const CARD_Y = 28
const CARD_WIDTH = PROFILE_CARD_WIDTH - CARD_X * 2
const CARD_HEIGHT = PROFILE_CARD_HEIGHT - CARD_Y * 2
const CARD_RADIUS = 40

const CENTER_X = PROFILE_CARD_WIDTH / 2
const LEFT_EDGE = 96
const RIGHT_EDGE = PROFILE_CARD_WIDTH - 96

const CHROME_Y = 88
const PORTRAIT_Y = 150
const PORTRAIT_SIZE = 320
const NAME_Y = 560
const FAMILY_Y = 640
const GROWTH_Y = 730
// P2-3 audit C4: tagline fills the mid-card; QR band moved up 150px so the
// bottom third reads anchored, not empty.
const TAGLINE_Y = 850
const QR_BAND_Y = 1180
const QR_SIZE = 160
const FOOTER_Y = 1500

const BRAND_WORDMARK = 'JoyJoin 悦聚'
const CHROME_LABEL = '我的悦聚名片'

/**
 * Draw the card onto a canvas context. Exported separately from the export
 * pipeline so layout/privacy tests can spy on canvas primitives without
 * touching Taro's canvas runtime.
 */
export function drawProfileCardPosterContent(
  ctx: Taro.CanvasContext,
  input: ProfileCardPosterInput,
  portraitImagePaths: string[],
): void {
  // ── Background + card shell ──
  ctx.save()
  ctx.setFillStyle(PALETTE.pageBgStart)
  ctx.fillRect(0, 0, PROFILE_CARD_WIDTH, PROFILE_CARD_HEIGHT)
  ctx.restore()
  fillRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, PALETTE.cardFill)

  // ── Chrome label ──
  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(28)
  ctx.setTextAlign('left')
  ctx.fillText(CHROME_LABEL, LEFT_EDGE, CHROME_Y)
  ctx.restore()

  // ── Portrait stack (pixel composite = body + equipped layers, slot order) ──
  const portraitX = CENTER_X - PORTRAIT_SIZE / 2
  for (const imagePath of portraitImagePaths) {
    if (!imagePath) continue
    ctx.drawImage(imagePath, portraitX, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE)
  }

  // ── Display name ──
  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(52)
  ctx.setTextAlign('center')
  ctx.fillText(input.displayName, CENTER_X, NAME_Y)
  ctx.restore()

  // ── Family pill (gold tint) ──
  if (input.familyName) {
    ctx.save()
    ctx.setFontSize(32)
    const textWidth = ctx.measureText(input.familyName).width
    const pillWidth = textWidth + 64
    const pillHeight = 64
    fillRoundedRect(
      ctx,
      CENTER_X - pillWidth / 2,
      FAMILY_Y - pillHeight / 2 - 16,
      pillWidth,
      pillHeight,
      pillHeight / 2,
      'rgba(240, 192, 96, 0.25)',
    )
    ctx.setFillStyle(PALETTE.textDark)
    ctx.setTextAlign('center')
    ctx.fillText(input.familyName, CENTER_X, FAMILY_Y)
    ctx.restore()
  }

  // ── Growth value ──
  if (typeof input.growthValue === 'number' && Number.isFinite(input.growthValue)) {
    ctx.save()
    ctx.setFillStyle(PALETTE.textMuted)
    ctx.setFontSize(36)
    ctx.setTextAlign('center')
    ctx.fillText(`潮流值 ${input.growthValue}`, CENTER_X, GROWTH_Y)
    ctx.restore()
  }

  // ── Quiet tagline line (mid-card) ──
  if (input.tagline) {
    ctx.save()
    ctx.setFillStyle(PALETTE.textMuted)
    ctx.setFontSize(30)
    ctx.setTextAlign('center')
    ctx.fillText(input.tagline, CENTER_X, TAGLINE_Y)
    ctx.restore()
  }

  // ── QR band (fail-open: copy-only when no QR image) ──
  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(30)
  ctx.setTextAlign('left')
  ctx.fillText(PROFILE_CARD_QR_COPY, LEFT_EDGE, QR_BAND_Y + 90)
  ctx.restore()
  if (input.qrCodeImagePath) {
    ctx.drawImage(input.qrCodeImagePath, RIGHT_EDGE - QR_SIZE, QR_BAND_Y, QR_SIZE, QR_SIZE)
  }

  // ── Brand footer ──
  ctx.save()
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setFontSize(26)
  ctx.setTextAlign('center')
  ctx.fillText(BRAND_WORDMARK, CENTER_X, FOOTER_Y)
  ctx.restore()
}

const DRAW_TIMEOUT_MS = 15_000

/**
 * Resolve the portrait stack: pixel-avatar composite when possible
 * (approved starter look OR body + equipped layers in slot order),
 * otherwise the archetype full-body art. Every layer is fail-open —
 * a layer that cannot resolve is simply skipped.
 */
async function resolvePortraitStack(input: ProfileCardPosterInput): Promise<string[]> {
  const pixelId = normalizePixelArchetypeId(input.pixelArchetypeId)
  if (pixelId) {
    const paths: string[] = []
    try {
      const starterLook = getPixelAvatarApprovedStarterLookUrl(pixelId)
      const bodyUrl = starterLook ?? getPixelAvatarBodyUrl(pixelId)
      if (bodyUrl) {
        const resolved = await resolveImagePath(bodyUrl)
        if (resolved) paths.push(resolved)
      }
      // Approved starter look already includes the starter outfit — only draw
      // layers when a custom outfit replaces it.
      if (!starterLook && input.outfit && input.itemsById) {
        for (const slot of PIXEL_AVATAR_EQUIPMENT_SLOTS) {
          const itemId = input.outfit[`${slot}ItemId` as keyof EquipmentOutfit] as string | null | undefined
          const item = itemId ? input.itemsById.get(itemId) : undefined
          if (!item || item.slot !== slot) continue
          const layerUrl = getPixelEquipmentLayerUrl(item.assetKey, pixelId)
          if (!layerUrl) continue
          try {
            const resolved = await resolveImagePath(layerUrl)
            if (resolved) paths.push(resolved)
          } catch {
            // skip the layer
          }
        }
      }
      if (paths.length > 0) return paths
    } catch {
      // fall through to archetype art
    }
  }

  if (input.archetypeAsset) {
    try {
      const resolved = await resolveImagePath(input.archetypeAsset)
      return resolved ? [resolved] : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Generate the card and return the exported temp file path. Export inherits
 * `exportCanvasWithRetry` semantics (DPR ≤2, retry, 60s auto-unlink). One
 * generation per call — callers must never reuse a previous temp file.
 */
export async function generateProfileCardPoster(input: ProfileCardPosterInput): Promise<string> {
  const portraitImagePaths = await resolvePortraitStack(input)

  const ctx = Taro.createCanvasContext(PROFILE_CARD_CANVAS_ID)
  drawProfileCardPosterContent(ctx, input, portraitImagePaths)

  return await new Promise<string>((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('Canvas draw timed out'))
      }
    }, DRAW_TIMEOUT_MS)

    ctx.draw(false, async () => {
      if (settled) return
      try {
        const tempFilePath = await exportCanvasWithRetry(
          PROFILE_CARD_CANVAS_ID,
          PROFILE_CARD_WIDTH,
          PROFILE_CARD_HEIGHT,
        )
        settled = true
        clearTimeout(timeout)
        try {
          ctx.clearRect(0, 0, PROFILE_CARD_WIDTH, PROFILE_CARD_HEIGHT)
        } catch {
          // best-effort
        }
        logInfo('[ProfileCardPoster] generated', { layers: portraitImagePaths.length })
        resolve(tempFilePath)
      } catch (error) {
        settled = true
        clearTimeout(timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })
}
