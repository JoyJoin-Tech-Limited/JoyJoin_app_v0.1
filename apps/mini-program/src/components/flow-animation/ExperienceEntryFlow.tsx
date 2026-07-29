import { Button, Image, Text, View } from '@tarojs/components'
import { FLOW1_HOME_COPY, getFlow1H1Line2 } from '@shared/copy/flowAnimationCopy'
import { flowAnalytics } from '../../lib/analytics/flowAnalytics'
import { haptics } from '../../lib/utils/haptics'
import type { FlowArchetypeBackgrounds } from './FlowShell'
import type { ExperienceDefinition } from './flowAnimation.types'

interface ExperienceEntryFlowProps {
  entries: readonly ExperienceDefinition[]
  revealProgress: number
  backgroundSources?: FlowArchetypeBackgrounds | null
  alangEnabled?: boolean
  onOpenDetail: (id: ExperienceDefinition['id']) => void
}

export default function ExperienceEntryFlow({
  entries,
  revealProgress,
  backgroundSources,
  alangEnabled = false,
  onOpenDetail,
}: ExperienceEntryFlowProps) {
  const handleBannerTap = (entry: ExperienceDefinition) => {
    haptics('light')
    flowAnalytics.trackBannerTap(entry.id, alangEnabled)
    flowAnalytics.trackDetailOpen(entry.id)
    onOpenDetail(entry.id)
  }

  return (
    <View className='experience-entry-flow'>
      <View className={`experience-entry-flow__intro ${revealProgress >= 0.12 ? 'experience-entry-flow__intro--visible' : ''}`}>
        <Text className='experience-entry-flow__title'>
          <Text className='experience-entry-flow__title-line'>{FLOW1_HOME_COPY.h1Line1}</Text>
          <Text className='experience-entry-flow__title-line experience-entry-flow__title-line--nowrap'>{getFlow1H1Line2()}</Text>
        </Text>
        <Text className='experience-entry-flow__subtitle'>{FLOW1_HOME_COPY.fallbackSubline}</Text>
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
              onClick={() => handleBannerTap(entry)}
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
                  <Text className='experience-banner__dimension'>{entry.bannerLine}</Text>
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
    </View>
  )
}
