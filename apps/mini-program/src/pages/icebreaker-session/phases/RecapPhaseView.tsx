import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon } from '../phaseUtils'
import { apiRequest } from '../../../lib/api/api'
import { buildSocialPath } from '../icebreakerSessionModel'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import MomentCardView from '../overlays/MomentCardView'

// Recap section color constants
const RECAP_BG_DARK = '#1a1a2e';
const RECAP_GOLD_BRIGHT = '#ffd700';
const RECAP_TEXT_MUTED = '#9CA3AF';

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
      <Card className='icebreaker__recap-section'>
        <Text className='icebreaker__recap-item'>感谢你的反馈</Text>
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
    <Card className='icebreaker__recap-section'>
      <Text className='icebreaker__recap-section-title'>这场 AI 回顾有帮助吗？</Text>
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
      <Card
        className='icebreaker__recap-section'
        style={{ backgroundColor: RECAP_BG_DARK, borderColor: RECAP_GOLD_BRIGHT }}
      >
        <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
          <View style={{ width: '40rpx', height: '40rpx', borderRadius: '20rpx', backgroundColor: RECAP_GOLD_BRIGHT }} />
          <View style={{ flex: 1 }}>
            <Text className='icebreaker__recap-section-title' style={{ color: RECAP_GOLD_BRIGHT }}>
              生成专属回忆卡
            </Text>
            <Text className='icebreaker__recap-item' style={{ color: RECAP_TEXT_MUTED }}>
              保存今晚的专属记忆，分享给朋友
            </Text>
          </View>
          <Button variant='primary' onClick={handleOpen}>
            生成
          </Button>
        </View>
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

export function RecapPhaseView({
  recapData,
  summary,
  medals,
  playerCount,
  onLeave,
  socialSessionId,
  recapMeta,
}: {
  recapData: {
    topicsDiscussed: string[]
    challengesCompleted: number
    lieDetectiveWinner?: string
    funMoments: string[]
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
}) {
  const recapMoments = summary?.moments ?? recapData?.funMoments ?? []

  return (
    <View className='icebreaker__recap'>
      <Card className='icebreaker__recap-card'>
        <View className='icebreaker__recap-emoji'><PhaseHeaderIcon phase="recap" size={120} /></View>
        <Text className='icebreaker__recap-title'>破冰回顾</Text>
        {summary?.headline ? (
          <Text className='icebreaker__recap-subtitle'>{summary.headline}</Text>
        ) : null}
        <Text className='icebreaker__recap-subtitle'>
          今晚 {playerCount} 人一起度过了愉快的破冰时光！
        </Text>
        {summary?.closingLine ? (
          <Text className='icebreaker__recap-subtitle'>{summary.closingLine}</Text>
        ) : null}
      </Card>

      {socialSessionId ? (
        <RecapAiFeedbackBar socialSessionId={socialSessionId} recapMeta={recapMeta} />
      ) : null}

      {(recapData || medals.length > 0 || recapMoments.length > 0) && (
        <View className='icebreaker__recap-details'>
          {medals.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>今晚奖项</Text>
              {medals.map((medal) => (
                <Text key={`${medal.title}-${medal.recipientDisplayName}`} className='icebreaker__recap-item'>
                  {medal.emoji} {medal.title} · {medal.recipientDisplayName} · {medal.description}
                </Text>
              ))}
            </Card>
          )}

          {recapData?.topicsDiscussed.length ? (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                讨论话题
              </Text>
              {recapData.topicsDiscussed.map((topic, i) => (
                <Text key={i} className='icebreaker__recap-item'>
                  • {topic}
                </Text>
              ))}
            </Card>
          ) : null}

          {(recapData?.challengesCompleted ?? 0) > 0 ? (
            <Card className='icebreaker__recap-section'>
              <View className='icebreaker__recap-section-title' style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                <PhaseHeaderIcon phase="micro_challenge" size={36} />
                <Text>完成挑战</Text>
              </View>
              <Text className='icebreaker__recap-stat'>
                {recapData?.challengesCompleted} 个挑战
              </Text>
            </Card>
          ) : null}

          {recapData?.lieDetectiveWinner ? (
            <Card className='icebreaker__recap-section'>
              <View className='icebreaker__recap-section-title' style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                <PhaseHeaderIcon phase="lie_detective" size={36} />
                <Text>最佳侦探</Text>
              </View>
              <Text className='icebreaker__recap-stat'>
                {recapData.lieDetectiveWinner}
              </Text>
            </Card>
          ) : null}

          {recapMoments.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                精彩瞬间
              </Text>
              {recapMoments.map((moment, i) => (
                <Text key={i} className='icebreaker__recap-item'>
                  • {moment}
                </Text>
              ))}
            </Card>
          )}
        </View>
      )}

      {!recapData && (
        <Card className='icebreaker__recap-section'>
          <Text className='icebreaker__recap-section-title'>
            感谢参与今晚的破冰！
          </Text>
          <Text className='icebreaker__recap-item'>
            希望你和新朋友们建立了更深的连接
          </Text>
        </Card>
      )}

      {socialSessionId && (
        <MomentCardCTA socialSessionId={socialSessionId} />
      )}

      <Button variant='primary' className='icebreaker__recap-leave-btn' onClick={onLeave}>
        返回活动
      </Button>
    </View>
  )
}
