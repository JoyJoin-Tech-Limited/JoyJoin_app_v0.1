import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect } from 'react'
import { haptics } from '../../../lib/utils/haptics'
import './RegistrationConfirmModal.scss'

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
// card pop 320ms → row i at 350 + i*300ms → its check pops +240ms later.
const ROW_STAGGER_MS = 300
const FIRST_ROW_MS = 350
const LAST_CHECK_LANDS_MS = FIRST_ROW_MS + ROW_STAGGER_MS * 3 + 240

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
    if (reduceMotion) return
    haptics('light')
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
    if (!reduceMotion) {
      haptics('medium')
    }
    onConfirm()
  }, [isRegistering, reduceMotion, onConfirm])

  if (!visible) return null

  const highlightLine = highlights.filter(Boolean).slice(0, 2).join(' · ')
  const rows: Array<{ key: string; main: string; sub?: string }> = [
    { key: 'time', main: dateTimeLabel, sub: area || undefined },
    {
      key: 'match',
      main: '按你的偏好匹配同桌与场地',
      sub: highlightLine || undefined,
    },
    { key: 'venue', main: '匹配成功后 24 小时内公布精确地点' },
    { key: 'cancel', main: '匹配完成前可免费取消 · 全额退款' },
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
        <Text id='reg-confirm-title' className='reg-confirm__title'>请确认报名信息</Text>

        <View className='reg-confirm__list'>
          {rows.map((row, index) => (
            <View key={row.key} className={`reg-confirm__row reg-confirm__row--${index}`}>
              <View className='reg-confirm__row-text'>
                <Text className='reg-confirm__row-main'>{row.main}</Text>
                {row.sub ? <Text className='reg-confirm__row-sub'>{row.sub}</Text> : null}
              </View>
              <View className={`reg-confirm__check reg-confirm__check--${index}`} aria-hidden='true' />
            </View>
          ))}
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
