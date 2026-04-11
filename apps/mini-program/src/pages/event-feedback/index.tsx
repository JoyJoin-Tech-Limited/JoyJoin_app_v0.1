import { View, Text, Button, Textarea } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logInfo, logError } from '../../lib/logger'
import './index.scss'

const RATING_LABELS = ['😕', '🙁', '😐', '🙂', '🤩']

export default function EventFeedbackPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const { isLoading: authLoading } = useAuthGuard()

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(async () => {
    if (!eventId || rating === 0 || isSubmitting) return

    setIsSubmitting(true)
    setError('')
    try {
      logInfo('[EventFeedback] Submitting', { eventId, rating })
      await apiRequest({
        path: `/api/events/${encodeURIComponent(eventId)}/feedback`,
        method: 'POST',
        data: {
          rating,
          comment: comment.trim() || undefined,
        },
      })
      setSubmitted(true)
      Taro.showToast({ title: '反馈已提交', icon: 'success', duration: 2000 })
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败，请重试'
      setError(message)
      logError('[EventFeedback] Submit failed', { message })
    } finally {
      setIsSubmitting(false)
    }
  }, [eventId, rating, comment, isSubmitting])

  if (authLoading) {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__loading'>
          <Text className='event-feedback__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  if (submitted) {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__success'>
          <Text className='event-feedback__success-emoji'>🎉</Text>
          <Text className='event-feedback__success-title'>感谢你的反馈！</Text>
          <Text className='event-feedback__success-text'>你的评价帮助我们变得更好</Text>
          <Button
            className='event-feedback__back-btn'
            onClick={() => Taro.navigateBack()}
          >
            返回
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className='event-feedback'>
      <View className='event-feedback__header'>
        <Text className='event-feedback__title'>活动反馈</Text>
        <Text className='event-feedback__subtitle'>你的评价对我们很重要</Text>
      </View>

      {/* Rating */}
      <View className='event-feedback__card'>
        <Text className='event-feedback__card-title'>整体体验如何？</Text>
        <View className='event-feedback__rating'>
          {RATING_LABELS.map((emoji, idx) => {
            const value = idx + 1
            return (
              <View
                key={value}
                className={`event-feedback__rating-item ${rating === value ? 'event-feedback__rating-item--selected' : ''}`}
                onClick={() => setRating(value)}
              >
                <Text className='event-feedback__rating-emoji'>{emoji}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Comment */}
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
          disabled={rating === 0 || isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '提交中…' : '提交反馈'}
        </Button>
      </View>
    </View>
  )
}
