import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, type ReactNode } from 'react'
import CloseIcon from '../ui/CloseIcon'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import './PickerShell.scss'

export interface PickerShellProps {
  visible: boolean
  onClose: () => void
  mascotExpression: 'homeWelcome' | 'coachGuide'
  title: string
  subtitle?: string
  showClose?: boolean
  reduceMotion: boolean
  children: ReactNode
  footer?: ReactNode
  overlay?: ReactNode
  className?: string
}

const DEFAULT_SHELL_HEIGHT_RPX = 1100
const SHELL_BOTTOM_CLEARANCE_RPX = 160

export default function PickerShell({
  visible,
  onClose,
  mascotExpression,
  title,
  subtitle,
  showClose = true,
  reduceMotion,
  children,
  footer,
  overlay,
  className = '',
}: PickerShellProps) {
  const shellHeightRpx = useMemo(() => {
    try {
      const { windowHeight, screenWidth } = Taro.getSystemInfoSync()
      if (!windowHeight || !screenWidth) {
        return DEFAULT_SHELL_HEIGHT_RPX
      }
      const windowRpx = (windowHeight * 750) / screenWidth
      return Math.min(
        DEFAULT_SHELL_HEIGHT_RPX,
        Math.max(400, Math.floor(windowRpx - SHELL_BOTTOM_CLEARANCE_RPX)),
      )
    } catch {
      return DEFAULT_SHELL_HEIGHT_RPX
    }
  }, [])

  return (
    <View
      className={`picker-shell ${visible ? 'picker-shell--open' : ''} ${reduceMotion ? 'picker-shell--reduce-motion' : ''} ${className}`}
      aria-hidden={!visible}
    >
      <View
        className='picker-shell__backdrop'
        onClick={onClose}
        catchMove
        role='button'
        aria-label='关闭'
      />
      <View
        className='picker-shell__surface'
        style={{ height: `${shellHeightRpx}rpx` }}
        role='dialog'
        aria-modal='true'
        onClick={(e) => e.stopPropagation()}
      >
        <View className='picker-shell__handle' catchMove />

        <View className='picker-shell__header'>
          <View className='picker-shell__title-row'>
            <Image
              className='picker-shell__mascot'
              src={getXiaoyueExpressionAsset(mascotExpression)}
              mode='aspectFit'
              aria-hidden='true'
            />
            <Text className='picker-shell__title'>{title}</Text>
          </View>
          {showClose && (
            <View
              className='picker-shell__close'
              onClick={onClose}
              hoverClass='picker-shell__close--hover'
              role='button'
              aria-label='关闭'
            >
              <CloseIcon size={24} className='picker-shell__close-icon' />
            </View>
          )}
        </View>

        {subtitle && <Text className='picker-shell__subtitle'>{subtitle}</Text>}

        <View className='picker-shell__content'>{children}</View>

        {footer && <View className='picker-shell__footer'>{footer}</View>}

        {overlay && (
          <View className='picker-shell__overlay' aria-hidden='false'>
            {overlay}
          </View>
        )}
      </View>
    </View>
  )
}
