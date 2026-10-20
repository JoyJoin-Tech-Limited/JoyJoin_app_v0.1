import Taro from '@tarojs/taro'
import { CANVAS_PALETTE as PALETTE } from '@shared/personality/canvasPalette'
import {
  drawTextBlock,
  exportCanvasWithRetry,
  fillRoundedRect,
  resolveImagePath,
  splitText,
} from '../../lib/utils/canvasHelpers'
import { logInfo } from '../../lib/utils/logger'

/**
 * Recap share poster (2026-10-20, spec
 * docs/deliberations/2026-10-20-recap-share-and-quip-chips-spec.md 规格一).
 *
 * Canvas builder for the icebreaker recap 「存下这张高光卡」 share card:
 * 1080×1560 portrait (results-page convention), legacy createCanvasContext +
 * hidden <Canvas> + offscreen SCSS, mirroring lib/onboarding/insightPoster.ts
 * discipline (including the spy-locked unit-test paradigm). Content is the
 * viewer's own night: 局档名+日期 → 我的勋章 (own medal only, omitted when
 * none) → unsigned highlight quote → table archetype icon row (≤6) → brand
 * mark → fail-open QR band, with the AIGC label baked iff the quote came from
 * an AI-generated source AND the label flag is on.
 *
 * Privacy hard contract (mirrors insightPoster REL-02/SEC-01): the input type
 * STRUCTURALLY EXCLUDES other participants' identity — tablemates enter the
 * canvas only as archetype icon URLs + a head count; the highlight quote is
 * never attributed (no personDisplayName); the viewer's own displayName is
 * not drawn either (the medal block speaks in first person). Spy tests lock
 * this: no other displayName may appear in any canvas primitive argument.
 */

export const RECAP_SHARE_POSTER_CANVAS_ID = 'recap-share-poster-canvas'
export const RECAP_SHARE_POSTER_WIDTH = 1080
export const RECAP_SHARE_POSTER_HEIGHT = 1560

/** Sanctioned AIGC label string (canvas bake, fail-closed). */
export const RECAP_SHARE_POSTER_AIGC_LABEL = '内容由 AI 生成'

/** Pinned QR-band copy (same vocab whitelist as insightPoster). */
export const RECAP_SHARE_POSTER_QR_COPY = '扫码，遇见对味的局'

/** Static fallback quote — never AI-sourced, never carries the AIGC label. */
export const RECAP_SHARE_POSTER_FALLBACK_QUOTE = '有些晚上，值得被记住'

/** App-message share titles (WeChat review posture: zero incentive wording). */
export const RECAP_SHARE_TITLE_SOLO = '今晚这桌，聊得很对味'

const CHROME_LABEL = '今晚的破冰纪念'
const BRAND_WORDMARK = 'JoyJoin 悦聚'
const MEDAL_CAPTION = '我拿到了'

const CARD_X = 28
const CARD_Y = 28
const CARD_WIDTH = RECAP_SHARE_POSTER_WIDTH - CARD_X * 2
const CARD_HEIGHT = RECAP_SHARE_POSTER_HEIGHT - CARD_Y * 2
const CARD_RADIUS = 40

const LEFT_EDGE = 96
const RIGHT_EDGE = RECAP_SHARE_POSTER_WIDTH - 96
const CENTER_X = RECAP_SHARE_POSTER_WIDTH / 2

const CHROME_Y = 88
const HEADER_Y = 168
const HEADER_LINE_HEIGHT = 52
const MEDAL_GAP = 56
const MEDAL_CAPTION_LINE_HEIGHT = 38
const MEDAL_TITLE_LINE_HEIGHT = 74
const QUOTE_GAP = 48
const QUOTE_FONT_SIZE = 44
const QUOTE_LINE_HEIGHT = 66
const QUOTE_MAX_CHARS_PER_LINE = 18
const QUOTE_MAX_LINES = 3
const ICONS_GAP = 56
const ICON_SIZE = 96
const ICON_INNER_GAP = 24
const TABLEMATE_LABEL_GAP = 28
const TABLEMATE_LABEL_LINE_HEIGHT = 44
const AIGC_GAP = 24
const AIGC_LINE_HEIGHT = 34
const QR_BAND_MIN_Y = 1330
const QR_SIZE = 160
const QR_COPY_FONT_SIZE = 30
const FOOTER_Y = 1500

const ACCENT = '#8B5CF6'

/** Where the highlight quote came from — drives the AIGC bake decision. */
export type RecapShareQuoteSource = 'panel' | 'recap' | 'fallback'

export interface RecapSharePosterInput {
  /** Display-resolved tier name (畅聊局 etc.); omitted when unknown. */
  tierName?: string
  /** Client-formatted session date ('2026.10.20'); omitted when unknown. */
  dateLabel?: string
  /** The VIEWER'S OWN medal title only — never another player's. */
  ownMedalTitle?: string
  /** Unsigned highlight quote (fallback sentence when no recap content). */
  highlightQuote: string
  /** ≤6 table archetype CDN asset URLs — icons only, NEVER names. */
  tablemateArchetypeAssets: string[]
  /** Whole-table head count for the 「N 位有趣的桌友」 line. */
  tablemateCount: number
  /** QR temp file path from `fetchShareQrCodeImage()`; undefined → copy-only band. */
  qrCodeImagePath?: string
  /** Baked iff the quote is AI-sourced AND the AIGC label flag is on. */
  hasAigcLabel: boolean
}

/**
 * Quote priority chain (spec §2): moment panel narrative → recap summary /
 * funMoments → static fallback. The quote is ALWAYS unsigned — the caller
 * passes narrative/moment strings only, never personDisplayName.
 */
export function resolveRecapShareQuote(input: {
  panelQuote?: string | null
  summaryMoments?: string[] | null
  funMoments?: string[] | null
}): { quote: string; source: RecapShareQuoteSource } {
  const panelQuote = typeof input.panelQuote === 'string' ? input.panelQuote.trim() : ''
  if (panelQuote) return { quote: panelQuote, source: 'panel' }
  const summaryMoment = input.summaryMoments?.find((m) => typeof m === 'string' && m.trim())
  if (summaryMoment) return { quote: summaryMoment.trim(), source: 'recap' }
  const funMoment = input.funMoments?.find((m) => typeof m === 'string' && m.trim())
  if (funMoment) return { quote: funMoment.trim(), source: 'recap' }
  return { quote: RECAP_SHARE_POSTER_FALLBACK_QUOTE, source: 'fallback' }
}

/** '2026.10.20' from a ms timestamp; '' when the timestamp is unusable. */
export function formatRecapShareDateLabel(sessionStartedAt?: number): string {
  if (typeof sessionStartedAt !== 'number' || !Number.isFinite(sessionStartedAt) || sessionStartedAt <= 0) {
    return ''
  }
  const date = new Date(sessionStartedAt)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

/**
 * App-message share title. With a plausible head count the group line wins;
 * otherwise the table-generic line. Both are incentive-free and pass the
 * 禁用词 scan (社交/匹配/灵魂/撮合/AI = 0 hits) — locked by test.
 */
export function buildRecapShareTitle(playerCount?: number): string {
  if (typeof playerCount === 'number' && Number.isFinite(playerCount) && playerCount >= 2) {
    return `我们 ${playerCount} 个人把今晚聊热了`
  }
  return RECAP_SHARE_TITLE_SOLO
}

/**
 * App-message share path. Non-participants must NEVER land on the session
 * page (participant 403 gate) — the share lands on the landing page with the
 * referral code riding `?invitationCode=` (persisted by LandingPage into
 * joyjoin_pending_referral_code, the same convention as the results share).
 * Fail-open: no code → plain landing path, byte-identical to a code-less share.
 */
export function buildRecapSharePath(referralCode?: string | null): string {
  const code = typeof referralCode === 'string' ? referralCode.trim() : ''
  const base = '/pages/index/index'
  return code ? `${base}?invitationCode=${encodeURIComponent(code)}` : base
}

/** 「N 位有趣的桌友」 line (count-only; never a name list). */
export function buildTablemateCountLabel(tablemateCount: number): string {
  const count = Math.max(0, Math.floor(tablemateCount))
  return `${count} 位有趣的桌友`
}

/**
 * Draw the poster content onto a canvas context. Exported separately from the
 * export pipeline so layout/vocab/privacy tests can spy on the canvas
 * primitives without touching Taro's canvas runtime (insightPoster pattern).
 *
 * `tablemateImagePaths` are the pre-resolved local paths for the ≤6 archetype
 * icons (resolveImagePath output; '' entries are skipped fail-open).
 */
export function drawRecapSharePosterContent(
  ctx: Taro.CanvasContext,
  input: RecapSharePosterInput,
  tablemateImagePaths: string[] = [],
): void {
  // ── Background + card shell ──
  ctx.save()
  ctx.setFillStyle(PALETTE.pageBgStart)
  ctx.fillRect(0, 0, RECAP_SHARE_POSTER_WIDTH, RECAP_SHARE_POSTER_HEIGHT)
  ctx.restore()
  fillRoundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, PALETTE.cardFill)

  // ── Top chrome: section label + brand mark ──
  ctx.save()
  ctx.setFontSize(26)
  ctx.setFillStyle(PALETTE.textMuted)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('top')
  ctx.fillText(CHROME_LABEL, LEFT_EDGE, CHROME_Y)
  ctx.setTextAlign('right')
  ctx.setFillStyle(PALETTE.textTertiary)
  ctx.fillText('JOYJOIN', RIGHT_EDGE, CHROME_Y)
  ctx.restore()

  let cursorY = HEADER_Y

  // ── 局名日期 line (畅聊局 · 2026.10.20) — either half may be absent ──
  const headerParts = [input.tierName, input.dateLabel].filter(
    (part): part is string => Boolean(part && part.trim()),
  )
  if (headerParts.length > 0) {
    ctx.save()
    ctx.setFontSize(34)
    ctx.setFillStyle(PALETTE.textMuted)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(headerParts.join(' · '), CENTER_X, cursorY)
    ctx.restore()
    cursorY += HEADER_LINE_HEIGHT
  }

  // ── 我的勋章 (own medal only; omitted entirely when none) ──
  if (input.ownMedalTitle) {
    cursorY += MEDAL_GAP
    ctx.save()
    ctx.setFontSize(26)
    ctx.setFillStyle(PALETTE.textTertiary)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(MEDAL_CAPTION, CENTER_X, cursorY)
    ctx.restore()
    cursorY += MEDAL_CAPTION_LINE_HEIGHT
    ctx.save()
    ctx.setFontSize(52)
    ctx.setFillStyle(ACCENT)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(splitText(input.ownMedalTitle, 12, 1)[0] ?? input.ownMedalTitle, CENTER_X, cursorY)
    ctx.restore()
    cursorY += MEDAL_TITLE_LINE_HEIGHT
  }

  // ── 高光引文 (unsigned by contract) ──
  cursorY += QUOTE_GAP
  cursorY += drawTextBlock(ctx, {
    text: input.highlightQuote,
    x: LEFT_EDGE,
    y: cursorY,
    maxCharsPerLine: QUOTE_MAX_CHARS_PER_LINE,
    maxLines: QUOTE_MAX_LINES,
    lineHeight: QUOTE_LINE_HEIGHT,
    fontSize: QUOTE_FONT_SIZE,
    color: PALETTE.textBody,
  })

  // ── 桌友群像: ≤6 archetype icons + count line (icons only, never names) ──
  const icons = tablemateImagePaths.filter(Boolean).slice(0, 6)
  if (icons.length > 0) {
    cursorY += ICONS_GAP
    const rowWidth = icons.length * ICON_SIZE + (icons.length - 1) * ICON_INNER_GAP
    let iconX = CENTER_X - rowWidth / 2
    for (const path of icons) {
      ctx.save()
      ctx.drawImage(path, iconX, cursorY, ICON_SIZE, ICON_SIZE)
      ctx.restore()
      iconX += ICON_SIZE + ICON_INNER_GAP
    }
    cursorY += ICON_SIZE
  }
  if (input.tablemateCount > 0) {
    cursorY += TABLEMATE_LABEL_GAP
    ctx.save()
    ctx.setFontSize(30)
    ctx.setFillStyle(PALETTE.textSecondary)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(buildTablemateCountLabel(input.tablemateCount), CENTER_X, cursorY)
    ctx.restore()
    cursorY += TABLEMATE_LABEL_LINE_HEIGHT
  }

  // ── AIGC label (baked iff the quote is AI-sourced AND the flag is on) ──
  if (input.hasAigcLabel) {
    cursorY += AIGC_GAP
    ctx.save()
    ctx.setFontSize(24)
    ctx.setFillStyle(PALETTE.textTertiary)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('top')
    ctx.fillText(RECAP_SHARE_POSTER_AIGC_LABEL, LEFT_EDGE, cursorY)
    ctx.restore()
    cursorY += AIGC_LINE_HEIGHT
  }

  // ── QR band (fail-open: without a QR temp file the band collapses to copy) ──
  const qrBandY = Math.max(cursorY + 40, QR_BAND_MIN_Y)
  if (input.qrCodeImagePath) {
    ctx.save()
    ctx.drawImage(input.qrCodeImagePath, LEFT_EDGE, qrBandY, QR_SIZE, QR_SIZE)
    ctx.restore()
    ctx.save()
    ctx.setFontSize(QR_COPY_FONT_SIZE)
    ctx.setFillStyle(PALETTE.textBody)
    ctx.setTextAlign('left')
    ctx.setTextBaseline('top')
    ctx.fillText(RECAP_SHARE_POSTER_QR_COPY, LEFT_EDGE + QR_SIZE + 40, qrBandY + QR_SIZE / 2 - 20)
    ctx.restore()
  } else {
    ctx.save()
    ctx.setFontSize(QR_COPY_FONT_SIZE)
    ctx.setFillStyle(PALETTE.textBody)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    ctx.fillText(RECAP_SHARE_POSTER_QR_COPY, CENTER_X, qrBandY + 40)
    ctx.restore()
  }

  // ── Footer brand mark ──
  ctx.save()
  ctx.setFontSize(26)
  ctx.setFillStyle(PALETTE.textTertiary)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  ctx.fillText(BRAND_WORDMARK, CENTER_X, FOOTER_Y)
  ctx.restore()
}

const DRAW_TIMEOUT_MS = 15_000
const MAX_TABLEMATE_ICONS = 6

/**
 * Generate the recap share poster and return the exported temp file path.
 * Export inherits `exportCanvasWithRetry` semantics (DPR ≤2, retry, 60s
 * auto-unlink of the exported file). One generation per call — callers must
 * never reuse a previous temp file across taps.
 */
export async function generateRecapSharePoster(input: RecapSharePosterInput): Promise<string> {
  // Archetype icons are CDN URLs (canvas drawImage needs network-resolvable
  // paths); each resolution is individually fail-open ('' → skipped).
  const tablemateImagePaths = await Promise.all(
    input.tablemateArchetypeAssets
      .slice(0, MAX_TABLEMATE_ICONS)
      .map((asset) => resolveImagePath(asset)),
  )

  const ctx = Taro.createCanvasContext(RECAP_SHARE_POSTER_CANVAS_ID)
  drawRecapSharePosterContent(ctx, input, tablemateImagePaths)

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
          RECAP_SHARE_POSTER_CANVAS_ID,
          RECAP_SHARE_POSTER_WIDTH,
          RECAP_SHARE_POSTER_HEIGHT,
        )
        settled = true
        clearTimeout(timeout)
        // Release the backing store immediately after export (~27 MB).
        try {
          ctx.clearRect(0, 0, RECAP_SHARE_POSTER_WIDTH, RECAP_SHARE_POSTER_HEIGHT)
        } catch {
          // best-effort
        }
        logInfo('[RecapSharePoster] generated', {
          iconCount: tablemateImagePaths.filter(Boolean).length,
          hasMedal: Boolean(input.ownMedalTitle),
        })
        resolve(tempFilePath)
      } catch (error) {
        settled = true
        clearTimeout(timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })
}
