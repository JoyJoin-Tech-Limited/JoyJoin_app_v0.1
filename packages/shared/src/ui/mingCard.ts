/**
 * 命格卡 (Ming Card) — canonical Pokémon-style archetype card generator.
 *
 * Platform-agnostic: all drawing is expressed against the minimal
 * `MingCardPainter` interface. Each platform provides an adapter:
 *   - mini-program: legacy CanvasContext adapter
 *     (`apps/mini-program/src/lib/utils/mingCardImage.ts`)
 *   - WebGL spike / H5: standard CanvasRenderingContext2D adapter
 *     (`prototypes/webgl-reveal/main.js` — the origin of this design)
 *
 * Layout gist (from the 2026-07-19 spike, PM-approved): accent outer frame ·
 * name banner + typicality pill · framed art window (holo zone) · blend flavor
 * line · keyword pills · set/rarity footer. 744×1039 (63:88 card ratio).
 */

export const MING_CARD_WIDTH = 744
export const MING_CARD_HEIGHT = 1039

export interface MingCardInput {
  /** Archetype display name, e.g. 开心柯基. */
  name: string
  /** Typicality badge text, e.g. 典型 / 非典型. */
  badge: string
  /** Up to 3 keyword pills; extras are ignored. */
  keywords: string[]
  /** Blend flavor line, e.g. 隐约有狐狸的影子. Omitted when undefined/empty. */
  blendLine?: string
  /** Archetype accent (hex or rgba() string). Frame, badge pill, pill strokes, rarity star. */
  accent: string
  /** Set number 1–12, rendered as `No.0X/12`. */
  index: number
  /** Resolved image path for the art window; card renders without art when absent. */
  artImagePath?: string
  /** Natural art size (needed for cover-crop math); required when artImagePath is set. */
  artImageSize?: { width: number; height: number }
}

/** Minimal drawing surface both legacy CanvasContext and standard ctx2d can adapt to. */
export interface MingCardPainter {
  fillRoundedRect(x: number, y: number, w: number, h: number, r: number, color: string): void
  strokeRoundedRect(x: number, y: number, w: number, h: number, r: number, color: string, lineWidth: number): void
  fillText(
    text: string,
    x: number,
    y: number,
    opts: { size: number; color: string; align?: 'left' | 'center' | 'right'; italic?: boolean },
  ): void
  /** Clips subsequent drawing to the rounded rect until `restore()`. */
  clipRoundedRect(x: number, y: number, w: number, h: number, r: number): void
  /** Cover-crop draw of an image into the target rect. */
  drawImageCover(
    path: string,
    x: number,
    y: number,
    w: number,
    h: number,
    imgW: number,
    imgH: number,
  ): void
  save(): void
  restore(): void
}

/** Named regions (px) — tests assert against these; keep in sync with drawMingCard. */
export const MING_CARD_LAYOUT = {
  outer: { x: 4, y: 4, w: MING_CARD_WIDTH - 8, h: MING_CARD_HEIGHT - 8, r: 46 },
  hairline: { x: 30, y: 30, w: MING_CARD_WIDTH - 60, h: MING_CARD_HEIGHT - 60, r: 30 },
  name: { x: 58, y: 108 },
  badgePill: { w: 150, h: 64, y: 76, r: 32 }, // x derived from right margin
  setLine: { x: 60, y: 166 },
  artWindow: { x: 58, y: 200, w: MING_CARD_WIDTH - 116, h: 620, r: 26 },
  blendLine: { y: 884 },
  keywordPill: { w: 168, h: 62, y: 916, r: 31, gap: 24 },
  footer: { y: 1008 },
} as const

const INK = '#3A2A1E'
const BODY = '#F7EFE3'
const CREAM_TEXT = '#FFF8EE'

export function drawMingCard(p: MingCardPainter, input: MingCardInput): void {
  const L = MING_CARD_LAYOUT
  const accent = input.accent

  // body + outer accent frame + inner gold hairline
  p.fillRoundedRect(L.outer.x, L.outer.y, L.outer.w, L.outer.h, L.outer.r, BODY)
  p.strokeRoundedRect(L.outer.x, L.outer.y, L.outer.w, L.outer.h, L.outer.r, accent, 20)
  p.strokeRoundedRect(L.hairline.x, L.hairline.y, L.hairline.w, L.hairline.h, L.hairline.r, 'rgba(203,146,104,.45)', 3)

  // header: name + typicality pill
  p.fillText(input.name, L.name.x, L.name.y, { size: 74, color: INK })
  const pillX = MING_CARD_WIDTH - 58 - L.badgePill.w
  p.fillRoundedRect(pillX, L.badgePill.y, L.badgePill.w, L.badgePill.h, L.badgePill.r, accent)
  p.fillText(input.badge, pillX + L.badgePill.w / 2, L.badgePill.y + L.badgePill.h / 2 + 2, {
    size: 36,
    color: CREAM_TEXT,
    align: 'center',
  })
  p.fillText('J O Y J O I N · 命 格 卡', L.setLine.x, L.setLine.y, { size: 27, color: 'rgba(58,42,30,.5)' })

  // art window
  const a = L.artWindow
  if (input.artImagePath && input.artImageSize) {
    p.save()
    p.clipRoundedRect(a.x, a.y, a.w, a.h, a.r)
    p.drawImageCover(input.artImagePath, a.x, a.y, a.w, a.h, input.artImageSize.width, input.artImageSize.height)
    p.restore()
  } else {
    p.fillRoundedRect(a.x, a.y, a.w, a.h, a.r, 'rgba(203,146,104,.12)')
  }
  p.strokeRoundedRect(a.x, a.y, a.w, a.h, a.r, accent, 10)

  // blend flavor line
  if (input.blendLine) {
    p.fillText(input.blendLine, MING_CARD_WIDTH / 2, L.blendLine.y, {
      size: 34,
      color: 'rgba(58,42,30,.62)',
      align: 'center',
      italic: true,
    })
  }

  // keyword pills (max 3)
  const keywords = input.keywords.filter(Boolean).slice(0, 3)
  if (keywords.length > 0) {
    const total = keywords.length * L.keywordPill.w + (keywords.length - 1) * L.keywordPill.gap
    keywords.forEach((keyword, i) => {
      const kx = (MING_CARD_WIDTH - total) / 2 + i * (L.keywordPill.w + L.keywordPill.gap)
      p.strokeRoundedRect(kx, L.keywordPill.y, L.keywordPill.w, L.keywordPill.h, L.keywordPill.r, accent, 3)
      p.fillText(keyword, kx + L.keywordPill.w / 2, L.keywordPill.y + L.keywordPill.h / 2 + 2, {
        size: 32,
        color: '#6B4F35',
        align: 'center',
      })
    })
  }

  // footer: set info + rarity star
  p.fillText(`JOYJOIN · No.${String(input.index).padStart(2, '0')}/12`, 58, L.footer.y, {
    size: 26,
    color: 'rgba(58,42,30,.45)',
  })
  p.fillText('★', MING_CARD_WIDTH - 58, L.footer.y, { size: 34, color: accent, align: 'right' })
}
