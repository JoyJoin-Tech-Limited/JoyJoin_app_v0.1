import { View, Text, Button } from '@tarojs/components'
import { useWeChatLogin } from '../../hooks/useWeChatLogin'
import './index.scss'

/**
 * LoginPage — WeChat Mini Program login entry point.
 *
 * Auth flow: Taro.login() → POST /api/auth/wechat/login (code2Session) →
 * GET /api/auth/user (nextStep) → navigate.  No web OAuth redirect is used.
 */
export default function LoginPage() {
  const { handleWeChatLogin, isLoggingIn } = useWeChatLogin()

  return (
    <View className='login-page'>
      <View className='login-page__content'>
        <Text className='login-page__title'>欢迎回来</Text>
        <Text className='login-page__subtitle'>用微信一键登录，继续你的缘分之旅</Text>
      </View>

      <View className='login-page__actions'>
        <Button
          className={`login-page__wechat-btn${isLoggingIn ? ' login-page__wechat-btn--loading' : ''}`}
          onClick={handleWeChatLogin}
          disabled={isLoggingIn}
          hoverClass='login-page__wechat-btn-hover'
        >
          {isLoggingIn ? '登录中…' : '微信一键登录'}
        </Button>
      </View>
    </View>
  )
}
