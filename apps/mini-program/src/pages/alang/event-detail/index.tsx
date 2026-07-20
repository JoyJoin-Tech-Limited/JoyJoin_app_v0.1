import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { View } from '@tarojs/components'
import { FlashFeatureClosed, FlashPageState } from '../../../components/alang/FlashUi'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import '../flash.scss'

/** Legacy prototype detail URLs recover through the formal server-owned home. */
export default function LegacyFlashDetailRedirect() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)

  useEffect(() => {
    if (!enabled) return
    void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent })
  }, [enabled])

  if (!enabled) return <FlashFeatureClosed />

  return (
    <View className='flash-page'>
      <FlashPageState title='正在接回新的闪现…' description='旧链接会从服务端保存的正式版状态继续。' />
    </View>
  )
}
