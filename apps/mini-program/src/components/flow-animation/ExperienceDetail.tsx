import { useState } from 'react'
import { Button, Image, ScrollView, Text, View } from '@tarojs/components'
import { FLOW_SHELL_COPY } from '@shared/copy/flowAnimationCopy'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import FlowIcon from './icons/FlowIcon'
import type { ExperienceDefinition } from './flowAnimation.types'

interface ExperienceDetailProps {
  experience: ExperienceDefinition
  archetypeId?: string | null
  onBack: () => void
  /** Forward CTA at the bottom of the detail page — completes the intro flow. */
  onEnterApp: () => void
}

export default function ExperienceDetail({ experience, archetypeId, onBack, onEnterApp }: ExperienceDetailProps) {
  const validArchetype = archetypeId ? ARCHETYPE_ASSET_MAP[archetypeId] ?? null : null
  const archetypeSrc = validArchetype?.webp ?? ''
  // Drop the scene art (image + scrim) if it fails so the scene copy stays
  // legible on the plain panel instead of floating over a broken image.
  const [sceneImageError, setSceneImageError] = useState(false)
  const showSceneImage = Boolean(archetypeSrc) && !sceneImageError

  return (
    <View className={`experience-detail experience-detail--${experience.id}`}>
      <View className='experience-detail__header'>
        <Button className='experience-detail__back' hoverClass='experience-detail__back--pressed' onClick={onBack} ariaLabel='返回两种玩法'>
          <View className='experience-detail__back-icon' />
          <Text>{FLOW_SHELL_COPY.detailBack}</Text>
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
            {showSceneImage ? (
              <>
                <Image
                  className='experience-detail__scene-image'
                  src={archetypeSrc}
                  mode='aspectFill'
                  lazyLoad={false}
                  onError={() => setSceneImageError(true)}
                />
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

      <View className='experience-detail__action'>
        <Button
          className='flow-shell__primary'
          hoverClass='flow-shell__primary--pressed'
          onClick={onEnterApp}
        >
          {FLOW_SHELL_COPY.ctaExplore}
        </Button>
      </View>
    </View>
  )
}
