import { useState, useEffect, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Canvas, Text, Image } from '@tarojs/components';

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

export default function MomentCardView({ payload, visible, onClose }: MomentCardViewProps) {
  const [canvasUrl, setCanvasUrl] = useState('');
  const [fadeIn, setFadeIn] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasId = `moment-card-${payload.generatedAt}`;

  const drawCard = useCallback(() => {
    const ctx = Taro.createCanvasContext(canvasId);
    if (!ctx) return;

    const w = CARD_WIDTH * SCALE;
    const h = CARD_HEIGHT * SCALE;

    // Background gradient
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#1a1a2e');
    grd.addColorStop(0.5, '#16213e');
    grd.addColorStop(1, '#0f3460');
    ctx.setFillStyle(grd);
    ctx.fillRect(0, 0, w, h);

    // Decorative circles
    ctx.setFillStyle('rgba(255, 255, 255, 0.03)');
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.15, w * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.2, h * 0.85, w * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Title
    ctx.setFillStyle('#ffffff');
    ctx.setFontSize(28 * SCALE);
    ctx.setTextAlign('center');
    ctx.fillText('JoyJoin', w / 2, 50 * SCALE);

    // Headline
    ctx.setFontSize(22 * SCALE);
    ctx.setFillStyle('#ffd700');
    const headline = payload.headline.length > 16 ? payload.headline.slice(0, 15) + '…' : payload.headline;
    ctx.fillText(headline, w / 2, 100 * SCALE);

    // Subheadline
    ctx.setFontSize(16 * SCALE);
    ctx.setFillStyle('#cccccc');
    ctx.fillText(payload.subheadline, w / 2, 130 * SCALE);

    // Divider
    ctx.setStrokeStyle('rgba(255, 215, 0, 0.4)');
    ctx.setLineWidth(1 * SCALE);
    ctx.beginPath();
    ctx.moveTo(w * 0.15, 150 * SCALE);
    ctx.lineTo(w * 0.85, 150 * SCALE);
    ctx.stroke();

    // Cast
    ctx.setTextAlign('left');
    ctx.setFontSize(14 * SCALE);
    ctx.setFillStyle('#aaaaaa');
    ctx.fillText('今晚的局', 30 * SCALE, 175 * SCALE);

    const castStartY = 195 * SCALE;
    const castItemHeight = 28 * SCALE;
    payload.cast.slice(0, 6).forEach((member, i) => {
      const y = castStartY + i * castItemHeight;
      ctx.setFontSize(16 * SCALE);
      ctx.setFillStyle('#ffffff');
      ctx.fillText(`${member.displayName}`, 30 * SCALE, y);
    });

    // Stats
    const statsY = castStartY + payload.cast.slice(0, 6).length * castItemHeight + 20 * SCALE;
    ctx.setTextAlign('center');
    ctx.setFontSize(14 * SCALE);
    ctx.setFillStyle('#888888');
    ctx.fillText(
      `${payload.stats.durationMinutes}分钟 · ${payload.stats.phasesCompleted}/${payload.stats.totalPhases}个环节`,
      w / 2,
      statsY
    );

    // Quote
    if (payload.quote) {
      const quoteY = statsY + 40 * SCALE;
      ctx.setFontSize(14 * SCALE);
      ctx.setFillStyle('#bbbbbb');
      const quoteText = payload.quote.length > 40 ? payload.quote.slice(0, 39) + '…' : payload.quote;
      ctx.fillText(`"${quoteText}"`, w / 2, quoteY);
    }

    // Medals
    if (payload.medals.length > 0) {
      const medalY = (payload.quote ? statsY + 70 * SCALE : statsY + 30 * SCALE);
      payload.medals.slice(0, 2).forEach((medal, i) => {
        const y = medalY + i * 30 * SCALE;
        ctx.setFontSize(14 * SCALE);
        ctx.setFillStyle('#ffd700');
        ctx.fillText(`${medal.emoji} ${medal.title}: ${medal.recipient}`, w / 2, y);
      });
    }

    // Footer
    ctx.setFontSize(12 * SCALE);
    ctx.setFillStyle('#666666');
    ctx.fillText('长按保存图片 · 扫码加入JoyJoin', w / 2, h - 30 * SCALE);

    ctx.draw(false, () => {
      Taro.canvasToTempFilePath({
        canvasId,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        destWidth: CARD_WIDTH * SCALE,
        destHeight: CARD_HEIGHT * SCALE,
        success: (res) => {
          setCanvasUrl(res.tempFilePath);
        },
        fail: () => {
          console.error('Canvas to temp file failed');
        },
      });
    });
  }, [canvasId, payload]);

  useEffect(() => {
    if (visible && !canvasUrl) {
      // Delay to ensure canvas is ready
      setTimeout(() => {
        drawCard();
        setTimeout(() => setFadeIn(true), 100);
      }, 100);
    }
  }, [visible, canvasUrl, drawCard]);

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
          // Share with friend
          Taro.showShareImageMenu({ path: canvasUrl });
        }
      },
    });
  }, [canvasUrl, handleSave]);

  if (!visible) return null;

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
        transition: 'opacity 800ms ease',
      }}
      onClick={onClose}
    >
      <View
        style={{
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
        onLongPress={handleLongPress}
      >
        {canvasUrl ? (
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
          onClick={handleSave}
          style={{
            backgroundColor: '#ffd700',
            color: '#1a1a2e',
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
          onClick={onClose}
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: '#ffffff',
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
