import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { AIResponseMeta, AIGCMeta } from '@shared/types/aiMeta'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import AIGCLabel from '../../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'
import { PhaseHeaderIcon } from '../phaseUtils'
import { apiRequest } from '../../../lib/api/api'
import { buildSocialPath } from '../icebreakerSessionModel'
import MomentCardView from '../overlays/MomentCardView'
import ParticleBurst from '../../../components/reveal/ParticleBurst'
import IdentityReveal from '../../../components/reveal/IdentityReveal'
import CardFlip from '../../../components/reveal/CardFlip'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { CEREMONY_HEROES } from '../../../lib/ceremonyHeroes'
import { MILESTONE_BADGES } from '../../../lib/milestoneBadges'
import { haptics } from '../../../lib/utils/haptics'
import './RecapPhaseView.scss'

function MedalIcon({ title, emoji }: { title: string; emoji: string }) {
  switch (title) {
    case '最佳侦探':
      return <PhaseHeaderIcon phase='lie_detective' size={48} />
    case '挑战先锋':
      return <PhaseHeaderIcon phase='micro_challenge' size={48} />
    case '话题王':
      return <PhaseHeaderIcon phase='warmup' size={48} />
    default:
      return <JoyJoinIcon emoji={emoji} size={48} />
  }
}

function RecapAiFeedbackBar({
  socialSessionId,
  recapMeta,
}: {
  socialSessionId: string
  recapMeta?: AIResponseMeta | null
}) {
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!recapMeta?.promptVersion || !recapMeta.aiCorrelationId) {
    return null
  }
  if (done) {
    return (
      <Card className='icebreaker__recap-section icebreaker__recap-section--compact'>
        <Text className='icebreaker__recap-feedback-done'>感谢你的反馈 <JoyJoinIcon emoji='💜' size={20} /></Text>
      </Card>
    )
  }
  const submit = async (rating: 'helpful' | 'neutral' | 'awkward') => {
    if (busy) return
    setBusy(true)
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/ai-feedback'),
        method: 'POST',
        data: {
          phase: 'recap',
          promptVersion: recapMeta.promptVersion,
          aiCorrelationId: recapMeta.aiCorrelationId,
          rating,
        },
      })
      setDone(true)
    } catch {
      setBusy(false)
    }
  }
  return (
    <Card className='icebreaker__recap-section icebreaker__recap-section--compact'>
      <Text className='icebreaker__recap-section-title'>这场悦仔回顾有帮助吗？</Text>
      <View className='icebreaker__feedback-row'>
        <Button variant='secondary' disabled={busy} onClick={() => void submit('helpful')}>
          有帮助
        </Button>
        <Button variant='secondary' disabled={busy} onClick={() => void submit('neutral')}>
          一般
        </Button>
        <Button variant='secondary' disabled={busy} onClick={() => void submit('awkward')}>
          略尴尬
        </Button>
      </View>
    </Card>
  )
}

function MomentCardCTA({ socialSessionId }: { socialSessionId: string }) {
  const [showCard, setShowCard] = useState(false)
  const [payload, setPayload] = useState<any>(null)

  const handleOpen = async () => {
    try {
      const res = await apiRequest<any>({
        path: buildSocialPath(socialSessionId, '/moment-card'),
      })
      if (res?.payload) {
        setPayload(res.payload)
        setShowCard(true)
      }
    } catch {
      // Silently fail — Moment Card is a bonus, not a blocker
    }
  }

  return (
    <>
      <Card className='icebreaker__recap-moment-cta'>
        <View className='icebreaker__recap-moment-cta-glow' />
        <View className='icebreaker__recap-moment-cta-content'>
          <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
            <JoyJoinIcon emoji='✨' tier='reveal' size={28} />
            <Text className='icebreaker__recap-moment-cta-title'>生成专属回忆卡</Text>
          </View>
          <Text className='icebreaker__recap-moment-cta-sub'>
            保存今晚的专属记忆，分享给朋友
          </Text>
        </View>
        <Button variant='primary' className='icebreaker__recap-moment-cta-btn' onClick={handleOpen}>
          生成
        </Button>
      </Card>

      {payload && (
        <MomentCardView
          payload={payload}
          visible={showCard}
          onClose={() => setShowCard(false)}
        />
      )}
    </>
  )
}

interface RecapPhaseViewProps {
  recapData: {
    topicsDiscussed: string[]
    challengesCompleted: number
    lieDetectiveWinner?: string
    funMoments: string[]
    lieDetective?: {
      aiWinRate: number
      hardestRound: number
      fooledEveryone: number
    }
    personalityDice?: {
      completedBy: string[]
      passedBy: string[]
    }
    undercoverWord?: {
      caught: boolean
      undercoverDisplayName: string
    }
  } | null
  summary: {
    headline?: string
    moments?: string[]
    closingLine?: string
  } | null
  medals: Array<{
    emoji: string
    title: string
    recipientDisplayName: string
    description: string
  }>
  playerCount: number
  onLeave: () => void
  /** Post-session hook: route to connections (「去认识这桌人」). */
  onConnectTap?: () => void
  socialSessionId?: string | null
  recapMeta?: AIResponseMeta | null
  /** Playable phases completed (excludes phase_selection) — honest partial-recap framing. */
  phasesCompleted?: number
  /** True when the host jumped the table to recap via 提前进入总结. */
  isEarlyEnd?: boolean
}

export function RecapPhaseView({
  recapData,
  summary,
  medals,
  playerCount,
  onLeave,
  onConnectTap,
  socialSessionId,
  recapMeta,
  phasesCompleted,
  isEarlyEnd,
}: RecapPhaseViewProps) {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const recapMoments = summary?.moments ?? recapData?.funMoments ?? []
  const [showBurst, setShowBurst] = useState(false)
  const [headlineRevealed, setHeadlineRevealed] = useState(false)
  const [shareFlipped, setShareFlipped] = useState(false)
  // D5 — Fires success haptic only once per recap-render when the stamp seals
  const stampHapticFiredRef = useRef(false)
  const handleStampSealed = useCallback(() => {
    if (!stampHapticFiredRef.current) {
      stampHapticFiredRef.current = true
      if (!shouldReduceMotion) haptics('success')
    }
  }, [shouldReduceMotion])

  // Celebration burst on mount
  useEffect(() => {
    const t = setTimeout(() => setShowBurst(true), 300)
    return () => clearTimeout(t)
  }, [])

  // Headline reveal after burst
  useEffect(() => {
    if (showBurst) {
      const t = setTimeout(() => setHeadlineRevealed(true), 800)
      return () => clearTimeout(t)
    }
  }, [showBurst])

  const handleShareFlip = useCallback(() => {
    setShareFlipped((prev) => !prev)
  }, [])

  const aigcEnabled = useAIGCLabelsEnabled()
  const recapAigcMeta: AIGCMeta = recapMeta?.aigc ?? { aiGenerated: true, labelType: 'ai-generated' }

  // Build dynamic share card lines
  const shareLines = useCallback(() => {
    const lines: string[] = []
    lines.push(`${playerCount} 位玩家一起度过了愉快的破冰时光`)
    if ((recapData?.challengesCompleted ?? 0) > 0) {
      lines.push(`完成了 ${recapData?.challengesCompleted} 个挑战`)
    }
    if (recapData?.lieDetectiveWinner) {
      lines.push(`最佳侦探：${recapData.lieDetectiveWinner}`)
    }
    if (medals.length > 0) {
      lines.push(`共颁发 ${medals.length} 个奖项`)
    }
    if (recapData?.undercoverWord) {
      lines.push(
        recapData.undercoverWord.caught
          ? `卧底 ${recapData.undercoverWord.undercoverDisplayName} 已被揪出`
          : `卧底 ${recapData.undercoverWord.undercoverDisplayName} 成功隐藏`,
      )
    }
    if (recapData?.lieDetective) {
      lines.push(`悦仔谎言胜率 ${(recapData.lieDetective.aiWinRate * 100).toFixed(0)}%`)
    }
    return lines
  }, [playerCount, recapData, medals.length])

  return (
    <View className='icebreaker__recap'>
      {/* Celebration burst */}
      {showBurst && (
        <View className='icebreaker__recap-burst'>
          <ParticleBurst trigger={showBurst} type='confetti' count={50} reducedMotion={shouldReduceMotion} />
        </View>
      )}

      {/* Hero headline with IdentityReveal */}
      <View className='icebreaker__recap-hero'>
        <View className='icebreaker__recap-hero-icon'>
          <PhaseHeaderIcon phase='recap' size={100} />
        </View>
        {summary?.headline ? (
          <IdentityReveal
            revealed={headlineRevealed}
            identity={summary.headline}
            label='今晚总结'
            spotlightColor='#FF6B9D'
          />
        ) : (
          <>
            {/* PM-locked terminal copy (2026-07-17): celebrate → thank →
                permission to pocket the phone → one clean exit. */}
            <Text className='icebreaker__recap-title'>今晚到这儿，刚刚好</Text>
            <Text className='icebreaker__recap-subtitle'>
              今晚 {playerCount} 人一起度过了愉快的破冰时光！
            </Text>
          </>
        )}
        {typeof phasesCompleted === 'number' && phasesCompleted > 0 ? (
          <Text className='icebreaker__recap-subtitle'>
            {isEarlyEnd ? `今晚玩了 ${phasesCompleted} 个环节，剩下的留到下次～` : `今晚玩了 ${phasesCompleted} 个环节`}
          </Text>
        ) : null}
        {summary?.closingLine ? (
          <Text className='icebreaker__recap-closing'>{summary.closingLine}</Text>
        ) : null}

        {aigcEnabled && (
          <View
            className='icebreaker__recap-aigc-row'
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12rpx',
              marginTop: '16rpx',
            }}
          >
            <AIGCLabel meta={recapAigcMeta} />
            {socialSessionId && (
              <AIContentReportButton
                options={{
                  reason: 'AI 生成回顾内容',
                  relatedEventId: socialSessionId,
                }}
                label='反馈这段内容'
              />
            )}
          </View>
        )}
      </View>

      {socialSessionId ? (
        <RecapAiFeedbackBar socialSessionId={socialSessionId} recapMeta={recapMeta} />
      ) : null}

      {/* Medals section */}
      {medals.length > 0 && (
        <Card className='icebreaker__recap-section'>
          <Text className='icebreaker__recap-section-title icebreaker__recap-section-title--center'>
            <JoyJoinIcon emoji='🏆' size={28} /> 今晚奖项
          </Text>
          <View className={`icebreaker__recap-medals-grid${medals.length === 1 ? ' icebreaker__recap-medals-grid--single' : ''}`}>
            {medals.map((medal, idx) => (
              <View
                key={`${medal.title}-${medal.recipientDisplayName}`}
                className='icebreaker__recap-medal'
              >
                <MedalIcon title={medal.title} emoji={medal.emoji} />
                <Text className='icebreaker__recap-medal-title'>{medal.title}</Text>
                <Text className='icebreaker__recap-medal-recipient'>
                  {medal.recipientDisplayName}
                </Text>
                <Text className='icebreaker__recap-medal-desc'>{medal.description}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* V2 Data cards */}
      {(recapData || recapMoments.length > 0) && (
        <View className='icebreaker__recap-details'>
          {/* Topics */}
          {recapData?.topicsDiscussed.length ? (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'><JoyJoinIcon emoji='💬' size={28} /> 讨论话题</Text>
              <View className='icebreaker__recap-tags'>
                {recapData.topicsDiscussed.map((topic, i) => (
                  <View key={i} className='icebreaker__recap-tag'>
                    <Text className='icebreaker__recap-tag-text'>{topic}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Challenges */}
          {(recapData?.challengesCompleted ?? 0) > 0 ? (
            <Card className='icebreaker__recap-section'>
              <View className='icebreaker__recap-section-header'>
                <PhaseHeaderIcon phase='micro_challenge' size={32} />
                <Text className='icebreaker__recap-section-title'>完成挑战</Text>
              </View>
              <Text className='icebreaker__recap-stat'>
                {recapData?.challengesCompleted} 个挑战
              </Text>
            </Card>
          ) : null}

          {/* Lie Detective V2 */}
          {recapData?.lieDetective ? (
            <Card className='icebreaker__recap-section'>
              <View className='icebreaker__recap-section-header'>
                <PhaseHeaderIcon phase='lie_detective' size={32} />
                <Text className='icebreaker__recap-section-title'>侦探风云</Text>
              </View>
              <View className='icebreaker__recap-stats-row'>
                <View className='icebreaker__recap-stat-box'>
                  <Text className='icebreaker__recap-stat-value'>
                    {(recapData.lieDetective.aiWinRate * 100).toFixed(0)}%
                  </Text>
                  <Text className='icebreaker__recap-stat-label'>悦仔胜率</Text>
                </View>
                <View className='icebreaker__recap-stat-box'>
                  <Text className='icebreaker__recap-stat-value'>
                    第 {recapData.lieDetective.hardestRound} 轮
                  </Text>
                  <Text className='icebreaker__recap-stat-label'>最难一轮</Text>
                </View>
                <View className='icebreaker__recap-stat-box'>
                  <Text className='icebreaker__recap-stat-value'>
                    {recapData.lieDetective.fooledEveryone} 次
                  </Text>
                  <Text className='icebreaker__recap-stat-label'>骗过全场</Text>
                </View>
              </View>
            </Card>
          ) : null}

          {/* Legacy lie detective winner */}
          {recapData?.lieDetectiveWinner && !recapData?.lieDetective ? (
            <Card className='icebreaker__recap-section'>
              <View className='icebreaker__recap-section-header'>
                <PhaseHeaderIcon phase='lie_detective' size={32} />
                <Text className='icebreaker__recap-section-title'>最佳侦探</Text>
              </View>
              <Text className='icebreaker__recap-stat'>{recapData.lieDetectiveWinner}</Text>
            </Card>
          ) : null}

          {/* Personality Dice */}
          {recapData?.personalityDice ? (
            <Card className='icebreaker__recap-section'>
              <View className='icebreaker__recap-section-header'>
                <PhaseHeaderIcon phase='personality_dice' size={32} />
                <Text className='icebreaker__recap-section-title'>人格骰子</Text>
              </View>
              {recapData.personalityDice.completedBy.length > 0 && (
                <View className='icebreaker__recap-v2-row'>
                  <Text className='icebreaker__recap-v2-label'>完成挑战</Text>
                  <Text className='icebreaker__recap-v2-value'>
                    {recapData.personalityDice.completedBy.join('、')}
                  </Text>
                </View>
              )}
              {recapData.personalityDice.passedBy.length > 0 && (
                <View className='icebreaker__recap-v2-row'>
                  <Text className='icebreaker__recap-v2-label'>选择跳过</Text>
                  <Text className='icebreaker__recap-v2-value'>
                    {recapData.personalityDice.passedBy.join('、')}
                  </Text>
                </View>
              )}
            </Card>
          ) : null}

          {/* Undercover Word */}
          {recapData?.undercoverWord ? (
            <Card className='icebreaker__recap-section'>
              <View className='icebreaker__recap-section-header'>
                <PhaseHeaderIcon phase='undercover_word' size={32} />
                <Text className='icebreaker__recap-section-title'>谁是卧底</Text>
              </View>
              <Text className='icebreaker__recap-stat'>
                {recapData.undercoverWord.caught
                  ? <>卧底 {recapData.undercoverWord.undercoverDisplayName} 已被揪出 <JoyJoinIcon emoji='🎉' tier='reaction' size={24} /></>
                  : <>卧底 {recapData.undercoverWord.undercoverDisplayName} 成功隐藏 <JoyJoinIcon emoji='😎' size={24} /></>}
              </Text>
            </Card>
          ) : null}

          {/* Fun moments */}
          {recapMoments.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx', marginBottom: '16rpx' }}>
                <JoyJoinIcon emoji='✨' tier='reveal' size={28} />
                <Text className='icebreaker__recap-section-title' style={{ marginBottom: 0 }}>精彩瞬间</Text>
              </View>
              {recapMoments.map((moment, i) => (
                <View key={i} className='icebreaker__recap-moment'>
                  <Text className='icebreaker__recap-moment-bullet'>•</Text>
                  <Text className='icebreaker__recap-moment-text'>{moment}</Text>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {/* Dynamic share card with CardFlip */}
      {socialSessionId && (
        <View className='icebreaker__recap-share-wrap'>
          <CardFlip
            front={
              <View className='icebreaker__recap-share-front'>
                <JoyJoinIcon emoji='🎉' tier='reaction' size={56} className='icebreaker__recap-share-front-emoji' />
                <Text className='icebreaker__recap-share-front-title'>今晚的破冰记忆</Text>
                <Text className='icebreaker__recap-share-front-hint'>点我查看详情</Text>
              </View>
            }
            back={
              <View className='icebreaker__recap-share-back'>
                {shareLines().map((line, i) => (
                  <Text key={i} className='icebreaker__recap-share-back-line'>
                    {line}
                  </Text>
                ))}
                <View className='icebreaker__recap-share-back-cta'>
                  <Button variant='primary' onClick={onLeave}>
                    收好今晚，回到活动
                  </Button>
                </View>
              </View>
            }
            flipped={shareFlipped}
            onFlip={handleShareFlip}
            duration={500}
            reducedMotion={shouldReduceMotion}
          />
        </View>
      )}

      {/* Empty state */}
      {!recapData && medals.length === 0 && recapMoments.length === 0 && (
        <Card className='icebreaker__recap-section'>
          <Text className='icebreaker__recap-section-title'>感谢参与今晚的破冰！</Text>
          <Text className='icebreaker__recap-item'>
            希望你和新朋友们建立了更深的连接
          </Text>
        </Card>
      )}

      {/* Moment card CTA */}
      {socialSessionId && <MomentCardCTA socialSessionId={socialSessionId} />}

      {/* Xiaoyue farewell — PM-locked permission line (2026-07-17) */}
      <View className='icebreaker__recap-farewell'>
        <XiaoyueChatBubble
          content='悦仔的任务完成啦，接下来的故事，你们当面接着讲～'
          pose='casual'
          tail
        />
      </View>

      {/* D5 — "Stamp of you" seal at the end of the recap (Batch D) */}
      <View className='icebreaker__recap-stamp'>
        <Image
          className='icebreaker__recap-stamp-img'
          mode='aspectFit'
          src={MILESTONE_BADGES.recapStamp}
          ariaLabel=''
          lazyLoad
          onLoad={handleStampSealed}
        />
        <Text className='icebreaker__recap-stamp-caption'>今晚的破冰纪念章</Text>
      </View>

      {/* C6 — "See you next time" ceremony end overlay (Batch C) */}
      <View className='icebreaker__recap-ceremony-end'>
        <Image
          className='icebreaker__recap-ceremony-end-img'
          mode='aspectFit'
          src={CEREMONY_HEROES.seeYouNextTime}
          ariaLabel=''
          lazyLoad
        />
      </View>

      {/* Leave row — primary exit + connections hook at peak warmth */}
      <View className='icebreaker__recap-leave-row'>
        <Button variant='primary' className='icebreaker__recap-leave-btn' onClick={onLeave}>
          回到活动详情
        </Button>
        {onConnectTap ? (
          <Button variant='secondary' className='icebreaker__recap-connect-btn' onClick={onConnectTap}>
            去认识这桌人
          </Button>
        ) : null}
      </View>
    </View>
  )
}
