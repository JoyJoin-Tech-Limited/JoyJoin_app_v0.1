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
    title: '正式盲盒活动',
    headline: 'AI 先懂你，再为相遇找线索',
    description: '把合拍的人，带进同一场城市体验',
    icon: 'formal-blind-box',
    closingCopy: '每一次相遇，都会沉淀为你的城市故事',
    steps: [
      { id: 'discover', title: '发现活动', description: '从城市里，挑一场值得出发的体验', icon: 'activity-discovery', accent: 'human' },
      { id: 'register', title: '报名参与', description: '留下偏好，让这次相遇更懂你', icon: 'activity-ticket', accent: 'human' },
      { id: 'match', title: 'AI 智能匹配', description: '不靠随机拼桌，让每次组合都有依据', icon: 'ai-match', accent: 'brand' },
      { id: 'offline', title: '共同线下体验', description: '从线上理解，走到一次真实见面', icon: 'offline-experience', accent: 'story' },
    ],
  },
  {
    id: 'street',
    eyebrow: '人与城市',
    title: '街头盲盒',
    headline: '让 AI 帮你听见城市的暗号',
    description: '不用做攻略，也能撞见计划外的惊喜',
    icon: 'street-blind-box',
    closingCopy: '从熟悉的街道，发现未曾注意的城市体验',
    steps: [
      { id: 'clue', title: '发现城市线索', description: 'AI 从附近，找出此刻值得靠近的线索', icon: 'explore-location', accent: 'city' },
      { id: 'task', title: '开启即时任务', description: '不用先做攻略，一条线索就能出发', icon: 'street-task', accent: 'brand' },
      { id: 'explore', title: '完成城市探索', description: '把熟悉的街道，走出一点新鲜感', icon: 'city-exploration', accent: 'city' },
      { id: 'story', title: '收集个人故事', description: '惊喜不会散场，它会留进你的故事', icon: 'city-story', accent: 'story' },
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
