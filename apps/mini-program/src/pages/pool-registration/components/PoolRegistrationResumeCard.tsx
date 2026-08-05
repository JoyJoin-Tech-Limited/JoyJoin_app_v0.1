import { View, Text } from '@tarojs/components'
import Card from '../../../components/ui/Card'
import type { MiniProgramPoolRegistrationReturnContext } from '../../../lib/payment/paymentPendingOrder'

const UNPAID_NOTICE = '你的选择已经帮你留好了，确认后继续加入这场局。'

function getPaidNoticeCopy(
  context: MiniProgramPoolRegistrationReturnContext,
): { kicker: string; title: string; body: string } {
  return {
    kicker: '已确认',
    title: '刚才那份报名偏好已经替你接回来',
    body: '预算、期待和细节都已恢复，现在点下方按钮就能继续完成这场报名。',
  }
}

interface PoolRegistrationResumeCardProps {
  context: MiniProgramPoolRegistrationReturnContext
  selectedBudget: string
  intentCount: number
  eventType: string
}

export default function PoolRegistrationResumeCard({
  context,
  selectedBudget,
  intentCount,
  eventType,
}: PoolRegistrationResumeCardProps) {
  const paidNotice = context.paymentStatus === 'paid' ? getPaidNoticeCopy(context) : null

  return (
    <Card
      className={[
        'pool-reg__resume-card',
        context.paymentStatus === 'paid' ? 'pool-reg__resume-card--paid' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {paidNotice ? (
        <>
          <Text className='pool-reg__resume-kicker'>{paidNotice.kicker}</Text>
          <Text className='pool-reg__resume-title'>{paidNotice.title}</Text>
          <Text className='pool-reg__resume-copy'>{paidNotice.body}</Text>
        </>
      ) : (
        <View className='pool-reg__resume-notice'>
          <View className='pool-reg__resume-check' aria-hidden='true' />
          <Text className='pool-reg__resume-notice-text'>{UNPAID_NOTICE}</Text>
        </View>
      )}
      <View className='pool-reg__resume-pills'>
        {selectedBudget ? <Text className='pool-reg__resume-pill'>{selectedBudget}</Text> : null}
        {intentCount > 0 ? <Text className='pool-reg__resume-pill'>{intentCount} 个期待</Text> : null}
        <Text className='pool-reg__resume-pill'>{eventType}</Text>
      </View>
    </Card>
  )
}
