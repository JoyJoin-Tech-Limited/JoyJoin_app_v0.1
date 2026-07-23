import { Text, View } from '@tarojs/components'
import AnimatedPath from './AnimatedPath'
import FlowNode from './FlowNode'
import ParticleEffect from './ParticleEffect'

// prefers-reduced-motion is centralized in index.scss so every visual remains readable while static.
const USER_SIGNALS = ['兴趣偏好', '时间', '地点', '探索需求', '体验倾向'] as const
const MATCH_SIGNALS = ['兴趣', '偏好', '时间', '地点', '活动需求'] as const

export function UserUnderstandingVisual() {
  return (
    <View className='flow-visual flow-visual--engine'>
      <ParticleEffect labels={USER_SIGNALS} />
      <FlowNode label='JoyJoin' detail='AI 体验引擎' />
      <Text className='flow-visual__result'>用户画像正在形成</Text>
    </View>
  )
}

export function DualExperienceVisual() {
  return (
    <View className='flow-visual flow-visual--dual'>
      <FlowNode label='AI 体验引擎' compact />
      <View className='flow-visual__branches'>
        <AnimatedPath direction='branch-left' />
        <AnimatedPath direction='branch-right' />
      </View>
      <View className='flow-visual__pair'>
        <FlowNode label='街头盲盒' detail='人 × 城市' accent='blue' />
        <FlowNode label='正式盲盒活动' detail='人 × 人' accent='coral' />
      </View>
    </View>
  )
}

export function CityJourneyVisual() {
  const stages = ['城市场景', '即时事件', '探索任务', '个人故事']
  return (
    <View className='flow-visual flow-visual--journey'>
      <View className='flow-map'>
        <View className='flow-map__road flow-map__road--one' />
        <View className='flow-map__road flow-map__road--two' />
        {stages.map((stage, index) => (
          <View key={stage} className={`flow-map__stop flow-map__stop--${index + 1}`}>
            <View className='flow-map__pin' />
            <Text className='flow-map__label'>{stage}</Text>
          </View>
        ))}
      </View>
      <Text className='flow-visual__guide'>阿浪 · 城市体验引导角色</Text>
    </View>
  )
}

export function PeopleJourneyVisual({ lifecycle = false }: { lifecycle?: boolean }) {
  const labels = lifecycle
    ? ['报名', '理解', '匹配', '组成', '体验', '故事']
    : ['报名活动', 'AI 理解', '智能匹配', '线下体验']
  return (
    <View className='flow-visual flow-visual--people'>
      <View className='flow-people'>
        {labels.map((label, index) => (
          <View key={label} className='flow-people__step'>
            <View className={`flow-people__avatar flow-people__avatar--${(index % 4) + 1}`} />
            <Text className='flow-people__label'>{label}</Text>
            {index < labels.length - 1 ? <AnimatedPath /> : null}
          </View>
        ))}
      </View>
    </View>
  )
}

export function EcosystemVisual() {
  return (
    <View className='flow-visual flow-visual--ecosystem'>
      <FlowNode label='街头盲盒' detail='城市探索' accent='blue' compact />
      <AnimatedPath />
      <FlowNode label='JoyJoin' detail='城市体验生态' />
      <AnimatedPath />
      <FlowNode label='正式盲盒活动' detail='智能匹配' accent='coral' compact />
    </View>
  )
}

export function BlindBoxVisual() {
  return (
    <View className='flow-visual flow-visual--box'>
      <View className='flow-box'>
        <View className='flow-box__lid' />
        <View className='flow-box__glow' />
        <View className='flow-box__body'>
          <Text className='flow-box__mark'>J</Text>
        </View>
      </View>
    </View>
  )
}

export function MatchingEngineVisual() {
  return (
    <View className='flow-visual flow-visual--engine'>
      <ParticleEffect labels={MATCH_SIGNALS} />
      <FlowNode label='AI 匹配中' detail='生成体验组合' />
    </View>
  )
}

export function RevealVisual() {
  return (
    <View className='flow-visual flow-visual--reveal'>
      {['活动时间', '活动地点', '活动主题', '活动成员'].map((item, index) => (
        <View key={item} className={`flow-reveal-card flow-reveal-card--${index + 1}`}>
          <View className='flow-reveal-card__dot' />
          <Text>{item}</Text>
        </View>
      ))}
    </View>
  )
}

export function OfflineJourneyVisual() {
  return (
    <View className='flow-visual flow-visual--offline'>
      {['抵达现场', '开始体验', '完成活动'].map((item, index) => (
        <View key={item} className='flow-offline-step'>
          <View className='flow-offline-step__ring'><View className='flow-offline-step__core' /></View>
          <Text>{item}</Text>
          {index < 2 ? <AnimatedPath /> : null}
        </View>
      ))}
    </View>
  )
}

export function StoryVisual() {
  return (
    <View className='flow-visual flow-visual--story'>
      {['我的故事', '我的装备', '我的足迹'].map((item, index) => (
        <View key={item} className={`flow-story-card flow-story-card--${index + 1}`}>
          <View className='flow-story-card__line' />
          <Text>{item}</Text>
        </View>
      ))}
    </View>
  )
}
