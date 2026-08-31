/**
 * Pool Registration Inclusions copy — 费用包含 strip on pool-registration Step 0
 *
 * surface: 'pool-registration'
 * toneMode: 'value-framing' (warm, factual, no machinery explanation)
 *
 * PM + commercialization approved 2026-08-31 — LOCKED copy, do not change
 * without copy-owner sign-off. 🔴 rules: zero emoji in rendered copy, no
 * AI/算法/权重 self-explanation, canonical 桌 terminology, event-booking
 * vocabulary (排桌, never 匹配/撮合 in visible copy).
 *
 * Icon swap point: each tile carries a discriminated `icon` field. The
 * mini-program renders `kind: 'glyph'` through JoyJoinIcon (proprietary icon
 * registry) and `kind: 'image'` through a plain <Image>. Upgrading a tile to
 * custom Lovart art is a one-line change: replace the glyph entry with
 * `{ kind: 'image', src: '<cdn-or-local-path>', alt: '<tile title>' }`.
 */

import type { IconTier } from '../iconSystem/emojiToIconMap.js';

export type PoolInclusionTileId =
  | 'icebreaker_hosting'
  | 'curated_tablemates'
  | 'smart_venue'
  | 'full_refund_guarantee';

export type PoolInclusionIcon =
  | { kind: 'glyph'; emoji: string; tier: IconTier }
  | { kind: 'image'; src: string; alt: string };

export interface PoolInclusionTileCopy {
  id: PoolInclusionTileId;
  /** Bold tile title, ≤4 chars. */
  title: string;
  /** Muted supporting line, ≤8 chars; renders under the title. */
  subtitle: string;
  icon: PoolInclusionIcon;
}

export const POOL_INCLUSION_TILES: readonly PoolInclusionTileCopy[] = [
  {
    id: 'icebreaker_hosting',
    title: '破冰带玩',
    subtitle: '五重玩法可深可浅',
    icon: {
      kind: 'image',
      src: '/assets/icons/included-strip/included-games.webp',
      alt: '破冰带玩',
    },
  },
  {
    id: 'curated_tablemates',
    title: '合拍同桌',
    subtitle: '6维偏好精算排桌',
    icon: {
      kind: 'image',
      src: '/assets/icons/included-strip/included-tablemates.webp',
      alt: '合拍同桌',
    },
  },
  {
    id: 'smart_venue',
    title: '智能选场',
    subtitle: '餐厅酒吧自动安排',
    icon: {
      kind: 'image',
      src: '/assets/icons/included-strip/included-venue.webp',
      alt: '智能选场',
    },
  },
  {
    id: 'full_refund_guarantee',
    title: '未成行全退',
    subtitle: '平台原因自动退款',
    icon: {
      kind: 'image',
      src: '/assets/icons/included-strip/included-refund.webp',
      alt: '未成行全退',
    },
  },
] as const;
