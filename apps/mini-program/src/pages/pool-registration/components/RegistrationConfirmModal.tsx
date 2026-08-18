import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect } from 'react'
import { haptics } from '../../../lib/utils/haptics'
import ReservationTicket from '../../../components/reservation/ReservationTicket'

interface RegistrationConfirmModalProps {
  visible: boolean
  dateTimeLabel: string
  area: string
  highlights: string[]
  isRegistering: boolean
  reduceMotion: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Reveal timeline (must mirror the SCSS animation-delay ladder):
// card pop 320ms → ticket reveal at 350ms (slot 0) → row i at
// 350 + (i+1)*300ms → its check pops +240ms later.
const ROW_STAGGER_MS = 300
const FIRST_ROW_MS = 350
const LAST_CHECK_LANDS_MS = FIRST_ROW_MS + ROW_STAGGER_MS * 2 + 240

export default function RegistrationConfirmModal({
  visible,
  dateTimeLabel,
  area,
  highlights,
  isRegistering,
  reduceMotion,
  onConfirm,
  onCancel,
}: RegistrationConfirmModalProps) {
  useEffect(() => {
    if (!visible) return
    // Haptics still fire under reduced motion (spec §4 degradation ladder):
    // the first pulse marks the modal opening, the second marks the last
    // check-pop landing (skipped when motion is reduced because there is no
    // staggered visual beat to sync to).
    haptics('light')
    if (reduceMotion) return
    const timer = setTimeout(() => {
      haptics('light')
    }, LAST_CHECK_LANDS_MS)
    return () => clearTimeout(timer)
  }, [visible, reduceMotion])

  // Close the modal when the user navigates away via system back / swipe-back.
  useEffect(() => {
    if (!visible) return
    const closeOnRouteChange = (): void => {
      onCancel()
    }
    Taro.eventCenter.on('__taroRouterChange', closeOnRouteChange)
    return () => {
      Taro.eventCenter.off('__taroRouterChange', closeOnRouteChange)
    }
  }, [visible, onCancel])

  const handleOverlayClick = useCallback(() => {
    if (isRegistering) return
    onCancel()
  }, [isRegistering, onCancel])

  const handleCardClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }, [])

  const handleConfirm = useCallback(() => {
    if (isRegistering) return
    // The commitment-weight haptic fires even when motion is reduced
    // (spec §4: haptics carry the beat when visuals can't).
    haptics('medium')
    onConfirm()
  }, [isRegistering, onConfirm])

  if (!visible) return null

  // Preference chips (Phase 2 data, Phase 3 presentation): budget · intents ·
  // optional step-2 details, rendered as a compact pill row inside the ticket.
  const highlightChips = highlights.filter(Boolean).slice(0, 3)
  // Phase 3 「订座」 slim (spec: registration-ceremony-spec-20260817 — each
  // surface speaks one new piece of information): the reservation facts moved
  // into the shared ReservationTicket meta, and the system-serving
  // 「按你的偏好匹配同桌与场地」 row was dropped. Stagger slot 0 is the ticket
  // reveal; assurance rows take slots 1–2.
  const rows: Array<{ key: string; main: string }> = [
    { key: 'venue', main: '排桌完成后 24 小时内公布精确地点' },
    { key: 'cancel', main: '排桌完成前可免费取消 · 全额退款' },
  ]

  const rootClass = reduceMotion ? 'reg-confirm reg-confirm--static' : 'reg-confirm'

  return (
    <View className='reg-confirm-overlay' onClick={handleOverlayClick}>
      <View className={rootClass} onClick={handleCardClick} role='dialog' aria-modal='true' aria-labelledby='reg-confirm-title'>
        <View
          className='reg-confirm__close'
          hoverClass='reg-confirm__close--pressed'
          onClick={handleOverlayClick}
          role='button'
          aria-label='关闭'
        >
          <Text className='reg-confirm__close-icon'>×</Text>
        </View>

        <Text className='reg-confirm__eyebrow'>预约确认</Text>
        <Text id='reg-confirm-title' className='reg-confirm__title'>请确认订座信息</Text>

        <View className='reg-confirm__ticket'>
          <ReservationTicket
            variant='flat'
            showPerforation={false}
            meta={[
              { key: 'venue', label: '地点', value: area || '待定' },
              { key: 'time', label: '时间', value: dateTimeLabel || '待定', align: 'right' },
            ]}
          >
            {highlightChips.length > 0 ? (
              <View className='reg-confirm__chips'>
                {highlightChips.map((chip) => (
                  <View key={chip} className='reg-confirm__chip'>
                    <Text className='reg-confirm__chip-text'>{chip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ReservationTicket>
        </View>

        <View className='reg-confirm__list'>
          {rows.map((row, index) => {
            const slot = index + 1
            return (
              <View key={row.key} className={`reg-confirm__row reg-confirm__row--${slot}`}>
                <View className='reg-confirm__row-text'>
                  <Text className='reg-confirm__row-main'>{row.main}</Text>
                </View>
                <View className={`reg-confirm__check reg-confirm__check--${slot}`} aria-hidden='true' />
              </View>
            )
          })}
        </View>

        <View className='reg-confirm__progress' aria-hidden='true'>
          <View className='reg-confirm__progress-fill' />
        </View>

        <View
          className={`reg-confirm__cta${isRegistering ? ' reg-confirm__cta--disabled' : ''}`}
          hoverClass={isRegistering ? undefined : 'reg-confirm__cta--pressed'}
          onClick={handleConfirm}
          role='button'
        >
          <Text className='reg-confirm__cta-text'>
            {isRegistering ? '锁定中…' : '确认无误，锁定席位'}
          </Text>
        </View>

        <View
          className='reg-confirm__cancel'
          hoverClass='reg-confirm__cancel--pressed'
          onClick={handleOverlayClick}
          role='button'
        >
          <Text className='reg-confirm__cancel-text'>再想想</Text>
        </View>
      </View>
    </View>
  )
}
