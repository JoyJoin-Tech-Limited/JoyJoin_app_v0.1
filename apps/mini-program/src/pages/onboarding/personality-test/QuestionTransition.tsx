import { View } from '@tarojs/components'
import './QuestionTransition.scss'

export interface QuestionTransitionProps {
  questionId: string
  children: React.ReactNode
}

/**
 * QuestionTransition — mounts children with a fade-in + slide-up entrance.
 *
 * Uses `questionId` as the React key so that every question change forces a
 * remount. The CSS animation restarts from frame 0 automatically, eliminating
 * the 17-ms flash that occurred when we toggled a class via setState + setTimeout.
 */
export default function QuestionTransition({ questionId, children }: QuestionTransitionProps) {
  return (
    <View key={questionId} className='question-transition question-transition--enter'>
      {children}
    </View>
  )
}
