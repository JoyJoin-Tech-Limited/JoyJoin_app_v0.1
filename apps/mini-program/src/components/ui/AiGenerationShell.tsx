import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Image, RootPortal } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { haptics } from '../../lib/utils/haptics'
import Button from './Button'
import './AiGenerationShell.scss'

export type GenerationPhase = 'confirm' | 'generating' | 'success' | 'error'

export interface AiGenerationShellStep {
  label: string
  description?: string
}

export interface AiGenerationShellProps {
  visible: boolean
  /** `overlay` renders a centered modal; `inline` renders a card in-place. */
  mode?: 'overlay' | 'inline'
  phase: GenerationPhase
  title: string
  subtitle?: string
  steps: AiGenerationShellStep[]
  /** 0–100 determinate progress used in `generating` phase. */
  progress?: number
  /** Accessible label for the progress bar (e.g., "生成进度 45%"). */
  progressLabel?: string
  /** Estimated total duration in ms; shown as a calm hint when progress stalls. */
  estimatedTotalMs?: number
  successTitle?: string
  successSubtitle?: string
  errorTitle?: string
  errorDescription?: string
  retryLabel?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
  onRetry?: () => void
  reduceMotion?: boolean
  mascotExpression?: XiaoyueExpressionId
  successMascotExpression?: XiaoyueExpressionId
  errorMascotExpression?: XiaoyueExpressionId
}

const clampProgress = (value: number | undefined) => {
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return Math.max(0, Math.min(100, num))
}

const formatSecondsRemaining = (ms: number) => {
  const seconds = Math.max(1, Math.ceil(ms / 1000))
  return `预计还需 ${seconds} 秒`
}

export default function AiGenerationShell({
  visible,
  mode = 'overlay',
  phase,
  title,
  subtitle,
  steps,
  progress,
  progressLabel,
  estimatedTotalMs,
  successTitle = '生成完成',
  successSubtitle = '专属内容已准备好',
  errorTitle = '生成遇到一点状况',
  errorDescription = '网络或服务器有点忙，稍后再试试？',
  retryLabel = '重试',
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
  onRetry,
  reduceMotion = false,
  mascotExpression = 'loadingSystem',
  successMascotExpression = 'actionSuccess',
  errorMascotExpression = 'actionFailure',
}: AiGenerationShellProps) {
  const safeProgress = clampProgress(progress)
  const isOverlay = mode === 'overlay'
  const isDismissible = phase === 'confirm' || phase === 'error'

  // Compute which steps are completed based on progress thresholds.
  const stepThresholds = useMemo(() => {
    const count = Math.max(1, steps.length)
    return steps.map((_, index) => Math.min(100, Math.round(((index + 1) / count) * 92)))
  }, [steps])

  const activeStepIndex = useMemo(() => {
    if (phase === 'success') return steps.length
    const completedCount = stepThresholds.filter((threshold) => safeProgress >= threshold).length
    return Math.min(completedCount, steps.length - 1)
  }, [phase, safeProgress, stepThresholds, steps.length])

  // Haptic feedback when a new step completes.
  const prevCompletedCountRef = useRef(0)
  useEffect(() => {
    if (phase !== 'generating' || reduceMotion) return
    const completedCount = stepThresholds.filter((threshold) => safeProgress >= threshold).length
    if (completedCount > prevCompletedCountRef.current && completedCount > 0) {
      haptics('light')
    }
    prevCompletedCountRef.current = completedCount
  }, [phase, reduceMotion, safeProgress, stepThresholds])

  // Reset completed count tracker when entering generating.
  useEffect(() => {
    if (phase === 'generating') {
      prevCompletedCountRef.current = 0
    }
  }, [phase])

  // Close on route change (system back / swipe-back) when dismissible.
  useEffect(() => {
    if (!visible || !isDismissible || !onCancel) return
    const closeOnRouteChange = (): void => {
      onCancel()
    }
    Taro.eventCenter.on('__taroRouterChange', closeOnRouteChange)
    return () => {
      Taro.eventCenter.off('__taroRouterChange', closeOnRouteChange)
    }
  }, [visible, isDismissible, onCancel])

  const handleOverlayClick = () => {
    if (!isDismissible || !onCancel) return
    onCancel()
  }

  const handleCardClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }

  const handleConfirm = () => {
    if (phase !== 'confirm' || !onConfirm) return
    if (!reduceMotion) haptics('medium')
    onConfirm()
  }

  const handleRetry = () => {
    if (!onRetry) return
    if (!reduceMotion) haptics('medium')
    onRetry()
  }

  const handleCancel = () => {
    if (!onCancel) return
    onCancel()
  }

  const progressHint = useMemo(() => {
    if (typeof estimatedTotalMs === 'number' && estimatedTotalMs > 0 && phase === 'generating') {
      const elapsedRatio = safeProgress / 100
      const remainingMs = Math.max(0, estimatedTotalMs * (1 - elapsedRatio))
      if (remainingMs > 1000) return formatSecondsRemaining(remainingMs)
    }
    return progressLabel ?? `${safeProgress}%`
  }, [estimatedTotalMs, phase, progressLabel, safeProgress])

  if (!visible) return null

  const shellContent = (
    <View
      className={`ai-gen-shell__card ${reduceMotion ? 'ai-gen-shell__card--static' : ''}`}
      onClick={handleCardClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='ai-gen-shell-title'
    >
      {isDismissible && onCancel && (
        <View
          className='ai-gen-shell__close'
          hoverClass='ai-gen-shell__close--pressed'
          onClick={handleCancel}
          role='button'
          aria-label='关闭'
        >
          <Text className='ai-gen-shell__close-icon' aria-hidden='true'>
            ×
          </Text>
        </View>
      )}

      {phase === 'error' ? (
        <View className='ai-gen-shell__content ai-gen-shell__content--error'>
          <Image
            className='ai-gen-shell__mascot ai-gen-shell__mascot--error'
            src={getXiaoyueExpressionAsset(errorMascotExpression)}
            mode='aspectFit'
          />
          <Text id='ai-gen-shell-title' className='ai-gen-shell__title'>
            {errorTitle}
          </Text>
          <Text className='ai-gen-shell__subtitle'>{errorDescription}</Text>
          <Button
            variant='primary'
            className='ai-gen-shell__cta'
            onClick={handleRetry}
          >
            {retryLabel}
          </Button>
          {phase === 'error' && onCancel && (
            <View
              className='ai-gen-shell__text-action'
              hoverClass='ai-gen-shell__text-action--pressed'
              hoverStartTime={0}
              hoverStayTime={120}
              onClick={handleCancel}
              role='button'
            >
              <Text className='ai-gen-shell__text-action-label'>{cancelLabel}</Text>
            </View>
          )}
        </View>
      ) : phase === 'success' ? (
        <View className='ai-gen-shell__content ai-gen-shell__content--success'>
          <Image
            className='ai-gen-shell__mascot ai-gen-shell__mascot--success'
            src={getXiaoyueExpressionAsset(successMascotExpression)}
            mode='aspectFit'
          />
          <Text id='ai-gen-shell-title' className='ai-gen-shell__title'>
            {successTitle}
          </Text>
          <Text className='ai-gen-shell__subtitle'>{successSubtitle}</Text>
        </View>
      ) : (
        <>
          <View className='ai-gen-shell__header'>
            <Image
              className={`ai-gen-shell__mascot ${phase === 'generating' && !reduceMotion ? 'ai-gen-shell__mascot--breathing' : ''}`}
              src={getXiaoyueExpressionAsset(mascotExpression)}
              mode='aspectFit'
            />
            <View className='ai-gen-shell__header-text'>
              <Text id='ai-gen-shell-title' className='ai-gen-shell__title'>
                {title}
              </Text>
              {subtitle ? <Text className='ai-gen-shell__subtitle'>{subtitle}</Text> : null}
            </View>
          </View>

          <View className='ai-gen-shell__steps' role='list'>
            {steps.map((step, index) => {
              const isCompleted = safeProgress >= stepThresholds[index]
              const isActive = index === activeStepIndex && phase === 'generating'
              const isPending = !isCompleted && !isActive

              return (
                <View
                  key={index}
                  className={`ai-gen-shell__step ${
                    isCompleted ? 'ai-gen-shell__step--completed' : ''
                  } ${isActive ? 'ai-gen-shell__step--active' : ''} ${
                    isPending ? 'ai-gen-shell__step--pending' : ''
                  }`}
                  role='listitem'
                >
                  <View className='ai-gen-shell__step-text'>
                    <Text className='ai-gen-shell__step-label'>{step.label}</Text>
                    {step.description ? (
                      <Text className='ai-gen-shell__step-description'>{step.description}</Text>
                    ) : null}
                  </View>
                  <View className='ai-gen-shell__step-indicator' aria-hidden='true'>
                    <View className='ai-gen-shell__step-check' />
                    <View className='ai-gen-shell__step-dot' />
                  </View>
                </View>
              )
            })}
          </View>

          {phase === 'generating' && (
            <View className='ai-gen-shell__progress-wrap'>
              <View
                className='ai-gen-shell__progress'
                role='progressbar'
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={safeProgress}
                aria-label={progressLabel ?? '生成进度'}
              >
                <View
                  className='ai-gen-shell__progress-fill'
                  style={{ transform: `scaleX(${safeProgress / 100})` }}
                />
              </View>
              <Text className='ai-gen-shell__progress-hint'>{progressHint}</Text>
            </View>
          )}

          {phase === 'confirm' && (
            <View className='ai-gen-shell__actions'>
              <Button
                variant='primary'
                className='ai-gen-shell__cta'
                onClick={handleConfirm}
              >
                {confirmLabel}
              </Button>
              {onCancel && (
                <View
                  className='ai-gen-shell__text-action'
                  hoverClass='ai-gen-shell__text-action--pressed'
                  hoverStartTime={0}
                  hoverStayTime={120}
                  onClick={handleCancel}
                  role='button'
                >
                  <Text className='ai-gen-shell__text-action-label'>{cancelLabel}</Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  )

  if (!isOverlay) {
    return <View className='ai-gen-shell ai-gen-shell--inline'>{shellContent}</View>
  }

  return (
    <RootPortal>
      <View className='ai-gen-shell ai-gen-shell--overlay' onClick={handleOverlayClick}>
        {shellContent}
      </View>
    </RootPortal>
  )
}
