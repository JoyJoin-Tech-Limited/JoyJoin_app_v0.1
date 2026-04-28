import { View, Text, Button, Image } from '@tarojs/components'
import { useWeChatLogin } from '../../hooks/useWeChatLogin'
import { getXiaoyueExpressionAsset } from '../../lib/xiaoyueExpressions'
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
 * Design: "One screen. One truth. One tap. Premium is restraint."
 * Archetype-colour radial glow, blurred mascot teaser, shimmer sweep.
 */
export default function LoginPage() {
  const { handleWeChatLogin, isLoggingIn } = useWeChatLogin()

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
          disabled={isLoggingIn}
          hoverClass='login-page__wechat-btn-hover'
        >
          {isLoggingIn ? '登录中…' : '微信一键登录'}
        </Button>

        <Text className='login-page__legal'>
          登录即同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </View>
  )
}
