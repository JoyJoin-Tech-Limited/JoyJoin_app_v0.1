import { useEffect, useRef, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { SocialSessionState, SocialIcebreakerPhase, XiaoyueAdaptiveSuggestion } from '@shared/socialIcebreaker'
import AIContentReportButton from '../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../hooks/useAIGCLabelsEnabled'
import { haptics } from '../../lib/utils/haptics'
import { getXiaoyueExpressionAsset, ICEBREAKER_XIAOYUE_EXPRESSION } from '../../lib/mascot/xiaoyueExpressions'
import type { XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import './XiaoyueSessionShell.scss'

/**
 * XiaoyueSessionShell — slim host band for the social icebreaker session (PR1 壳层).
 *
 * ─── Ownership exclusivity map (locked contract Q1) ──────────────────────────
 * SHELL OWNS (all 10 phases):
 *   - the slim host band: 40rpx expression avatar + toneLine (+ optional hostHint line)
 *   - expression swap per phase (ICEBREAKER_XIAOYUE_EXPRESSION, 200ms opacity crossfade)
 *   - the host ⋯ menu TRIGGER semantics (host-only, all phases with valid actions;
 *     the ActionSheet itself lives in pages/icebreaker-session/index.tsx)
 *   - the calm-by-default sync-loss dot (band right side; page owns the toast)
 *   - the adaptive-suggestion OVERLAY card (floats over content, never pushes layout)
 *   - the merged quiet AIGC footer `内容由 AI 生成 · 反馈` (shell-level, sessionPack only)
 *
 * PHASE VIEWS OWN (out of shell scope — do not duplicate here):
 *   - all phase content, presence/roster UI, and CTAs
 *   - AIGC rows INSIDE their own cards (micro_challenge / recap keep theirs as-is)
 *   - warmup presence strip + tier caption (PR2 入场层)
 *
 * PhaseIntroOverlay / phaseToast own phase-transition surfacing (unchanged).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface XiaoyueSessionShellProps {
  phase: SocialIcebreakerPhase | 'waiting' | 'ended';
  sessionPack?: SocialSessionState['xiaoyueSessionPack'];
  /** Adaptive suggestion to surface as an overlay card (host-only; page gates visibility). */
  adaptiveSuggestion?: XiaoyueAdaptiveSuggestion;
  isHost: boolean;
  /** Calm-by-default sync-loss: grey dot on the band's right side when polling fails. */
  syncLost?: boolean;
  /** Whether the ⋯ menu trigger renders (host && phase has valid menu items). */
  showHostMenu?: boolean;
  /** ⋯ menu trigger handler — page owns the ActionSheet. */
  onOpenHostMenu?: () => void;
  onDismissSuggestion?: () => void;
  /** Fired when the host taps 反馈 in a shell-level AIGC footer (analytics). */
  onAigcFeedbackTap?: (location: 'footer' | 'suggestion') => void;
}

function getPhaseCoachingLine(
  phase: XiaoyueSessionShellProps['phase'],
  sessionPack: SocialSessionState['xiaoyueSessionPack'],
  isHost: boolean,
): { main: string; hint?: string } {
  if (!sessionPack) {
    const defaults: Record<string, string> = {
      waiting: `欢迎来到今晚的破冰时间，我是${DEFAULT_MASCOT_DISPLAY_NAME}。`,
      warmup: '先抽张话题卡，暖暖场吧。',
      micro_challenge: '热身完毕，来个轻松的小挑战。',
      phase_selection: '这一局，你来搭～',
      lie_detective: '侦探时间，仔细听每一句话。',
      auction: '虚拟拍卖开始，脑洞越大越好。',
      personality_dice: '人格骰子环节，看看大家敢不敢接招。',
      mini_script: '迷你剧本杀，今晚的高光时刻。',
      recap: '时间过得真快，来回顾一下今晚。',
      ended: '今晚的破冰之旅圆满结束。',
    }
    return { main: defaults[phase] ?? '破冰进行中，放松玩就好。' }
  }

  if (phase === 'waiting') {
    return { main: sessionPack.opener }
  }

  if (phase === 'recap' || phase === 'ended') {
    return { main: sessionPack.recapFraming.open }
  }

  const coaching = sessionPack.phaseCoaching[phase as SocialIcebreakerPhase]
  if (!coaching) {
    return { main: '破冰进行中，放松玩就好。' }
  }

  return {
    main: coaching.toneLine,
    hint: isHost ? coaching.hostHint : undefined,
  }
}

function getSuggestionExpression(type: XiaoyueAdaptiveSuggestion['type']): XiaoyueExpressionId {
  const map: Record<XiaoyueAdaptiveSuggestion['type'], XiaoyueExpressionId> = {
    advance_ready: 'actionSuccess',
    speed_up: 'coachGuide',
    slow_down: 'neutralInformation',
    go_deeper: 'testCurious',
    keep_light: 'homeWelcome',
    rescue_quiet: 'optOutReassure',
    energy_boost: 'matchSuccess',
    keep_going: 'coachGuide',
  }
  return map[type] ?? 'coachGuide'
}

/** Expression crossfade budget (contract R5: 表情切换 200ms crossfade). */
const EXPRESSION_CROSSFADE_MS = 200
/** Suggestion overlay auto-dismiss (contract Q3: 自动消失 + dismiss 收回). */
const SUGGESTION_AUTO_DISMISS_MS = 8000

export default function XiaoyueSessionShell({
  phase,
  sessionPack,
  adaptiveSuggestion,
  isHost,
  syncLost = false,
  showHostMenu = false,
  onOpenHostMenu,
  onDismissSuggestion,
  onAigcFeedbackTap,
}: XiaoyueSessionShellProps) {
  const expressionId = ICEBREAKER_XIAOYUE_EXPRESSION[phase] ?? 'coachGuide'
  const { main, hint } = getPhaseCoachingLine(phase, sessionPack, isHost)
  const aigcEnabled = useAIGCLabelsEnabled()

  // 200ms opacity crossfade between phase expressions. One-shot only —
  // no breathing / loop animation (contract AC9). Under prefers-reduced-motion
  // the outgoing layer is display:none (see SCSS) so the swap is instant.
  const [fadingOutExpression, setFadingOutExpression] = useState<XiaoyueExpressionId | null>(null)
  const currentExpressionRef = useRef<XiaoyueExpressionId>(expressionId)
  useEffect(() => {
    if (expressionId === currentExpressionRef.current) {
      return
    }
    setFadingOutExpression(currentExpressionRef.current)
    currentExpressionRef.current = expressionId
    const timer = setTimeout(() => setFadingOutExpression(null), EXPRESSION_CROSSFADE_MS + 40)
    return () => clearTimeout(timer)
  }, [expressionId])

  // Suggestion overlay auto-dismiss. Manual `知道了` uses the same handler.
  const suggestion = isHost ? adaptiveSuggestion : undefined
  const suggestionKey = suggestion
    ? `${suggestion.type}:${suggestion.message}:${suggestion.actionableHint}`
    : undefined
  useEffect(() => {
    if (!suggestionKey || !onDismissSuggestion) {
      return
    }
    const timer = setTimeout(onDismissSuggestion, SUGGESTION_AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [suggestionKey, onDismissSuggestion])

  const handleDismissSuggestionTap = () => {
    haptics('light')
    onDismissSuggestion?.()
  }

  return (
    <View className='xiaoyue-session-shell'>
      <View className='xiaoyue-session-shell__band'>
        {/* Crop fix: no border-radius / overflow mask — expression art renders whole. */}
        <View className='xiaoyue-session-shell__avatar' aria-hidden='true'>
          <Image
            className='xiaoyue-session-shell__avatar-img'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset(expressionId)}
          />
          {fadingOutExpression && (
            <Image
              className='xiaoyue-session-shell__avatar-img xiaoyue-session-shell__avatar-img--out'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset(fadingOutExpression)}
            />
          )}
        </View>

        <View className='xiaoyue-session-shell__text'>
          <Text className='xiaoyue-session-shell__tone'>{main}</Text>
          {/* hostHint: kept as a second muted line (simpler than folding into the ⋯ menu). */}
          {hint && <Text className='xiaoyue-session-shell__hint'>{hint}</Text>}
        </View>

        {syncLost && (
          <View className='xiaoyue-session-shell__sync-dot' aria-label='连接断了，正在重连' />
        )}

        {isHost && showHostMenu && onOpenHostMenu && (
          <View
            className='xiaoyue-session-shell__menu'
            onClick={onOpenHostMenu}
            role='button'
            aria-label='主持人菜单'
          >
            <View className='xiaoyue-session-shell__menu-circle'>
              <Text className='xiaoyue-session-shell__menu-icon'>⋯</Text>
            </View>
          </View>
        )}
      </View>

      {/* Merged quiet AIGC footer (contract Q9): single muted line, shell-level.
          Regulatory floor copy `内容由 AI 生成` is preserved verbatim. */}
      {sessionPack && aigcEnabled && phase !== 'warmup' && (
        <View className='xiaoyue-session-shell__aigc'>
          <Text className='xiaoyue-session-shell__aigc-text'>内容由 AI 生成</Text>
          <Text className='xiaoyue-session-shell__aigc-sep'>·</Text>
          <View
            className='xiaoyue-session-shell__aigc-report'
            onClick={() => onAigcFeedbackTap?.('footer')}
          >
            <AIContentReportButton
              options={{ reason: 'AI 生成开场包/主持提示' }}
              label='反馈'
            />
          </View>
        </View>
      )}

      {/* Adaptive suggestion — overlay card: floats over content, never pushes layout. */}
      {suggestion && (
        <View className='xiaoyue-session-shell__suggestion'>
          <View
            className='xiaoyue-session-shell__suggestion-card'
            role='status'
            aria-live='polite'
          >
            <View className='xiaoyue-session-shell__suggestion-head'>
              <Image
                className='xiaoyue-session-shell__suggestion-avatar'
                mode='aspectFit'
                src={getXiaoyueExpressionAsset(getSuggestionExpression(suggestion.type))}
              />
              <Text className='xiaoyue-session-shell__suggestion-message'>{suggestion.message}</Text>
            </View>
            {suggestion.actionableHint && (
              <Text className='xiaoyue-session-shell__suggestion-hint'>{suggestion.actionableHint}</Text>
            )}
            <View className='xiaoyue-session-shell__suggestion-footer'>
              {aigcEnabled && (
                <View className='xiaoyue-session-shell__aigc xiaoyue-session-shell__aigc--inline'>
                  <Text className='xiaoyue-session-shell__aigc-text'>内容由 AI 生成</Text>
                  <Text className='xiaoyue-session-shell__aigc-sep'>·</Text>
                  <View
                    className='xiaoyue-session-shell__aigc-report'
                    onClick={() => onAigcFeedbackTap?.('suggestion')}
                  >
                    <AIContentReportButton
                      options={{ reason: 'AI 生成自适应建议' }}
                      label='反馈'
                    />
                  </View>
                </View>
              )}
              {onDismissSuggestion && (
                <Text
                  className='xiaoyue-session-shell__suggestion-dismiss'
                  onClick={handleDismissSuggestionTap}
                >
                  知道了
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
