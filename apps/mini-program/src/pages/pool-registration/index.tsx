import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEventPool, registerForPool, type EventPoolSummary } from '@shared/api'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logInfo, logError } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import './index.scss'

export default function PoolRegistrationPage() {
  const router = useRouter()
  const poolId = router.params.id ?? ''
  const { isLoading: authLoading } = useAuthGuard()

  const [isRegistering, setIsRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState('')

  const { data: pool, isLoading } = useQuery<EventPoolSummary>({
    queryKey: ['mini-program', 'event-pool', poolId],
    queryFn: () => getEventPool(apiRequest, poolId),
    enabled: !!poolId && !authLoading,
  })

  const handleRegister = useCallback(async () => {
    if (!poolId || isRegistering) return

    setIsRegistering(true)
    setError('')
    try {
      logInfo('[PoolRegistration] Registering', { poolId })
      await registerForPool(apiRequest, poolId)
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
    return <LoadingScreen />
  }

  if (registered) {
    return (
      <View className='pool-reg'>
        <Card className='pool-reg__success'>
          <Text className='pool-reg__success-emoji'>🎉</Text>
          <Text className='pool-reg__success-title'>报名成功！</Text>
          <Text className='pool-reg__success-text'>我们会在匹配完成后通知你</Text>
          <Button
            variant='primary'
            className='pool-reg__back-btn'
            onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
          >
            查看我的活动
          </Button>
        </Card>
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
        <Card className='pool-reg__card'>
          {pool.dateTime ? (
            <View className='pool-reg__info-row'>
              <Text className='pool-reg__info-label'>📅 时间</Text>
              <Text className='pool-reg__info-value'>{pool.dateTime}</Text>
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
        </Card>
      ) : null}

      {error ? <Text className='pool-reg__error'>{error}</Text> : null}

      <View className='pool-reg__footer'>
        <Button
          variant='primary'
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
