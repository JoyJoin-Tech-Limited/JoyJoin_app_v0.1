import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { logError } from '../../lib/utils/logger'

export default function MyEventsLegacyPage() {
  const [statusText, setStatusText] = useState('正在前往我的足迹...')

  useEffect(() => {
    let isActive = true

    void Taro.switchTab({ url: '/pages/events/index' }).catch(async (switchTabError) => {
      if (!isActive) {
        return
      }

      logError('[MyEventsLegacyPage] switchTab failed, trying reLaunch fallback', {
        error: switchTabError instanceof Error ? switchTabError.message : String(switchTabError),
      })

      try {
        await Taro.reLaunch({ url: '/pages/events/index' })
      } catch (relaunchError) {
        logError('[MyEventsLegacyPage] reLaunch fallback failed', {
          error: relaunchError instanceof Error ? relaunchError.message : String(relaunchError),
        })

        if (isActive) {
          setStatusText('跳转没成功，返回再试试')
        }
      }
    })

    return () => {
      isActive = false
    }
  }, [])

  return (
    <View>
      <Text>{statusText}</Text>
    </View>
  )
}
