import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { haptics } from '../../../lib/utils/haptics'

export interface AtuanArrivalAssets {
  scene: string
  character: string
  bag: string
}

type Detail = 'atuan' | 'bag' | null
type Stage = 'explore' | 'wind' | 'choice'

export function AtuanArrivalPrelude({
  assets,
  onSpeechChange,
  onBeginConversation,
}: {
  assets: AtuanArrivalAssets
  onSpeechChange: (speech: string) => void
  onBeginConversation: (approachIndex: number, label: string) => void
}) {
  const [atuanSeen, setAtuanSeen] = useState(false)
  const [bagSeen, setBagSeen] = useState(false)
  const [detail, setDetail] = useState<Detail>(null)
  const [stage, setStage] = useState<Stage>('explore')
  const [assetFailed, setAssetFailed] = useState(false)

  const markAssetFailed = () => setAssetFailed(true)

  const inspect = (target: Exclude<Detail, null>) => {
    if (stage !== 'explore' || detail) return
    haptics('light')
    if (target === 'atuan') setAtuanSeen(true)
    else setBagSeen(true)
    setDetail(target)
  }

  const closeDetail = () => {
    if (!detail) return
    const completedBoth = (detail === 'atuan' ? true : atuanSeen) && (detail === 'bag' ? true : bagSeen)
    setDetail(null)
    if (completedBoth) {
      haptics('medium')
      setStage('wind')
    }
  }

  const catchCard = () => {
    if (stage !== 'wind') return
    haptics('medium')
    onSpeechChange('')
    setStage('choice')
  }

  return (
    <View className={`atuan-arrival atuan-arrival--${stage}`} data-testid='atuan-arrival-prelude'>
      <Image className='atuan-arrival__scene' src={assets.scene} mode='aspectFill' aria-hidden='true' onError={markAssetFailed} />
      {assetFailed ? (
        <View className='atuan-arrival__asset-fallback' role='status' aria-live='polite'>
          <Text className='atuan-arrival__asset-fallback-title'>场景图片暂未加载</Text>
          <Text className='atuan-arrival__asset-fallback-detail'>你仍然可以查看阿团和纸袋，故事不会中断。</Text>
        </View>
      ) : null}
      {stage === 'explore' && !atuanSeen ? (
        <>
          <Image className='atuan-arrival__cutout atuan-arrival__cutout--atuan' src={assets.character} mode='aspectFill' aria-hidden='true' onError={markAssetFailed} />
          <View className='atuan-arrival__atuan-highlight' hoverClass='atuan-arrival__highlight--pressed' onClick={() => inspect('atuan')} role='button' aria-label='查看站在长椅旁的阿团'>
            {assetFailed ? <Text className='atuan-arrival__fallback-hotspot-label'>查看阿团</Text> : null}
          </View>
        </>
      ) : null}

      {stage === 'explore' && !bagSeen ? (
        <>
          <Image className='atuan-arrival__cutout atuan-arrival__cutout--bag' src={assets.bag} mode='aspectFill' aria-hidden='true' onError={markAssetFailed} />
          <View className='atuan-arrival__bag-highlight' hoverClass='atuan-arrival__highlight--pressed' onClick={() => inspect('bag')} role='button' aria-label='查看长椅上的纸袋'>
            {assetFailed ? <Text className='atuan-arrival__fallback-hotspot-label'>查看纸袋</Text> : null}
          </View>
        </>
      ) : null}

      {detail === 'atuan' ? (
        <View className='atuan-arrival__detail atuan-arrival__detail--atuan' hoverClass='atuan-arrival__detail--pressed' onClick={closeDetail} role='button' aria-label='阿团一直看着公园入口，点击回到现场'>
          <View className='atuan-arrival__detail-shade' />
          <Image className='atuan-arrival__detail-character' src={assets.character} mode='aspectFill' aria-hidden='true' onError={markAssetFailed} />
          <View className='atuan-arrival__entrance-light atuan-arrival__entrance-light--one' />
          <View className='atuan-arrival__entrance-light atuan-arrival__entrance-light--two' />
          <View className='atuan-arrival__entrance-light atuan-arrival__entrance-light--three' />
        </View>
      ) : null}

      {detail === 'bag' ? (
        <View className='atuan-arrival__detail atuan-arrival__detail--bag' hoverClass='atuan-arrival__detail--pressed' onClick={closeDetail} role='button' aria-label='纸袋里装着五张没有送出去的卡，点击回到现场'>
          <View className='atuan-arrival__detail-shade' />
          <View className='atuan-arrival__bag-closeup'>
            <View className='atuan-arrival__bag-paper' />
            {[0, 1, 2, 3, 4].map((index) => (
              <View key={index} className={`atuan-arrival__peek-card atuan-arrival__peek-card--${index + 1}`}>
                <View className='atuan-arrival__peek-stamp' />
                <View className='atuan-arrival__peek-rule' />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {stage === 'wind' ? (
        <View className='atuan-arrival__wind-event'>
          <View className='atuan-arrival__wind-ribbon atuan-arrival__wind-ribbon--one' />
          <View className='atuan-arrival__wind-ribbon atuan-arrival__wind-ribbon--two' />
          <View className='atuan-arrival__loose-card' hoverClass='atuan-arrival__loose-card--pressed' onClick={catchCard} role='button' aria-label='接住被风掀起的卡片'>
            <View className='atuan-arrival__loose-card-stamp' />
            <View className='atuan-arrival__loose-card-rule' />
          </View>
        </View>
      ) : null}

      {stage === 'choice' ? (
        <View className='atuan-arrival__action-cards' aria-label='选择你的现场动作'>
          <View className='atuan-arrival__action-card atuan-arrival__action-card--catch' hoverClass='atuan-arrival__action-card--pressed' onClick={() => onBeginConversation(0, '先接住飞出的卡。')} role='button' aria-label='先接住飞出的卡'>
            <View className='atuan-arrival__action-card-visual'><View className='atuan-arrival__action-mini-card' /></View>
            <Text className='atuan-arrival__action-card-text'>先接住飞出的卡</Text>
          </View>
          <View className='atuan-arrival__action-card atuan-arrival__action-card--bag' hoverClass='atuan-arrival__action-card--pressed' onClick={() => onBeginConversation(1, '先压住纸袋。')} role='button' aria-label='先压住纸袋'>
            <View className='atuan-arrival__action-card-visual'><View className='atuan-arrival__action-bag-mark' /></View>
            <Text className='atuan-arrival__action-card-text'>先压住纸袋</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
