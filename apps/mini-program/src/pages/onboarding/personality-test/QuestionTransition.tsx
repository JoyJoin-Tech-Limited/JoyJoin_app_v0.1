import { View } from '@tarojs/components'
import { useMemo } from 'react'
import './QuestionTransition.scss'

export interface QuestionTransitionProps {
  questionId: string
  children: React.ReactNode
}

export default function QuestionTransition({ questionId, children }: QuestionTransitionProps) {
  const key = useMemo(() => questionId, [questionId])

  return (
    <View key={key} className='question-transition question-transition--enter'>
      {children}
    </View>
  )
}
