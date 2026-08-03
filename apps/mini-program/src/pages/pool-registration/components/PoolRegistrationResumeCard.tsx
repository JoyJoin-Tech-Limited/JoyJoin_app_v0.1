import { View, Text } from '@tarojs/components'
import Card from '../../../components/ui/Card'
import type { MiniProgramPoolRegistrationReturnContext } from '../../../lib/payment/paymentPendingOrder'

function getResumeNoticeCopy(
  context: MiniProgramPoolRegistrationReturnContext,
): { kicker: string; title: string; body: string } {
  if (context.paymentStatus === 'paid') {
    return {
      kicker: '权益已到账',
      title: '刚才那份报名偏好已经替你接回来',
      body: '预算、期待和细节都已恢复，现在点下方按钮就能继续完成这场报名。',
    }
  }

  return {
    kicker: context.handoffCode === 'NO_AVAILABLE_EVENT_PACK_CREDITS' ? '次数已用完' : '偏好已保留',
    title: '先开通权益，再回来继续报名',
    body: '你刚填写的预算和偏好不会丢，完成支付确认后会自动回到这里继续。',
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
  const notice = getResumeNoticeCopy(context)

  return (
    <Card
      className={[
        'pool-reg__resume-card',
        context.paymentStatus === 'paid' ? 'pool-reg__resume-card--paid' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Text className='pool-reg__resume-kicker'>{notice.kicker}</Text>
      <Text className='pool-reg__resume-title'>{notice.title}</Text>
      <Text className='pool-reg__resume-copy'>{notice.body}</Text>
      <View className='pool-reg__resume-pills'>
        {selectedBudget ? <Text className='pool-reg__resume-pill'>{selectedBudget}</Text> : null}
        {intentCount > 0 ? <Text className='pool-reg__resume-pill'>{intentCount} 个期待</Text> : null}
        <Text className='pool-reg__resume-pill'>{eventType}</Text>
      </View>
    </Card>
  )
}
