import { View } from '@tarojs/components'
import './FirstActHighlightOverlay.scss'

export interface FirstActHighlightTarget {
  id: string
  label: string
  placementClassName: string
}

export interface FirstActHighlightOverlayProps {
  npcSlug: string
  className?: string
  targets: readonly FirstActHighlightTarget[]
  completedIds: readonly string[]
  activeId: string | null
  disabled?: boolean
  locked?: boolean
  onSelect: (id: string) => void
}

export function FirstActHighlightOverlay({
  npcSlug,
  className = '',
  targets,
  completedIds,
  activeId,
  disabled = false,
  locked = false,
  onSelect,
}: FirstActHighlightOverlayProps) {
  const completed = new Set(completedIds)

  return (
    <View
      className={`first-act-highlight-overlay${className ? ` ${className}` : ''}`}
      aria-label={`可观察区域，已观察 ${completed.size} 处，共 ${targets.length} 处`}
      data-testid={`${npcSlug}-first-act-highlight-overlay`}
    >
      {targets.filter((target) => !completed.has(target.id)).map((target) => {
        const seen = completed.has(target.id)
        const active = activeId === target.id
        const unavailable = disabled || seen || (locked && !active)

        return (
          <View
            key={target.id}
            className={`first-act-highlight ${target.placementClassName}${active ? ' first-act-highlight--active' : ''}`}
            hoverClass={unavailable ? '' : 'first-act-highlight--pressed'}
            role='button'
            aria-label={`观察${target.label}`}
            aria-pressed={active}
            aria-disabled={unavailable}
            data-testid={`${npcSlug}-first-act-hotspot`}
            data-highlight-id={target.id}
            onClick={() => {
              if (!unavailable) onSelect(target.id)
            }}
          >
            <View className='first-act-highlight__marker' aria-hidden='true'>
              <View className='first-act-highlight__core' />
            </View>
          </View>
        )
      })}
    </View>
  )
}
