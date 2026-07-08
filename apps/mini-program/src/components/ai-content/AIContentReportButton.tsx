import { View, Text } from '@tarojs/components'
import { haptics } from '../../lib/utils/haptics'
import { showAIContentReportFlow, type ReportAIContentOptions } from '../../lib/api/ai-content/reportAIContent'
import './AIContentReportButton.scss'

export interface AIContentReportButtonProps {
  /** Report context passed to the API. */
  options: ReportAIContentOptions
  /** Visible label. */
  label?: string
  /** Optional CSS class. */
  className?: string
  /** Called after a successful report submission. */
  onReported?: () => void
}

/**
 * AIContentReportButton — small text/button entry point for reporting
 * AI-generated content. Should be rendered only when AIGC_LABELS_ENABLED
 * is true so the reporting surface matches the label disclosure.
 */
export default function AIContentReportButton({
  options,
  label = '举报此内容',
  className = '',
  onReported,
}: AIContentReportButtonProps) {
  const handleTap = async () => {
    haptics('light')
    try {
      await showAIContentReportFlow(options)
      onReported?.()
    } catch {
      // Error toast already shown by showAIContentReportFlow
    }
  }

  const classes = ['aigc-report-button', className].filter(Boolean).join(' ')

  return (
    <View
      className={classes}
      onClick={handleTap}
      hoverClass='aigc-report-button--active'
      hoverStayTime={120}
      role='button'
      aria-label={label}
    >
      <Text className='aigc-report-button__text'>{label}</Text>
    </View>
  )
}
