import { Text, View, Image } from '@tarojs/components'
import { useState } from 'react'
import type { ReactNode } from 'react'
import Button, { type JoyButtonProps } from './Button'
import Card from './Card'
import JoyJoinIcon from './JoyJoinIcon'
import './StatusCard.scss'

const EMPTY_ICON_EMOJI = '\u2728'
const ERROR_ICON_EMOJI = '\u{1F615}'
const INFO_ICON_EMOJI = '\u2139\ufe0f'

const DEFAULT_STATUS_CARD_ICONS = {
  empty: EMPTY_ICON_EMOJI,
  error: ERROR_ICON_EMOJI,
  info: INFO_ICON_EMOJI,
} as const

const DEFAULT_STATUS_CARD_ICON_TIERS: Partial<Record<keyof typeof DEFAULT_STATUS_CARD_ICONS, 'mood' | 'expression' | 'status'>> = {
  empty: 'mood',
  error: 'expression',
  info: 'status',
}

export type StatusCardTone = keyof typeof DEFAULT_STATUS_CARD_ICONS

interface StatusCardAction {
  label: string
  onClick: () => void
  variant?: JoyButtonProps['variant']
  className?: string
  disabled?: boolean
  loading?: boolean
}

interface StatusCardProps {
  tone?: StatusCardTone
  title: string
  description?: string
  action?: StatusCardAction
  className?: string
  icon?: string
  heroSrc?: string
  footer?: ReactNode
}

export default function StatusCard({
  tone = 'info',
  title,
  description,
  action,
  className = '',
  icon,
  heroSrc,
  footer,
}: StatusCardProps) {
  const [heroError, setHeroError] = useState(false)
  const resolvedIcon =
    typeof icon === 'string' && icon.trim() !== ''
      ? icon.trim()
      : DEFAULT_STATUS_CARD_ICONS[tone]
  const resolvedTier =
    typeof icon === 'string' && icon.trim() !== '' ? undefined : DEFAULT_STATUS_CARD_ICON_TIERS[tone]

  return (
    <Card className={`status-card status-card--${tone}${className ? ` ${className}` : ''}`}>
      {heroSrc && !heroError ? (
        <Image
          className='status-card__hero'
          src={heroSrc}
          mode='aspectFit'
          onError={() => setHeroError(true)}
        />
      ) : (
        <JoyJoinIcon emoji={resolvedIcon} tier={resolvedTier} size={48} className='status-card__icon' />
      )}
      <Text className='status-card__title'>{title}</Text>
      {description ? <Text className='status-card__description'>{description}</Text> : null}
      {action ? (
        <Button
          variant={action.variant}
          className={`status-card__action${action.className ? ` ${action.className}` : ''}`}
          onClick={action.onClick}
          disabled={action.disabled}
          loading={action.loading}
        >
          {action.label}
        </Button>
      ) : null}
      {footer ? <View className='status-card__footer'>{footer}</View> : null}
    </Card>
  )
}