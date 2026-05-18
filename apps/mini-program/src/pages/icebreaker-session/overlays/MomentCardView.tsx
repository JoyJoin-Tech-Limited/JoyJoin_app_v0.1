import { useState, useEffect, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Canvas, Text, Image } from '@tarojs/components';
import { getArchetypeHSL } from '@shared/archetypeColors';

// Moment card color constants (avoiding hardcoded hex in inline styles / canvas)
const CARD_BG_DARK = '#1e1e2f';
const CARD_GOLD_MUTED = '#d4af37';
const CARD_TEXT_MUTED = '#9CA3AF';
const CARD_TEXT_WHITE = '#FDFCFA';

interface MomentCardCastMember {
  displayName: string;
  archetype?: string;
  archetypeEmoji?: string;
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

    // ── Quote ──
    let nextY = statsY + 30 * SCALE;
    if (payload.quote) {
      const quoteY = nextY;
      ctx.setFontSize(14 * SCALE);
      ctx.setFillStyle('#bbbbbb');
      const quoteText = payload.quote.length > 40 ? payload.quote.slice(0, 39) + '…' : payload.quote;
      ctx.fillText(`"${quoteText}"`, w / 2, quoteY);
      nextY = quoteY + 30 * SCALE;
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
    ctx.setTextAlign('center');
    ctx.setFontSize(12 * SCALE);
    ctx.setFillStyle('#666666');
    ctx.fillText('长按保存图片 · 扫码加入JoyJoin', w / 2, h - 30 * SCALE);

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
        console.error('Canvas to temp file failed after retries');
      }
    });
  }, [canvasId, payload]);

  useEffect(() => {
    if (visible && !canvasUrl && !canvasFailed) {
      const delay = prefersReducedMotion() ? 0 : 100;
      setTimeout(() => {
        drawCard();
        const fadeDelay = prefersReducedMotion() ? 0 : 100;
        setTimeout(() => setFadeIn(true), fadeDelay);
      }, delay);
    }
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
              style={{
                backgroundColor: CARD_GOLD_MUTED,
                color: CARD_BG_DARK,
                padding: '12rpx 40rpx',
                borderRadius: '32rpx',
                fontSize: '28rpx',
                fontWeight: 'bold',
              }}
            >
              再试试
            </View>
          </View>
        ) : canvasUrl ? (
          <Image
            src={canvasUrl}
            style={{ width: `${CARD_WIDTH}rpx`, height: `${CARD_HEIGHT}rpx` }}
            mode="aspectFit"
            showMenuByLongpress
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
          style={{
            backgroundColor: CARD_GOLD_MUTED,
            color: CARD_BG_DARK,
            padding: '12rpx 32rpx',
            borderRadius: '32rpx',
            fontSize: '28rpx',
            fontWeight: 'bold',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '保存中...' : '保存到相册'}
        </View>
        <View
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: CARD_TEXT_WHITE,
            padding: '12rpx 32rpx',
            borderRadius: '32rpx',
            fontSize: '28rpx',
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
