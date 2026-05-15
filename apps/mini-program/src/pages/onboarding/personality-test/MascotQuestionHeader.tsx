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
        <View className='mascot-question-header__banner mascot-question-header__banner--loading'>
          <View className='mascot-question-header__skeleton-scenario' />
          <View className='mascot-question-header__skeleton-scenario mascot-question-header__skeleton-scenario--short' />
        </View>
      </View>
    )
  }

  return (
    <View className='mascot-question-header'>
      <View className='mascot-question-header__banner'>
        <Text
          className={`mascot-question-header__scenario${isLoading ? ' mascot-question-header__scenario--loading' : ''}`}
        >
          {question.scenarioText ?? question.questionText}
        </Text>
      </View>
    </View>
  )
})
