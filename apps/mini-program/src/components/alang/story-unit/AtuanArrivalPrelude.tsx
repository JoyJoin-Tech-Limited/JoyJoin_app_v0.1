import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { haptics } from '../../../lib/utils/haptics'

export interface AtuanArrivalAssets {
  scene: string
  character: string
  bag: string
}

type SceneTarget = 'atuan' | 'bench' | 'lamp'
type Detail = SceneTarget | 'letter' | null
type Stage = 'scene' | 'letter' | 'wind' | 'choice'

const SCENE_TARGETS: ReadonlyArray<{
  id: SceneTarget
  label: string
  clue: string
}> = [
  {
    id: 'atuan',
    label: '阿团',
    clue: '阿团没有看纸袋。他的目光一直落在公园入口，像是在等谁。',
  },
  {
    id: 'bench',
    label: '长椅',
    clue: '长椅边缘压着一道新折痕，像有人刚把东西匆忙放下。',
  },
  {
    id: 'lamp',
    label: '路灯',
    clue: '路灯已经亮了。风正从灯杆的方向穿过长椅。',
  },
]

const EMPTY_SEEN: Record<SceneTarget, boolean> = {
  atuan: false,
  bench: false,
  lamp: false,
}

export function AtuanArrivalPrelude({
  assets,
  onBeginConversation,
}: {
  assets: AtuanArrivalAssets
  onBeginConversation: (approachIndex: number, label: string) => void
}) {
  const [seen, setSeen] = useState(EMPTY_SEEN)
  const [detail, setDetail] = useState<Detail>(null)
  const [stage, setStage] = useState<Stage>('scene')
  const exploredCount = SCENE_TARGETS.filter((target) => seen[target.id]).length

  const inspectSceneTarget = (target: SceneTarget) => {
    if (stage !== 'scene' || detail) return
    haptics('light')
    setSeen((current) => ({ ...current, [target]: true }))
    setDetail(target)
  }

  const inspectLetter = () => {
    if (stage !== 'letter' || detail) return
    haptics('light')
    setDetail('letter')
  }

  const closeDetail = () => {
    if (!detail) return
    const inspectedDetail = detail
    setDetail(null)

    if (inspectedDetail === 'letter') {
      haptics('medium')
      setStage('wind')
      return
    }

    const completedScene = SCENE_TARGETS.every((target) => (
      target.id === inspectedDetail ? true : seen[target.id]
    ))
    if (completedScene) {
      haptics('medium')
      setStage('letter')
    }
  }

  const catchCard = () => {
    if (stage !== 'wind') return
    haptics('medium')
    setStage('choice')
  }

  const detailTarget = detail && detail !== 'letter'
    ? SCENE_TARGETS.find((target) => target.id === detail)
    : null

  return (
    <View className={`atuan-arrival atuan-arrival--${stage}`} data-testid='atuan-arrival-prelude'>
      <Image className='atuan-arrival__scene' src={assets.scene} mode='aspectFill' aria-hidden='true' />
      <View className='atuan-arrival__scene-grade' aria-hidden='true' />

      <Image
        className='atuan-arrival__cutout atuan-arrival__cutout--atuan'
        src={assets.character}
        mode='aspectFill'
        aria-hidden='true'
        data-testid='atuan-scene-character'
      />

      {stage !== 'scene' ? (
        <Image
          className='atuan-arrival__cutout atuan-arrival__cutout--bag'
          src={assets.bag}
          mode='aspectFill'
          aria-hidden='true'
        />
      ) : null}

      {stage === 'scene' ? (
        <>
          <View className='atuan-arrival__progress' role='status' aria-live='polite'>
            <Text className='atuan-arrival__progress-label'>探索现场</Text>
            <Text className='atuan-arrival__progress-count'>{exploredCount}/3</Text>
          </View>
          {SCENE_TARGETS.map((target) => (
            <View
              key={target.id}
              className={`atuan-arrival__scene-target atuan-arrival__scene-target--${target.id}${seen[target.id] ? ' atuan-arrival__scene-target--seen' : ''}`}
              hoverClass='atuan-arrival__scene-target--pressed'
              onClick={() => inspectSceneTarget(target.id)}
              role='button'
              aria-label={`${seen[target.id] ? '再次查看' : '查看'}${target.label}`}
            >
              <View className='atuan-arrival__target-marker' aria-hidden='true'>
                <View className='atuan-arrival__target-core' />
              </View>
              <Text className='atuan-arrival__target-label'>{seen[target.id] ? `已看 · ${target.label}` : target.label}</Text>
            </View>
          ))}
        </>
      ) : null}

      {stage === 'letter' && !detail ? (
        <>
          <View className='atuan-arrival__unlock-note' role='status' aria-live='polite'>
            <Text className='atuan-arrival__unlock-kicker'>三处线索已找到</Text>
            <Text className='atuan-arrival__unlock-copy'>长椅下，露出一只没有封口的信封。</Text>
          </View>
          <View
            className='atuan-arrival__letter-target'
            hoverClass='atuan-arrival__letter-target--pressed'
            onClick={inspectLetter}
            role='button'
            aria-label='查看新出现的信封'
          >
            <View className='atuan-arrival__target-marker atuan-arrival__target-marker--letter' aria-hidden='true'>
              <View className='atuan-arrival__target-core' />
            </View>
            <Text className='atuan-arrival__target-label'>新线索 · 信封</Text>
          </View>
        </>
      ) : null}

      {detailTarget ? (
        <View
          className={`atuan-arrival__clue atuan-arrival__clue--${detailTarget.id}`}
          hoverClass='atuan-arrival__clue--pressed'
          onClick={closeDetail}
          role='button'
          aria-label={`收下${detailTarget.label}的线索，回到现场`}
        >
          <Text className='atuan-arrival__clue-kicker'>现场线索 · {exploredCount}/3</Text>
          <Text className='atuan-arrival__clue-title'>{detailTarget.label}</Text>
          <Text className='atuan-arrival__clue-copy'>{detailTarget.clue}</Text>
          <Text className='atuan-arrival__clue-action'>轻触回到现场</Text>
        </View>
      ) : null}

      {detail === 'letter' ? (
        <View
          className='atuan-arrival__clue'
          hoverClass='atuan-arrival__clue--pressed'
          onClick={closeDetail}
          role='button'
          aria-label='收下信封线索，回到现场'
        >
          <Text className='atuan-arrival__clue-kicker'>第二层 · 信封</Text>
          <Text className='atuan-arrival__clue-title'>五张没有送出的观察卡</Text>
          <Text className='atuan-arrival__clue-copy'>信封没有封口。五张卡叠在一起，最上面那张写着一个熟悉的名字。</Text>
          <Text className='atuan-arrival__clue-action'>轻触收下线索</Text>
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
        <View className='atuan-arrival__action-sheet' aria-label='选择你的现场动作'>
          <Text className='atuan-arrival__action-prompt'>风突然大了，先护住哪边？</Text>
          <View className='atuan-arrival__action-cards'>
            <View className='atuan-arrival__action-card atuan-arrival__action-card--catch' hoverClass='atuan-arrival__action-card--pressed' onClick={() => onBeginConversation(0, '接住卡片')} role='button' aria-label='接住卡片'>
              <View className='atuan-arrival__action-card-visual'><View className='atuan-arrival__action-mini-card' /></View>
              <View className='atuan-arrival__action-card-copy'>
                <Text className='atuan-arrival__action-card-text'>接住卡片</Text>
                <Text className='atuan-arrival__action-card-hint'>别让它被风带走</Text>
              </View>
              <Text className='atuan-arrival__action-card-arrow' aria-hidden='true'>›</Text>
            </View>
            <View className='atuan-arrival__action-card atuan-arrival__action-card--bag' hoverClass='atuan-arrival__action-card--pressed' onClick={() => onBeginConversation(1, '护住纸袋')} role='button' aria-label='护住纸袋'>
              <View className='atuan-arrival__action-card-visual'><View className='atuan-arrival__action-bag-mark' /></View>
              <View className='atuan-arrival__action-card-copy'>
                <Text className='atuan-arrival__action-card-text'>护住纸袋</Text>
                <Text className='atuan-arrival__action-card-hint'>先稳住剩下的卡片</Text>
              </View>
              <Text className='atuan-arrival__action-card-arrow' aria-hidden='true'>›</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
