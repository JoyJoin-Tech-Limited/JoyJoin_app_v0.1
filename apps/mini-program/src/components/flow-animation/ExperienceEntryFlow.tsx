import { useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import ExperienceDetail from './ExperienceDetail'
import FlowIcon from './icons/FlowIcon'
import type { ExperienceDefinition } from './flowAnimation.types'

interface ExperienceEntryFlowProps {
  entries: readonly ExperienceDefinition[]
  revealProgress: number
  initialDetailId?: ExperienceDefinition['id']
}

export default function ExperienceEntryFlow({
  entries,
  revealProgress,
  initialDetailId,
}: ExperienceEntryFlowProps) {
  const [detailId, setDetailId] = useState<ExperienceDefinition['id'] | null>(initialDetailId ?? null)
  const detail = entries.find((entry) => entry.id === detailId)

  return (
    <View className='experience-entry-flow'>
      <View className={`experience-entry-flow__intro ${revealProgress >= 0.12 ? 'experience-entry-flow__intro--visible' : ''}`}>
        <Text className='experience-entry-flow__title'>探索你的城市体验</Text>
        <Text className='experience-entry-flow__subtitle'>两种玩法，都值得打开：遇见合拍的人，也重新发现熟悉的城市</Text>
      </View>

      <View className='experience-entry-flow__entries'>
        {entries.map((entry, index) => {
          const visible = revealProgress >= (index === 0 ? 0.32 : 0.48)
          const accent = entry.id === 'event' ? 'human' : 'city'

          return (
            <Button
              key={entry.id}
              className={[
                'experience-banner',
                `experience-banner--${entry.id}`,
                visible ? 'experience-banner--visible' : '',
              ].join(' ')}
              hoverClass='experience-banner--pressed'
              onClick={() => setDetailId(entry.id)}
              ariaLabel={`查看${entry.title}玩法`}
            >
              <View className='experience-banner__summary'>
                <View className='experience-banner__icon'>
                  <FlowIcon name={entry.icon} active accent={accent} size='lg' />
                </View>
                <View className='experience-banner__copy'>
                  <Text className='experience-banner__title'>{entry.title}</Text>
                  <Text className='experience-banner__eyebrow'>{entry.eyebrow}</Text>
                  <Text className='experience-banner__dimension'>{entry.headline}</Text>
                </View>
                <View className={`experience-banner__art experience-banner__art--${entry.id}`}>
                  <View className='experience-banner__art-node experience-banner__art-node--one' />
                  <View className='experience-banner__art-node experience-banner__art-node--two' />
                  <View className='experience-banner__art-node experience-banner__art-node--three' />
                  <View className='experience-banner__art-path experience-banner__art-path--one' />
                  <View className='experience-banner__art-path experience-banner__art-path--two' />
                  <View className='experience-banner__art-glint' />
                </View>
              </View>

              <View className='experience-banner__footer'>
                <Text className='experience-banner__link'>查看玩法</Text>
                <View className='experience-banner__arrow' />
              </View>
            </Button>
          )
        })}
      </View>

      {detail ? <ExperienceDetail experience={detail} onBack={() => setDetailId(null)} /> : null}
    </View>
  )
}
