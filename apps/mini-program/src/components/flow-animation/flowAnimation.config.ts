import type { ExperienceDefinition, FlowStepDefinition } from './flowAnimation.types'

export const FLOW_ANIMATION_TIMING = {
  experienceRevealMs: 1_350,
  lifecycleMs: 9_600,
  progressTickMs: 80,
} as const

export const EXPERIENCE_DEFINITIONS: readonly ExperienceDefinition[] = [
  {
    id: 'event',
    eyebrow: '人与人',
    title: '盲盒活动',
    headline: '不是随机拼桌，是认真组一支合拍的小队',
    description: '你挑活动，我们参考彼此的偏好组成小组',
    icon: 'formal-blind-box',
    closingCopy: '先有一件共同想做的事，认识彼此就自然多了',
    steps: [
      { id: 'discover', title: '挑一场想参加的', description: '先从你真正感兴趣的活动开始', icon: 'activity-discovery', accent: 'human' },
      { id: 'register', title: '告诉我们你的偏好', description: '时间、兴趣和相处节奏，都会参与组队', icon: 'activity-ticket', accent: 'human' },
      { id: 'match', title: '组成活动小组', description: '在活动规则内，把更合拍的人安排到一起', icon: 'ai-match', accent: 'brand' },
      { id: 'offline', title: '到现场一起体验', description: '不用硬找话题，先一起把活动玩起来', icon: 'offline-experience', accent: 'story' },
    ],
  },
  {
    id: 'street',
    eyebrow: '人与城市',
    title: '街头盲盒',
    headline: '临时想出门，城市也有现成的玩法',
    description: '从一条此刻可开启的线索出发，边走边发现',
    icon: 'street-blind-box',
    closingCopy: '不用等周末，也不用约齐人。想出门时，就换一种方式打开城市',
    steps: [
      { id: 'clue', title: '看看今天有什么', description: '从此刻可开启的城市线索里，挑一个顺眼的', icon: 'explore-location', accent: 'city' },
      { id: 'task', title: '接到一件小任务', description: '不必准备很久，照着提示就能开始', icon: 'street-task', accent: 'brand' },
      { id: 'explore', title: '边走边发现', description: '路程不必很远，也能重新看看熟悉的街道', icon: 'city-exploration', accent: 'city' },
      { id: 'story', title: '留下这次发现', description: '完成之后，把这段经历收进你的城市故事', icon: 'city-story', accent: 'story' },
    ],
  },
] as const

export const LIFECYCLE_STEPS: readonly FlowStepDefinition[] = [
  { id: 'registered', title: '报名成功', description: '名额已经锁定，这次出发开始有了形状', icon: 'activity-ticket', accent: 'brand' },
  { id: 'matching', title: 'AI 匹配', description: '活动条件、你的偏好与现场节奏，一起进入匹配', icon: 'ai-match', accent: 'brand' },
  { id: 'grouped', title: '小组形成', description: '合适的人逐渐靠近，一场共同体验正在成形', icon: 'group-formed', accent: 'brand' },
  { id: 'revealed', title: '活动揭晓', description: '时间、地点和出发提示，会在准备好后揭晓', icon: 'activity-reveal', accent: 'city' },
  { id: 'offline', title: '线下体验', description: '从屏幕走进城市，和新伙伴完成一次真实见面', icon: 'offline-experience', accent: 'city' },
  { id: 'story', title: '我的故事', description: '见过的人、走过的地方，会沉淀为城市记忆', icon: 'city-story', accent: 'story' },
] as const
