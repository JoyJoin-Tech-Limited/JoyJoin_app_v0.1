export const FLASH_STORY_UNIT_IDS = [
  's1-p1-alang', 's1-p1-lizi', 's1-p1-momo', 's1-p1-shiqi', 's1-p1-atuan',
  's1-p2-alang', 's1-p2-lizi', 's1-p2-momo', 's1-p2-shiqi', 's1-p2-atuan',
  's1-p3-alang', 's1-p3-lizi', 's1-p3-momo', 's1-p3-shiqi', 's1-p3-atuan',
] as const

export const FLASH_STORY_ANALYTICS_EVENTS = [
  'story_start',
  'object_interaction_start',
  'object_complete',
  'story_complete',
  'next_npc_click',
  'exit_before_complete',
] as const

export type FlashStoryUnitId = typeof FLASH_STORY_UNIT_IDS[number]
export type FlashStoryAnalyticsEvent = typeof FLASH_STORY_ANALYTICS_EVENTS[number]
export type FlashStoryNpcSlug = 'alang' | 'lizi' | 'momo' | 'shiqi' | 'atuan'
export type FlashStoryObjectCode = 'seat-plan' | 'dry-markers' | 'route-book' | 'outing-book' | 'observation-cards'
export type FlashStoryInteractionKind = 'spacing' | 'pairing' | 'path' | 'overlay' | 'privacy'

export interface FlashStoryUnitDefinition {
  unitId: FlashStoryUnitId
  npcSlug: FlashStoryNpcSlug
  phase: 1 | 2 | 3
  objectCode: FlashStoryObjectCode
  interactionKind: FlashStoryInteractionKind
  goal: string
  success: string
  firstMistake: string
}

export const FLASH_STORY_SEASON_UNITS: readonly FlashStoryUnitDefinition[] = [
  { unitId: 's1-p1-alang', npcSlug: 'alang', phase: 1, objectCode: 'seat-plan', interactionKind: 'spacing', goal: '移动两把椅子，留出图上刚好的并肩距离。', success: '座位之间的空隙和折痕对上了。', firstMistake: '不用挤在一起。给它们留一点能呼吸的距离。' },
  { unitId: 's1-p1-lizi', npcSlug: 'lizi', phase: 1, objectCode: 'dry-markers', interactionKind: 'pairing', goal: '试一笔，再把三只笔帽配回对应的笔身。', success: '三种颜色终于各自找回了名字。', firstMistake: '颜色没跑掉，再看一眼笔尖留下的那一小段。' },
  { unitId: 's1-p1-momo', npcSlug: 'momo', phase: 1, objectCode: 'route-book', interactionKind: 'path', goal: '沿着最后一条实线走，在空白页前停下。', success: '路线停在了故事真正断开的地方。', firstMistake: '先别翻到结尾。断点就在空白开始以前。' },
  { unitId: 's1-p1-shiqi', npcSlug: 'shiqi', phase: 1, objectCode: 'outing-book', interactionKind: 'overlay', goal: '拖动上层纸页，让三条路线贴回下层浅痕。', success: '三条路线重合了，方向完全一致。', firstMistake: '慢一点。纸没坏，线还在。' },
  { unitId: 's1-p1-atuan', npcSlug: 'atuan', phase: 1, objectCode: 'observation-cards', interactionKind: 'privacy', goal: '留下城市细节，把名字和具体时间盖住。', success: '能分享的细节留下了，个人边界也守住了。', firstMistake: '先别翻背面。能看见的部分已经够我们判断。' },
  { unitId: 's1-p2-alang', npcSlug: 'alang', phase: 2, objectCode: 'route-book', interactionKind: 'path', goal: '从旧路线的断点出发，接到阿浪认出的那一段。', success: '最后一条路线接回了阿浪走过的方向。', firstMistake: '别替它补一条新路。只接已经留下的线。' },
  { unitId: 's1-p2-lizi', npcSlug: 'lizi', phase: 2, objectCode: 'outing-book', interactionKind: 'overlay', goal: '对齐三层圈痕，找出栗子反复保留的那一项。', success: '重复的圈痕落在同一个小格里。', firstMistake: '别急着替我删。先看看我到底圈了几次。' },
  { unitId: 's1-p2-momo', npcSlug: 'momo', phase: 2, objectCode: 'dry-markers', interactionKind: 'pairing', goal: '按试写痕迹，把错配的笔帽一一换回来。', success: '笔帽归位，藏着的选择也变清楚了。', firstMistake: '不是看外壳。试写留下的颜色更诚实。' },
  { unitId: 's1-p2-shiqi', npcSlug: 'shiqi', phase: 2, objectCode: 'observation-cards', interactionKind: 'privacy', goal: '保留可分享的观察，把能追踪个人习惯的记录遮住。', success: '城市细节与个人时间被清楚分开。', firstMistake: '准确不等于可以保存。先找出哪一格属于别人。' },
  { unitId: 's1-p2-atuan', npcSlug: 'atuan', phase: 2, objectCode: 'seat-plan', interactionKind: 'spacing', goal: '转正图纸，再把两把椅子调到默默舒服的距离。', success: '这不是通用建议，而是为一个人反复改过的位置。', firstMistake: '先转回读图的方向。距离是从那边量的。' },
  { unitId: 's1-p3-alang', npcSlug: 'alang', phase: 3, objectCode: 'route-book', interactionKind: 'path', goal: '沿保留的旧路走完，再把空白页分出去。', success: '保留与归还终于落在两条清楚的路上。', firstMistake: '不用把所有路都带走。先分清哪一段属于谁。' },
  { unitId: 's1-p3-lizi', npcSlug: 'lizi', phase: 3, objectCode: 'outing-book', interactionKind: 'overlay', goal: '把完成标记贴到最小的那一格，不评价它够不够特别。', success: '第一格被认真标成了“发生过”。', firstMistake: '先记下做过，不用急着给这一天打分。' },
  { unitId: 's1-p3-momo', npcSlug: 'momo', phase: 3, objectCode: 'dry-markers', interactionKind: 'pairing', goal: '找出还能写的那支笔，把邀请的时间和方向写完整。', success: '迟到的邀请终于成为一句完整的话。', firstMistake: '不用替我措辞。帮我找到还能写的那支就好。' },
  { unitId: 's1-p3-shiqi', npcSlug: 'shiqi', phase: 3, objectCode: 'observation-cards', interactionKind: 'privacy', goal: '留下城市观察，永久盖住阿浪的固定活动时间。', success: '那条不该保留的时间记录不会再出现。', firstMistake: '城市可以被记住，人的规律不该被留下。' },
  { unitId: 's1-p3-atuan', npcSlug: 'atuan', phase: 3, objectCode: 'seat-plan', interactionKind: 'spacing', goal: '把两把椅子并排摆好，再为两边各留一个名字的位置。', success: '邀请被摆到桌面上，答案仍留给默默。', firstMistake: '不是替他选座位。只是把我的邀请说清楚。' },
] as const

const UNIT_BY_ID = new Map(FLASH_STORY_SEASON_UNITS.map((unit) => [unit.unitId, unit]))

export function isFlashStoryUnitId(value: string): value is FlashStoryUnitId {
  return UNIT_BY_ID.has(value as FlashStoryUnitId)
}

export function getFlashStoryUnitDefinition(value: string): FlashStoryUnitDefinition | null {
  return isFlashStoryUnitId(value) ? UNIT_BY_ID.get(value) ?? null : null
}

/**
 * Story episode v2 pilot whitelist. Only these units route through the v2
 * state-driven node engine; all other units keep the v1 flat-content +
 * dedicated-interaction path (FlashStoryUnit). Expanded after pilot QA.
 */
export const FLASH_V2_PILOT_UNIT_IDS: readonly string[] = [
  "s1-p1-alang",
  "s1-p2-alang",
  "s1-p3-alang",
  "s1-p1-shiqi",
  "s1-p3-shiqi",
]

export function isFlashV2PilotUnitId(value: string): boolean {
  return FLASH_V2_PILOT_UNIT_IDS.includes(value)
}
