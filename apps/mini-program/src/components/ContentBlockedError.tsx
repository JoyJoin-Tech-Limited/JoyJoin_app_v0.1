import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { haptics } from '../lib/utils/haptics'
import './ContentBlockedError.scss'

// ─── Types ─────────────────────────────────────────────────────────

export interface ContentBlockedErrorProps {
  /** Server-provided user-facing message (already warm, not punitive). */
  message: string
  /** Show or hide the error. */
  visible: boolean
  /** Which form field had the violation — used for aria-label and testing. */
  fieldName?: string
  /** Called when the user taps the error to dismiss it. */
  onDismiss?: () => void
}

// ─── Field-aware hint mapping ──────────────────────────────────────

const FIELD_HINT_PREFIX: Record<string, string> = {
  displayName: '昵称',
  bio: '个人简介',
  industryRawInput: '职业信息',
  occupationId: '职业信息',
  currentCity: '城市信息',
}

function resolveHint(fieldName?: string): string {
  const prefix = fieldName ? FIELD_HINT_PREFIX[fieldName] : undefined
  if (prefix) {
    return `${prefix}不符合规范，修改后即可继续。`
  }
  return '修改后即可继续。'
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * Inline error display for CONTENT_VIOLATION responses from the server's
 * 敏感词过滤 gate. Renders a red hint block below the offending form field
 * with haptic feedback, fade-in entrance, and screen-reader announcement.
 *
 * Used in edit-profile and onboarding essential-data forms.
 */
export default function ContentBlockedError({
  message,
  visible,
  fieldName,
  onDismiss,
}: ContentBlockedErrorProps) {
  const hasAppearedRef = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [])

  // ── Reduce motion ────────────────────────────────────────────────
  const reduceMotionRef = useRef(false)
  useEffect(() => {
    try {
      const sysInfo = Taro.getSystemInfoSync() as unknown as Record<string, unknown>
      reduceMotionRef.current = sysInfo.reduceMotion === true
    } catch {
      // Best-effort — default to animation enabled
    }
  }, [])

  // ── Haptics on appear ────────────────────────────────────────────
  useEffect(() => {
    if (visible && !hasAppearedRef.current) {
      hasAppearedRef.current = true
      try {
        Taro.vibrateShort({ type: 'light' })
      } catch {
        // Non-critical — fail silently on unsupported devices
      }
    }
    if (!visible) {
      hasAppearedRef.current = false
    }
  }, [visible])

  if (!visible || !message) return null

  const hintText = resolveHint(fieldName)
  const motionClass = reduceMotionRef.current
    ? 'content-blocked-error--reduce-motion'
    : ''
  const closingClass = isClosing ? 'content-blocked-error--closing' : ''

  const handleDismiss = onDismiss
    ? () => {
        haptics('light')
        setIsClosing(true)
        dismissTimerRef.current = setTimeout(() => {
          onDismiss()
          setIsClosing(false)
        }, reduceMotionRef.current ? 0 : 200)
      }
    : undefined

  return (
    <View
      className={`content-blocked-error ${motionClass} ${closingClass} ${handleDismiss ? 'content-blocked-error--dismissible' : ''}`}
      role='alert'
      aria-live='polite'
      aria-label={fieldName ? `${fieldName} 内容不合规` : '内容不合规'}
      onClick={handleDismiss}
      hoverClass={handleDismiss ? 'content-blocked-error--hover' : undefined}
      hoverStayTime={100}
    >
      <Text className='content-blocked-error__message'>{message}</Text>
      <Text className='content-blocked-error__hint'>{hintText}</Text>
    </View>
  )
}
