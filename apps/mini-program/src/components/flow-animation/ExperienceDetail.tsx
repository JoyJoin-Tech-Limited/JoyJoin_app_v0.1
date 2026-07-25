import { Button, ScrollView, Text, View } from '@tarojs/components'
import FlowIcon from './icons/FlowIcon'
import type { ExperienceDefinition } from './flowAnimation.types'

interface ExperienceDetailProps {
  experience: ExperienceDefinition
  onBack: () => void
}

export default function ExperienceDetail({ experience, onBack }: ExperienceDetailProps) {
  return (
    <View className={`experience-detail experience-detail--${experience.id}`}>
      <View className='experience-detail__header'>
        <Button className='experience-detail__back' hoverClass='experience-detail__back--pressed' onClick={onBack}>
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
              <Text className='experience-detail__subtitle'>{experience.headline}</Text>
            </View>
          </View>

          <View className={`experience-detail__scene experience-detail__scene--${experience.id}`}>
            <View className='experience-detail__scene-copy'>
              <Text className='experience-detail__scene-kicker'>
                {experience.id === 'event' ? 'YOUR GROUP IS TAKING SHAPE' : 'A CLUE FOR TODAY'}
              </Text>
              <Text className='experience-detail__scene-title'>
                {experience.id === 'event' ? '报名后，我们开始认真组队' : '今天的城市，从一条线索开始'}
              </Text>
            </View>
            <View className='experience-detail__scene-art'>
              <View className='experience-detail__scene-path experience-detail__scene-path--one' />
              <View className='experience-detail__scene-path experience-detail__scene-path--two' />
              <View className='experience-detail__scene-node experience-detail__scene-node--one' />
              <View className='experience-detail__scene-node experience-detail__scene-node--two' />
              <View className='experience-detail__scene-node experience-detail__scene-node--three' />
              <View className='experience-detail__scene-beacon' />
              <View className='experience-detail__scene-spark experience-detail__scene-spark--one' />
              <View className='experience-detail__scene-spark experience-detail__scene-spark--two' />
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

          <Text className='experience-detail__closing'>{experience.closingCopy}</Text>
          <View className='experience-detail__bottom-safe' />
        </View>
      </ScrollView>
    </View>
  )
}
