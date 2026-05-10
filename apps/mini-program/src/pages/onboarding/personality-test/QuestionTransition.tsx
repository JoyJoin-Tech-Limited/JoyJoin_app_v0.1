import { View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import './QuestionTransition.scss'

export interface QuestionTransitionProps {
  questionId: string
  children: React.ReactNode
}

export default function QuestionTransition({ questionId, children }: QuestionTransitionProps) {
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    setAnimating(false)
    const timer = setTimeout(() => setAnimating(true), 17)
    return () => clearTimeout(timer)
  }, [questionId])

  return (
    <View className={animating ? 'question-transition question-transition--enter' : 'question-transition'}>
      {children}
    </View>
  )
}
