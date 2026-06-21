import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authenticateMiniProgramUserWithPhone, getUserState } from '../../lib/api/api'
import { seedMiniProgramAuthSession } from '../../lib/api/authSession'
import { navigateToMiniProgramNextStep } from '../../lib/onboarding/onboardingNavigation'
import { logInfo, logError } from '../../lib/utils/logger'
import { haptics } from '../../lib/utils/haptics'
import { TOAST_FATAL_MS } from '../../lib/utils/uiConstants'
import './TestLoginSheet.scss'

const TEST_ACCOUNTS: Array<{ phone: string; label: string; archetype: string }> = [
  { phone: '+8613800000001', label: '完整资料', archetype: '开心柯基' },
  { phone: '+8613800000002', label: '未完成资料', archetype: '-' },
  { phone: '+8613800000003', label: '太阳鸡', archetype: '太阳鸡' },
  { phone: '+8613800000004', label: '树洞考拉', archetype: '树洞考拉' },
  { phone: '+8613800000005', label: '靠谱大象', archetype: '靠谱大象' },
  { phone: '+8613800000006', label: '最小资料', archetype: '-' },
  { phone: '+8613800000007', label: '机灵海豚', archetype: '机灵海豚' },
  { phone: '+8613800000008', label: '脑洞章鱼', archetype: '脑洞章鱼' },
  { phone: '+8613800000009', label: '社交蝴蝶', archetype: '社交蝴蝶' },
  { phone: '+8613800000010', label: '智慧猫头鹰', archetype: '智慧猫头鹰' },
]

const TEST_PASSWORD = 'test123456'

interface TestLoginSheetProps {
  visible: boolean
  onClose: () => void
}

export default function TestLoginSheet({ visible, onClose }: TestLoginSheetProps) {
  const [loggingInPhone, setLoggingInPhone] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const handleLogin = async (phone: string) => {
    if (loggingInPhone) return
    haptics('medium')
    setLoggingInPhone(phone)

    try {
      logInfo('[TestLoginSheet] Starting phone login', { phone })

      await authenticateMiniProgramUserWithPhone({
        phone,
        password: TEST_PASSWORD,
      })

      const userState = await getUserState()
      seedMiniProgramAuthSession(userState, queryClient)

      logInfo('[TestLoginSheet] Login successful', { nextStep: userState.nextStep })

      Taro.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1200,
      })

      await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'root' })
    } catch (error) {
      const msg = error instanceof Error ? error.message : '登录失败'
      logError('[TestLoginSheet] Login failed', { phone, message: msg })
      Taro.showToast({
        title: msg,
        icon: 'none',
        duration: TOAST_FATAL_MS,
      })
    } finally {
      setLoggingInPhone(null)
    }
  }

  if (!visible) return null

  return (
    <View className='test-login-sheet' catchMove>
      <View className='test-login-sheet__backdrop' onClick={onClose} />
      <View className='test-login-sheet__panel'>
        <View className='test-login-sheet__header'>
          <Text className='test-login-sheet__title'>测试账号登录</Text>
          <View
            className='test-login-sheet__close'
            onClick={() => {
              haptics('light')
              onClose()
            }}
            hoverClass='test-login-sheet__close--hover'
            role='button'
            aria-label='关闭'
          >
            <Text className='test-login-sheet__close-text'>取消</Text>
          </View>
        </View>

        <View className='test-login-sheet__hint'>
          <Text className='test-login-sheet__hint-text'>密码均为 test123456，点击直接登录</Text>
        </View>

        <ScrollView className='test-login-sheet__list' scrollY enableFlex>
          {TEST_ACCOUNTS.map((acct) => (
            <View
              key={acct.phone}
              className={`test-login-sheet__item ${loggingInPhone === acct.phone ? 'test-login-sheet__item--loading' : ''}`}
              onClick={() => handleLogin(acct.phone)}
              hoverClass='test-login-sheet__item--hover'
              role='button'
              aria-label={`登录 ${acct.label} ${acct.phone}`}
            >
              <View className='test-login-sheet__item-avatar'>
                <Text className='test-login-sheet__item-avatar-text'>
                  {acct.archetype === '-' ? '?' : acct.archetype.slice(0, 1)}
                </Text>
              </View>
              <View className='test-login-sheet__item-info'>
                <Text className='test-login-sheet__item-label'>{acct.label}</Text>
                <Text className='test-login-sheet__item-phone'>{acct.phone}</Text>
              </View>
              <View className='test-login-sheet__item-archetype'>
                <Text className='test-login-sheet__item-archetype-text'>{acct.archetype}</Text>
              </View>
              {loggingInPhone === acct.phone && (
                <View className='test-login-sheet__item-spinner' />
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}
