import { View, Text } from '@tarojs/components'
import Card from '../../../components/ui/Card'
import type { MiniProgramPoolRegistrationReturnContext } from '../../../lib/payment/paymentPendingOrder'

interface ResumeNoticeCopy {
  kicker: string
  title: string
  body: string
}

function getPaidNoticeCopy(): ResumeNoticeCopy {
  return {
    kicker: '支付已确认',
    title: '接着完成报名，不会重复扣款',
    body: '预算、期待和细节已恢复。服务端已确认这笔支付，继续只完成报名。',
  }
}

function getPaymentRequiredNoticeCopy(): ResumeNoticeCopy {
  return {
    kicker: '支付待完成',
    title: '报名选择已替你保留',
    body: '还未确认支付，预算、期待和细节都在。继续时会回到现有支付流程，由你确认下一步。',
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
  const notice = context.paymentStatus === 'paid'
    ? getPaidNoticeCopy()
    : getPaymentRequiredNoticeCopy()

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
