import { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import {
  DUO_SOLO_CONFIRM_BODY,
  DUO_SOLO_CONFIRM_PRIMARY,
  DUO_SOLO_CONFIRM_SECONDARY,
  getDuoSoloConfirmTitle,
} from '../../../lib/duo/duoCopy'
import { haptics } from '../../../lib/utils/haptics'

interface DuoSoloConfirmDialogProps {
  visible: boolean
  /** Raw inviter display name — the title interpolates it via truncateDuoName. */
  inviterName: string
  reduceMotion: boolean
  /** Primary action 「还是一起去」 — also the backdrop-tap action (D-4: 遮罩 ≡ 主按钮). */
  onStayTogether: () => void
  /** Secondary action 「就我一个人」 — confirms the solo switch. */
  onGoSolo: () => void
}

/**
 * DuoSoloConfirmDialog — S2 invitee solo-confirm dialog (contract
 * duo-s2-invitee-role-separation, D-4..D-7).
 *
 * Self-drawn centered dialog (platform-native confirm/action panels are
 * vetoed by D-4):
 * - 「还是一起去」 is the ONLY solid-primary button and sits on top (default
 *   focus); the backdrop tap maps to it (dismiss, no state change).
 * - 「就我一个人」 is a text-style secondary; both hit areas ≥88rpx.
 * - No × close button.
 * - Motion reuses reg-confirm-backdrop-in (200ms) + reg-confirm-card-pop
 *   (320ms) — zero new keyframes; exit is an immediate unmount.
 * - Open + button haptics are light and fire even under reduced motion
 *   (haptics carry the beat when visuals can't).
 */
export default function DuoSoloConfirmDialog({
  visible,
  inviterName,
  reduceMotion,
  onStayTogether,
  onGoSolo,
}: DuoSoloConfirmDialogProps) {
  useEffect(() => {
    if (!visible) return
    haptics('light')
  }, [visible])

  if (!visible) return null

  const overlayClass = reduceMotion
    ? 'duo-solo-confirm-overlay duo-solo-confirm-overlay--static'
    : 'duo-solo-confirm-overlay'
  const cardClass = reduceMotion ? 'duo-solo-confirm duo-solo-confirm--static' : 'duo-solo-confirm'

  const handleStayTogether = () => {
    haptics('light')
    onStayTogether()
  }

  const handleGoSolo = () => {
    haptics('light')
    onGoSolo()
  }

  return (
    <View className={overlayClass} catchMove onClick={handleStayTogether}>
      <View
        className={cardClass}
        role='dialog'
        aria-modal='true'
        aria-labelledby='duo-solo-confirm-title'
        onClick={(e) => e.stopPropagation()}
      >
        <Text id='duo-solo-confirm-title' className='duo-solo-confirm__title'>
          {getDuoSoloConfirmTitle(inviterName)}
        </Text>
        <Text className='duo-solo-confirm__body'>{DUO_SOLO_CONFIRM_BODY}</Text>

        <View
          className='duo-solo-confirm__primary'
          hoverClass='duo-solo-confirm__primary--pressed'
          onClick={handleStayTogether}
          role='button'
          aria-label={DUO_SOLO_CONFIRM_PRIMARY}
        >
          <Text className='duo-solo-confirm__primary-text'>{DUO_SOLO_CONFIRM_PRIMARY}</Text>
        </View>

        <View
          className='duo-solo-confirm__secondary'
          hoverClass='duo-solo-confirm__secondary--pressed'
          onClick={handleGoSolo}
          role='button'
          aria-label={DUO_SOLO_CONFIRM_SECONDARY}
        >
          <Text className='duo-solo-confirm__secondary-text'>{DUO_SOLO_CONFIRM_SECONDARY}</Text>
        </View>
      </View>
    </View>
  )
}
