import { Text, View, Image } from '@tarojs/components'
import { useState } from 'react'
import type { ReactNode } from 'react'
import Button, { type JoyButtonProps } from './Button'
import Card from './Card'
import JoyJoinIcon from './JoyJoinIcon'
import './StatusCard.scss'

const DEFAULT_STATUS_CARD_ICONS = {
  empty: '✨',
  error: '😕',
  info: 'ℹ️',
} as const

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
        <JoyJoinIcon emoji={resolvedIcon} size={48} className='status-card__icon' />
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