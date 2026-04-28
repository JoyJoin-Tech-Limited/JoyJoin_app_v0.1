import { View, Text, Button, Textarea, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { getXiaoyueExpressionAsset } from '../../lib/xiaoyueExpressions'
import { logInfo, logError } from '../../lib/logger'
import { TOAST_DEFAULT_MS } from '../../lib/uiConstants'
import RatingFace from '../../components/RatingFace'
import JoyJoinLoadingScreen from '../../components/JoyJoinLoadingScreen'
import ArchetypeHead from '../../components/ArchetypeHead'
import Card from '../../components/Card'
import './index.scss'

interface Participant {
  id: string
  displayName?: string
  firstName?: string
  archetype?: string
}

interface MutualMatch {
  userId: string
  displayName: string
  archetype: string | null
  wechatContactId: string | null
}

type FeedbackStep = 'rating' | 'connections' | 'comment' | 'submitting' | 'revealed'

export default function EventFeedbackPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()
  const currentUserId = currentUser?.id

  const [step, setStep] = useState<FeedbackStep>('rating')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedConnections, setSelectedConnections] = useState<string[]>([])
  const [mutualMatches, setMutualMatches] = useState<MutualMatch[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { data: participants = [], isLoading: participantsLoading } = useQuery<Participant[]>({
    queryKey: ['mini-program', 'event-participants', eventId],
    queryFn: async () => {
      const res = await apiRequest<Participant[]>({ path: `/api/events/${encodeURIComponent(eventId)}/participants` })
      // Filter out current user
      return res.filter((p) => p.id !== currentUserId)
    },
    enabled: !!eventId && !authLoading && !!currentUserId,
  })

  const toggleConnection = useCallback((userId: string) => {
    setSelectedConnections((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!eventId || rating === 0 || isSubmitting) return

    setIsSubmitting(true)
    setError('')
    try {
      logInfo('[EventFeedback] Submitting', { eventId, rating, connections: selectedConnections.length })
      const res = await apiRequest<{ mutualMatches?: MutualMatch[] }>({
        path: `/api/events/${encodeURIComponent(eventId)}/feedback`,
        method: 'POST',
        data: {
          rating,
          comment: comment.trim() || undefined,
          connections: selectedConnections,
        },
      })
      setMutualMatches(res.mutualMatches || [])
      setStep('revealed')
      Taro.showToast({ title: '反馈已提交', icon: 'success', duration: TOAST_DEFAULT_MS })
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败，请重试'
      setError(message)
      logError('[EventFeedback] Submit failed', { message })
      setIsSubmitting(false)
    }
  }, [eventId, rating, comment, selectedConnections, isSubmitting])

  const handleCopyWechat = useCallback((wechatId: string) => {
    Taro.setClipboardData({
      data: wechatId,
      success: () => {
        Taro.showToast({ title: '微信号已复制', icon: 'success', duration: TOAST_DEFAULT_MS })
      },
    })
  }, [])

  if (authLoading || participantsLoading) {
    return (
      <JoyJoinLoadingScreen
        title='准备反馈页面…'
        subtitle='小悦在确认你的活动参与记录'
        showSkeleton={false}
      />
    )
  }

  // ─── Revealed step ─────────────────────────────────────────────────────────
  if (step === 'revealed') {
    const hasMatches = mutualMatches.length > 0
    return (
      <View className='event-feedback'>
        <View className='event-feedback__success'>
          <Image
            className='event-feedback__success-mascot'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset(hasMatches ? 'matchSuccess' : 'thanksFeedback')}
          />
          <Text className='event-feedback__success-title'>
            {hasMatches ? '🎉 缘分双向奔赴！' : '感谢你的反馈！'}
          </Text>
          <Text className='event-feedback__success-text'>
            {hasMatches
              ? `你和 ${mutualMatches.length} 位参与者互相选择了对方`
              : '你的评价帮助我们变得更好'}
          </Text>

          {hasMatches ? (
            <View className='event-feedback__matches'>
              {mutualMatches.map((match) => (
                <Card key={match.userId} className='event-feedback__match-card'>
                  <View className='event-feedback__match-row'>
                    <ArchetypeHead archetype={match.archetype || undefined} size={64} fallbackText={match.displayName} />
                    <View className='event-feedback__match-info'>
                      <Text className='event-feedback__match-name'>{match.displayName}</Text>
                      {match.wechatContactId ? (
                        <View
                          className='event-feedback__match-wechat'
                          onClick={() => handleCopyWechat(match.wechatContactId!)}
                        >
                          <Text className='event-feedback__match-wechat-label'>微信号</Text>
                          <Text className='event-feedback__match-wechat-id'>{match.wechatContactId}</Text>
                          <Text className='event-feedback__match-wechat-hint'>点击复制</Text>
                        </View>
                      ) : (
                        <Text className='event-feedback__match-no-wechat'>对方尚未设置微信号</Text>
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          <Button className='event-feedback__back-btn' onClick={() => Taro.navigateBack()}>
            返回
          </Button>
        </View>
      </View>
    )
  }

  // ─── Rating step ───────────────────────────────────────────────────────────
  if (step === 'rating') {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__header'>
          <Text className='event-feedback__title'>活动反馈</Text>
          <Text className='event-feedback__subtitle'>今晚这局怎么样？</Text>
        </View>

        <View className='event-feedback__card'>
          <Text className='event-feedback__card-title'>整体体验如何？</Text>
          <View className='event-feedback__rating'>
            <RatingFace value={rating} onSelect={setRating} disabled={false} />
          </View>
        </View>

        <View className='event-feedback__footer'>
          <Button
            className='event-feedback__submit'
            onClick={() => rating > 0 && setStep('connections')}
            disabled={rating === 0}
          >
            下一步
          </Button>
        </View>
      </View>
    )
  }

  // ─── Connections step ──────────────────────────────────────────────────────
  if (step === 'connections') {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__header'>
          <Text className='event-feedback__title'>活动反馈</Text>
          <Text className='event-feedback__subtitle'>想继续了解谁？</Text>
        </View>

        <View className='event-feedback__card'>
          <Text className='event-feedback__card-title'>选择想保持联系的人</Text>
          <Text className='event-feedback__card-hint'>互相选择后，即可看到对方的微信号</Text>
          {participants.length === 0 ? (
            <Text className='event-feedback__empty-participants'>暂无其他参与者信息</Text>
          ) : (
            <View className='event-feedback__participant-grid'>
              {participants.map((p) => {
                const isSelected = selectedConnections.includes(p.id)
                return (
                  <View
                    key={p.id}
                    className={`event-feedback__participant-item ${isSelected ? 'event-feedback__participant-item--selected' : ''}`}
                    onClick={() => toggleConnection(p.id)}
                  >
                    <ArchetypeHead
                      archetype={p.archetype}
                      size={80}
                      fallbackText={p.displayName || p.firstName}
                    />
                    <Text className='event-feedback__participant-name'>
                      {p.displayName || p.firstName || '匿名'}
                    </Text>
                    {isSelected && (
                      <View className='event-feedback__participant-check'>✓</View>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </View>

        <View className='event-feedback__footer'>
          <Button className='event-feedback__submit' onClick={() => setStep('comment')}>
            {selectedConnections.length > 0
              ? `已选 ${selectedConnections.length} 人，下一步`
              : '跳过，下一步'}
          </Button>
        </View>
      </View>
    )
  }

  // ─── Comment step ──────────────────────────────────────────────────────────
  return (
    <View className='event-feedback'>
      <View className='event-feedback__header'>
        <Text className='event-feedback__title'>活动反馈</Text>
        <Text className='event-feedback__subtitle'>最后一步</Text>
      </View>

      <View className='event-feedback__card'>
        <Text className='event-feedback__card-title'>想说点什么？（可选）</Text>
        <Textarea
          className='event-feedback__textarea'
          placeholder='分享你的感受和建议…'
          value={comment}
          onInput={(e) => setComment(e.detail.value)}
          maxlength={500}
        />
      </View>

      {error ? <Text className='event-feedback__error'>{error}</Text> : null}

      <View className='event-feedback__footer'>
        <Button
          className='event-feedback__submit'
          onClick={handleSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '提交中…' : '提交反馈'}
        </Button>
      </View>
    </View>
  )
}
