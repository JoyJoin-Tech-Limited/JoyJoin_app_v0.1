/**
 * Xiaoyue Adaptive Facilitation Engine — Phase 2
 *
 * Deterministic pulse analysis + bounded suggestion taxonomy.
 * No LLM call. Fixed rails: signals → rules → suggestion.
 * AI (Xiaoyue) suggests; the deterministic session state machine decides what is allowed.
 */

import {
  PHASE_CONFIG,
  type SocialSessionState,
  type SocialIcebreakerPhase,
  type XiaoyuePulseSignals,
  type XiaoyueAdaptiveSuggestion,
  type XiaoyueAdaptiveSuggestionType,
} from '@shared/socialIcebreaker';

// ─── Signal Extraction ──────────────────────────────────────────────────────

export function computePulseSignals(state: SocialSessionState): XiaoyuePulseSignals {
  const now = Date.now();
  const phaseElapsedMinutes = Math.max(0, (now - state.phaseStartedAt) / 60_000);
  const playerCount = Math.max(1, state.playerCount);
  const activeRate = Math.min(1, (state.activePlayerCount ?? 0) / playerCount);

  const pulseChecks = state.pulseChecks ?? [];
  const avgVibe =
    pulseChecks.length > 0
      ? pulseChecks.reduce((sum, p) => sum + p.vibe, 0) / pulseChecks.length
      : 0;

  const completionRate = computeCompletionRate(state, playerCount);

  return {
    phaseElapsedMinutes: Math.round(phaseElapsedMinutes * 10) / 10,
    activeRate: Math.round(activeRate * 100) / 100,
    completionRate: Math.round(completionRate * 100) / 100,
    avgVibe: Math.round(avgVibe * 10) / 10,
    playerCount,
    pulseCheckCount: pulseChecks.length,
  };
}

function computeCompletionRate(state: SocialSessionState, playerCount: number): number {
  switch (state.currentPhase) {
    case 'warmup': {
      const readyCount = state.warmupReadyUserIds?.length ?? 0;
      return readyCount / playerCount;
    }
    case 'micro_challenge': {
      const doneCount = state.challengeCompletedBy?.length ?? 0;
      return doneCount / playerCount;
    }
    case 'lie_detective': {
      const doneCount = state.lieDetectiveCompletedUserIds?.length ?? 0;
      return doneCount / playerCount;
    }
    case 'personality_dice': {
      const doneCount = state.diceCompletedBy?.length ?? 0;
      return doneCount / playerCount;
    }
    case 'auction': {
      // Auction completion: all lots closed
      return state.auctionAllLotsClosed ? 1 : 0;
    }
    case 'mini_script': {
      // Mini-script: host-generated framework = "started", no per-player completion tracked
      return state.miniScriptFramework ? 0.5 : 0;
    }
    case 'recap':
      return 1;
    default:
      return 0;
  }
}

// ─── Deterministic Suggestion Rules ─────────────────────────────────────────

interface SuggestionTemplate {
  type: XiaoyueAdaptiveSuggestionType;
  message: string;
  actionableHint: string;
  minGroupSize?: number;
  maxGroupSize?: number;
}

const SUGGESTION_TEMPLATES: Record<XiaoyueAdaptiveSuggestionType, SuggestionTemplate[]> = {
  advance_ready: [
    { type: 'advance_ready', message: '大部分人已经准备好了，可以推进到下一环节啦', actionableHint: '点击"进入下一阶段"按钮' },
    { type: 'advance_ready', message: '进度不错，大家都跟上了，准备换场吧', actionableHint: '推进阶段，保持节奏' },
  ],
  speed_up: [
    { type: 'speed_up', message: '这个环节有点久了，可以适当加快节奏', actionableHint: '减少讨论时间，鼓励快速分享' },
    { type: 'speed_up', message: '时间过半，试试给每人限定30秒', actionableHint: '设定倒计时，提升紧迫感' },
  ],
  slow_down: [
    { type: 'slow_down', message: '大家还在话题卡环节，不用着急，多给一点时间', actionableHint: '再等2-3分钟，观察一下' },
    { type: 'slow_down', message: '节奏有点快，有人还没进入状态', actionableHint: '放慢一步，先确保每个人都开口' },
  ],
  go_deeper: [
    { type: 'go_deeper', message: '气氛很好，试试引导大家分享更深入的故事', actionableHint: '换个Level 2或3的话题' },
    { type: 'go_deeper', message: '能量很足，可以挑战一个更有深度的问题', actionableHint: '提出一个需要回忆或反思的问题' },
  ],
  keep_light: [
    { type: 'keep_light', message: '大家还有点拘谨，继续保持轻松的氛围', actionableHint: '多用搞笑或生活类话题' },
    { type: 'keep_light', message: '氛围偏冷，不要急着深入，先暖暖场', actionableHint: '来个简单的小游戏或投票' },
  ],
  rescue_quiet: [
    {
      type: 'rescue_quiet',
      message: '有几位朋友还没参与，温柔地邀请TA试试吧，不勉强',
      actionableHint: '点名邀请一位还没发言的人，但给足退路',
      minGroupSize: 5,
    },
    {
      type: 'rescue_quiet',
      message: '有人一直没开口——小组里一个人的沉默会被放很大，试试给TA一个最轻松的问题',
      actionableHint: '问一个只需要回答一个词的问题，比如"你更喜欢山还是海"',
      minGroupSize: 2,
      maxGroupSize: 4,
    },
    {
      type: 'rescue_quiet',
      message: '注意到有人一直沉默，给TA一个不用想太多的问题',
      actionableHint: '问一个只需要回答"是/否"的问题',
      minGroupSize: 5,
    },
  ],
  energy_boost: [
    { type: 'energy_boost', message: '活跃度有点低，来个轻松的小互动提提神', actionableHint: '发起一个快速投票或表情包大战' },
    { type: 'energy_boost', message: '场子有点闷，试试换个更有趣的玩法', actionableHint: '切换到微挑战或换个话题方向' },
  ],
  keep_going: [
    { type: 'keep_going', message: '节奏不错，继续保持这个势头', actionableHint: '按当前节奏进行，适时观察' },
    { type: 'keep_going', message: '一切顺利，悦仔觉得你们今晚状态很好', actionableHint: '继续保持，准备好再推进' },
  ],
};

function pickTemplate(type: XiaoyueAdaptiveSuggestionType, seed: number, playerCount: number): SuggestionTemplate {
  const pool = SUGGESTION_TEMPLATES[type].filter(t => {
    if (t.minGroupSize != null && playerCount < t.minGroupSize) return false;
    if (t.maxGroupSize != null && playerCount > t.maxGroupSize) return false;
    return true;
  });
  // Fallback: if all templates are filtered out, use any template of this type
  const candidates = pool.length > 0 ? pool : SUGGESTION_TEMPLATES[type];
  const index = seed % candidates.length;
  return candidates[index];
}

/**
 * Deterministic rule engine that maps pulse signals to a suggestion type.
 * Rules are ordered by priority (most specific first).
 * Group-size aware: 4-person groups (one quiet = 25%+ of room) trigger earlier than 5-6 person groups.
 */
function selectSuggestionType(
  signals: XiaoyuePulseSignals,
  phase: SocialIcebreakerPhase,
  state?: SocialSessionState,
): XiaoyueAdaptiveSuggestionType {
  const isTightGroup = signals.playerCount <= 4; // 4人：每个人占比25%，沉默更明显

  // 1. Recap is always "advance" (session ending)
  if (phase === 'recap') {
    return 'keep_going';
  }

  // 2. Completion dominance → advance ready
  if (signals.completionRate >= 0.75 && signals.phaseElapsedMinutes >= 2) {
    return 'advance_ready';
  }

  // 3. Low active rate + elapsed time → energy boost (room is dying)
  // Tight group (4): intervene at 60% active after 3min. Balanced (5-6): 50% after 5min.
  const energyBoostMinutes = isTightGroup ? 3 : 5;
  const energyBoostRate = isTightGroup ? 0.6 : 0.5;
  if (signals.activeRate < energyBoostRate && signals.phaseElapsedMinutes >= energyBoostMinutes) {
    return 'energy_boost';
  }

  // 4. High vibe + good completion → go deeper
  if (signals.avgVibe >= 2.5 && signals.completionRate >= 0.5) {
    return 'go_deeper';
  }

  // 5. Low vibe → keep it light (fragile energy, protect the room)
  if (signals.avgVibe > 0 && signals.avgVibe < 1.5) {
    return 'keep_light';
  }

  // 6. Low completion after reasonable time → rescue quiet players
  // Tight group: 4人局一个人沉默就是25%——half completion at 3min triggers rescue. Balanced: 30% at 5min.
  const rescueCompletionRate = isTightGroup ? 0.5 : 0.3;
  const rescueMinutes = isTightGroup ? 3 : 5;
  if (signals.completionRate < rescueCompletionRate && signals.phaseElapsedMinutes >= rescueMinutes) {
    return 'rescue_quiet';
  }

  // 7. Phase dragging too long → speed up
  const timeoutMinutes = getPhaseTimeoutMinutes(phase, state);
  if (signals.phaseElapsedMinutes >= timeoutMinutes * 0.75) {
    return 'speed_up';
  }

  // 8. Phase very short + low completion → slow down
  if (signals.phaseElapsedMinutes < 2 && signals.completionRate < 0.3) {
    return 'slow_down';
  }

  // Default: all good
  return 'keep_going';
}

export function getPhaseTimeoutMinutes(phase: SocialIcebreakerPhase, state?: SocialSessionState): number {
  if (state?.runPlan?.segments?.length) {
    const segment = state.runPlan.segments.find((s) => s.phase === phase);
    if (segment && typeof segment.allocatedMinutes === 'number') {
      return segment.allocatedMinutes;
    }
  }
  return PHASE_CONFIG[phase]?.timeoutMinutes ?? 15;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate an adaptive suggestion based purely on deterministic pulse analysis.
 * No LLM call. Bounded, fast, reliable.
 */
export function generateXiaoyueAdaptiveSuggestion(
  state: SocialSessionState
): XiaoyueAdaptiveSuggestion {
  const signals = computePulseSignals(state);
  const type = selectSuggestionType(signals, state.currentPhase, state);

  // Use a simple hash of signals as a deterministic seed for template selection.
  // Bucket elapsed time to the nearest minute so the template doesn't oscillate
  // on rapid re-requests within the same minute.
  const seed =
    Math.floor(signals.phaseElapsedMinutes) +
    Math.floor(signals.completionRate * 100) +
    Math.floor(signals.activeRate * 100) +
    signals.playerCount;

  const template = pickTemplate(type, seed, signals.playerCount);

  return {
    type: template.type,
    message: template.message,
    actionableHint: template.actionableHint,
    basedOnSignals: signals,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Check if the session should auto-advance to the next phase.
 * Returns true when adaptive engine signals advance_ready and enough time has elapsed.
 */
export function shouldAutoAdvance(state: SocialSessionState): boolean {
  if (state.autoAdvanceEnabled !== true) return false;
  if (state.currentPhase === 'recap') return false;

  const signals = computePulseSignals(state);
  const type = selectSuggestionType(signals, state.currentPhase);

  // Only auto-advance on advance_ready signal
  if (type !== 'advance_ready') return false;

  // Require a minimum elapsed time to avoid advancing too quickly
  if (signals.phaseElapsedMinutes < 2) return false;

  return true;
}
