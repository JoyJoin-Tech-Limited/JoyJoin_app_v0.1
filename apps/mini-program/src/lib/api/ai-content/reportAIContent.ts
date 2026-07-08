import Taro from '@tarojs/taro'
import {
  AI_CONTENT_REPORT_CATEGORY,
  type CreateReportRequest,
} from '@joyjoin/shared/api'
import { apiRequest } from '../api'

export interface ReportAIContentOptions {
  /** Free-text reason from the user, or a default prompt reason. */
  reason: string
  /** Event/pool context, if known. */
  relatedEventId?: string
  /** User context, if the content is attributed to a specific user. */
  reportedUserId?: string
}

/**
 * Submit an AI-content report to the compliance endpoint.
 *
 * Contract with Backend Engineer:
 *   POST /api/reports
 *   Body: { category: 'ai_content', description: string, relatedEventId?, reportedUserId? }
 *
 * The server validates category, rate-limits the reporter, runs
 * validateContentSafe() on the description, and stores it in the reports table.
 */
export async function reportAIContent(options: ReportAIContentOptions): Promise<void> {
  const payload: CreateReportRequest = {
    category: AI_CONTENT_REPORT_CATEGORY,
    description: options.reason,
    ...(options.relatedEventId ? { relatedEventId: options.relatedEventId } : {}),
    ...(options.reportedUserId ? { reportedUserId: options.reportedUserId } : {}),
  }

  await apiRequest<unknown>({
    path: '/api/reports',
    method: 'POST',
    data: payload,
  })
}

/**
 * Present the AI-content report flow: confirmation modal, submit, toast result.
 */
export async function showAIContentReportFlow(options: ReportAIContentOptions): Promise<void> {
  const { confirm } = await Taro.showModal({
    title: '反馈这段内容',
    content: '确认要举报这段 AI 生成内容吗？我们会尽快审核。',
    confirmText: '提交',
    cancelText: '取消',
    confirmColor: '#8B5CF6',
  })

  if (!confirm) return

  try {
    await reportAIContent(options)
    Taro.showToast({ title: '举报已提交', icon: 'success', duration: 2000 })
  } catch (err) {
    Taro.showToast({
      title: '提交失败，请稍后再试',
      icon: 'none',
      duration: 2000,
    })
    throw err
  }
}
