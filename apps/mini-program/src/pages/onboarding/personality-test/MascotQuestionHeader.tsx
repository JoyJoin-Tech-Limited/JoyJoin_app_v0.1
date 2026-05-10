import { View, Text } from '@tarojs/components'
import { memo } from 'react'
import './MascotQuestionHeader.scss'

interface QuestionStub {
  scenarioText?: string
  questionText: string
}

export interface MascotQuestionHeaderProps {
  question: QuestionStub | null
  isLoading?: boolean
}

export default memo(function MascotQuestionHeader({
  question,
  isLoading = false,
}: MascotQuestionHeaderProps) {
  if (!question) {
    return (
      <View className='mascot-question-header mascot-question-header--empty'>
        <View className='mascot-question-header__card mascot-question-header__card--loading'>
          <View className='mascot-question-header__skeleton-eyebrow' />
          <View className='mascot-question-header__skeleton-line' />
          <View className='mascot-question-header__skeleton-line mascot-question-header__skeleton-line--short' />
        </View>
      </View>
    )
  }

  return (
    <View className='mascot-question-header'>
      <View className='mascot-question-header__card'>
        {question.scenarioText ? (
          <Text className='mascot-question-header__eyebrow'>
            {question.scenarioText}
          </Text>
        ) : null}
        <Text
          className={`mascot-question-header__question${isLoading ? ' mascot-question-header__question--loading' : ''}`}
        >
          {question.questionText}
        </Text>
      </View>
    </View>
  )
})
