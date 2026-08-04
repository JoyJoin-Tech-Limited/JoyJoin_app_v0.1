import { useState } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
import { FLOW1_HOME_COPY, FLOW_SHELL_COPY, getArchetypeSubline, getFlow1H1Line2 } from '@shared/copy/flowAnimationCopy'
import { flowAnalytics } from '../../lib/analytics/flowAnalytics'
import { haptics } from '../../lib/utils/haptics'
import type { FlowArchetypeBackgrounds } from './FlowShell'
import type { ExperienceDefinition } from './flowAnimation.types'

interface ExperienceEntryFlowProps {
  entries: readonly ExperienceDefinition[]
  revealProgress: number
  archetypeId?: string | null
  backgroundSources?: FlowArchetypeBackgrounds | null
  alangEnabled?: boolean
  onOpenDetail: (id: ExperienceDefinition['id']) => void
}

export default function ExperienceEntryFlow({
  entries,
  revealProgress,
  archetypeId,
  backgroundSources,
  alangEnabled = false,
  onOpenDetail,
}: ExperienceEntryFlowProps) {
  // World art that failed to load is dropped (art + scrim) so the copy stays
  // legible on the plain banner panel instead of floating over a broken image.
  const [failedWorldIds, setFailedWorldIds] = useState<ReadonlySet<string>>(new Set())

  const handleBannerTap = (entry: ExperienceDefinition) => {
    haptics('light')
    flowAnalytics.trackBannerTap(entry.id, alangEnabled)
    flowAnalytics.trackDetailOpen(entry.id)
    onOpenDetail(entry.id)
  }

  const handleWorldError = (id: ExperienceDefinition['id']) => {
    setFailedWorldIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }

  return (
    <View className='experience-entry-flow'>
      <View className={`experience-entry-flow__intro ${revealProgress >= 0.12 ? 'experience-entry-flow__intro--visible' : ''}`}>
        <Text className='experience-entry-flow__title'>
          <Text className='experience-entry-flow__title-line'>{FLOW1_HOME_COPY.h1Line1}</Text>
          <Text className='experience-entry-flow__title-line experience-entry-flow__title-line--nowrap'>{getFlow1H1Line2()}</Text>
        </Text>
        <Text className='experience-entry-flow__subtitle'>{getArchetypeSubline(archetypeId)}</Text>
      </View>

      <View className='experience-entry-flow__entries'>
        {entries.map((entry, index) => {
          const visible = revealProgress >= (index === 0 ? 0.32 : 0.48)
          const backgroundSrc = backgroundSources?.[entry.id]
          const worldSrc = failedWorldIds.has(entry.id) ? undefined : backgroundSrc

          return (
            <Button
              key={entry.id}
              className={[
                'experience-banner',
                `experience-banner--${entry.id}`,
                visible ? 'experience-banner--visible' : '',
              ].join(' ')}
              hoverClass='experience-banner--pressed'
              onClick={() => handleBannerTap(entry)}
              ariaLabel={`查看${entry.title}玩法`}
            >
              {worldSrc ? (
                <>
                  <Image
                    className={`experience-banner__world experience-banner__world--${entry.id}`}
                    src={worldSrc}
                    mode='aspectFill'
                    lazyLoad={false}
                    onError={() => handleWorldError(entry.id)}
                  />
                  <View className={`experience-banner__world-scrim experience-banner__world-scrim--${entry.id}`} />
                </>
              ) : null}
              <View className='experience-banner__summary'>
                <View className='experience-banner__copy-panel'>
                  <View className='experience-banner__copy'>
                    <Text className='experience-banner__title'>{entry.title}</Text>
                    <Text className='experience-banner__eyebrow'>{entry.eyebrow}</Text>
                    <Text className='experience-banner__dimension'>{entry.bannerLine}</Text>
                  </View>
                </View>
              </View>

              <View className='experience-banner__footer'>
                <Text className='experience-banner__link'>{FLOW_SHELL_COPY.bannerEnter}</Text>
                <View className='experience-banner__arrow' />
              </View>
            </Button>
          )
        })}
      </View>
    </View>
  )
}
