import { Button, View, Text } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../lib/api'
import { logError } from '../../lib/logger'
import './index.scss'

type VerificationState = 'polling' | 'paid' | 'pending' | 'failed'

// Poll for up to 20 seconds total so the user gets a fast answer without
// hammering the status endpoint after returning from the WeChat pay sheet.
const MAX_POLL_ATTEMPTS = 10
const POLL_INTERVAL_MS = 2000

function clearPendingOrderStorage() {
  wx.removeStorageSync('pending_order')
  wx.removeStorageSync('pending_order_context')
}

export default function PaymentVerificationPage() {
  const [orderId, setOrderId] = useState('')
  const [status, setStatus] = useState<VerificationState>('polling')
  const [message, setMessage] = useState('正在确认支付结果...')
  const [attemptCount, setAttemptCount] = useState(0)
  const isPollingRef = useRef(false)
  const isMountedRef = useRef(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      clearTimer()
    }
  }, [clearTimer])

  const navigateAfterPaid = useCallback(() => {
    const context = wx.getStorageSync('pending_order_context') as { type?: string } | undefined
    clearPendingOrderStorage()

    if (context?.type === 'event') {
      Taro.redirectTo({ url: '/pages/events/index' })
      return
    }

    Taro.redirectTo({ url: '/pages/profile/index' })
  }, [])

  const pollPaymentStatus = useCallback(async (targetOrderId: string, attempt = 1) => {
    if (!targetOrderId || isPollingRef.current) {
      return
    }

    isPollingRef.current = true
    setAttemptCount(attempt)

    try {
      const response = await apiRequest<{ status?: string }>({
        path: `/api/payments/status/${encodeURIComponent(targetOrderId)}`,
      })

      if (response.status === 'completed') {
        setStatus('paid')
        setMessage('支付已确认，正在为你发放权益...')
        timeoutRef.current = setTimeout(() => {
          navigateAfterPaid()
        }, 1200)
        return
      }

      if (response.status === 'failed' || response.status === 'closed') {
        clearPendingOrderStorage()
        setStatus('failed')
        setMessage('支付未完成，请重新发起支付')
        return
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        setStatus('pending')
        setMessage('支付处理中，请稍后查看我的订单')
        return
      }

      setStatus('polling')
      setMessage('正在确认支付结果...')
      timeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) {
          return
        }
        isPollingRef.current = false
        void pollPaymentStatus(targetOrderId, attempt + 1)
      }, POLL_INTERVAL_MS)
      return
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '查询支付状态失败'
      setStatus('failed')
      setMessage(nextMessage)
      logError('Mini-program payment verification failed', {
        message: nextMessage,
      })
      return
    } finally {
      isPollingRef.current = false
    }
  }, [navigateAfterPaid])

  const bootstrap = useCallback((incomingOrderId?: string) => {
    if (isPollingRef.current) {
      return
    }

    clearTimer()

    const storedOrderId = typeof incomingOrderId === 'string' && incomingOrderId.length > 0
      ? incomingOrderId
      : wx.getStorageSync('pending_order')

    if (!storedOrderId || typeof storedOrderId !== 'string') {
      void Taro.showToast({
        title: '未找到待确认订单',
        icon: 'none',
      })
      Taro.redirectTo({ url: '/pages/discover/index' })
      return
    }

    setOrderId(storedOrderId)
    setStatus('polling')
    setMessage('正在确认支付结果...')
    void pollPaymentStatus(storedOrderId, 1)
  }, [clearTimer, pollPaymentStatus])

  useLoad((params) => {
    bootstrap(params?.outTradeNo)
  })

  useDidShow(() => {
    if (status === 'polling') {
      bootstrap(orderId)
      return
    }

    if (status === 'pending' && orderId && wx.getStorageSync('pending_order')) {
      bootstrap(orderId)
    }
  })

  return (
    <View className='verification-page'>
      <View className='verification-page__card'>
        <Text className='verification-page__title'>订单确认中</Text>
        <Text className='verification-page__message'>{message}</Text>

        {status === 'polling' ? (
          <View className='verification-page__spinner-wrap'>
            <View className='verification-page__spinner' />
            <Text className='verification-page__meta'>已查询 {attemptCount} / {MAX_POLL_ATTEMPTS} 次</Text>
          </View>
        ) : null}

        {status === 'paid' ? (
          <Button className='verification-page__button' onClick={navigateAfterPaid}>
            进入我的权益
          </Button>
        ) : null}

        {status === 'pending' ? (
          <View className='verification-page__actions'>
            <Button className='verification-page__button' onClick={() => Taro.redirectTo({ url: '/pages/profile/index' })}>
              去我的页查看
            </Button>
            <Button className='verification-page__button verification-page__button--secondary' onClick={() => bootstrap(orderId)}>
              继续查询
            </Button>
          </View>
        ) : null}

        {status === 'failed' ? (
          <View className='verification-page__actions'>
            <Button className='verification-page__button' onClick={() => Taro.navigateBack({ fail: () => Taro.navigateTo({ url: '/pages/blind-box-payment/index' }) })}>
              重新支付
            </Button>
            <Button className='verification-page__button verification-page__button--secondary' onClick={() => Taro.redirectTo({ url: '/pages/profile/index' })}>
              返回我的页
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  )
}
