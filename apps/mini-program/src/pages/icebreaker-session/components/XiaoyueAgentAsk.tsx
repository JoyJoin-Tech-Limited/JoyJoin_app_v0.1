import { Text, View } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import AIContentReportButton from '../../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../../hooks/useAIGCLabelsEnabled'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import {
  XIAOYUE_AGENT_ASK_COPY,
  type XiaoyueAgentAskViewModel,
} from '../viewModels/xiaoyueAgentAskModel'
// Styles are @use'd by pages/icebreaker-session/index.scss. Do not add a
// component-side SCSS import: it can be stranded in sub-common.wxss.

export interface XiaoyueAgentAskProps {
  view: XiaoyueAgentAskViewModel
  onAccept: () => void
  onIgnore: () => void
  onCloseSession: () => void
  onRetry: () => void
  onDismissFailure: () => void
  onAigcFeedbackTap?: () => void
}

function SecondaryAction({
  label,
  disabled,
  onClick,
  className = '',
}: {
  label: string
  disabled: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <View
      className={`xiaoyue-agent-ask__secondary ${className}${disabled ? ' xiaoyue-agent-ask__secondary--disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      hoverClass={disabled ? 'none' : 'xiaoyue-agent-ask__secondary--pressed'}
      hoverStartTime={0}
      role='button'
      aria-label={label}
      aria-disabled={disabled}
    >
      <Text className='xiaoyue-agent-ask__secondary-text'>{label}</Text>
    </View>
  )
}

/** Host-only, non-modal Ask. All decisions and timing live in the hook. */
export function XiaoyueAgentAsk({
  view,
  onAccept,
  onIgnore,
  onCloseSession,
  onRetry,
  onDismissFailure,
  onAigcFeedbackTap,
}: XiaoyueAgentAskProps) {
  const aigcEnabled = useAIGCLabelsEnabled()
  const { isDegradation } = useDeviceTier()
  const showAigc = aigcEnabled && view.aiGenerated
  const actionsDisabled = view.busy || view.stage === 'success'
  const failureState = view.dismissDecision === 'action_failed_dismissed'
  const primaryAction = failureState ? onRetry : onAccept
  const secondaryLabel = failureState
    ? XIAOYUE_AGENT_ASK_COPY.dismissFailure
    : XIAOYUE_AGENT_ASK_COPY.ignore
  const secondaryAction = failureState ? onDismissFailure : onIgnore

  return (
    <View
      className={`xiaoyue-agent-ask${view.exiting ? ' xiaoyue-agent-ask--exiting' : ''}${view.animateIn && !isDegradation ? '' : ' xiaoyue-agent-ask--static'}`}
      role='group'
      aria-label={view.kicker}
      aria-busy={view.busy}
      data-ask-id={view.askId}
      data-stage={view.stage}
    >
      <View className='xiaoyue-agent-ask__card'>
        <Text className='xiaoyue-agent-ask__kicker'>{view.kicker}</Text>
        <Text className='xiaoyue-agent-ask__question' aria-live='polite'>
          {view.question}
        </Text>
        <View className='xiaoyue-agent-ask__status-row'>
          {view.stage === 'success' ? (
            <JoyJoinIcon
              className='xiaoyue-agent-ask__success-icon'
              emoji='✓'
              tier='status'
              size={24}
            />
          ) : null}
          <Text className='xiaoyue-agent-ask__status' aria-live='polite'>
            {view.hint}
          </Text>
        </View>

        <Button
          variant='primary'
          className='xiaoyue-agent-ask__primary'
          disabled={view.primaryDisabled || actionsDisabled}
          onClick={view.primaryDisabled || actionsDisabled ? undefined : primaryAction}
          hoverClass='xiaoyue-agent-ask__primary--pressed'
          aria-busy={view.busy}
        >
          {view.primaryLabel}
        </Button>

        <View className='xiaoyue-agent-ask__secondary-row'>
          <SecondaryAction
            label={secondaryLabel}
            disabled={actionsDisabled}
            onClick={secondaryAction}
          />
          <SecondaryAction
            label={XIAOYUE_AGENT_ASK_COPY.close}
            disabled={actionsDisabled || view.stage === 'offline'}
            onClick={onCloseSession}
            className='xiaoyue-agent-ask__secondary--quiet'
          />
        </View>

        {showAigc ? (
          <View className='xiaoyue-agent-ask__aigc'>
            <Text className='xiaoyue-agent-ask__aigc-text'>内容由 AI 生成</Text>
            <Text className='xiaoyue-agent-ask__aigc-sep'>·</Text>
            <View className='xiaoyue-agent-ask__aigc-report' onClick={onAigcFeedbackTap}>
              <AIContentReportButton
                options={{ reason: 'AI 生成话题建议' }}
                label='反馈'
                variant='text'
              />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default XiaoyueAgentAsk
