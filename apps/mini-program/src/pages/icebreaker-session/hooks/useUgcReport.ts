import { useCallback, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import type { IcebreakerUgcReportBody, UgcContentRef } from '@joyjoin/shared/api'
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker'
import { apiRequest } from '../../../lib/api/api'
import { buildSocialPath } from '../icebreakerSessionModel'
import { haptics } from '../../../lib/utils/haptics'
import { logWarn } from '../../../lib/utils/logger'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'

// ── E9 UGC 举报闭环 (sprint e9-ugc-report, contract §2/AC-07) ─────────────
// Long-press is the ONLY entry (low visual weight — no persistent button):
//   onLongPress → ActionSheet「举报这条内容」→ confirm modal (optional note)
//   → POST /api/social-icebreaker/:socialSessionId/report-content
//   → warm toast. The server snapshots the original text itself — the client
//   never sends the reported content, only the locator (contentRef).
// AIContentReportButton stays untouched (AIGC-semantic, no snapshot ability).

export const UGC_REPORT_ACTION_LABEL = '举报这条内容'
export const UGC_REPORT_MODAL_TITLE = '举报这条内容'
export const UGC_REPORT_MODAL_CONTENT = '提交后我们会尽快核查这条内容'
export const UGC_REPORT_MODAL_PLACEHOLDER = '补充说明（选填）'
export const UGC_REPORT_SUCCESS_TOAST = '已收到，我们会核查'
export const UGC_REPORT_FAILURE_TOAST = '提交失败，请稍后再试'
export const UGC_REPORT_NOTE_MAX_LENGTH = 100

/**
 * WeChat fires `tap` after `longpress` on the same node — on rows that also
 * carry an onClick (quip vote toggle, lie-statement vote) the echo tap would
 * silently flip a vote while the reporter is mid-flow. Mounts consult
 * `shouldSkipClick()` inside their onClick to swallow that echo.
 */
const TAP_SUPPRESS_AFTER_LONG_PRESS_MS = 600

export interface UgcReportTarget {
  /** Current phase machine id (drives the server snapshot + admin prefix). */
  phase: SocialIcebreakerPhase
  /** The content author's userId — must be a fellow session member. */
  targetUserId: string
  /** Server-side snapshot locator — never carries the content text. */
  contentRef: UgcContentRef
}

interface UseUgcReportOptions {
  /** Absent (pre-poll frame) → presentReport is a no-op. */
  socialSessionId?: string
}

interface UseUgcReportReturn {
  /** Fire the full report flow. Never rejects; in-flight calls are dropped. */
  presentReport: (target: UgcReportTarget) => Promise<void>
  /** True briefly after a long-press — swallow the WeChat echo tap. */
  shouldSkipClick: () => boolean
  /** REL-01 in-flight marker (request leg of the flow). */
  isReporting: boolean
}

/** wx.showModal(editable) — WeChat base library ≥2.17.1 renders a one-line
 *  input; Taro's shipped types predate the field, so we cast (same pattern as
 *  TaroWithShareImageMenu in useRecapSharePoster). Other runtimes ignore it —
 *  submission without a note stays possible everywhere. */
type ShowModalEditable = (options: {
  title?: string
  content?: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
  editable?: boolean
  placeholderText?: string
}) => Promise<{ confirm: boolean; cancel: boolean; content?: string }>

export function useUgcReport({ socialSessionId }: UseUgcReportOptions): UseUgcReportReturn {
  const [isReporting, setIsReporting] = useState(false)
  // REL-01: one flow at a time — a second long-press while the sheet/modal/
  // request is open is dropped, so double-submits are structurally impossible.
  const flowActiveRef = useRef(false)
  const lastLongPressAtRef = useRef(0)

  const shouldSkipClick = useCallback(
    () => Date.now() - lastLongPressAtRef.current < TAP_SUPPRESS_AFTER_LONG_PRESS_MS,
    [],
  )

  const presentReport = useCallback(
    async (target: UgcReportTarget): Promise<void> => {
      if (!socialSessionId || flowActiveRef.current) return
      flowActiveRef.current = true
      lastLongPressAtRef.current = Date.now()
      haptics('light')
      try {
        // Step 1 — entry sheet. Dismissal is a cancel, never a failure.
        let tapIndex = -1
        try {
          const sheet = await Taro.showActionSheet({ itemList: [UGC_REPORT_ACTION_LABEL] })
          tapIndex = sheet.tapIndex
        } catch {
          return
        }
        if (tapIndex !== 0) return

        // Step 2 — confirm + optional short note (no note is submittable).
        let confirm = false
        let note = ''
        try {
          const modal = await (Taro.showModal as unknown as ShowModalEditable)({
            title: UGC_REPORT_MODAL_TITLE,
            content: UGC_REPORT_MODAL_CONTENT,
            confirmText: '提交',
            cancelText: '取消',
            confirmColor: '#8B5CF6',
            editable: true,
            placeholderText: UGC_REPORT_MODAL_PLACEHOLDER,
          })
          confirm = modal.confirm
          note = typeof modal.content === 'string'
            ? modal.content.trim().slice(0, UGC_REPORT_NOTE_MAX_LENGTH)
            : ''
        } catch {
          return
        }
        if (!confirm) return

        // Step 3 — submit. The body carries ONLY the locator + optional note;
        // the original text is snapshotted server-side (contract AC-01).
        setIsReporting(true)
        try {
          const body: IcebreakerUgcReportBody = {
            phase: target.phase,
            targetUserId: target.targetUserId,
            contentRef: target.contentRef,
            ...(note ? { note } : {}),
          }
          await apiRequest<unknown>({
            path: buildSocialPath(socialSessionId, '/report-content'),
            method: 'POST',
            data: body,
          })
        } catch (error) {
          logWarn('[UgcReport] submit failed', {
            phase: target.phase,
            kind: target.contentRef.kind,
            message: error instanceof Error ? error.message : 'unknown error',
          })
          void Taro.showToast({ title: UGC_REPORT_FAILURE_TOAST, icon: 'none', duration: 2500 })
          return
        } finally {
          setIsReporting(false)
        }

        // OBS-01: {phase, kind} only — the reported text never rides analytics.
        socialIcebreakerAnalytics.track('ugc_report_submitted', socialSessionId, undefined, target.phase, {
          kind: target.contentRef.kind,
        })
        void Taro.showToast({ title: UGC_REPORT_SUCCESS_TOAST, icon: 'success', duration: 2000 })
      } finally {
        flowActiveRef.current = false
      }
    },
    [socialSessionId],
  )

  return { presentReport, shouldSkipClick, isReporting }
}
