import { View } from '@tarojs/components';

/**
 * ChevronGlyph — shared CSS chevron (2026-10-29).
 * Replaces text-glyph arrows (▼ ▲ ▶) which render off-baseline and vary
 * across devices. Pure CSS: a 12rpx square with two currentColor borders,
 * rotated 45° (down) or 225° (up). Inherits color from parent text color.
 */
export type ChevronGlyphDirection = 'up' | 'down';

interface ChevronGlyphProps {
  direction: ChevronGlyphDirection;
  className?: string;
}

export default function ChevronGlyph({ direction, className = '' }: ChevronGlyphProps) {
  const modifier = direction === 'up' ? 'chevron-glyph--up' : '';
  const classes = ['chevron-glyph', modifier, className].filter(Boolean).join(' ');
  return <View className={classes} aria-hidden='true' />;
}
