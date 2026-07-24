export type FlowAccent = 'brand' | 'human' | 'city' | 'story'

export type FlowIconName =
  | 'formal-blind-box'
  | 'street-blind-box'
  | 'activity-discovery'
  | 'activity-ticket'
  | 'ai-match'
  | 'group-formed'
  | 'activity-reveal'
  | 'offline-experience'
  | 'explore-location'
  | 'street-task'
  | 'city-exploration'
  | 'city-story'

export interface FlowStepDefinition {
  id: string
  title: string
  description: string
  icon: FlowIconName
  accent: FlowAccent
}

export interface ExperienceDefinition {
  id: 'event' | 'street'
  eyebrow: string
  title: string
  headline: string
  description: string
  icon: FlowIconName
  steps: readonly FlowStepDefinition[]
  closingCopy: string
}
