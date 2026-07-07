import { View, Text } from '@tarojs/components'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { SocialSessionState, SocialIcebreakerPhase, XiaoyueAdaptiveSuggestion } from '@shared/socialIcebreaker'
import XiaoyueChatBubble from './XiaoyueChatBubble'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { ICEBREAKER_XIAOYUE_EXPRESSION } from '../../lib/mascot/xiaoyueExpressions'
import type { XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import './XiaoyueSessionShell.scss'

export interface XiaoyueSessionShellProps {
  phase: SocialIcebreakerPhase | 'waiting' | 'ended';
  sessionPack?: SocialSessionState['xiaoyueSessionPack'];
  adaptiveSuggestion?: XiaoyueAdaptiveSuggestion;
  playerCount: number;
  isHost: boolean;
  isSyncing: boolean;
  eventTitle?: string;
  onRequestSuggestion?: () => void;
  onDismissSuggestion?: () => void;
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

/**
 * XiaoyueSessionShell — persistent character host for the social icebreaker session.
 *
 * Replaces the static phaseHeader with a Xiaoyue-led status shell that adapts
 * expression, copy, and coaching hints per phase.
 */
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

export default function XiaoyueSessionShell({
  phase,
  sessionPack,
  adaptiveSuggestion,
  playerCount,
  isHost,
  isSyncing,
  eventTitle,
  onRequestSuggestion,
  onDismissSuggestion,
}: XiaoyueSessionShellProps) {
  const expressionId = ICEBREAKER_XIAOYUE_EXPRESSION[phase] ?? 'coachGuide'
  const { main, hint } = getPhaseCoachingLine(phase, sessionPack, isHost)

  return (
    <View className='xiaoyue-session-shell'>
      <XiaoyueChatBubble
        content={main}
        expressionId={expressionId}
        wide
        showGlow
        staggerDelay={80}
      />

      {hint && (
        <View className='xiaoyue-session-shell__hint'>
          <Text className='xiaoyue-session-shell__hint-text'>{hint}</Text>
        </View>
      )}

      {/* ─── Adaptive Suggestion Nudge (host-only) ─── */}
      {isHost && adaptiveSuggestion && (
        <View className='xiaoyue-session-shell__nudge'>
          <XiaoyueChatBubble
            content={adaptiveSuggestion.message}
            expressionId={getSuggestionExpression(adaptiveSuggestion.type)}
            showGlow
            staggerDelay={40}
          />
          <View className='xiaoyue-session-shell__nudge-actions'>
            <Text className='xiaoyue-session-shell__nudge-hint'>
              {adaptiveSuggestion.actionableHint}
            </Text>
            {onDismissSuggestion && (
              <Text
                className='xiaoyue-session-shell__nudge-dismiss'
                onClick={onDismissSuggestion}
              >
                知道了
              </Text>
            )}
          </View>
        </View>
      )}

      {/* ─── Host suggestion trigger ─── */}
      {isHost && !adaptiveSuggestion && phase !== 'waiting' && phase !== 'ended' && phase !== 'recap' && onRequestSuggestion && (
        <View className='xiaoyue-session-shell__ask'>
          <View
            className='xiaoyue-session-shell__ask-text'
            onClick={onRequestSuggestion}
          >
            <JoyJoinIcon emoji='💡' size={20} className='xiaoyue-session-shell__ask-icon' />
            <Text className='xiaoyue-session-shell__ask-label'>
              {`${DEFAULT_MASCOT_DISPLAY_NAME}，给点建议？`}
            </Text>
          </View>
        </View>
      )}

      <View className='xiaoyue-session-shell__meta'>
        {eventTitle && (
          <Text className='xiaoyue-session-shell__meta-event'>{eventTitle}</Text>
        )}
        {playerCount > 0 && (
          <Text className='xiaoyue-session-shell__meta-players'>
            {playerCount} 人参与
          </Text>
        )}
        {isSyncing && (
          <View className='xiaoyue-session-shell__meta-sync'>
            <Text className='xiaoyue-session-shell__meta-sync-text'>同步中…</Text>
          </View>
        )}
      </View>
    </View>
  )
}
