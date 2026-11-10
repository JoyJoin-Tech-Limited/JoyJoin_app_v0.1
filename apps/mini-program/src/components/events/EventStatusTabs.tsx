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
      className={[
        'event-status-tabs',
        `event-status-tabs--${activeTab}`,
        manualMotionEnabled ? 'event-status-tabs--manual' : '',
        className,
      ].filter(Boolean).join(' ')}
      role='tablist'
      aria-label='活动记录状态'
    >
      <View className='event-status-tabs__track'>
        <View
          className='event-status-tabs__tab-indicator'
          data-active-tab={activeTab}
          aria-hidden='true'
        />
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
