import { useState, useEffect, useCallback, useRef } from 'react';
import Taro from '@tarojs/taro';
import { View, Canvas, Text, Image } from '@tarojs/components';
import { getArchetypeHSL } from '@shared/archetypeColors';
import { logError } from '../../../lib/utils/logger';

// Moment card color constants (avoiding hardcoded hex in inline styles / canvas)
const CARD_BG_DARK = '#1e1e2f';
const CARD_GOLD_MUTED = '#d4af37';
const CARD_TEXT_MUTED = '#9CA3AF';
const CARD_TEXT_WHITE = '#FDFCFA';

// ── Keepsake block colors (campfire-vault-card-pr3 R1/R2) ──
const KEEPSAKE_BG = '#FFFAF4'; // cream polaroid-pop on the dark card
const KEEPSAKE_BORDER = 'rgba(139, 92, 246, 0.45)'; // foil border
const KEEPSAKE_EYEBROW_COLOR = '#7C3AED';
const KEEPSAKE_QUESTION_COLOR = '#1F2937';
const KEEPSAKE_PERMISSION_COLOR = 'rgba(55, 65, 81, 0.62)';
// Q1-4 — quiet AIGC microline inside the keepsake block (mirrors the
// in-session PhaseAigcRow compliance pattern; server renderer draws the
// identical line, same placement).
const KEEPSAKE_AIGC_COLOR = 'rgba(55, 65, 81, 0.45)';
// Depth-seal palette mirrors PR1 getDepthSealColors (warmupViewModels.ts) —
// duplicated here so this renderer stays self-contained: soft accent fill,
// accent border, deep-variant text (≥4.5:1 on the cream tint).
const KEEPSAKE_SEAL_COLORS: Record<number, { fill: string; border: string; text: string }> = {
  1: { fill: 'rgba(91, 141, 184, 0.10)', border: 'rgba(91, 141, 184, 0.30)', text: '#3D6E9C' },
  2: { fill: 'rgba(139, 92, 246, 0.10)', border: 'rgba(139, 92, 246, 0.30)', text: '#7C3AED' },
  3: { fill: 'rgba(201, 154, 60, 0.10)', border: 'rgba(201, 154, 60, 0.30)', text: '#8A651A' },
};

interface MomentCardCastMember {
  displayName: string;
  archetype?: string;
  archetypeEmoji?: string;
}

/**
 * 话题留档 keepsake (campfire-vault-card-pr3 K1): the night's reached topic
 * card, rendered as a cream-and-foil block that REPLACES the plain quote zone.
 * Optional so older cached payloads without it still render (G3).
 */
interface MomentCardKeepsake {
  question: string;
  permissionLine?: string | null;
  depthLevel?: 1 | 2 | 3;
  mood?: string;
}

interface MomentCardPayload {
  version: 1;
  headline: string;
  subheadline: string;
  cast: MomentCardCastMember[];
  stats: {
    durationMinutes: number;
    phasesCompleted: number;
    totalPhases: number;
    topicsCount: number;
    challengesCount: number;
  };
  quote?: string;
  quoteAuthor?: string;
  keepsake?: MomentCardKeepsake;
  medals: Array<{
    emoji: string;
    title: string;
    recipient: string;
  }>;
  deepLinkUrl: string;
  generatedAt: string;
}

interface MomentCardViewProps {
  payload: MomentCardPayload;
  visible: boolean;
  onClose: () => void;
}

const CARD_WIDTH = 320;
const CARD_HEIGHT = 520;
const SCALE = 2; // Retina scale for sharp rendering

/** Convert HSL values to hex string for canvas setFillStyle. */
function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const col = light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(col * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getArchetypeHex(archetype: string | undefined): string {
  const hsl = getArchetypeHSL(archetype);
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

/** Trace (but do not fill/stroke) a rounded-rect path — same arc pattern as the medal pills. */
function traceRoundedRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + radius, y + height);
  ctx.arc(x + radius, y + radius, radius, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
}

/**
 * CJK-safe greedy wrap using ctx.measureText (font must be set beforehand).
 * Clamps to maxLines; when text is cut, the last line gets an ellipsis that
 * still fits maxWidth. Never emits a line wider than maxWidth.
 */
function wrapCanvasText(ctx: any, rawText: string, maxWidth: number, maxLines: number): string[] {
  const text = rawText.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const lines: string[] = [];
  let current = '';
  let truncated = false;
  for (const ch of text) {
    if (current && ctx.measureText(current + ch).width > maxWidth) {
      lines.push(current);
      current = ch;
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    } else {
      current += ch;
    }
  }
  if (!truncated && current) {
    if (lines.length >= maxLines) {
      truncated = true;
    } else {
      lines.push(current);
    }
  }
  if (truncated && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) {
      // Code-point-safe trim: slice(0,-1) can split a surrogate pair.
      last = [...last].slice(0, -1).join('');
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

// ── Keepsake layout resolver (C9) — pure geometry, unit-tested ──
/** Minimal drawable block: compact padY×2 + eyebrow + gap + one question line. */
export const KEEPSAKE_MIN_BLOCK_HEIGHT = 59 * SCALE;

export interface KeepsakeLayoutInput {
  /** Line count produced by wrapCanvasText with maxLines=2. */
  questionLineCount: number;
  hasPermission: boolean;
  /**
   * Q1-4 — reserve the quiet 「话题由 AI 生成」 microline row (right-aligned,
   * bottom of the block). Compliance row: never dropped by the ladder.
   * Defaults to false so legacy callers keep the pre-label budget.
   */
  hasAigcLabel?: boolean;
  topY: number;
  maxBottomY: number;
}

export interface KeepsakeLayout {
  /** True when even the minimal block cannot fit — skip the keepsake. */
  skip: boolean;
  compact: boolean;
  /** Final question line count after degradation (1 when clamped). */
  lineCount: number;
  /** Third degradation tier: the 悦仔说 row is dropped to fit. */
  dropPermission: boolean;
  /** Hard-clipped so the block bottom never exceeds maxBottomY (R5). */
  blockHeight: number;
  padY: number;
  eyebrowRow: number;
  gapAfterEyebrow: number;
  questionLineHeight: number;
  gapBeforePermission: number;
  permissionRow: number;
  gapBeforeAigc: number;
  aigcRow: number;
}

interface KeepsakeMetrics {
  padY: number;
  eyebrowRow: number;
  gapAfterEyebrow: number;
  questionLineHeight: number;
  gapBeforePermission: number;
  permissionRow: number;
  gapBeforeAigc: number;
  aigcRow: number;
  total: number;
}

function keepsakeMetricsFor(
  compact: boolean,
  lineCount: number,
  includePermission: boolean,
  includeAigc: boolean
): KeepsakeMetrics {
  const padY = (compact ? 8 : 12) * SCALE;
  const eyebrowRow = (compact ? 16 : 18) * SCALE;
  const gapAfterEyebrow = (compact ? 5 : 8) * SCALE;
  const questionLineHeight = (compact ? 22 : 24) * SCALE;
  const gapBeforePermission = (compact ? 4 : 6) * SCALE;
  const permissionRow = includePermission ? (compact ? 13 : 14) * SCALE : 0;
  const gapBeforeAigc = (compact ? 4 : 6) * SCALE;
  const aigcRow = includeAigc ? (compact ? 12 : 13) * SCALE : 0;
  const total =
    padY +
    eyebrowRow +
    gapAfterEyebrow +
    questionLineHeight * lineCount +
    (includePermission ? gapBeforePermission + permissionRow : 0) +
    (includeAigc ? gapBeforeAigc + aigcRow : 0) +
    padY;
  return { padY, eyebrowRow, gapAfterEyebrow, questionLineHeight, gapBeforePermission, permissionRow, gapBeforeAigc, aigcRow, total };
}

/**
 * Keepsake degradation ladder (R5 no-overlap, C9):
 *   1. full → compact paddings
 *   2. clamp the question to one line
 *   3. drop the 悦仔说 row entirely
 *   4. hard-clip blockHeight to [topY, maxBottomY]
 *   5. skip the keepsake when topY leaves less than the minimal block height
 * Worst case (12-cast + quote + permission + 3 medals) previously bottomed at
 * ≈462 > 440 maxBlockBottom and overlapped the footer; tiers 3–5 close that.
 */
export function resolveKeepsakeLayout(input: KeepsakeLayoutInput): KeepsakeLayout {
  const { hasPermission, topY, maxBottomY } = input;
  const hasAigc = input.hasAigcLabel ?? false;
  // Minimal block grows by the AIGC row when the label is on (Q1-4).
  const minBlockHeight =
    KEEPSAKE_MIN_BLOCK_HEIGHT + (hasAigc ? (4 + 12) * SCALE : 0);
  const skip = maxBottomY - topY < minBlockHeight;

  let compact = false;
  let lineCount = Math.max(1, input.questionLineCount);
  let metrics = keepsakeMetricsFor(compact, lineCount, hasPermission, hasAigc);
  if (topY + metrics.total > maxBottomY) {
    compact = true;
    metrics = keepsakeMetricsFor(true, lineCount, hasPermission, hasAigc);
  }
  if (topY + metrics.total > maxBottomY && lineCount > 1) {
    lineCount = 1;
    metrics = keepsakeMetricsFor(true, lineCount, hasPermission, hasAigc);
  }
  let dropPermission = false;
  if (topY + metrics.total > maxBottomY && hasPermission) {
    dropPermission = true;
    metrics = keepsakeMetricsFor(true, lineCount, false, hasAigc);
  }
  const blockHeight = Math.min(metrics.total, Math.max(maxBottomY - topY, 0));

  return {
    skip,
    compact,
    lineCount,
    dropPermission,
    blockHeight,
    padY: metrics.padY,
    eyebrowRow: metrics.eyebrowRow,
    gapAfterEyebrow: metrics.gapAfterEyebrow,
    questionLineHeight: metrics.questionLineHeight,
    gapBeforePermission: metrics.gapBeforePermission,
    permissionRow: metrics.permissionRow,
    gapBeforeAigc: metrics.gapBeforeAigc,
    aigcRow: metrics.aigcRow,
  };
}

/**
 * 话题留档 keepsake block (campfire-vault-card-pr3 R1–R5) — cream-and-foil card
 * replacing the plain quote zone. Draws within [topY, maxBottomY] (scaled px)
 * and returns the block bottom Y. Degradation ladder lives in the pure
 * resolveKeepsakeLayout (C9): compact paddings → one-line question → drop
 * 悦仔说 → hard clip → skip, so cast/medals/footer never overlap and the
 * total card height never changes (R5).
 */
function drawKeepsakeBlock(
  ctx: any,
  keepsake: MomentCardKeepsake,
  topY: number,
  maxBottomY: number,
  cardWidth: number,
  hasAigcLabel = true
): number {
  const marginX = 30 * SCALE; // matches castLeftMargin
  const blockWidth = cardWidth - marginX * 2;
  const padX = 16 * SCALE;
  const contentWidth = blockWidth - padX * 2;
  const centerX = cardWidth / 2;

  const eyebrowSize = 11 * SCALE;
  const questionSize = 20 * SCALE;
  const permissionSize = 13 * SCALE;
  const sealTextSize = 10 * SCALE;
  const aigcSize = 10 * SCALE;

  const permissionText = keepsake.permissionLine?.trim()
    ? `悦仔说 · ${keepsake.permissionLine.trim()}`
    : null;
  const seal = keepsake.depthLevel ? KEEPSAKE_SEAL_COLORS[keepsake.depthLevel] : undefined;

  ctx.setFontSize(questionSize);
  let questionLines = wrapCanvasText(ctx, keepsake.question, contentWidth, 2);

  const layout = resolveKeepsakeLayout({
    questionLineCount: questionLines.length,
    hasPermission: !!permissionText,
    hasAigcLabel,
    topY,
    maxBottomY,
  });
  if (layout.skip) {
    // Last resort (C9): not enough room for even the minimal block — skip
    // the keepsake entirely so medals/footer never collide.
    return topY;
  }
  if (layout.lineCount < questionLines.length) {
    questionLines = wrapCanvasText(ctx, keepsake.question, contentWidth, layout.lineCount);
  }

  const blockHeight = layout.blockHeight;
  const bottomY = topY + blockHeight;

  // ── Cream card + foil border (R1) ──
  ctx.setFillStyle(KEEPSAKE_BG);
  traceRoundedRect(ctx, marginX, topY, blockWidth, blockHeight, 16 * SCALE);
  ctx.fill();
  ctx.setStrokeStyle(KEEPSAKE_BORDER);
  ctx.setLineWidth(2 * SCALE);
  ctx.stroke();

  let cursorY = topY + layout.padY;

  // ── Eyebrow row: letterspaced label left + depth seal right (R2) ──
  const eyebrowCenterY = cursorY + layout.eyebrowRow / 2;
  ctx.setFontSize(eyebrowSize);
  ctx.setFillStyle(KEEPSAKE_EYEBROW_COLOR);
  ctx.setTextAlign('left');
  const letterSpacing = 1.5 * SCALE;
  let eyebrowX = marginX + padX;
  for (const ch of '今晚的话题卡') {
    ctx.fillText(ch, eyebrowX, eyebrowCenterY + eyebrowSize * 0.35);
    eyebrowX += ctx.measureText(ch).width + letterSpacing;
  }

  if (seal && keepsake.depthLevel) {
    const sealText = `深度·L${keepsake.depthLevel}`;
    const sealHeight = (layout.compact ? 16 : 18) * SCALE;
    ctx.setFontSize(sealTextSize);
    const sealWidth = ctx.measureText(sealText).width + 16 * SCALE;
    const sealX = marginX + blockWidth - padX - sealWidth;
    const sealY = eyebrowCenterY - sealHeight / 2;
    ctx.setFillStyle(seal.fill);
    traceRoundedRect(ctx, sealX, sealY, sealWidth, sealHeight, sealHeight / 2);
    ctx.fill();
    ctx.setStrokeStyle(seal.border);
    ctx.setLineWidth(1 * SCALE);
    ctx.stroke();
    ctx.setFillStyle(seal.text);
    ctx.setTextAlign('center');
    ctx.fillText(sealText, sealX + sealWidth / 2, eyebrowCenterY + sealTextSize * 0.35);
  }
  cursorY += layout.eyebrowRow + layout.gapAfterEyebrow;

  // ── Question: bold dark, centered, ≤2 lines (R3) ──
  // The legacy canvas API has no font-weight, so bold is faked with a second
  // pass at a sub-pixel x offset.
  ctx.setFontSize(questionSize);
  ctx.setFillStyle(KEEPSAKE_QUESTION_COLOR);
  ctx.setTextAlign('center');
  questionLines.forEach((line, i) => {
    const baseline =
      cursorY + layout.questionLineHeight * i + layout.questionLineHeight / 2 + questionSize * 0.35;
    ctx.fillText(line, centerX, baseline);
    ctx.fillText(line, centerX + 0.4 * SCALE, baseline);
  });
  cursorY += layout.questionLineHeight * questionLines.length;

  // ── 悦仔说 permission whisper (R4) — omitted when absent, dropped as the
  // third degradation tier when space runs out (C9) ──
  if (permissionText && !layout.dropPermission) {
    cursorY += layout.gapBeforePermission;
    ctx.setFontSize(permissionSize);
    const [permissionLine] = wrapCanvasText(ctx, permissionText, contentWidth, 1);
    if (permissionLine) {
      ctx.setFillStyle(KEEPSAKE_PERMISSION_COLOR);
      ctx.fillText(
        permissionLine,
        centerX,
        cursorY + layout.permissionRow / 2 + permissionSize * 0.35
      );
    }
  }

  // ── Q1-4 — quiet AIGC microline, right-aligned at the bottom of the block.
  // Compliance row: present on every labelled tier of the ladder (never
  // dropped like the 悦仔说 whisper). Matches the server renderer's line.
  if (hasAigcLabel && layout.aigcRow > 0) {
    cursorY += layout.gapBeforeAigc;
    ctx.setFontSize(aigcSize);
    ctx.setFillStyle(KEEPSAKE_AIGC_COLOR);
    ctx.setTextAlign('right');
    ctx.fillText(
      '话题由 AI 生成',
      marginX + blockWidth - padX,
      cursorY + layout.aigcRow / 2 + aigcSize * 0.35
    );
  }

  return bottomY;
}

async function canvasToTempFilePathWithRetry(
  options: any,
  maxRetries = 3,
  delayMs = 150
): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await Taro.canvasToTempFilePath(options);
      return res.tempFilePath;
    } catch {
      if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

function prefersReducedMotion(): boolean {
  try {
    const info = Taro.getSystemInfoSync();
    // WeChat mini-program does not expose reduced-motion directly;
    // treat dark-theme older devices as a weak heuristic, otherwise
    // rely on the short 100 ms fallback in the UI.
    if ((info as any).reduceMotion) return true;
  } catch {
    // ignore
  }
  return false;
}

export default function MomentCardView({ payload, visible, onClose }: MomentCardViewProps) {
  const [canvasUrl, setCanvasUrl] = useState('');
  const [fadeIn, setFadeIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);

  const canvasId = `moment-card-${payload.generatedAt}`;

  // C7 — every deferred draw/fade timer is tracked in a ref array and
  // cleared by the scheduling effect's cleanup (close, re-open, unmount),
  // so nothing fires into a dead or hidden overlay.
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const drawCard = useCallback(() => {
    const ctx = Taro.createCanvasContext(canvasId);
    if (!ctx) return;

    const w = CARD_WIDTH * SCALE;
    const h = CARD_HEIGHT * SCALE;

    // ── Background ──
    // Dark charcoal base
    ctx.setFillStyle(CARD_BG_DARK);
    ctx.fillRect(0, 0, w, h);

    // Subtle gold radial glow (top-right)
    const glow = (ctx as any).createRadialGradient(w * 0.75, h * 0.12, 0, w * 0.75, h * 0.12, w * 0.6);
    glow.addColorStop(0, 'rgba(212, 175, 55, 0.12)');
    glow.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.setFillStyle(glow);
    ctx.fillRect(0, 0, w, h);

    // Second faint accent glow (bottom-left)
    const glow2 = (ctx as any).createRadialGradient(w * 0.2, h * 0.88, 0, w * 0.2, h * 0.88, w * 0.5);
    glow2.addColorStop(0, 'rgba(212, 175, 55, 0.08)');
    glow2.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.setFillStyle(glow2);
    ctx.fillRect(0, 0, w, h);

    // Decorative circles — shifted to very subtle brand tones
    ctx.setFillStyle('rgba(212, 175, 55, 0.03)');
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.15, w * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.setFillStyle('rgba(180, 160, 120, 0.03)');
    ctx.beginPath();
    ctx.arc(w * 0.2, h * 0.85, w * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Title
    ctx.setFillStyle(CARD_TEXT_WHITE);
    ctx.setFontSize(28 * SCALE);
    ctx.setTextAlign('center');
    ctx.fillText('JoyJoin', w / 2, 50 * SCALE);

    // Headline
    ctx.setFontSize(26 * SCALE);
    ctx.setFillStyle(CARD_GOLD_MUTED); // muted gold, not pure #ffd700
    const headline = payload.headline.length > 18 ? payload.headline.slice(0, 17) + '…' : payload.headline;
    ctx.fillText(headline, w / 2, 100 * SCALE);

    // Subheadline
    ctx.setFontSize(16 * SCALE);
    ctx.setFillStyle('#cccccc');
    ctx.fillText(payload.subheadline, w / 2, 135 * SCALE);

    // Divider
    ctx.setStrokeStyle('rgba(212, 175, 55, 0.35)');
    ctx.setLineWidth(1 * SCALE);
    ctx.beginPath();
    ctx.moveTo(w * 0.15, 160 * SCALE);
    ctx.lineTo(w * 0.85, 160 * SCALE);
    ctx.stroke();

    // ── Cast (horizontal rows) ──
    ctx.setTextAlign('left');
    ctx.setFontSize(12 * SCALE);
    ctx.setFillStyle('#888888');
    ctx.fillText('今晚的局', 30 * SCALE, 182 * SCALE);

    const castLabelY = 182 * SCALE;
    const castStartY = castLabelY + 22 * SCALE;
    const circleDia = 16 * SCALE;
    const castTextSize = 14 * SCALE;
    const castRowHeight = 36 * SCALE;
    const castItemsPerRow = 4;
    const castHGap = 12 * SCALE; // horizontal gap between items
    const castVGap = 8 * SCALE;  // vertical gap between rows
    const castLeftMargin = 30 * SCALE;

    const castOverflowCount = payload.cast.length > 12 ? payload.cast.length - 11 : 0;
    const castToRender = payload.cast.slice(0, castOverflowCount > 0 ? 11 : 12);
    const castOverflow = castOverflowCount > 0 ? `+${castOverflowCount}` : null;

    ctx.setFontSize(castTextSize);
    let currentX = castLeftMargin;
    let currentY = castStartY;
    let itemsInCurrentRow = 0;

    const drawCastItem = (name: string, colorHex: string) => {
      // Colored circle
      ctx.setFillStyle(colorHex);
      ctx.beginPath();
      ctx.arc(currentX + circleDia / 2, currentY - castTextSize * 0.35, circleDia / 2, 0, Math.PI * 2);
      ctx.fill();

      // Name
      ctx.setFillStyle('#dddddd');
      const textX = currentX + circleDia + 4 * SCALE;
      ctx.fillText(name, textX, currentY);

      const textWidth = ctx.measureText(name).width;
      const itemWidth = circleDia + 4 * SCALE + textWidth + castHGap;
      currentX += itemWidth;
      itemsInCurrentRow++;

      if (itemsInCurrentRow >= castItemsPerRow) {
        currentX = castLeftMargin;
        currentY += castRowHeight + castVGap;
        itemsInCurrentRow = 0;
      }
    };

    castToRender.forEach((member) => {
      const colorHex = getArchetypeHex(member.archetype);
      drawCastItem(member.displayName, colorHex);
    });

    if (castOverflow && itemsInCurrentRow >= castItemsPerRow) {
      currentX = castLeftMargin;
      currentY += castRowHeight + castVGap;
      itemsInCurrentRow = 0;
    }
    if (castOverflow) {
      ctx.setFillStyle('#888888');
      ctx.fillText(castOverflow, currentX, currentY);
      currentX += ctx.measureText(castOverflow).width + castHGap;
      itemsInCurrentRow++;
    }

    // Normalize Y after cast rows for next section
    const castEndY = itemsInCurrentRow === 0 ? currentY - castVGap : currentY + castRowHeight;

    // ── Stats ──
    const statsY = castEndY + 16 * SCALE;
    ctx.setTextAlign('center');
    ctx.setFontSize(14 * SCALE);
    ctx.setFillStyle('#888888');
    ctx.fillText(
      `${payload.stats.durationMinutes}分钟 · ${payload.stats.phasesCompleted}/${payload.stats.totalPhases}个环节`,
      w / 2,
      statsY
    );

    // ── Quote / Keepsake ──
    // 话题留档 (campfire-vault-card-pr3 R5): parity with the server renderer —
    // a recap-moment quote can coexist with the keepsake (quote line stacks
    // above the block); without a keepsake the quote path renders exactly as
    // before (G3). The warmup-topic quote branch is already suppressed
    // server-side whenever a keepsake exists, so no duplication is possible.
    let nextY = statsY + 30 * SCALE;
    const keepsake =
      payload.keepsake && payload.keepsake.question && payload.keepsake.question.trim()
        ? payload.keepsake
        : null;
    if (payload.quote) {
      const quoteY = nextY;
      ctx.setFontSize(14 * SCALE);
      ctx.setFillStyle('#bbbbbb');
      const quoteText = payload.quote.length > 40 ? payload.quote.slice(0, 39) + '…' : payload.quote;
      ctx.fillText(`"${quoteText}"`, w / 2, quoteY);
      nextY = quoteY + (keepsake ? 22 : 30) * SCALE;
    }
    if (keepsake) {
      const hasMedals = payload.medals.length > 0;
      // Tightened spacing keeps block + medals clear of the fixed footer:
      // medals pill bottom ≤ 476 (footer text top ≈ 478); block bottom ≤ 440
      // with medals, ≤ 470 without. Total card height is unchanged.
      const keepsakeTop = payload.quote ? nextY - 10 * SCALE : statsY + 10 * SCALE;
      const maxBlockBottom = (hasMedals ? 440 : 470) * SCALE;
      const blockBottom = drawKeepsakeBlock(ctx, keepsake, keepsakeTop, maxBlockBottom, w);
      nextY = blockBottom + 30 * SCALE;
    }

    // ── Medals (horizontal chips) ──
    if (payload.medals.length > 0) {
      const medalY = nextY;
      const medalTextSize = 13 * SCALE;
      const medalHeight = 28 * SCALE;
      const medalHGap = 12 * SCALE;
      const medalHPadding = 10 * SCALE;
      const medalVPadding = 6 * SCALE;
      const cornerRadius = 14 * SCALE;

      ctx.setFontSize(medalTextSize);

      const medalsToRender = payload.medals.slice(0, 3);
      const medalTexts = medalsToRender.map(
        (m) => `${m.emoji} ${m.title}: ${m.recipient}`
      );
      const medalWidths = medalTexts.map((t) => ctx.measureText(t).width + medalHPadding * 2);
      const totalMedalWidth = medalWidths.reduce((a, b) => a + b, 0) + (medalsToRender.length - 1) * medalHGap;
      let medalX = (w - totalMedalWidth) / 2;

      medalsToRender.forEach((medal, i) => {
        const mw = medalWidths[i];

        // Pill background (dark)
        ctx.setFillStyle('rgba(30, 30, 47, 0.95)');
        ctx.beginPath();
        ctx.moveTo(medalX + cornerRadius, medalY - medalHeight + medalVPadding);
        ctx.lineTo(medalX + mw - cornerRadius, medalY - medalHeight + medalVPadding);
        ctx.arc(
          medalX + mw - cornerRadius,
          medalY - medalHeight / 2 + medalVPadding,
          cornerRadius,
          -Math.PI / 2,
          Math.PI / 2
        );
        ctx.lineTo(medalX + cornerRadius, medalY + medalVPadding);
        ctx.arc(
          medalX + cornerRadius,
          medalY - medalHeight / 2 + medalVPadding,
          cornerRadius,
          Math.PI / 2,
          -Math.PI / 2
        );
        ctx.closePath();
        ctx.fill();

        // Gold border
        ctx.setStrokeStyle('rgba(212, 175, 55, 0.55)');
        ctx.setLineWidth(1 * SCALE);
        ctx.stroke();

        // Text
        ctx.setFillStyle('#e8d8b8');
        ctx.setTextAlign('left');
        ctx.fillText(medalTexts[i], medalX + medalHPadding, medalY - medalHeight / 2 + medalVPadding + medalTextSize * 0.35);

        medalX += mw + medalHGap;
      });

      nextY = medalY + medalHeight + 10 * SCALE;
    }

    // ── Footer ──
    // Q1-3 — no QR-code drawing utility exists in the mini-program and we do
    // not add a dependency for this; the footer only promises what the card
    // actually delivers (long-press save).
    ctx.setTextAlign('center');
    ctx.setFontSize(12 * SCALE);
    ctx.setFillStyle('#666666');
    ctx.fillText('长按保存图片', w / 2, h - 30 * SCALE);

    ctx.draw(false, async () => {
      const tempPath = await canvasToTempFilePathWithRetry({
        canvasId,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        destWidth: CARD_WIDTH * SCALE,
        destHeight: CARD_HEIGHT * SCALE,
      });
      if (tempPath) {
        setCanvasUrl(tempPath);
        setCanvasFailed(false);
      } else {
        setCanvasFailed(true);
        logError('[MomentCard] Canvas to temp file failed after retries');
      }
    });
  }, [canvasId, payload]);

  useEffect(() => {
    if (!(visible && !canvasUrl && !canvasFailed)) return;
    const delay = prefersReducedMotion() ? 0 : 100;
    const drawTimer = setTimeout(() => {
      drawCard();
      const fadeDelay = prefersReducedMotion() ? 0 : 100;
      const fadeTimer = setTimeout(() => setFadeIn(true), fadeDelay);
      timersRef.current.push(fadeTimer);
    }, delay);
    timersRef.current.push(drawTimer);
    return () => {
      for (const timer of timersRef.current) clearTimeout(timer);
      timersRef.current = [];
    };
  }, [visible, canvasUrl, canvasFailed, drawCard]);

  const handleSave = useCallback(async () => {
    if (!canvasUrl) return;
    setSaving(true);
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: canvasUrl });
      Taro.showToast({ title: '已保存到相册', icon: 'success' });
    } catch {
      // If unauthorized, show preview for manual save
      Taro.previewImage({ urls: [canvasUrl] });
    } finally {
      setSaving(false);
    }
  }, [canvasUrl]);

  const handleLongPress = useCallback(() => {
    if (!canvasUrl) return;
    Taro.showActionSheet({
      itemList: ['保存图片', '转发给朋友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          handleSave();
        } else if (res.tapIndex === 1) {
          Taro.showShareImageMenu({ path: canvasUrl }).catch(() => {
            Taro.showToast({ title: '请长按图片分享', icon: 'none' });
          });
        }
      },
    });
  }, [canvasUrl, handleSave]);

  const handleRetry = useCallback(() => {
    setCanvasFailed(false);
    setCanvasUrl('');
    // drawCard will be triggered by the useEffect when canvasUrl becomes empty
  }, []);

  if (!visible) return null;

  const reducedMotion = prefersReducedMotion();

  return (
    <View
      className={`moment-card-overlay ${fadeIn ? 'fade-in' : ''}`}
      role='dialog'
      aria-modal='true'
      aria-label='今晚的回忆卡'
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        opacity: fadeIn ? 1 : 0,
        transition: reducedMotion ? 'opacity 100ms ease' : 'opacity 800ms ease',
      }}
      onClick={onClose}
    >
      <View
        style={{
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 8rpx 32rpx rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
        onLongPress={handleLongPress}
      >
        {canvasFailed ? (
          <View
            style={{
              width: `${CARD_WIDTH}rpx`,
              height: `${CARD_HEIGHT}rpx`,
              backgroundColor: CARD_BG_DARK,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40rpx',
              boxSizing: 'border-box',
            }}
          >
            <Text style={{ color: CARD_GOLD_MUTED, fontSize: '32rpx', fontWeight: 'bold', marginBottom: '16rpx' }}>
              JoyJoin
            </Text>
            <Text style={{ color: CARD_TEXT_MUTED, fontSize: '28rpx', textAlign: 'center', marginBottom: '32rpx' }}>
              回忆卡没生成成功，再试试
            </Text>
            <View
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
              role='button'
              aria-label='重新生成回忆卡'
              style={{
                backgroundColor: CARD_GOLD_MUTED,
                color: CARD_BG_DARK,
                padding: '12rpx 40rpx',
                borderRadius: '32rpx',
                fontSize: '28rpx',
                fontWeight: 'bold',
                minHeight: '88rpx',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              再试试
            </View>
          </View>
        ) : canvasUrl ? (
          <Image
            src={canvasUrl}
            style={{ width: `${CARD_WIDTH}rpx`, height: `${CARD_HEIGHT}rpx` }}
            mode='aspectFit'
            showMenuByLongpress
            aria-label='今晚的回忆卡预览图'
          />
        ) : (
          <Canvas
            canvasId={canvasId}
            style={{
              width: `${CARD_WIDTH}rpx`,
              height: `${CARD_HEIGHT}rpx`,
            }}
          />
        )}
      </View>

      <View style={{ marginTop: '24rpx', display: 'flex', gap: '16rpx' }}>
        <View
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
          role='button'
          aria-label={saving ? '正在保存图片' : '保存图片'}
          style={{
            backgroundColor: CARD_GOLD_MUTED,
            color: CARD_BG_DARK,
            padding: '12rpx 32rpx',
            borderRadius: '32rpx',
            fontSize: '28rpx',
            fontWeight: 'bold',
            opacity: saving ? 0.6 : 1,
            minHeight: '88rpx',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          {saving ? '保存中...' : '保存到相册'}
        </View>
        <View
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          role='button'
          aria-label='关闭'
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: CARD_TEXT_WHITE,
            padding: '12rpx 32rpx',
            borderRadius: '32rpx',
            fontSize: '28rpx',
            minHeight: '88rpx',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          关闭
        </View>
      </View>

      <Text style={{ marginTop: '16rpx', color: '#888888', fontSize: '22rpx' }}>
        长按卡片可查看更多选项
      </Text>
    </View>
  );
}
