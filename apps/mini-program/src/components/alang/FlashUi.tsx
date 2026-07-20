import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { resolveFlashNpcTheme, resolveFlashTaskCategory } from '../../lib/alang/flashNpcAssets'
import type { FlashNpcReference, FlashTaskSummary } from '../../lib/alang/flashTypes'
import JoyJoinIcon from '../ui/JoyJoinIcon'

export function FlashNpcPortrait({
  npc,
  size = 'medium',
}: {
  npc: Pick<FlashNpcReference, 'slug' | 'name'>
  size?: 'small' | 'medium' | 'large'
}) {
  const theme = useMemo(() => resolveFlashNpcTheme(npc.slug, npc.name), [npc.name, npc.slug])
  const [failed, setFailed] = useState(!theme.imageSrc)

  useEffect(() => {
    setFailed(!theme.imageSrc)
  }, [theme.imageSrc])

  return (
    <View
      className={`flash-npc-portrait flash-npc-portrait--${size}`}
      style={{ backgroundColor: theme.tint }}
      aria-label={`${npc.name}的角色形象`}
    >
      {!failed ? (
        <Image
          className='flash-npc-portrait__image'
          src={theme.imageSrc}
          mode='aspectFit'
          onError={() => setFailed(true)}
        />
      ) : (
        <Text className='flash-npc-portrait__fallback' style={{ color: theme.ink }}>
          {theme.fallbackGlyph}
        </Text>
      )}
    </View>
  )
}

export function FlashButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  ariaLabel,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  ariaLabel?: string
}) {
  return (
    <View
      className={`flash-button flash-button--${variant}${disabled ? ' flash-button--disabled' : ''}`}
      hoverClass={disabled ? '' : 'flash-button--pressed'}
      onClick={() => {
        if (!disabled) onClick()
      }}
      role='button'
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      <Text className='flash-button__text'>{children}</Text>
    </View>
  )
}

export function FlashPageState({
  title,
  description,
  action,
  actionLabel,
  tone = 'plain',
}: {
  title: string
  description?: string
  action?: () => void
  actionLabel?: string
  tone?: 'plain' | 'error'
}) {
  return (
    <View className={`flash-state flash-state--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {tone === 'error' ? (
        <Text className='flash-state__mark' aria-hidden='true'>…</Text>
      ) : (
        <JoyJoinIcon
          className='flash-state__mark'
          emoji='✨'
          tier='reveal'
          size={48}
        />
      )}
      <Text className='flash-state__title'>{title}</Text>
      {description ? <Text className='flash-state__description'>{description}</Text> : null}
      {action && actionLabel ? (
        <FlashButton onClick={action} variant='secondary'>{actionLabel}</FlashButton>
      ) : null}
    </View>
  )
}

export function FlashFeatureClosed() {
  return (
    <View className='flash-page'>
      <FlashPageState
        title='闪现正在准备下一次见面'
        description='这项体验暂时没有开放，过些时候再来看看。'
      />
    </View>
  )
}

function statusCopy(status: string): string {
  switch (status) {
    case 'arrived':
    case 'feedback_pending':
      return '待写反馈'
    case 'ready_to_deliver':
      return '下次见面交付'
    case 'completed':
    case 'delivered':
      return '已经交付'
    case 'expired':
      return '已经结束'
    case 'withdrawn':
      return '地点已撤下'
    case 'abandoned':
      return '已经放下'
    default:
      return '进行中'
  }
}

export function formatFlashRemainingTime(remainingSeconds?: number, endsAt?: string): string {
  let seconds = remainingSeconds
  if (typeof seconds !== 'number' && endsAt) {
    const endMs = new Date(endsAt).getTime()
    if (Number.isFinite(endMs)) seconds = Math.max(0, Math.floor((endMs - Date.now()) / 1000))
  }
  if (typeof seconds !== 'number') return '这会儿在线'
  if (seconds <= 60) return '快要离开了'
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `还在 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `还在 ${hours} 小时 ${rest} 分` : `还在 ${hours} 小时`
}

export function formatFlashDueDate(dueAt?: string): string {
  if (!dueAt) return '接下来的 7 天都可以去'
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return '接下来的 7 天都可以去'
  return `${due.getMonth() + 1}月${due.getDate()}日前`
}

function formatFlashTaskTiming(task: FlashTaskSummary): string {
  if (task.status === 'ready_to_deliver') return '等下次见面交付'
  if (task.status === 'arrived' || task.status === 'feedback_pending') return '已经到达，待写反馈'
  if (task.status === 'completed' || task.status === 'delivered') return '已经交付'
  if (task.status === 'withdrawn') return '地点已撤下'
  if (task.status === 'expired' || task.status === 'abandoned') return '任务已经结束'
  return formatFlashDueDate(task.dueAt)
}

export function FlashTaskCard({
  task,
  onClick,
}: {
  task: FlashTaskSummary
  onClick: () => void
}) {
  const category = resolveFlashTaskCategory(task.category)
  const assignmentId = task.assignmentId ?? task.id
  return (
    <View
      className='flash-task-card'
      hoverClass='flash-task-card--pressed'
      onClick={onClick}
      role='button'
      aria-label={`查看任务：${task.title}`}
      data-assignment-id={assignmentId}
    >
      <View className='flash-task-card__accent' style={{ backgroundColor: category.accent }} />
      <View className='flash-task-card__body'>
        <View className='flash-task-card__topline'>
          <Text className='flash-task-card__category' style={{ color: category.text, backgroundColor: category.tint }}>
            {category.label}
          </Text>
          <Text className='flash-task-card__status'>{statusCopy(task.status)}</Text>
        </View>
        <Text className='flash-task-card__title'>{task.title}</Text>
        <Text className='flash-task-card__meta'>
          {task.npc.name} · {formatFlashTaskTiming(task)}
        </Text>
      </View>
      <Text className='flash-task-card__arrow' aria-hidden='true'>›</Text>
    </View>
  )
}
