import Taro, { useRouter } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import {
  ATUAN_FIRST_ACT_CARDS,
  type AtuanFirstActCardDestinationId,
  type AtuanFirstActCardPlacement,
} from '@shared/alang/atuanFirstAct'
import './index.scss'

const DESTINATIONS: Array<{ id: AtuanFirstActCardDestinationId; label: string; icon: string }> = [
  { id: 'keep', label: '可以一起记住', icon: 'spark' },
  { id: 'return', label: '只留给卡上的人', icon: 'letter' },
  { id: 'cover', label: '先替他遮住', icon: 'cover' },
]

const FEEDBACK: Record<AtuanFirstActCardDestinationId, string> = {
  keep: '“好。能让人觉得被记住，又不会让他不自在的事，可以留下。”',
  return: '“那就装进信封，只交给卡上的人。别人不需要替他读完。”',
  cover: '“嗯，先盖住。等我问过他，再决定这句话该不该留下。”',
}

export default function AtuanCardsPage() {
  const { params } = useRouter()
  const storageKey = decodeURIComponent(params.key ?? '')
  const approach = params.approach === 'notice_wait' ? 'notice_wait' : 'notice_again'
  const orderedCards = useMemo(
    () => approach === 'notice_wait' ? [...ATUAN_FIRST_ACT_CARDS] : [...ATUAN_FIRST_ACT_CARDS].reverse(),
    [approach],
  )
  const [index, setIndex] = useState(0)
  const [placements, setPlacements] = useState<AtuanFirstActCardPlacement[]>([])
  const [pending, setPending] = useState<AtuanFirstActCardPlacement | null>(null)
  const card = orderedCards[index]

  const place = (destinationId: AtuanFirstActCardDestinationId) => {
    if (!card || pending) return
    setPending({ cardId: card.id, destinationId })
  }

  const continueSorting = () => {
    if (!pending) return
    const next = [...placements, pending]
    if (next.length === orderedCards.length) {
      Taro.setStorageSync(storageKey, next)
      void Taro.navigateBack()
      return
    }
    setPlacements(next)
    setPending(null)
    setIndex((current) => current + 1)
  }

  return (
    <View className='atuan-cards'>
      <View>
        <Text className='atuan-cards__eyebrow'>阿团的小纸袋</Text>
        <Text className='atuan-cards__title'>替卡片找个舒服的位置</Text>
        <Text className='atuan-cards__copy'>不是猜标准答案。你在决定：这句话可以被谁看见。</Text>
      </View>

      <View className='atuan-cards__progress' aria-label={`已整理 ${placements.length} 张，共 ${orderedCards.length} 张`}>
        {orderedCards.map((item, cardIndex) => <View key={item.id} className={`atuan-cards__progress-dot${cardIndex <= index ? ' atuan-cards__progress-dot--active' : ''}`} />)}
      </View>

      {card ? (
        <View className='atuan-cards__card'>
          <View className='atuan-cards__card-string' />
          <Text className='atuan-cards__card-count'>{index + 1} / {orderedCards.length}</Text>
          <Text className='atuan-cards__card-copy'>{card.label}</Text>
        </View>
      ) : null}

      {pending ? (
        <View className='atuan-cards__feedback' role='status' aria-live='polite'>
          <Text className='atuan-cards__feedback-name'>阿团</Text>
          <Text className='atuan-cards__feedback-copy'>{FEEDBACK[pending.destinationId]}</Text>
          <View className='atuan-cards__continue' role='button' aria-label={index === orderedCards.length - 1 ? '收好最后一张' : '继续整理'} onClick={continueSorting}>
            <Text>{index === orderedCards.length - 1 ? '收好最后一张' : '继续整理'}</Text>
          </View>
        </View>
      ) : (
        <View className='atuan-cards__destinations'>
          {DESTINATIONS.map((destination) => (
            <View key={destination.id} className='atuan-cards__destination' hoverClass='atuan-cards__destination--pressed' role='button' aria-label={destination.label} onClick={() => place(destination.id)}>
              <View className={`atuan-cards__icon atuan-cards__icon--${destination.icon}`} aria-hidden='true'><View className='atuan-cards__icon-shape' /></View>
              <Text>{destination.label}</Text>
            </View>
          ))}
        </View>
      )}

      <Text className='atuan-cards__atuan-copy'>{approach === 'notice_wait' ? '“刚才那张是你接住的。我们最后看它。”' : '“纸袋里的短线你看见了。帮我再数一次。”'}</Text>
    </View>
  )
}
