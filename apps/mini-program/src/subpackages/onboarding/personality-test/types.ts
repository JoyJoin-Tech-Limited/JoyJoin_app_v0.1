export type Phase = 'intro' | 'testing' | 'completing'

export type AssessmentQuestionType = 'choice' | 'slider' | 'emoji_tap'

export interface AssessmentOption {
  value: string
  text: string
  traitScores?: Record<string, number>
  iconAssetKey?: string
  commentary?: string
}

export interface AssessmentSliderConfig {
  leftLabel: string
  rightLabel: string
  leftEmoji?: string
  rightEmoji?: string
}

export interface AssessmentQuestion {
  id: string
  scenarioText: string
  questionText: string
  options: AssessmentOption[]
  questionType?: AssessmentQuestionType
  sliderConfig?: AssessmentSliderConfig
}

export interface AssessmentProgress {
  answered: number
  estimatedRemaining: number
  minQuestions: number
  softMaxQuestions: number
  hardMaxQuestions: number
}

export interface AssessmentMatch {
  archetype: string
  score: number
  confidence: number
}
