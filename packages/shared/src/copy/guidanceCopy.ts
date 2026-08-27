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

export type GuidanceTipCopyKey = 'discover_arrival';

export interface GuidanceTipRowCopy {
  /** Pill label disambiguating the play mode (e.g. 和新朋友同桌). */
  eyebrow: string;
  /** One-line mechanics explainer (e.g. 盲盒活动 · 挑一场活动，凑成一桌，线下见). */
  line: string;
}

export interface GuidanceTipCopy {
  copyKey: GuidanceTipCopyKey;
  toneMode: ToneMode;
  /** Small-caps style header above the voiced title. */
  kicker: string;
  /** Explicit close button label. */
  dismissLabel: string;
  /** Explainer rows beneath the title. */
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
        eyebrow: FLOW1_ENTRY_COPY.event.eyebrow,
        line: `${FLOW1_ENTRY_COPY.event.title} · ${FLOW1_ENTRY_COPY.event.bannerLine}`,
      },
      {
        eyebrow: FLOW1_ENTRY_COPY.street.eyebrow,
        line: `${FLOW1_ENTRY_COPY.street.title} · ${FLOW1_ENTRY_COPY.street.bannerLine}`,
      },
    ],
    dismissHint: '轻触收起',
  },
};

export function getGuidanceTipCopy(copyKey: GuidanceTipCopyKey): GuidanceTipCopy {
  return GUIDANCE_TIP_COPY[copyKey];
}
