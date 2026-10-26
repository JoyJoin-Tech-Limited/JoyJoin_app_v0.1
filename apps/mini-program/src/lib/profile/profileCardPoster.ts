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
  getPixelEquipmentAsset,
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
 * age, interests, bio, real-name fields, and any referral/invitation CODE as
 * a rendered text field — no field on this type can carry them into a canvas
 * primitive. The QR is the ONE deliberate exception (pre-ship C7): it encodes
 * the share deep link, which may itself carry attribution, but no code is
 * ever drawn as readable copy. No incentive wording anywhere on the poster
 * (WeChat 诱导分享 ban). No LLM content → no AIGC label (fail-closed rule not
 * triggered).
 */

export const PROFILE_CARD_CANVAS_ID = 'profile-card-poster-canvas'
export const PROFILE_CARD_WIDTH = 1080
export const PROFILE_CARD_HEIGHT = 1560
export const PROFILE_CARD_QR_COPY = '微信扫一扫，来悦聚认识我'
// UIUX 2026-10-26 residual #3: no-QR exports must not instruct the viewer to
// scan a code that is not there — neutral non-scan invitation instead.
export const PROFILE_CARD_NO_QR_COPY = '来悦聚认识我'

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
// Pre-ship B2 (2026-10-26): the pixel body canvas is 512×768 (2:3). The old
// square 320×320 well squashed every portrait 33% vertically — the exported
// card showed a visibly flattened character. The portrait well is now 2:3 and
// the whole mid-card stack moved down to keep the same breathing rhythm.
const PORTRAIT_Y = 150
const PORTRAIT_WIDTH = 320
const PORTRAIT_HEIGHT = 480
const PORTRAIT_X = CENTER_X - PORTRAIT_WIDTH / 2
const PORTRAIT_ASSET_WIDTH = 512
const PORTRAIT_ASSET_HEIGHT = 768
// Archetype fallback art is ~1:1 (694×663), so it stays square inside the well.
const ARCHETYPE_ART_SIZE = 320
const NAME_Y = 716
const FAMILY_Y = 798
const GROWTH_Y = 880
// P2-3 audit C4: tagline fills the mid-card; QR band moved up 150px so the
// bottom third reads anchored, not empty.
const TAGLINE_Y = 966
const QR_BAND_Y = 1180
const QR_SIZE = 160
const FOOTER_Y = 1500

const BRAND_WORDMARK = 'JoyJoin 悦聚'
const CHROME_LABEL = '我的悦聚名片'

// UIUX 2026-10-26 residual #2: displayName is user-controlled — constrain it
// to the 96px-safe content width with an ellipsis (code-point safe, never
// mid-word-squished by canvas maxWidth). Curated family/tagline stay as-is.
const NAME_MAX_WIDTH = RIGHT_EDGE - LEFT_EDGE

export function fitCanvasTextToWidth(
  ctx: Taro.CanvasContext,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  const chars = Array.from(text)
  let end = chars.length - 1
  while (end > 1 && ctx.measureText(`${chars.slice(0, end).join('')}…`).width > maxWidth) {
    end -= 1
  }
  return `${chars.slice(0, end).join('')}…`
}

/**
 * One drawn portrait layer: an already-resolved image with its own on-canvas
 * rectangle. The pixel composite is a layered paper doll — body plus one
 * placement-positioned overlay per equipped slot — so a shared destination
 * rect is structurally wrong (pre-ship C1).
 */
export interface ProfileCardPortraitLayer {
  url: string
  left: number
  top: number
  width: number
  height: number
}

function getOutfitItemId(
  outfit: EquipmentOutfit,
  slot: (typeof PIXEL_AVATAR_EQUIPMENT_SLOTS)[number],
): string | null {
  return (outfit[`${slot}ItemId` as keyof EquipmentOutfit] as string | null | undefined) ?? null
}

/**
 * Mirrors `PixelAvatarComposite`'s `usesApprovedStarterLook`: the approved
 * starter look is a flattened composite of the DEFAULT starter set, so it may
 * only stand in for the body when every slot still holds that archetype's
 * starter piece. Any real equipped item needs body + placement layers.
 */
function isStarterOutfitEquipped(
  pixelArchetypeId: string,
  outfit: EquipmentOutfit,
  itemsById: Map<string, EquipmentItem>,
): boolean {
  return PIXEL_AVATAR_EQUIPMENT_SLOTS.every((slot) => {
    const itemId = getOutfitItemId(outfit, slot)
    const item = itemId ? itemsById.get(itemId) : undefined
    return Boolean(
      item
      && item.slot === slot
      && item.assetKey === `equipment/starter/${pixelArchetypeId}/${slot}/v1`,
    )
  })
}

/**
 * Plan the portrait stack without touching the canvas runtime (pure — unit
 * testable). Priority: pixel composite (starter look or body + equipped
 * layers) → archetype full-body art → nothing. A missing outfit payload keeps
 * the starter look, because that is a better default than a bare base body.
 */
export function planPortraitLayers(input: ProfileCardPosterInput): ProfileCardPortraitLayer[] {
  // The caller passes `pixelArchetypeId: pixelAvatarEnabled ? archetype : null`,
  // so a missing id means "this account has no pixel avatar". normalize…
  // defaults to 'cat', which used to paint another archetype's look — gate on
  // the raw id and fall through to the square archetype artwork instead.
  const pixelId = input.pixelArchetypeId ? normalizePixelArchetypeId(input.pixelArchetypeId) : null
  if (pixelId) {
    const layers: ProfileCardPortraitLayer[] = []
    const starterLookUrl = getPixelAvatarApprovedStarterLookUrl(pixelId)
    const outfit = input.outfit ?? null
    const itemsById = input.itemsById ?? null
    const usesStarterLook = starterLookUrl !== null
      && (outfit && itemsById ? isStarterOutfitEquipped(pixelId, outfit, itemsById) : true)
    const bodyUrl = usesStarterLook ? starterLookUrl : getPixelAvatarBodyUrl(pixelId)
    if (bodyUrl) {
      layers.push({
        url: bodyUrl,
        left: PORTRAIT_X,
        top: PORTRAIT_Y,
        width: PORTRAIT_WIDTH,
        height: PORTRAIT_HEIGHT,
      })
    }
    // Pre-ship B1/C1: equipped gear must reach the exported card, at the same
    // 512×768-anchored placement rects the on-screen composite uses.
    if (bodyUrl && !usesStarterLook && outfit && itemsById) {
      for (const slot of PIXEL_AVATAR_EQUIPMENT_SLOTS) {
        const itemId = getOutfitItemId(outfit, slot)
        const item = itemId ? itemsById.get(itemId) : undefined
        if (!item || item.slot !== slot) continue
        const asset = getPixelEquipmentAsset(item.assetKey, pixelId)
        if (!asset) continue
        layers.push({
          url: asset.url,
          left: PORTRAIT_X + (asset.placement.left / PORTRAIT_ASSET_WIDTH) * PORTRAIT_WIDTH,
          top: PORTRAIT_Y + (asset.placement.top / PORTRAIT_ASSET_HEIGHT) * PORTRAIT_HEIGHT,
          width: (asset.placement.width / PORTRAIT_ASSET_WIDTH) * PORTRAIT_WIDTH,
          height: (asset.placement.height / PORTRAIT_ASSET_HEIGHT) * PORTRAIT_HEIGHT,
        })
      }
    }
    if (layers.length > 0) return layers
  }

  if (input.archetypeAsset) {
    return [{
      url: input.archetypeAsset,
      left: CENTER_X - ARCHETYPE_ART_SIZE / 2,
      top: PORTRAIT_Y + (PORTRAIT_HEIGHT - ARCHETYPE_ART_SIZE) / 2,
      width: ARCHETYPE_ART_SIZE,
      height: ARCHETYPE_ART_SIZE,
    }]
  }
  return []
}

/**
 * Draw the card onto a canvas context. Exported separately from the export
 * pipeline so layout/privacy tests can spy on canvas primitives without
 * touching Taro's canvas runtime.
 */
export function drawProfileCardPosterContent(
  ctx: Taro.CanvasContext,
  input: ProfileCardPosterInput,
  portraitLayers: ProfileCardPortraitLayer[],
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

  // ── Portrait stack (2:3 well; each layer owns its placement rect) ──
  for (const layer of portraitLayers) {
    if (!layer.url) continue
    ctx.drawImage(layer.url, layer.left, layer.top, layer.width, layer.height)
  }

  // ── Display name ──
  ctx.save()
  ctx.setFillStyle(PALETTE.textDark)
  ctx.setFontSize(52)
  ctx.setTextAlign('center')
  ctx.fillText(fitCanvasTextToWidth(ctx, input.displayName, NAME_MAX_WIDTH), CENTER_X, NAME_Y)
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
  ctx.fillText(
    input.qrCodeImagePath ? PROFILE_CARD_QR_COPY : PROFILE_CARD_NO_QR_COPY,
    LEFT_EDGE,
    QR_BAND_Y + 90,
  )
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
/**
 * Resolve the planned portrait stack into drawable local paths. Every layer is
 * fail-open — a layer that cannot resolve is simply skipped.
 */
async function resolvePortraitStack(
  input: ProfileCardPosterInput,
): Promise<ProfileCardPortraitLayer[]> {
  const planned = planPortraitLayers(input).filter((layer) => Boolean(layer.url))
  // Pre-ship R4 (step-3 audit): resolving these SERIALLY could spend up to five
  // layers × the 5s `resolveImagePath` timeout before the 15s draw guard even
  // starts, leaving 「正在生成…」 on screen for ~25s. Resolve in parallel.
  const paths = await Promise.all(
    planned.map(async (layer) => {
      try {
        return await resolveImagePath(layer.url)
      } catch {
        return ''
      }
    }),
  )
  return planned.flatMap((layer, index) => {
    const path = paths[index]
    return path ? [{ ...layer, url: path }] : []
  })
}

/**
 * Generate the card and return the exported temp file path. Export inherits
 * `exportCanvasWithRetry` semantics (DPR ≤2, retry, 60s auto-unlink). One
 * generation per call — callers must never reuse a previous temp file.
 */
export async function generateProfileCardPoster(input: ProfileCardPosterInput): Promise<string> {
  const portraitLayers = await resolvePortraitStack(input)

  const ctx = Taro.createCanvasContext(PROFILE_CARD_CANVAS_ID)
  drawProfileCardPosterContent(ctx, input, portraitLayers)

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
        logInfo('[ProfileCardPoster] generated', { layers: portraitLayers.length })
        resolve(tempFilePath)
      } catch (error) {
        settled = true
        clearTimeout(timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })
}
