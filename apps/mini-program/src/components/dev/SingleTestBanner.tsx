import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
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
  botUsers: Array<{ userId: string; displayName: string; archetype: string | null }>
}

export default function SingleTestBanner({ className = '' }: SingleTestBannerProps) {
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleStart = async () => {
    haptics('medium')
    setLoading(true)
    try {
      const result = await apiRequest<StartResult>({
        method: 'POST',
        path: '/api/test/single-test/start',
      })
      Taro.showToast({ title: `局已创建，共${result.botUsers.length + 1}人`, icon: 'none' })
      Taro.navigateTo({
        url: `/pages/matching-status/index?registrationId=${encodeURIComponent(result.registrationId)}`,
      })
    } catch (err: any) {
      const msg = err?.message || String(err)
      Taro.showToast({ title: `启动失败: ${msg}`, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    haptics('medium')
    setResetting(true)
    try {
      await apiRequest<{ message: string }>({
        method: 'POST',
        path: '/api/test/single-test/reset',
      })
      Taro.showToast({ title: '测试数据已重置', icon: 'success' })
    } catch (err: any) {
      Taro.showToast({ title: `重置失败: ${err?.message || String(err)}`, icon: 'none' })
    } finally {
      setResetting(false)
    }
  }

  return (
    <View className={`single-test-banner ${className}`}>
      <View className='single-test-banner__content'>
        <Text className='single-test-banner__title'>🧪 单人调试模式</Text>
        <Text className='single-test-banner__desc'>启动 5 个 AI bot，测试冰 breaker 全流程</Text>
      </View>
      <View className='single-test-banner__actions'>
        <View
          className={`single-test-banner__btn single-test-banner__btn--start ${loading ? 'single-test-banner__btn--loading' : ''}`}
          onClick={handleStart}
          hoverClass='single-test-banner__btn--hover'
        >
          <Text>{loading ? '启动中…' : '创建调试局'}</Text>
        </View>
        <View
          className={`single-test-banner__btn single-test-banner__btn--reset ${resetting ? 'single-test-banner__btn--loading' : ''}`}
          onClick={handleReset}
          hoverClass='single-test-banner__btn--hover'
        >
          <Text>{resetting ? '重置中…' : '重置'}</Text>
        </View>
      </View>
    </View>
  )
}
