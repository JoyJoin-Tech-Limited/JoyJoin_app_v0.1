import { View, Text } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon } from '../phaseUtils'
import { apiRequest } from '../../../lib/api/api'
import { buildSocialPath } from '../icebreakerSessionModel'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import MomentCardView from '../overlays/MomentCardView'
import ParticleBurst from '../../../components/reveal/ParticleBurst'
import IdentityReveal from '../../../components/reveal/IdentityReveal'
import CardFlip from '../../../components/reveal/CardFlip'
import './RecapPhaseView.scss'

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
        <Text className='icebreaker__recap-feedback-done'>感谢你的反馈 💜</Text>
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
          <Text className='icebreaker__recap-moment-cta-title'>✨ 生成专属回忆卡</Text>
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
  socialSessionId?: string | null
  recapMeta?: AIResponseMeta | null
}

export function RecapPhaseView({
  recapData,
  summary,
  medals,
  playerCount,
  onLeave,
  socialSessionId,
  recapMeta,
}: RecapPhaseViewProps) {
  const recapMoments = summary?.moments ?? recapData?.funMoments ?? []
  const [showBurst, setShowBurst] = useState(false)
  const [headlineRevealed, setHeadlineRevealed] = useState(false)
  const [shareFlipped, setShareFlipped] = useState(false)

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
          <ParticleBurst trigger={showBurst} type='confetti' count={50} />
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
            <Text className='icebreaker__recap-title'>破冰回顾</Text>
            <Text className='icebreaker__recap-subtitle'>
              今晚 {playerCount} 人一起度过了愉快的破冰时光！
            </Text>
          </>
        )}
        {summary?.closingLine ? (
          <Text className='icebreaker__recap-closing'>{summary.closingLine}</Text>
        ) : null}
      </View>

      {socialSessionId ? (
        <RecapAiFeedbackBar socialSessionId={socialSessionId} recapMeta={recapMeta} />
      ) : null}

      {/* Medals section */}
      {medals.length > 0 && (
        <View className='icebreaker__recap-medals'>
          <Text className='icebreaker__recap-section-title icebreaker__recap-section-title--center'>
            🏆 今晚奖项
          </Text>
          <View className='icebreaker__recap-medals-grid'>
            {medals.map((medal, idx) => (
              <View
                key={`${medal.title}-${medal.recipientDisplayName}`}
                className='icebreaker__recap-medal'
              >
                <Text className='icebreaker__recap-medal-emoji'>{medal.emoji}</Text>
                <Text className='icebreaker__recap-medal-title'>{medal.title}</Text>
                <Text className='icebreaker__recap-medal-recipient'>
                  {medal.recipientDisplayName}
                </Text>
                <Text className='icebreaker__recap-medal-desc'>{medal.description}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* V2 Data cards */}
      {(recapData || recapMoments.length > 0) && (
        <View className='icebreaker__recap-details'>
          {/* Topics */}
          {recapData?.topicsDiscussed.length ? (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>💬 讨论话题</Text>
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
                  <Text className='icebreaker__recap-stat-label'>最难 round</Text>
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
                  ? `卧底 ${recapData.undercoverWord.undercoverDisplayName} 已被揪出 🎉`
                  : `卧底 ${recapData.undercoverWord.undercoverDisplayName} 成功隐藏 😎`}
              </Text>
            </Card>
          ) : null}

          {/* Fun moments */}
          {recapMoments.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>✨ 精彩瞬间</Text>
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
                <Text className='icebreaker__recap-share-front-emoji'>🎉</Text>
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
                    保存并分享
                  </Button>
                </View>
              </View>
            }
            flipped={shareFlipped}
            onFlip={handleShareFlip}
            duration={500}
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

      {/* Leave button */}
      <Button variant='primary' className='icebreaker__recap-leave-btn' onClick={onLeave}>
        返回活动
      </Button>
    </View>
  )
}
