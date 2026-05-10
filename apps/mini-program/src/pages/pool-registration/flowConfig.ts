import type { PreJoinVibeBrief } from '@shared/ai/onboarding'
import { INTENT_OPTIONS } from '@shared/constants'

export type PoolEventType = '饭局' | '酒局'

export interface FlowOption {
  value: string
  label: string
  emoji?: string
  description?: string
}

export type BriefContent = Pick<PreJoinVibeBrief, 'insight' | 'matchingPromise' | 'reasons'>

export const INTENT_FLOW_OPTIONS: FlowOption[] = INTENT_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  description: option.subtitle,
}))

export const LANGUAGE_OPTIONS: FlowOption[] = [
  { value: '粤语', label: '粤语', description: '更容易拉近距离' },
  { value: '普通话', label: '普通话', description: '默认开聊更自然' },
  { value: '英语', label: 'English', description: '适合双语或国际化局' },
]

export const DINNER_BUDGET_OPTIONS: FlowOption[] = [
  { value: '150以下', label: '150以下', description: '轻松吃顿舒服的' },
  { value: '150-200', label: '150-200', description: '平衡预算和体验' },
  { value: '200-300', label: '200-300', description: '更精致一点的饭局' },
  { value: '300-500', label: '300-500', description: '把这次吃得更讲究' },
]

export const DRINKS_BUDGET_OPTIONS: FlowOption[] = [
  { value: '80以下', label: '80以下', description: '轻松小酌就好' },
  { value: '80-150', label: '80-150', description: '更偏精品调酒或氛围' },
]

export const DIETARY_OPTIONS: FlowOption[] = [
  { value: 'none', label: '无限制' },
  { value: 'vegetarian', label: '素食' },
  { value: 'halal', label: '清真' },
  { value: 'seafood_allergy', label: '海鲜过敏' },
]

export const BAR_THEME_OPTIONS: FlowOption[] = [
  { value: '精酿', label: '精酿', description: '偏啤酒和轻松聊天' },
  { value: '清吧', label: '清吧', description: '更安静，更适合慢聊' },
  { value: '私密调酒', label: '私密调酒', description: '更注重调酒和氛围' },
]

export const ALCOHOL_COMFORT_OPTIONS: FlowOption[] = [
  { value: '可以喝酒', label: '可以喝酒', description: '小酌也没问题' },
  { value: '微醺就好', label: '微醺就好', description: '想放松，但不过量' },
  { value: '无酒精', label: '无酒精', description: '我更想喝软饮' },
]

export function resolvePoolEventType(rawValue?: string | null): PoolEventType {
  const normalizedValue = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : ''

  if (normalizedValue.includes('drinks') || normalizedValue.includes('酒')) {
    return '酒局'
  }

  return '饭局'
}

export function getBudgetOptions(eventType: PoolEventType): FlowOption[] {
  return eventType === '酒局' ? DRINKS_BUDGET_OPTIONS : DINNER_BUDGET_OPTIONS
}

export function getFlowStepLabels(eventType: PoolEventType): string[] {
  return ['预算', '期待', eventType === '酒局' ? '氛围' : '细节']
}

export function buildPreJoinVibeBriefPath(input: {
  eventType: PoolEventType
  area?: string
}): string {
  const query = [`eventType=${encodeURIComponent(input.eventType)}`]

  if (input.area && input.area.trim() !== '') {
    query.push(`area=${encodeURIComponent(input.area.trim())}`)
  }

  return `/api/ai/pre-join-vibe-brief?${query.join('&')}`
}

export function buildFallbackBrief(input: {
  eventType: PoolEventType
  area?: string
}): BriefContent {
  const areaName = input.area?.trim() ?? ''
  const areaReasonPrefix = areaName !== '' ? `${areaName}这场` : '这场'

  if (input.eventType === '酒局') {
    return {
      insight: '你更适合在节奏舒服的酒局里，先放松一点，再慢慢熟起来。',
      matchingPromise: '我们会把你的预算、语言和酒局氛围偏好一起放进匹配里，为你找更同频的酒搭子。',
      reasons: [
        `${areaReasonPrefix}更容易遇到顺路也顺节奏的人`,
        '预算和主题偏好会一起参与匹配',
        '喝酒舒适度会帮我们控制整桌节奏',
      ],
    }
  }

  return {
    insight: '你更适合在轻松的饭局里，先吃得舒服，再慢慢把话题聊开。',
    matchingPromise: '我们会把你的预算、语言和饮食偏好一起放进匹配里，为你找更同频的饭搭子。',
    reasons: [
      `${areaReasonPrefix}更容易遇到顺路也顺频的人`,
      '预算和社交期待会一起参与匹配',
      '饮食细节会帮我们避开不合拍的组合',
    ],
  }
}