import { View, Text, Image } from '@tarojs/components'
import AIGCLabel from '../../components/ai-content/AIGCLabel'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import TypewriterText from '../../components/ui/TypewriterText'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { squadUnboxingAnalytics } from '../../lib/analytics/squadUnboxingAnalytics'
import { type FocusedNarrativeModel, type SquadDiagnosisSegment } from './squadUnboxingViewModels'
import type { AIGCMeta } from '@shared/types/aiMeta'

interface SquadUnboxingAnalysisBubbleProps {
  groupId: string
  dealSettled: boolean
  headerReady: boolean
  bubbleNarration: { kind: 'member'; userId: string } | { kind: 'burst' } | null
  animateFocusedNarration: boolean
  shouldReduceMotion: boolean
  isDegradation: boolean
  bubbleText: string
  focusedNarrativeModel: FocusedNarrativeModel | null
  showNarrativeDetails: boolean
  tableDiagnosis: SquadDiagnosisSegment[]
  aigcMeta?: AIGCMeta
  onVerdictComplete: () => void
}

export default function SquadUnboxingAnalysisBubble({
  groupId,
  dealSettled,
  headerReady,
  bubbleNarration,
  animateFocusedNarration,
  shouldReduceMotion,
  isDegradation,
  bubbleText,
  focusedNarrativeModel,
  showNarrativeDetails,
  tableDiagnosis,
  aigcMeta,
  onVerdictComplete,
}: SquadUnboxingAnalysisBubbleProps) {
  return (
    <View
      className='squad-unboxing__analysis-bubble'
      role='status'
      aria-live='polite'
      aria-atomic='true'
    >
      <View
        className={[
          'squad-unboxing__analysis-bubble-inner',
          // Post-review fix: the bubble holds its entrance until the
          // deal settles — no empty white slab during the handoff.
          headerReady && dealSettled ? 'squad-unboxing__analysis-bubble-inner--ready' : '',
        ].filter(Boolean).join(' ')}
      >
        <Image
          className={['squad-unboxing__analysis-bubble-mascot', headerReady && dealSettled ? 'squad-unboxing__analysis-bubble-mascot--ready' : ''].filter(Boolean).join(' ')}
          mode='aspectFit'
          src={getXiaoyueExpressionAsset('matchSuccess')}
          aria-hidden='true'
        />
        {/* key remounts the typewriters when the deal settles so the
            first keystroke lands with the bubble's entrance, never
            mid-type while hidden. */}
        <View className='squad-unboxing__analysis-bubble-bubble' key={dealSettled ? 'settled' : 'pending'}>
          {focusedNarrativeModel ? (
            <>
              <View aria-hidden='true'>
                <TypewriterText
                  className='squad-unboxing__narrative-verdict'
                  text={focusedNarrativeModel.verdict}
                  speed={45}
                  delay={180}
                  enabled={!shouldReduceMotion && !isDegradation && animateFocusedNarration}
                  showCursor={false}
                  numberOfLines={3}
                  onComplete={() => {
                    onVerdictComplete()
                    squadUnboxingAnalytics.track('squad_unboxing_bubble_reveal_complete', {
                      groupId,
                      screen: 'squad-unboxing',
                    })
                  }}
                />
                {showNarrativeDetails && focusedNarrativeModel.evidence.length > 0 ? (
                  <View className='squad-unboxing__narrative-evidence'>
                    {focusedNarrativeModel.evidence.map((point) => (
                      <ConnectionPointPill key={point} text={point} rarity='common' />
                    ))}
                  </View>
                ) : null}
                {showNarrativeDetails && focusedNarrativeModel.opener ? (
                  <Text className='squad-unboxing__narrative-opener'>
                    {`「${focusedNarrativeModel.opener}」`}
                  </Text>
                ) : null}
              </View>
              <Text className='squad-unboxing__sr-only'>
                {[
                  focusedNarrativeModel.verdict,
                  ...focusedNarrativeModel.evidence,
                  focusedNarrativeModel.opener,
                ].filter(Boolean).join('。')}
              </Text>
            </>
          ) : (
            <>
              <View aria-hidden='true'>
                <TypewriterText
                  className='squad-unboxing__analysis-bubble-text'
                  text={bubbleText}
                  speed={45}
                  delay={180}
                  maxDuration={bubbleNarration?.kind === 'member' ? undefined : 3000}
                  enabled={!shouldReduceMotion && !isDegradation && (bubbleNarration?.kind !== 'member' || animateFocusedNarration)}
                  showCursor={false}
                  // BUG B (2026-07-28): clamp the narration so a long
                  // member intro can never spill over the 桌卡 strip
                  // in the locked revealed column. 2026-08-19: the
                  // budget tightened 4 → 3 lines — the fan-phase
                  // column only has ~563rpx (bubble + event panel),
                  // and the auto-pocket handoff below unfolds the
                  // relaxed column where the transition line + 桌卡
                  // debut instead of being born clipped.
                  numberOfLines={3}
                  onComplete={() => {
                    squadUnboxingAnalytics.track('squad_unboxing_bubble_reveal_complete', {
                      groupId,
                      screen: 'squad-unboxing',
                    })
                  }}
                />
              </View>
              <Text className='squad-unboxing__sr-only'>{bubbleText}</Text>
            </>
          )}
          <AIGCLabel
            meta={aigcMeta}
            className='squad-unboxing__analysis-bubble-aigc'
            reduceMotion={shouldReduceMotion}
          />
          {/* 桌型诊断 (2026-07-24 P0/P2): deterministic role mix, shown
              only under the GROUP voice (tease/burst/soul) — hidden
              while the bubble narrates a single member. Lives inside
              the bubble footer to keep the vertical budget honest. */}
          {tableDiagnosis.length > 0 && bubbleNarration?.kind !== 'member' ? (
            <View
              className='squad-unboxing__diagnosis'
              aria-label={`这桌配置：${tableDiagnosis.map((segment) => `${segment.count}个${segment.label}`).join('，')}`}
            >
              <Text className='squad-unboxing__diagnosis-label'>这桌配置</Text>
              <View className='squad-unboxing__diagnosis-chips'>
                {tableDiagnosis.map((segment) => (
                  <View
                    key={segment.key}
                    className={`squad-unboxing__diagnosis-chip squad-unboxing__diagnosis-chip--${segment.key}`}
                  >
                    <Text className='squad-unboxing__diagnosis-chip-text'>
                      {`${segment.count}个${segment.label}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
