/**
 * Guidance queue copy (C4 onboarding guidance iteration, 2026-08-27).
 *
 * surface: 'onboarding' · toneMode: 'system-ui' (card chrome: kicker, dismiss,
 * eyebrow rows). The tip TITLE is intentionally not stored here — the discover
 * arrival title is 悦仔-voiced per archetype and resolved via
 * `getOnboardingVoiceLine('discover-arrival', archetype)` (yuezai-voice).
 *
 * W1 registers exactly one tip: `discover_arrival`, absorbed byte-for-byte
 * from the legacy storage-keyed coachmark in pages/discover (PR-5/PR-9).
 * Later waves APPEND new entries keyed by their registry copyKey.
 *
 * Every line passed docs/copy/brand-copy-strategy.md 🔴 hard rules:
 * zero emoji, WeChat-safe vocabulary (no 匹配/社交/灵魂/撮合/AI), canonical
 * terminology. Locked by guidanceCopy.test.ts.
 */

import { FLOW1_ENTRY_COPY } from './flowAnimationCopy.js';
import type { ToneMode } from './toneMap.js';

export type GuidanceTipCopyKey = 'discover_arrival' | 'profile_first_visit';

/** Stable row identity — drives row-tap routing (event feed vs 街头盲盒 on
 *  discover; avatar/equipment/trend explainers on profile). */
export type GuidanceTipRowKey = 'event' | 'street' | 'avatar' | 'equipment' | 'trend';

export interface GuidanceTipRowCopy {
  key: GuidanceTipRowKey;
  /** Row headline: play-mode name merged with the old eyebrow qualifier
   *  (e.g. 盲盒活动 · 和新朋友同桌). */
  title: string;
  /** One-line mechanics explainer (e.g. 挑一场活动，凑成一桌，线下见). */
  caption: string;
}

export interface GuidanceTipCopy {
  copyKey: GuidanceTipCopyKey;
  toneMode: ToneMode;
  /** Small-caps style header above the voiced title. */
  kicker: string;
  /** Static 悦仔-voiced title. Optional: discover_arrival resolves its title
   *  per archetype via `getOnboardingVoiceLine('discover-arrival', …)` and
   *  leaves this unset; profile_first_visit carries its title here. */
  title?: string;
  /** Explicit close button label (retained for copy-lock; the redesigned
   *  card chrome uses an icon-only ✕ with aria-label). */
  dismissLabel: string;
  /** Tappable play-mode rows beneath the title. */
  rows: readonly GuidanceTipRowCopy[];
  /** Tap-to-dismiss affordance hint used in the aria label. */
  dismissHint: string;
}

export const GUIDANCE_TIP_COPY: Record<GuidanceTipCopyKey, GuidanceTipCopy> = {
  discover_arrival: {
    copyKey: 'discover_arrival',
    toneMode: 'system-ui',
    kicker: '先看看怎么玩',
    dismissLabel: '知道了',
    rows: [
      {
        key: 'event',
        title: `${FLOW1_ENTRY_COPY.event.title} · ${FLOW1_ENTRY_COPY.event.eyebrow}`,
        caption: FLOW1_ENTRY_COPY.event.bannerLine,
      },
      {
        key: 'street',
        title: `${FLOW1_ENTRY_COPY.street.title} · ${FLOW1_ENTRY_COPY.street.eyebrow}`,
        caption: FLOW1_ENTRY_COPY.street.bannerLine,
      },
    ],
    dismissHint: '点右上角收起',
  },
  // W2 (P6, 2026-09-11): profile first-visit coachmark. 悦仔 voice explains
  // the 个性化系统 in one card — informational rows (row tap degrades to a
  // tap-through dismiss on the page). Title is static (not archetype-voiced),
  // carried here instead of the onboarding voice-line resolver.
  profile_first_visit: {
    copyKey: 'profile_first_visit',
    toneMode: 'system-ui',
    kicker: '悦仔的小提示',
    title: '这是你的专属形象',
    dismissLabel: '知道了',
    rows: [
      {
        key: 'avatar',
        title: '专属形象 · 场场都在',
        caption: '它会跟着你去每一场局',
      },
      {
        key: 'equipment',
        title: '当前装备 · 穿搭展示',
        caption: '你的搭配，桌友看得到',
      },
      {
        key: 'trend',
        title: '潮流值 · 越玩越旺',
        caption: '多参加活动就会成长',
      },
    ],
    dismissHint: '点右上角收起',
  },
};

export function getGuidanceTipCopy(copyKey: GuidanceTipCopyKey): GuidanceTipCopy {
  return GUIDANCE_TIP_COPY[copyKey];
}
