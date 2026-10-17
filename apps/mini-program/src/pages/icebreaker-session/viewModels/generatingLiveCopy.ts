import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { SocialContentStatus } from '@shared/socialIcebreaker'

/**
 * Wave 3 (icebreaker-uiux-wave3, contract AC-07): live "出题中" copy for the
 * five AI-generative phases, generalizing the warmup `warmupTopicsStatus`
 * precedent (2026-07-26). The server exposes one optional `*ContentStatus`
 * field per phase (`quipContentStatus` etc.) ONLY while the
 * `icebreakerContentStatusEnabled` flag is on; when the field is absent
 * (flag off / legacy snapshot) every consumer must fall through to the
 * pre-Wave-3 static waiting copy unchanged.
 *
 * RENDER-GUARD INVARIANT (评审 M9): gating is POSITIVE equality on
 * `'generating'` ONLY. A negative form (`!== 'idle'`) is forbidden because
 * `undefined !== 'idle'` is true and would render the live copy for every
 * flag-off client. Locked by contentStatusLiveCopyContract.test.ts.
 */

export type GenerativeContentPhase =
  | 'quip_battle'
  | 'undercover_word'
  | 'group_mirror'
  | 'auction'
  | 'personality_dice'

/** True only while the phase's content is actively generating. Field absent
 *  (flag off / legacy session) → false → callers render the static copy. */
export function isContentGenerating(status: SocialContentStatus | undefined): boolean {
  return status === 'generating'
}

/**
 * Staged generating copy (WarmupCardSlot 2026-07-28 502-incident precedent):
 * a static 「正在出题…」 for 8s+ reads as a hang, so after
 * `GENERATING_COPY_STAGE_DELAY_MS` the line swaps to a reassuring second
 * stage. Both stages are zero-emoji and carry no AI/matching vocabulary
 * (WeChat review posture).
 */
export const GENERATING_COPY_STAGE_DELAY_MS = 4000

export type GeneratingCopyStage = 0 | 1

const GENERATING_LIVE_COPY: Record<
  GenerativeContentPhase,
  { stage0: string; stage1: string }
> = {
  quip_battle: {
    stage0: `${DEFAULT_MASCOT_DISPLAY_NAME}正在出题…`,
    stage1: '好题目值得多想一会儿，马上就好~',
  },
  undercover_word: {
    stage0: `${DEFAULT_MASCOT_DISPLAY_NAME}正在想词…`,
    stage1: '词对快配好了，马上就好~',
  },
  group_mirror: {
    stage0: `${DEFAULT_MASCOT_DISPLAY_NAME}正在出题…`,
    stage1: '问题快想好了，马上就好~',
  },
  auction: {
    stage0: `${DEFAULT_MASCOT_DISPLAY_NAME}正在准备拍品…`,
    stage1: '拍品快就位了，马上就好~',
  },
  personality_dice: {
    stage0: `${DEFAULT_MASCOT_DISPLAY_NAME}正在准备挑战…`,
    stage1: '挑战快写好了，马上就好~',
  },
}

export function getGeneratingLiveCopy(
  phase: GenerativeContentPhase,
  stage: GeneratingCopyStage,
): string {
  const copy = GENERATING_LIVE_COPY[phase]
  return stage === 0 ? copy.stage0 : copy.stage1
}
