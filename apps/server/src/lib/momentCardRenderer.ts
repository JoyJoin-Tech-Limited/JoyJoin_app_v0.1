/**
 * Server-side Moment Card PNG renderer.
 *
 * Replicates the mini-program Canvas layout from MomentCardView.tsx
 * using @napi-rs/canvas for headless rendering.
 *
 * Font note: CJK text requires a Chinese font installed on the host.
 *   macOS dev: PingFang SC is available.
 *   Linux prod: ensure fonts-noto-cjk or equivalent is installed.
 */

import { createCanvas, loadImage, SKRSContext2D, GlobalFonts } from "@napi-rs/canvas";
import QRCode from "qrcode";
import { getArchetypeHSL } from "@joyjoin/shared";
import type { MomentCardKeepsake, MomentCardPayload } from "./momentCardPayload";
import { logger } from "./logger";
import { existsSync } from "fs";

// ── CJK font registration ──────────────────────────────────────────────────
const CJK_FONT_CANDIDATES = [
  // macOS
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
  "/Library/Fonts/Arial Unicode.ttf",
  // Linux (common package paths)
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
];

let cjkFontRegistered = false;
for (const path of CJK_FONT_CANDIDATES) {
  if (existsSync(path)) {
    try {
      GlobalFonts.registerFromPath(path);
      cjkFontRegistered = true;
      break;
    } catch {
      // try next candidate
    }
  }
}

if (!cjkFontRegistered) {
  logger.warn(
    '[MomentCardRenderer] No CJK font registered. Chinese characters may render as boxes. ' +
    'Install fonts-noto-cjk or wqy-zenhei on the server.',
  );
}

const CARD_WIDTH = 640;
const CARD_HEIGHT = 1040;

// Brand colors (match MomentCardView.tsx)
const CARD_BG_DARK = "#1e1e2f";
const CARD_GOLD_MUTED = "#d4af37";
const CARD_TEXT_MUTED = "#9CA3AF";
const CARD_TEXT_WHITE = "#FDFCFA";

/** Best-effort CJK font stack for the server environment. */
const FONT_FAMILY = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const col = light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(col * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getArchetypeHex(archetype: string | undefined): string {
  const hsl = getArchetypeHSL(archetype);
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

function setFont(ctx: SKRSContext2D, size: number, weight: string | number = "normal") {
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
}

function measureTextWidth(ctx: SKRSContext2D, text: string): number {
  return ctx.measureText(text).width;
}

function drawRoundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Clamp text to maxWidth, appending an ellipsis when truncation is needed. */
function fitWithEllipsis(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (measureTextWidth(ctx, text) <= maxWidth) return text;
  const chars = [...text]; // codepoint-safe (CJK)
  let out = text;
  while (chars.length > 0 && measureTextWidth(ctx, out + "…") > maxWidth) {
    chars.pop();
    out = chars.join("");
  }
  return out + "…";
}

/**
 * CJK-safe manual word wrap: breaks per codepoint (no word-boundary assumption),
 * capped at maxLines with an ellipsis on the last line when truncated.
 * Caller must set the font before invoking.
 */
function wrapTextLines(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chars = [...text];
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < chars.length; i++) {
    const candidate = current + chars[i];
    if (current && measureTextWidth(ctx, candidate) > maxWidth) {
      lines.push(current);
      if (lines.length === maxLines - 1) {
        // Last allowed line — fit the remainder with an ellipsis reservation.
        lines.push(fitWithEllipsis(ctx, chars.slice(i).join(""), maxWidth));
        return lines;
      }
      current = chars[i];
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

/** Depth seal palette — same colors as PR1 seals. */
const KEEPSAKE_SEAL_STYLES: Record<number, { base: string; deep: string }> = {
  1: { base: "#5B8DB8", deep: "#3D6E9C" },
  2: { base: "#8B5CF6", deep: "#7C3AED" },
  3: { base: "#C99A3C", deep: "#8A651A" },
};

/**
 * 话题留档 keepsake block — cream editorial card on the dark Moment Card.
 * Draws the eyebrow row (「今晚的话题卡」 + depth seal pill), the question
 * (bold, ≤2 lines, ellipsis-clamped), and the 悦仔说 permission line when
 * present. Returns the Y coordinate just below the block.
 */
function drawKeepsakeBlock(
  ctx: SKRSContext2D,
  w: number,
  y: number,
  keepsake: MomentCardKeepsake,
): number {
  const blockX = 30;
  const blockW = w - 60;
  const padX = 24;
  const padTop = 20;
  const padBottom = 20;
  const contentW = blockW - padX * 2;

  const eyebrowRowH = 16;
  const questionFontSize = 20;
  const questionLineH = 27;
  const gapEyebrowQuestion = 8;

  const permissionLine =
    typeof keepsake.permissionLine === "string" && keepsake.permissionLine.trim().length > 0
      ? keepsake.permissionLine.trim()
      : null;
  const permissionGap = 6;
  const permissionH = permissionLine ? 16 : 0;

  // AIGC compliance microline — always present, right-aligned inside the
  // block's bottom padding (mirrors the mini-program MomentCardView label).
  const AIGC_LABEL = "话题由 AI 生成";
  const aigcFontSize = 10;
  const aigcGap = 6;
  const aigcRowH = 14;

  // Pre-measure the question so block height is known before painting.
  setFont(ctx, questionFontSize, 600);
  const questionLines = wrapTextLines(ctx, keepsake.question, contentW, 2);
  const questionH = questionLines.length * questionLineH;

  const blockH =
    padTop + eyebrowRowH + gapEyebrowQuestion + questionH +
    (permissionLine ? permissionGap + permissionH : 0) +
    aigcGap + aigcRowH + padBottom;

  // Cream card + foil border
  ctx.fillStyle = "#FFFAF4";
  drawRoundedRect(ctx, blockX, y, blockW, blockH, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(139, 92, 246, 0.45)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, blockX, y, blockW, blockH, 16);
  ctx.stroke();

  // Eyebrow — per-char advance for letterspacing. Canvas has no
  // letter-spacing, and U+2009 thin-space joins render as tofu when the host
  // CJK font lacks that glyph (mirrors mini-program MomentCardView).
  setFont(ctx, 11, 600);
  ctx.fillStyle = "#7C3AED";
  ctx.textAlign = "left";
  const eyebrowLetterSpacing = 1.5;
  const eyebrowBaselineY = y + padTop + 11;
  let eyebrowX = blockX + padX;
  for (const ch of "今晚的话题卡") {
    ctx.fillText(ch, eyebrowX, eyebrowBaselineY);
    eyebrowX += measureTextWidth(ctx, ch) + eyebrowLetterSpacing;
  }

  // Depth seal pill, right-aligned on the eyebrow row (text only, no emoji).
  const level =
    keepsake.depthLevel === 1 || keepsake.depthLevel === 2 || keepsake.depthLevel === 3
      ? keepsake.depthLevel
      : undefined;
  if (level) {
    const seal = KEEPSAKE_SEAL_STYLES[level];
    const sealText = `深度·L${level}`;
    setFont(ctx, 10, 600);
    const sealPillH = 18;
    const sealPadX = 8;
    const sealPillW = measureTextWidth(ctx, sealText) + sealPadX * 2;
    const sealX = blockX + blockW - padX - sealPillW;
    const sealY = y + padTop + 1;
    ctx.fillStyle = hexToRgba(seal.base, 0.14);
    drawRoundedRect(ctx, sealX, sealY, sealPillW, sealPillH, sealPillH / 2);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(seal.base, 0.55);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, sealX, sealY, sealPillW, sealPillH, sealPillH / 2);
    ctx.stroke();
    ctx.fillStyle = seal.deep;
    ctx.textAlign = "center";
    ctx.fillText(sealText, sealX + sealPillW / 2, sealY + sealPillH / 2 + 3.5);
  }

  // Question — bold, centered, ≤2 lines.
  ctx.textAlign = "center";
  setFont(ctx, questionFontSize, 600);
  ctx.fillStyle = "#1F2937";
  const questionTop = y + padTop + eyebrowRowH + gapEyebrowQuestion;
  questionLines.forEach((line, i) => {
    ctx.fillText(line, w / 2, questionTop + 16 + i * questionLineH);
  });

  // 悦仔说 permission whisper — omitted entirely when absent (no dangling prefix).
  if (permissionLine) {
    setFont(ctx, 13);
    ctx.fillStyle = "rgba(55, 65, 81, 0.62)";
    const permissionBaseline =
      questionTop + questionH + permissionGap + 11;
    ctx.fillText(
      fitWithEllipsis(ctx, `悦仔说 · ${permissionLine}`, contentW),
      w / 2,
      permissionBaseline,
    );
  }

  // AIGC compliance microline — quiet, right-aligned at the content edge,
  // sitting in the reserved row above the bottom padding.
  setFont(ctx, aigcFontSize);
  ctx.fillStyle = "rgba(55, 65, 81, 0.45)";
  ctx.textAlign = "right";
  const aigcBaseline =
    questionTop + questionH +
    (permissionLine ? permissionGap + permissionH : 0) +
    aigcGap + 10;
  ctx.fillText(AIGC_LABEL, blockX + blockW - padX, aigcBaseline);

  ctx.textAlign = "left";
  return y + blockH;
}

export async function renderMomentCardToPng(payload: MomentCardPayload): Promise<Buffer> {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;

  // ── Background ──
  ctx.fillStyle = CARD_BG_DARK;
  ctx.fillRect(0, 0, w, h);

  // Gold radial glow (top-right)
  const glow1 = ctx.createRadialGradient(w * 0.75, h * 0.12, 0, w * 0.75, h * 0.12, w * 0.6);
  glow1.addColorStop(0, "rgba(212, 175, 55, 0.12)");
  glow1.addColorStop(1, "rgba(212, 175, 55, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, w, h);

  // Second faint accent glow (bottom-left)
  const glow2 = ctx.createRadialGradient(w * 0.2, h * 0.88, 0, w * 0.2, h * 0.88, w * 0.5);
  glow2.addColorStop(0, "rgba(212, 175, 55, 0.08)");
  glow2.addColorStop(1, "rgba(212, 175, 55, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);

  // Decorative circles
  ctx.fillStyle = "rgba(212, 175, 55, 0.03)";
  ctx.beginPath();
  ctx.arc(w * 0.8, h * 0.15, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(180, 160, 120, 0.03)";
  ctx.beginPath();
  ctx.arc(w * 0.2, h * 0.85, w * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // ── Title ──
  setFont(ctx, 28, 600);
  ctx.fillStyle = CARD_TEXT_WHITE;
  ctx.textAlign = "center";
  ctx.fillText("JoyJoin", w / 2, 50);

  // ── Headline ──
  setFont(ctx, 26, 600);
  ctx.fillStyle = CARD_GOLD_MUTED;
  const headline = payload.headline.length > 18 ? payload.headline.slice(0, 17) + "…" : payload.headline;
  ctx.fillText(headline, w / 2, 100);

  // ── Subheadline ──
  setFont(ctx, 16);
  ctx.fillStyle = "#cccccc";
  ctx.fillText(payload.subheadline, w / 2, 135);

  // ── Divider ──
  ctx.strokeStyle = "rgba(212, 175, 55, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.15, 160);
  ctx.lineTo(w * 0.85, 160);
  ctx.stroke();

  // ── Cast ──
  ctx.textAlign = "left";
  setFont(ctx, 12);
  ctx.fillStyle = "#888888";
  ctx.fillText("今晚的局", 30, 182);

  const castLabelY = 182;
  const castStartY = castLabelY + 22;
  const circleDia = 16;
  const castTextSize = 14;
  const castRowHeight = 36;
  const castItemsPerRow = 4;
  const castHGap = 12;
  const castVGap = 8;
  const castLeftMargin = 30;

  const castOverflowCount = payload.cast.length > 12 ? payload.cast.length - 11 : 0;
  const castToRender = payload.cast.slice(0, castOverflowCount > 0 ? 11 : 12);
  const castOverflow = castOverflowCount > 0 ? `+${castOverflowCount}` : null;

  setFont(ctx, castTextSize);
  let currentX = castLeftMargin;
  let currentY = castStartY;
  let itemsInCurrentRow = 0;

  for (const member of castToRender) {
    const colorHex = getArchetypeHex(member.archetype);

    // Colored circle
    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.arc(currentX + circleDia / 2, currentY - castTextSize * 0.35, circleDia / 2, 0, Math.PI * 2);
    ctx.fill();

    // Name
    ctx.fillStyle = "#dddddd";
    const textX = currentX + circleDia + 4;
    ctx.fillText(member.displayName, textX, currentY);

    const textWidth = measureTextWidth(ctx, member.displayName);
    const itemWidth = circleDia + 4 + textWidth + castHGap;
    currentX += itemWidth;
    itemsInCurrentRow++;

    if (itemsInCurrentRow >= castItemsPerRow) {
      currentX = castLeftMargin;
      currentY += castRowHeight + castVGap;
      itemsInCurrentRow = 0;
    }
  }

  if (castOverflow && itemsInCurrentRow >= castItemsPerRow) {
    currentX = castLeftMargin;
    currentY += castRowHeight + castVGap;
    itemsInCurrentRow = 0;
  }
  if (castOverflow) {
    ctx.fillStyle = "#888888";
    ctx.fillText(castOverflow, currentX, currentY);
    currentX += measureTextWidth(ctx, castOverflow) + castHGap;
    itemsInCurrentRow++;
  }

  const castEndY = itemsInCurrentRow === 0 ? currentY - castVGap : currentY + castRowHeight;

  // ── Stats ──
  const statsY = castEndY + 16;
  ctx.textAlign = "center";
  setFont(ctx, 14);
  ctx.fillStyle = "#888888";
  ctx.fillText(
    `${payload.stats.durationMinutes}分钟 · ${payload.stats.phasesCompleted}/${payload.stats.totalPhases}个环节`,
    w / 2,
    statsY,
  );

  // ── Quote ──
  let nextY = statsY + 30;
  if (payload.quote) {
    const quoteY = nextY;
    setFont(ctx, 14);
    ctx.fillStyle = "#bbbbbb";
    const quoteText = payload.quote.length > 40 ? payload.quote.slice(0, 39) + "…" : payload.quote;
    ctx.fillText(`"${quoteText}"`, w / 2, quoteY);
    nextY = quoteY + 30;
  }

  // ── Keepsake block (话题留档) — replaces the quote zone when present ──
  if (payload.keepsake) {
    nextY = drawKeepsakeBlock(ctx, w, nextY, payload.keepsake) + 24;
  }

  // ── Medals ──
  if (payload.medals.length > 0) {
    const medalY = nextY;
    const medalTextSize = 13;
    const medalHeight = 28;
    const medalHGap = 12;
    const medalHPadding = 10;
    const medalVPadding = 6;
    const cornerRadius = 14;

    setFont(ctx, medalTextSize);

    const medalsToRender = payload.medals.slice(0, 3);
    const medalTexts = medalsToRender.map((m) => `${m.emoji} ${m.title}: ${m.recipient}`);
    const medalWidths = medalTexts.map((t) => measureTextWidth(ctx, t) + medalHPadding * 2);
    const totalMedalWidth = medalWidths.reduce((a, b) => a + b, 0) + (medalsToRender.length - 1) * medalHGap;
    let medalX = (w - totalMedalWidth) / 2;

    medalsToRender.forEach((medal, i) => {
      const mw = medalWidths[i];

      // Pill background
      ctx.fillStyle = "rgba(30, 30, 47, 0.95)";
      drawRoundedRect(ctx, medalX, medalY - medalHeight + medalVPadding, mw, medalHeight, cornerRadius);
      ctx.fill();

      // Gold border
      ctx.strokeStyle = "rgba(212, 175, 55, 0.55)";
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, medalX, medalY - medalHeight + medalVPadding, mw, medalHeight, cornerRadius);
      ctx.stroke();

      // Text
      ctx.fillStyle = "#e8d8b8";
      ctx.textAlign = "left";
      ctx.fillText(medalTexts[i], medalX + medalHPadding, medalY - medalHeight / 2 + medalVPadding + medalTextSize * 0.35);

      medalX += mw + medalHGap;
    });

    nextY = medalY + medalHeight + 10;
  }

  // ── QR Code ──
  if (payload.deepLinkUrl) {
    try {
      const qrSize = 80;
      const qrDataUrl = await QRCode.toDataURL(payload.deepLinkUrl, {
        width: qrSize,
        margin: 1,
        color: { dark: "#cccccc", light: "#1e1e2f" },
      });
      const qrImage = await loadImage(qrDataUrl);
      const qrX = w - qrSize - 30;
      const qrY = h - qrSize - 50;
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    } catch {
      // QR code is optional; ignore errors
    }
  }

  // ── Footer ──
  ctx.textAlign = "center";
  setFont(ctx, 12);
  ctx.fillStyle = "#666666";
  ctx.fillText("长按保存图片 · 扫码加入JoyJoin", w / 2, h - 30);

  return canvas.encode("png");
}
