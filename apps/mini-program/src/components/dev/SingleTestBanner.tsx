import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { haptics } from '../../lib/utils/haptics'
import { apiRequest } from '../../lib/api/api'
import './SingleTestBanner.scss'

interface SingleTestBannerProps {
  className?: string
}

interface StartResult {
  socialSessionId: string
  groupId: string
  testerRegistrationId: string
  registrationId: string
  bots: Array<{ botId: string; displayName: string; archetype: string | null }>
}

const RETRY_DELAYS_MS = [0, 450, 900]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrorTitle(prefix: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const compact = message.replace(/\s+/g, ' ').trim()
  return `${prefix}: ${compact || '请稍后重试'}`.slice(0, 28)
}

async function requestWithRetry<T>(request: () => Promise<T>): Promise<T> {
  let lastError: unknown

  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) {
      await sleep(delay)
    }

    try {
      return await request()
    } catch (err) {
      lastError = err
    }
  }

  throw lastError
}

export default function SingleTestBanner({ className = '' }: SingleTestBannerProps) {
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const isBusy = loading || resetting

  const handleStart = useCallback(async () => {
    if (isBusy) {
      return
    }

    haptics('medium')
    setLoading(true)
    try {
      const result = await requestWithRetry(() =>
        apiRequest<StartResult>({
          method: 'POST',
          path: '/api/test/single-test/start',
        }),
      )
      Taro.showToast({ title: `调试局已创建，共${result.bots.length + 1}人`, icon: 'none' })
      await Taro.navigateTo({
        url: `/pages/matching-status/index?registrationId=${encodeURIComponent(result.registrationId)}`,
      })
    } catch (err: unknown) {
      Taro.showToast({ title: getErrorTitle('启动失败', err), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [isBusy])

  const handleReset = useCallback(async () => {
    if (isBusy) {
      return
    }

    haptics('medium')
    setResetting(true)
    try {
      await requestWithRetry(() =>
        apiRequest<{ message: string }>({
          method: 'POST',
          path: '/api/test/single-test/reset',
        }),
      )
      Taro.showToast({ title: '测试数据已重置', icon: 'success' })
    } catch (err: unknown) {
      Taro.showToast({ title: getErrorTitle('重置失败', err), icon: 'none' })
    } finally {
      setResetting(false)
    }
  }, [isBusy])

  return (
    <View className={`single-test-banner ${className}`}>
      <View className='single-test-banner__content'>
        <Text className='single-test-banner__title'>单人调试模式</Text>
        <Text className='single-test-banner__desc'>启动 5 个 AI bot，测试 icebreaker 全流程</Text>
      </View>
      <View className='single-test-banner__actions'>
        <View
          className={`single-test-banner__btn single-test-banner__btn--start ${loading ? 'single-test-banner__btn--loading' : ''} ${isBusy ? 'single-test-banner__btn--disabled' : ''}`}
          onClick={handleStart}
          hoverClass={isBusy ? 'none' : 'single-test-banner__btn--hover'}
        >
          <Text>{loading ? '启动中…' : '创建调试局'}</Text>
        </View>
        <View
          className={`single-test-banner__btn single-test-banner__btn--reset ${resetting ? 'single-test-banner__btn--loading' : ''} ${isBusy ? 'single-test-banner__btn--disabled' : ''}`}
          onClick={handleReset}
          hoverClass={isBusy ? 'none' : 'single-test-banner__btn--hover'}
        >
          <Text>{resetting ? '重置中…' : '重置'}</Text>
        </View>
      </View>
    </View>
  )
}
