import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import './EventStatusTabs.scss'

export type EventStatusTabKey = 'ongoing' | 'upcoming' | 'completed'

const ITEMS: Array<{ key: EventStatusTabKey; label: string }> = [
  { key: 'ongoing', label: '进行中' },
  { key: 'upcoming', label: '待开始' },
  { key: 'completed', label: '已结束' },
]

export interface EventStatusTabsProps {
  activeTab: EventStatusTabKey
  onChange: (tab: EventStatusTabKey) => void
  className?: string
}

export default React.memo(function EventStatusTabs({
  activeTab,
  onChange,
  className,
}: EventStatusTabsProps) {
  // Automatic/default resolution never animates. Only a deliberate user change
  // enables the quiet glide; rapid taps simply retarget the current transform.
  const [manualMotionEnabled, setManualMotionEnabled] = useState(false)

  const handleSelect = (tab: EventStatusTabKey) => {
    if (tab === activeTab) return
    setManualMotionEnabled(true)
    onChange(tab)
  }

  return (
    <View
      // Only the motion modifier survives on the root: the per-key classes
      // (`--ongoing/--upcoming/--completed`) had no rule left to hit once the
      // thumb moved onto the active tab, and a dead class is a promise that the
      // next reader will look up a style that does not exist. `data-active-tab`
      // below is the machine-readable state.
      className={[
        'event-status-tabs',
        manualMotionEnabled ? 'event-status-tabs--manual' : '',
        className,
      ].filter(Boolean).join(' ')}
      role='tablist'
      aria-label='活动记录状态'
      data-active-tab={activeTab}
    >
      <View className='event-status-tabs__track'>
        {ITEMS.map((item) => (
          <View
            key={item.key}
            className={`event-status-tabs__tab${activeTab === item.key ? ' event-status-tabs__tab--active' : ''}`}
            role='tab'
            aria-selected={activeTab === item.key}
            hoverClass='event-status-tabs__tab--pressed'
            onClick={() => handleSelect(item.key)}
          >
            <Text className='event-status-tabs__tab-text'>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
})
