import { useMemo } from 'react'
import BaseFlow, { type ProductFlowScene } from './BaseFlow'
import {
  BlindBoxVisual,
  MatchingEngineVisual,
  OfflineJourneyVisual,
  PeopleJourneyVisual,
  RevealVisual,
  StoryVisual,
} from './FlowVisuals'
import { markFlowSeen } from './FlowStorage'

interface BlindBoxFlowProps {
  userId?: string | null
  onComplete: () => void
}

export default function BlindBoxFlow({ userId, onComplete }: BlindBoxFlowProps) {
  const scenes = useMemo<readonly ProductFlowScene[]>(() => [
    {
      id: 'registered',
      kicker: '报名成功',
      title: '你的城市体验即将开始',
      copy: '这不是一张普通报名凭证，而是一段体验生成过程的起点。',
      visual: <BlindBoxVisual />,
    },
    {
      id: 'matching',
      kicker: 'AI 理解与匹配',
      title: '生成适合你的体验组合',
      copy: '兴趣、偏好、时间、地点与活动期待，会一起进入匹配。',
      visual: <MatchingEngineVisual />,
    },
    {
      id: 'group',
      kicker: '体验伙伴形成',
      title: '找到适合一起体验的人',
      copy: 'AI 会综合每个人的节奏与期待，形成更合拍的活动组合。',
      visual: <PeopleJourneyVisual lifecycle />,
    },
    {
      id: 'reveal',
      kicker: '活动逐步揭晓',
      title: '时间、场景与主题就位',
      copy: '匹配完成后，活动信息与体验伙伴会在合适的时间向你展开。',
      visual: <RevealVisual />,
    },
    {
      id: 'offline',
      kicker: '走进真实城市',
      title: '抵达，体验，完成',
      copy: '从线上生成到线下发生，让一次选择真正成为城市体验。',
      visual: <OfflineJourneyVisual />,
    },
    {
      id: 'story',
      kicker: '体验继续生长',
      title: '每一次体验，都会成为你的城市故事',
      copy: '故事、装备与足迹，会记录你在城市里的每一次出发。',
      visual: <StoryVisual />,
      durationMs: 3200,
    },
  ], [])

  return (
    <BaseFlow
      ariaLabel='正式盲盒活动生命周期介绍'
      scenes={scenes}
      onFinish={() => {
        markFlowSeen('blind-box-lifecycle', userId)
        onComplete()
      }}
    />
  )
}
