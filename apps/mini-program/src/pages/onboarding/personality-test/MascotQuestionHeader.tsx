import { View, Text } from '@tarojs/components'
import XiaoyueChatBubble from '../../../components/XiaoyueChatBubble'
import type { XiaoyueExpressionId } from '../../../lib/xiaoyueExpressions'
import './MascotQuestionHeader.scss'

interface MatchChip {
  archetype: string
}

interface QuestionStub {
  scenarioText?: string
  questionText: string
}

export interface MascotQuestionHeaderProps {
  question: QuestionStub | null
  currentMatches?: MatchChip[]
  expressionId: XiaoyueExpressionId
  isLoading?: boolean
}

export default function MascotQuestionHeader({
  question,
  currentMatches = [],
  expressionId,
  isLoading = false,
}: MascotQuestionHeaderProps) {
  if (!question) {
    return (
      <View className='mascot-question-header mascot-question-header--empty'>
        <XiaoyueChatBubble
          content='小悦正在准备下一题…'
          expressionId='loadingSystem'
          wide
          showGlow
          isLoading
        />
      </View>
    )
  }

  const bubbleContent = question.scenarioText
    ? `${question.scenarioText}。${question.questionText}`
    : question.questionText

  return (
    <View className='mascot-question-header'>
      {question.scenarioText ? (
        <Text className='mascot-question-header__eyebrow'>
          {question.scenarioText}
        </Text>
      ) : null}

      <XiaoyueChatBubble
        content={bubbleContent}
        expressionId={expressionId}
        wide
        showGlow={!isLoading}
        isLoading={isLoading}
        staggerDelay={50}
      />

      {currentMatches.length > 0 ? (
        <View className='mascot-question-header__matches'>
          {currentMatches.slice(0, 2).map((match) => (
            <Text key={match.archetype} className='mascot-question-header__match-chip'>
              {match.archetype}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}
