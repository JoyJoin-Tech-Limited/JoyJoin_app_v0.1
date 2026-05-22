/**
 * Context-aware subtitle copy for the Discover page header.
 * Generates warm, personalized lines based on user state.
 */

interface DiscoverHeaderContext {
  displayName: string
  archetype?: string | null
  registrationCount: number
  openPoolCount: number
  hasMatchingResult?: boolean
}

const ARCHETYPE_TAGLINES: Record<string, string[]> = {
  corgi: ['一进场就把气氛带热', '有你在的局不会冷场'],
  rooster: ['情绪稳定，是局里的定心丸', '你的存在感让人安心'],
  hamster_praise: ['有你在的局不会冷场', '你的热情是局的催化剂'],
  fox: ['普通话题也能聊出火花', '你的好奇心会感染整桌人'],
  dolphin_calm: ['读空气的能力是稀有天赋', '你让每个人都感到被看见'],
  spider: ['社交裁缝的手艺该上场了', '你会把不同频率的人织在一起'],
  koala: ['你的倾听让对话有了深度', '朋友难过时总会想到你'],
  octopus: ['你的联想力是局的隐藏彩蛋', '换个角度，话题就有了新生命'],
  owl: ['追问的艺术你掌握得很好', '你会帮大家聊到真正的自己'],
  elephant: ['定海神针一插，局就稳了', '你的稳重是局的压舱石'],
  turtle: ['慢半拍是你的节奏', '不急着表态，反而更有分量'],
  cat: ['静音模式也有信号', '你的观察本身就是一种参与'],
}

const DEFAULT_TAGLINES = [
  '探索你的下一场悦聚',
  '找到聊得来的人，从一场小局开始',
  '氛围对味，话题自来',
]

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function getDiscoverSubtitle(ctx: DiscoverHeaderContext): string {
  const { archetype, registrationCount, openPoolCount } = ctx

  // User has active registrations — surface progress
  if (registrationCount > 0) {
    if (openPoolCount > 0) {
      return `你已报名 ${registrationCount} 场活动，还有 ${openPoolCount} 场新局在报名中`
    }
    return `你已报名 ${registrationCount} 场活动，成局结果即将揭晓`
  }

  // User has archetype but no registrations — encourage with archetype flavor
  if (archetype) {
    const lines = ARCHETYPE_TAGLINES[archetype] ?? DEFAULT_TAGLINES
    return getRandom(lines)
  }

  // No archetype — nudge toward personality test
  return '先完成氛围测试，解锁你的专属匹配'
}

export function getDiscoverActionLabel(ctx: DiscoverHeaderContext): {
  label: string
  emoji: string
  path: string
} | null {
  const { archetype, registrationCount } = ctx

  // No archetype → primary action is personality test
  if (!archetype) {
    return {
      label: '测测我的氛围原型',
      emoji: '🧩',
      path: '/pages/onboarding/personality-test/index',
    }
  }

  // Has registrations → show my events
  if (registrationCount > 0) {
    return {
      label: '查看我的报名',
      emoji: '📋',
      path: '/pages/events/index',
    }
  }

  // Has archetype, no registrations → no primary action needed
  // The pool cards ARE the action
  return null
}
