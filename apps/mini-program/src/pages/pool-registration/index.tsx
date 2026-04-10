import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logInfo, logError } from '../../lib/logger'
import './index.scss'

interface EventPool {
  id: string
  title?: string
  description?: string
  dateRange?: string
  maxParticipants?: number
  currentParticipants?: number
  [key: string]: unknown
}

export default function PoolRegistrationPage() {
  const router = useRouter()
  const poolId = router.params.id ?? ''
  const { isLoading: authLoading } = useAuthGuard()

  const [isRegistering, setIsRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState('')

  const { data: pool, isLoading } = useQuery<EventPool>({
    queryKey: ['mini-program', 'event-pool', poolId],
    queryFn: () => apiRequest<EventPool>({ path: `/api/event-pools/${encodeURIComponent(poolId)}` }),
    enabled: !!poolId && !authLoading,
  })

  const handleRegister = useCallback(async () => {
    if (!poolId || isRegistering) return

    setIsRegistering(true)
    setError('')
    try {
      logInfo('[PoolRegistration] Registering', { poolId })
      await apiRequest({
        path: '/api/pool-registrations',
        method: 'POST',
        data: { poolId },
      })
      setRegistered(true)
      Taro.showToast({ title: '报名成功！', icon: 'success', duration: 2000 })
    } catch (err) {
      const message = err instanceof Error ? err.message : '报名失败，请重试'
      setError(message)
      logError('[PoolRegistration] Failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: 3000 })
    } finally {
      setIsRegistering(false)
    }
  }, [poolId, isRegistering])

  if (authLoading || isLoading) {
    return (
      <View className='pool-reg'>
        <View className='pool-reg__loading'>
          <Text className='pool-reg__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  if (registered) {
    return (
      <View className='pool-reg'>
        <View className='pool-reg__success'>
          <Text className='pool-reg__success-emoji'>🎉</Text>
          <Text className='pool-reg__success-title'>报名成功！</Text>
          <Text className='pool-reg__success-text'>我们会在匹配完成后通知你</Text>
          <Button
            className='pool-reg__back-btn'
            onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
          >
            查看我的活动
          </Button>
        </View>
      </View>
    )
  }

  return (
    <ScrollView className='pool-reg' scrollY enhanced showScrollbar={false}>
      <View className='pool-reg__header'>
        <Text className='pool-reg__title'>{pool?.title ?? '活动报名'}</Text>
        {pool?.description ? (
          <Text className='pool-reg__description'>{pool.description}</Text>
        ) : null}
      </View>

      {pool ? (
        <View className='pool-reg__card'>
          {pool.dateRange ? (
            <View className='pool-reg__info-row'>
              <Text className='pool-reg__info-label'>📅 时间</Text>
              <Text className='pool-reg__info-value'>{pool.dateRange}</Text>
            </View>
          ) : null}
          {pool.maxParticipants ? (
            <View className='pool-reg__info-row'>
              <Text className='pool-reg__info-label'>👥 名额</Text>
              <Text className='pool-reg__info-value'>
                {pool.currentParticipants ?? 0} / {pool.maxParticipants}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? <Text className='pool-reg__error'>{error}</Text> : null}

      <View className='pool-reg__footer'>
        <Button
          className='pool-reg__submit'
          onClick={handleRegister}
          disabled={isRegistering}
          loading={isRegistering}
        >
          {isRegistering ? '报名中…' : '立即报名'}
        </Button>
      </View>
    </ScrollView>
  )
}
