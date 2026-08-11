import type { SocialSessionState } from '@shared/socialIcebreaker'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import type { VibeId } from '../../../lib/vibeMapping'

// ─── Three-layer glance stack model (icebreaker fluid-UX S3+S8, 2026-08-11) ─
//
// Pure derivations + the LOCKED copy constants for the L1/L2/L3 glance stack
// pilot (warmup + micro_challenge) and the S8 Handshake Bridge opening ritual.
// Source of truth: docs/design/icebreaker-l1-pictogram-copy-spec-20260811.md —
// every string here is a locked spec string; edit here once, everywhere
// follows (later migration waves reuse the same constants).

// ── Locked L1 words (spec §1.1/§1.2) ────────────────────────────────────────
/** waiting-phase L1 word — the Handshake Bridge canvas. */
export const GLANCE_L1_WORD_WAITING = '等人齐'
/** Shared reveal-beat L1 word (one learnable word across all reveals). */
export const GLANCE_L1_WORD_REVEAL = '揭晓'

// ── Locked L2 framing fragments (spec §3.3) ─────────────────────────────────
export const GLANCE_L2_FRAMING_WARMUP = '这张卡问我们——'
export const GLANCE_L2_FRAMING_MICRO_CHALLENGE = '一起来——'
export const GLANCE_L2_HINT_MICRO_CHALLENGE = '做完了点一下'

// ── Locked L3 peek trigger (engineering-owned gesture copy, 🟢) ─────────────
export const GLANCE_PEEK_TRIGGER_HINT = '按住看'

// ── Locked S8 Handshake Bridge strings (spec §6, scene-split locked §8 Q2/Q3)
export const RITUAL_CTA_START = '人齐了，开聊'
export const RITUAL_CTA_WAIT = '再等等'
/** Non-host waiting hint on the ritual surface (🟢, warmth rule). */
export const RITUAL_WAITING_HINT = '等主持人开场'

export type HandshakeRitualKind = 'countdown' | 'toast' | 'name_relay'

/** Locked spoken-ritual beats (spec §6.1): A 齐声倒数 default, B 碰杯
 *  (host-selectable, glow/blaze), C 名字接龙 (深聊 vibe). */
export const RITUAL_BEATS: Record<HandshakeRitualKind, readonly string[]> = {
  countdown: ['三', '二', '一', '开聊！'],
  toast: ['这杯，敬新桌友——', '干杯！'],
  name_relay: ['我是 __ ，今天想聊 __ '],
}

/** Beat step duration (ms) — engineering-owned timing; ~2.2s total for the
 *  four-beat countdown, matching the first group Nudge. */
export const RITUAL_BEAT_STEP_MS = 550

/** Ritual kind resolution (locked scene-split): C is reserved for the 深聊
 *  vibe where slowness is a feature; B is a host-selectable alternative for
 *  glow/blaze bar venues; A is the default everywhere. The host's explicit
 *  toast pick only applies when the tier sanctions it. */
export function resolveHandshakeRitualKind(options: {
  vibe?: VibeId
  tier?: TierMachineId
  hostSelectedToast?: boolean
}): HandshakeRitualKind {
  if (options.vibe === 'deep_chat') return 'name_relay'
  if (
    options.hostSelectedToast &&
    (options.tier === 'glow' || options.tier === 'blaze')
  ) {
    return 'toast'
  }
  return 'countdown'
}

/** Whether the toast alternative is offered to the host at all. */
export function canOfferToastRitual(tier?: TierMachineId): boolean {
  return tier === 'glow' || tier === 'blaze'
}

export interface RitualGateInput {
  topicCount: number
  warmupTopicsStatus?: SocialSessionState['warmupTopicsStatus']
  topicsError: boolean
  selectedMood?: SocialSessionState['selectedMood']
}

/**
 * S8 ritual gate (client-derived, no server change): while the gate is OPEN
 * the warmup shows the spoken-ritual surface instead of first content. The
 * gate closes when the server-observed start signal arrives — topics dealt,
 * generation started, or a mood persisted (the host's ritual tap leads
 * straight into the mood pick, which flips one of these on the next poll).
 * A rejoining device (topics already dealt) never sees the ritual.
 */
export function isHandshakeRitualGateOpen(input: RitualGateInput): boolean {
  if (input.topicCount > 0) return false
  if (input.warmupTopicsStatus === 'generating') return false
  if (input.topicsError) return false
  if (input.selectedMood) return false
  return true
}
