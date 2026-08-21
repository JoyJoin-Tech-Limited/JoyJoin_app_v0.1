import { View } from '@tarojs/components'
import './FirstActHighlightOverlay.scss'

export interface FirstActHighlightTarget {
  id: string
  label: string
  placementClassName: string
}

export interface FirstActHighlightOverlayProps {
  npcSlug: string
  testIdPrefix?: string
  className?: string
  targets: readonly FirstActHighlightTarget[]
  completedIds: readonly string[]
  activeId: string | null
  disabled?: boolean
  locked?: boolean
  actionLabelPrefix?: string
  onSelect: (id: string) => void
}

export function FirstActHighlightOverlay({
  npcSlug,
  testIdPrefix = `${npcSlug}-first-act`,
  className = '',
  targets,
  completedIds,
  activeId,
  disabled = false,
  locked = false,
  actionLabelPrefix = '观察',
  onSelect,
}: FirstActHighlightOverlayProps) {
  const completed = new Set(completedIds)

  return (
    <View
      className={`first-act-highlight-overlay${className ? ` ${className}` : ''}`}
      aria-label={`可观察区域，已观察 ${completed.size} 处，共 ${targets.length} 处`}
      data-testid={`${testIdPrefix}-highlight-overlay`}
    >
      {targets.map((target) => {
        const seen = completed.has(target.id)
        const active = activeId === target.id
        const unavailable = disabled || seen || (locked && !active)

        return (
          <View
            key={target.id}
            className={`first-act-highlight ${target.placementClassName}${seen ? ' first-act-highlight--seen' : ''}${active ? ' first-act-highlight--active' : ''}`}
            hoverClass={unavailable ? '' : 'first-act-highlight--pressed'}
            role='button'
            aria-label={`${actionLabelPrefix}${target.label}`}
            aria-pressed={active}
            aria-disabled={unavailable}
            data-testid={`${testIdPrefix}-hotspot`}
            data-highlight-id={target.id}
            onClick={() => {
              if (!unavailable) onSelect(target.id)
            }}
          >
            <View className='first-act-highlight__marker' aria-hidden='true' />
          </View>
        )
      })}
    </View>
  )
}
