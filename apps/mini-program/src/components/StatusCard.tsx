import { Text, View } from '@tarojs/components'
import type { ReactNode } from 'react'
import Button, { type JoyButtonProps } from './Button'
import Card from './Card'
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
}

interface StatusCardProps {
  tone?: StatusCardTone
  title: string
  description?: string
  action?: StatusCardAction
  className?: string
  icon?: string
  footer?: ReactNode
}

export default function StatusCard({
  tone = 'info',
  title,
  description,
  action,
  className = '',
  icon,
  footer,
}: StatusCardProps) {
  const resolvedIcon =
    typeof icon === 'string' && icon.trim() !== ''
      ? icon.trim()
      : DEFAULT_STATUS_CARD_ICONS[tone]

  return (
    <Card className={`status-card status-card--${tone}${className ? ` ${className}` : ''}`}>
      <Text className='status-card__icon'>{resolvedIcon}</Text>
      <Text className='status-card__title'>{title}</Text>
      {description ? <Text className='status-card__description'>{description}</Text> : null}
      {action ? (
        <Button
          variant={action.variant}
          className={`status-card__action${action.className ? ` ${action.className}` : ''}`}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ) : null}
      {footer ? <View className='status-card__footer'>{footer}</View> : null}
    </Card>
  )
}