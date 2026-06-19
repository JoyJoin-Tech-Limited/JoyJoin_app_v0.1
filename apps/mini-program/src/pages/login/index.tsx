import { useState, useRef } from 'react'
import { View, Text, Button, Image, Input } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import Taro from '@tarojs/taro'
import { useWeChatLogin } from '../../hooks/auth/useWeChatLogin'
import {
  authenticateMiniProgramUserWithPhone,
  getUserState,
  type ApiError,
} from '../../lib/api/api'
import { seedMiniProgramAuthSession } from '../../lib/api/authSession'
import { navigateToMiniProgramNextStep } from '../../lib/onboarding/onboardingNavigation'
import { logInfo, logError } from '../../lib/utils/logger'
import { TOAST_FATAL_MS } from '../../lib/utils/uiConstants'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { getArchetypeVisual } from '../onboarding/personality-test/visuals'
import './index.scss'

// Featured archetypes that orbit the avatar — unmistakably JoyJoin
const FLOATING_ARCHETYPES = ['corgi', 'fox', 'koala']

/**
 * LoginPage — WeChat Mini Program login entry point.
 *
 * Auth flow: Taro.login() → POST /api/auth/wechat/login (code2Session) →
 * GET /api/auth/user (nextStep) → navigate.  No web OAuth redirect is used.
 *
 * Accepts optional `invitationCode` URL param to attribute signup to a referrer.
 *
 * Also exposes a test login section (phone+password) for QA accounts.
 */
export default function LoginPage() {
  const router = useRouter()
  const invitationCode = router.params.invitationCode ?? ''
  const { handleWeChatLogin, isLoggingIn } = useWeChatLogin({
    referralCode: invitationCode || undefined,
  })

  const queryClient = useQueryClient()
  const [showTestLogin, setShowTestLogin] = useState(false)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [isTestLoggingIn, setIsTestLoggingIn] = useState(false)
  const testLoginLockRef = useRef(false)

  async function handleTestLogin() {
    if (testLoginLockRef.current || !phone || !password) return
    testLoginLockRef.current = true
    setIsTestLoggingIn(true)

    try {
      logInfo('[LoginPage] Starting test login')

      const normalizedPhone = phone.length === 11 && !phone.startsWith('+') ? `+86${phone}` : phone

      await authenticateMiniProgramUserWithPhone({ phone: normalizedPhone, password })
      const userState = await getUserState()
      seedMiniProgramAuthSession(userState, queryClient)

      logInfo('[LoginPage] Test login successful', { nextStep: userState.nextStep })
      await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'root' })
    } catch (error) {
      const typedError = error as ApiError | undefined
      const message =
        error instanceof Error ? error.message : '手机号或密码错误'

      logError('[LoginPage] Test login failed', { message, statusCode: typedError?.statusCode })

      Taro.showToast({
        title: message,
        icon: 'none',
        duration: TOAST_FATAL_MS,
      })
    } finally {
      testLoginLockRef.current = false
      setIsTestLoggingIn(false)
    }
  }

  return (
    <View className='login-page'>
      {/* Radial glow — brand purple at low opacity, centred behind avatar */}
      <View
        className='login-page__glow'
        aria-hidden='true'
      />

      <View className='login-page__content'>
        {/* Eyebrow — unmistakably JoyJoin */}
        <Text className='login-page__eyebrow'>JoyJoin · 12种氛围原型</Text>

        {/* Avatar hero block with floating archetype orbs */}
        <View className='login-page__avatar-wrap'>
          <View className='login-page__avatar-ring' aria-hidden='true' />
          <Image
            className='login-page__avatar-img'
            src={getXiaoyueExpressionAsset('homeWelcome')}
            mode='aspectFit'
          />
          {FLOATING_ARCHETYPES.map((name, index) => {
            const visual = getArchetypeVisual(name)
            return (
              <Image
                key={name}
                className={`login-page__float-orb login-page__float-orb--${index + 1}`}
                src={visual.asset}
                mode='aspectFit'
              />
            )
          })}
        </View>

        {/* Headline — references the archetype system directly */}
        <View className='login-page__headline'>
          <Text className='login-page__title'>打开氛围盲盒</Text>
          <Text className='login-page__title'>遇见同频的人</Text>
        </View>

        <Text className='login-page__subtitle'>微信一键登录，测测你的社交原型，加入4-6人小局</Text>
      </View>

      <View className='login-page__actions'>
        <Button
          className={`login-page__wechat-btn${isLoggingIn ? ' login-page__wechat-btn--loading' : ''}`}
          onClick={handleWeChatLogin}
          disabled={isLoggingIn || isTestLoggingIn}
          hoverClass='login-page__wechat-btn-hover'
        >
          {isLoggingIn ? '登录中…' : '微信一键登录'}
        </Button>

        {/* Test login toggle */}
        <View className='login-page__test-toggle' onClick={() => setShowTestLogin(v => !v)}>
          <View className='login-page__divider-line' />
          <Text className='login-page__test-toggle-text'>
            {showTestLogin ? '收起测试登录' : '测试账号登录'}
          </Text>
          <View className='login-page__divider-line' />
        </View>

        {/* Test login form — expanded inline */}
        {showTestLogin && (
          <View className='login-page__test-form'>
            <View className='login-page__test-field'>
              <Input
                className='login-page__test-input'
                placeholder='手机号'
                value={phone}
                onInput={e => setPhone(e.detail.value)}
                maxlength={14}
                type='text'
              />
            </View>
            <View className='login-page__test-field'>
              <Input
                className='login-page__test-input'
                placeholder='密码'
                value={password}
                onInput={e => setPassword(e.detail.value)}
                password
              />
            </View>
            <Button
              className='login-page__test-submit'
              onClick={handleTestLogin}
              disabled={isTestLoggingIn || !phone || !password}
              hoverClass='login-page__test-submit-hover'
            >
              {isTestLoggingIn ? '登录中…' : '登录'}
            </Button>
          </View>
        )}

        <Text className='login-page__legal'>
          登录即同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </View>
  )
}
