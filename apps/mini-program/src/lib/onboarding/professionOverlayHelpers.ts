/**
 * Profession overlay pure helpers — expression mapping, ambient ids and the
 * legacy keyword→reaction lookup.
 *
 * Extracted from `ProfessionChatOverlay.tsx` during a no-behavior-change
 * refactor. These functions are deterministic and side-effect free; the overlay
 * imports them and calls them at the exact same call sites as before.
 */

import type { XiaoyueExpressionId } from '../mascot/xiaoyueExpressions'
import { PROFESSION_REACTION_ENTRIES } from './professionOverlayCopy'

export interface ChatMessage {
  id: string
  sender: 'xiaoyue' | 'user'
  text: string
  expressionId?: XiaoyueExpressionId
  isFallback?: boolean
}

export const DEBOUNCE_MS = 2000
export const MAX_SENDS_PER_SESSION = 5
export const API_TIMEOUT_MS = 14000

export function getReactionForProfession(text: string): string {
  const lower = text.toLowerCase()
  for (const [keyword, reaction] of PROFESSION_REACTION_ENTRIES) {
    if (lower.includes(keyword.toLowerCase())) {
      return reaction
    }
  }
  return `「${text.trim()}」——这个背景挺有意思的，我先帮你收进档案了。等会儿让悦仔再仔细品一品，看看能挖出什么有趣的连接～`
}

export function mapFallbackExpression(reaction: string): XiaoyueExpressionId {
  if (reaction.includes('洞察力') || reaction.includes('逻辑')) return 'testCurious'
  if (reaction.includes('倾听') || reaction.includes('细腻')) return 'testListening'
  if (reaction.includes('故事') || reaction.includes('共鸣')) return 'matchSuccess'
  return 'homeWelcome'
}

export function mapSuccessExpression(reaction: string): XiaoyueExpressionId {
  if (reaction.includes('有趣') || reaction.includes('好奇') || reaction.includes('惊喜')) return 'testCurious'
  if (reaction.includes('温暖') || reaction.includes('安心') || reaction.includes('舒服')) return 'testListening'
  if (reaction.includes('棒') || reaction.includes('厉害') || reaction.includes('赞')) return 'matchSuccess'
  return 'coachGuide'
}

/** Anticipate expression based on profession keywords before API responds */
export function getAnticipationExpression(text: string): XiaoyueExpressionId {
  const lower = text.toLowerCase()
  // Creative / artistic professions → curious face
  if (['设计', '艺术', '摄影', '音乐', '写作', '导演', '编剧', '画家', '创意', '美术', '画画', '舞蹈', '表演', '模特', '主播', '网红', '博主', '自媒体'].some((k) => lower.includes(k)))
    return 'testCurious'
  if (['designer', 'artist', 'photographer', 'musician', 'writer', 'director', 'actor', 'creative', 'model', 'streamer', 'blogger'].some((k) => lower.includes(k)))
    return 'testCurious'
  // Technical / analytical professions → listening face
  if (['程序', '工程', '数据', '开发', '技术', '算法', '科研', '研究', '学术', '博士', '教授', '科学家', '分析', '架构', '运维', '测试', '码农', '人工智能'].some((k) => lower.includes(k)))
    return 'testListening'
  if (['engineer', 'programmer', 'developer', 'data scientist', 'scientist', 'researcher', 'analyst', 'architect', 'coder', 'dev', 'phd', 'professor', 'tech'].some((k) => lower.includes(k)))
    return 'testListening'
  // Social / people-facing professions → coach guide face
  if (['销售', '老师', '教师', '人力', 'hr', '培训', '教练', '咨询', '顾问', '主持', '公关', '市场', '运营', '客服', '社工', '志愿者', '导游'].some((k) => lower.includes(k)))
    return 'coachGuide'
  if (['sales', 'teacher', 'hr', 'trainer', 'coach', 'consultant', 'host', 'marketing', 'operation', 'customer service', 'social worker', 'volunteer', 'guide'].some((k) => lower.includes(k)))
    return 'coachGuide'
  // Business / leadership → success face
  if (['经理', '总监', '主管', '创业', '创始人', '老板', '合伙', '投资', '金融', '银行', '证券', '保险', '地产', '管理', 'leader', 'executive'].some((k) => lower.includes(k)))
    return 'matchSuccess'
  if (['manager', 'director', 'founder', 'entrepreneur', 'partner', 'investor', 'finance', 'banking', 'executive', 'ceo', 'cfo', 'cto'].some((k) => lower.includes(k)))
    return 'matchSuccess'
  return 'loadingSystem'
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
