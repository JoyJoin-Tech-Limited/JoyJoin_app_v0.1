import { useMemo } from 'react'
import BaseFlow, { type ProductFlowScene } from './BaseFlow'
import {
  CityJourneyVisual,
  DualExperienceVisual,
  EcosystemVisual,
  PeopleJourneyVisual,
  UserUnderstandingVisual,
} from './FlowVisuals'
import { markFlowSeen } from './FlowStorage'

interface JoyJoinIntroFlowProps {
  userId?: string | null
  onComplete: () => void
}

export default function JoyJoinIntroFlow({ userId, onComplete }: JoyJoinIntroFlowProps) {
  const scenes = useMemo<readonly ProductFlowScene[]>(() => [
    {
      id: 'understand',
      kicker: '先理解，再出发',
      title: '理解每一次出发的原因',
      copy: '兴趣、时间、地点与探索期待，会一起形成属于你的体验画像。',
      visual: <UserUnderstandingVisual />,
    },
    {
      id: 'two-experiences',
      kicker: '一套 AI 引擎',
      title: '两种城市体验',
      copy: '向城市深处探索，也找到适合一起体验的人。',
      visual: <DualExperienceVisual />,
    },
    {
      id: 'city',
      kicker: '街头盲盒 · 人 × 城市',
      title: '让城市给你一个惊喜',
      copy: '随时探索城市场景，完成即时体验，把沿途发现写进个人故事。',
      visual: <CityJourneyVisual />,
    },
    {
      id: 'people',
      kicker: '正式盲盒活动 · 人 × 人',
      title: '找到适合一起体验的人',
      copy: 'AI 理解每个人的偏好与节奏，再组成值得出发的线下体验。',
      visual: <PeopleJourneyVisual />,
    },
    {
      id: 'ecosystem',
      kicker: 'JoyJoin 城市体验生态',
      title: '理解用户，理解场景',
      copy: '生成下一次值得出发的体验。',
      visual: <EcosystemVisual />,
      durationMs: 3200,
    },
  ], [])

  return (
    <BaseFlow
      ariaLabel='JoyJoin 玩法介绍'
      scenes={scenes}
      onFinish={() => {
        markFlowSeen('joyjoin-intro', userId)
        onComplete()
      }}
    />
  )
}
