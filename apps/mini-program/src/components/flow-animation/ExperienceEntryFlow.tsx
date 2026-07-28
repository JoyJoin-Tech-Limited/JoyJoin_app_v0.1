import { useState } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
import ExperienceDetail from './ExperienceDetail'
import type { FlowArchetypeBackgrounds } from './FlowShell'
import type { ExperienceDefinition } from './flowAnimation.types'

interface ExperienceEntryFlowProps {
  entries: readonly ExperienceDefinition[]
  revealProgress: number
  backgroundSources?: FlowArchetypeBackgrounds | null
  initialDetailId?: ExperienceDefinition['id']
}

export default function ExperienceEntryFlow({
  entries,
  revealProgress,
  backgroundSources,
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
          const backgroundSrc = backgroundSources?.[entry.id]

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
              {backgroundSrc ? (
                <>
                  <Image
                    className={`experience-banner__world experience-banner__world--${entry.id}`}
                    src={backgroundSrc}
                    mode='aspectFill'
                    lazyLoad={false}
                  />
                  <View className={`experience-banner__world-scrim experience-banner__world-scrim--${entry.id}`} />
                </>
              ) : null}
              <View className='experience-banner__summary'>
                <View className='experience-banner__copy'>
                  <Text className='experience-banner__title'>{entry.title}</Text>
                  <Text className='experience-banner__eyebrow'>{entry.eyebrow}</Text>
                  <Text className='experience-banner__dimension'>{entry.headline}</Text>
                </View>
              </View>

              <View className='experience-banner__footer'>
                <Text className='experience-banner__link'>进入看看</Text>
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
