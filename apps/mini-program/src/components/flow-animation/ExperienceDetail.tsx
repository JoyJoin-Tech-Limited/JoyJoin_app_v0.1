import { Button, Image, ScrollView, Text, View } from '@tarojs/components'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import FlowIcon from './icons/FlowIcon'
import type { ExperienceDefinition } from './flowAnimation.types'

interface ExperienceDetailProps {
  experience: ExperienceDefinition
  archetypeId?: string | null
  onBack: () => void
}

export default function ExperienceDetail({ experience, archetypeId, onBack }: ExperienceDetailProps) {
  const validArchetype = archetypeId ? ARCHETYPE_ASSET_MAP[archetypeId] ?? null : null
  const archetypeSrc = validArchetype?.webp ?? ''

  return (
    <View className={`experience-detail experience-detail--${experience.id}`}>
      <View className='experience-detail__header'>
        <Button className='experience-detail__back' hoverClass='experience-detail__back--pressed' onClick={onBack} ariaLabel='返回两种玩法'>
          <View className='experience-detail__back-icon' />
          <Text>两种玩法</Text>
        </Button>
        <Text className='experience-detail__eyebrow'>{experience.eyebrow}</Text>
      </View>

      <ScrollView className='experience-detail__scroll' scrollY enhanced showScrollbar={false}>
        <View className='experience-detail__content'>
          <View className='experience-detail__hero'>
            <FlowIcon name={experience.icon} active accent={experience.id === 'event' ? 'human' : 'city'} size='lg' />
            <View className='experience-detail__hero-copy'>
              <Text className='experience-detail__title'>{experience.title}</Text>
              <Text className='experience-detail__subtitle'>{experience.detail.heroSubtitle}</Text>
            </View>
          </View>

          <View className={`experience-detail__scene experience-detail__scene--${experience.id}`}>
            {archetypeSrc ? (
              <>
                <Image className='experience-detail__scene-image' src={archetypeSrc} mode='aspectFill' lazyLoad={false} />
                <View className='experience-detail__scene-scrim' />
              </>
            ) : null}
            <View className='experience-detail__scene-copy'>
              <Text className='experience-detail__scene-title'>
                {experience.detail.sceneTitle}
              </Text>
            </View>
            <View className='experience-detail__scene-progress'>
              {experience.steps.map((step, index) => (
                <View key={step.id} className='experience-detail__scene-progress-item'>
                  <View className='experience-detail__scene-progress-dot' />
                  {index < experience.steps.length - 1 ? <View className='experience-detail__scene-progress-line' /> : null}
                </View>
              ))}
            </View>
          </View>

          <View className='experience-detail__timeline'>
            {experience.steps.map((step, index) => (
              <View
                key={step.id}
                className='experience-detail__step'
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <View className='experience-detail__step-icon'>
                  <FlowIcon name={step.icon} active accent={step.accent} size='md' />
                </View>
                <View className='experience-detail__step-copy'>
                  <Text className='experience-detail__step-index'>0{index + 1}</Text>
                  <Text className='experience-detail__step-title'>{step.title}</Text>
                  <Text className='experience-detail__step-description'>{step.description}</Text>
                </View>
                {index < experience.steps.length - 1 ? <View className='experience-detail__line' /> : null}
              </View>
            ))}
          </View>

          <Text className='experience-detail__closing'>{experience.detail.closing}</Text>
          <View className='experience-detail__bottom-safe' />
        </View>
      </ScrollView>
    </View>
  )
}
