import { Image, Text, View } from '@tarojs/components'
import type { ArchetypeVisual } from '../visuals'
import type { RevealPhase } from './resultHelpers'

interface RevealStageProps {
  displayArchetypeName: string
  displayAsset: string
  visual: ArchetypeVisual
  revealPhase: RevealPhase
  phaseText?: string
  showLoginPrompt?: boolean
  loginPromptLabel?: string
  onLoginPrompt?: () => void
  isLoggingIn?: boolean
  loginError?: string
}

export default function RevealStage({
  displayArchetypeName,
  displayAsset,
  visual,
  revealPhase,
  phaseText,
  showLoginPrompt = false,
  loginPromptLabel,
  onLoginPrompt,
  isLoggingIn = false,
  loginError,
}: RevealStageProps) {
  return (
    <View className='personality-results__immersive-shell personality-results__immersive-shell--reveal' role='status' aria-live='polite' aria-label={`${displayArchetypeName} — 卡面显形中 — ${revealPhase === 'silhouette' ? '轮廓' : revealPhase === 'fill' ? '色彩' : '火花点亮'}`}>
      <Text className='personality-results__immersive-eyebrow'>JoyJoin 气场揭晓</Text>
      <Text className='personality-results__immersive-title'>你的卡面正在显形</Text>
      <Text className='personality-results__immersive-copy'>
        {phaseText || '最后一点火花亮起之后，就会进入完整的结果页。'}
      </Text>

      <View
        className='personality-results__reveal-orb'
        style={{ background: `radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.98) 0%, ${visual.accent} 58%, rgba(255, 255, 255, 0.12) 100%)` }}
      >
        <View className='personality-results__reveal-glow' style={{ background: visual.accent }} />
        <Image
          className={`personality-results__reveal-image personality-results__reveal-image--${revealPhase}`}
          mode='aspectFit'
          src={displayAsset}
        />
        <View className={`personality-results__reveal-scrim personality-results__reveal-scrim--${revealPhase}`} />
        <View className={`personality-results__reveal-glow-overlay personality-results__reveal-glow-overlay--${revealPhase}`} />
      </View>

      <Text className='personality-results__reveal-label'>{displayArchetypeName}</Text>
      <Text className='personality-results__reveal-copy'>
        {revealPhase === 'silhouette'
          ? '先看轮廓，留一点悬念。'
          : revealPhase === 'fill'
            ? '颜色和气场正在回到正确的位置。'
            : '最后这一圈火花之后，就是你的完整结果页。'}
      </Text>

      {showLoginPrompt ? (
        <View className='personality-results__reveal-login'>
          <Text
            className='personality-results__reveal-login-link'
            onClick={() => {
              if (isLoggingIn) return
              onLoginPrompt?.()
            }}
          >
            {isLoggingIn ? '登录中…' : loginPromptLabel || '微信登录，保存这张入场卡'}
          </Text>
          {loginError ? (
            <Text className='personality-results__reveal-login-error'>{loginError}</Text>
          ) : (
            <Text className='personality-results__reveal-login-hint'>登录后结果会保存，也能直接看为你准备的局</Text>
          )}
        </View>
      ) : null}
    </View>
  )
}
