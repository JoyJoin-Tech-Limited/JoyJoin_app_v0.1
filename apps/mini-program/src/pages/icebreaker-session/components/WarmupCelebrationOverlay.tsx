import { useEffect, useState } from 'react'
import { View, Text, Image, RootPortal } from '@tarojs/components'
import ParticleBurst from '../../../components/reveal/ParticleBurst'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { haptics } from '../../../lib/utils/haptics'
// Styles are @use'd by the page SCSS (index.scss) — a component-level SCSS
// import would be chunked into the page-invisible sub-common.wxss.

interface WarmupCelebrationOverlayProps {
  visible: boolean
  line: string
  reducedMotion: boolean
  onDismiss?: () => void
}

const AUTO_DISMISS_MS = 2500

export function WarmupCelebrationOverlay({
  visible,
  line,
  reducedMotion,
  onDismiss,
}: WarmupCelebrationOverlayProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (!visible) {
      setIsExiting(false)
      return
    }

    setIsExiting(false)
    const exitTimer = setTimeout(() => setIsExiting(true), AUTO_DISMISS_MS - 400)
    const dismissTimer = setTimeout(() => onDismiss?.(), AUTO_DISMISS_MS)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(dismissTimer)
    }
  }, [visible, onDismiss])

  if (!visible) return null

  return (
    // RootPortal: the phase shell keeps a transform (entrance scale), which
    // makes position:fixed descendants clip to the shell box on device
    // (MiniScriptConfigModal precedent). catchMove stays on the overlay root.
    <RootPortal>
      <View
        className={`warmup-celebration ${isExiting ? 'warmup-celebration--out' : ''}`}
        catchMove
        aria-live='polite'
        role='status'
        onClick={() => {
          haptics('light')
          onDismiss?.()
        }}
      >
        <View className='warmup-celebration__burst'>
          <ParticleBurst trigger={visible} type='confetti' count={50} reducedMotion={reducedMotion} />
        </View>

        <View className='warmup-celebration__card'>
          <Image
            className='warmup-celebration__avatar'
            src={getXiaoyueExpressionAsset('matchSuccess')}
            mode='aspectFit'
          />
          <View className='warmup-celebration__bubble'>
            <Text className='warmup-celebration__text'>{line}</Text>
          </View>
          <Text className='warmup-celebration__tap-hint'>轻触继续</Text>
        </View>
      </View>
    </RootPortal>
  )
}
