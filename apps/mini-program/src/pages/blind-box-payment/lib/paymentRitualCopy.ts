/**
 * Payment Ritual V2 — Archetype-Aware Copy System (24/24 Edition)
 *
 * Every string engineered for maximum emotional value.
 * Tone: 悦仔 Voice — warm, playful, deeply personal.
 */

import type { ArchetypeFamily } from './paymentRitualState'

// ─── Archetype Names ───

const ARCHETYPE_NAMES: Record<string, string> = {
  corgi: '开心柯基',
  rooster: '太阳鸡',
  hamster_praise: '夸夸仓鼠',
  fox: '社交狐狸',
  dolphin_calm: '平静海豚',
  spider: '深思蜘蛛',
  koala: '温和考拉',
  octopus: '灵动章鱼',
  owl: '智慧猫头鹰',
  elephant: '稳重大象',
  turtle: '踏实海龟',
  cat: '独立猫咪',
}

// ─── Archetype-Specific Opening Lines (Delight + Identity) ───

const ARCHETYPE_OPENING_LINES: Record<string, string> = {
  corgi: '嘿，小太阳。悦仔给你留了个前排位置，这边请～',
  rooster: '嘿，发光体。悦仔给你留了最亮的那盏聚光灯。',
  hamster_praise: '嘿，夸夸大使。这里有人急需你的赞美能量。',
  fox: '嘿，故事收集者。今晚的局，缺一个会讲故事的你。',
  dolphin_calm: '嘿，定海神针。这桌人需要你镇场子。',
  spider: '嘿，洞察者。悦仔猜你已经看透这个局的走向了。',
  koala: '嘿，温柔结界。这桌需要你这种让人安心的存在。',
  octopus: '嘿，多线程玩家。这局复杂度刚好配得上你。',
  owl: '嘿，深夜哲学家。这桌人等着听你的见解。',
  elephant: '嘿，靠谱担当。有你在，这局稳了。',
  turtle: '嘿，长期主义者。慢慢来，对的人值得你花时间。',
  cat: '嘿，独立观察者。这局有趣到值得你打破独处的标准。',
}

const FAMILY_TRAITS: Record<ArchetypeFamily, string> = {
  warm: '热情',
  cool: '洒脱',
  fire: '明亮',
  calm: '从容',
}

// ─── Act I: Anticipation (Belonging + Ritual + Delight) ───

export interface ActICopy {
  title: string
  subtitle: string
  xiaoyueLine: string
  progressHint: string // Achievement seed
  communitySubline: string // Deep belonging
}

export function getActICopy(
  archetype: string | null,
  family: ArchetypeFamily,
  hasContextActivity: boolean,
  weeklyEvents: number,
): ActICopy {
  const name = archetype ? ARCHETYPE_NAMES[archetype] || '探索者' : null
  const trait = FAMILY_TRAITS[family]

  if (name) {
    const opening = ARCHETYPE_OPENING_LINES[archetype!] || `嘿，${trait}的${name}。悦仔给你留了个前排位置。`

    return {
      title: '准备好了吗？下一场相遇在等你',
      subtitle: hasContextActivity
        ? '聚光灯已经就位，该你上场了'
        : `${name}的局，从来不会无聊`,
      xiaoyueLine: opening,
      progressHint: '第一步：认识同频的人',
      communitySubline: weeklyEvents > 0
        ? `本周${weeklyEvents}场局，有人和你一样，在等一个对的开始`
        : '有人和你一样，在等一个对的开始',
    }
  }

  return {
    title: '准备好了吗？下一场相遇在等你',
    subtitle: '这里的故事，缺一个主角',
    xiaoyueLine: '嘿，探索者。悦仔给你留了个前排位置。',
    progressHint: '第一步：认识同频的人',
    communitySubline: '有人和你一样，在等一个对的开始',
  }
}

// ─── Act II: Revelation (Identity + Understood + Ritual) ───

export interface ActIICopy {
  heroTitle: string
  heroSubline: string
  contextLine?: string
  revealLine: string // Ritual moment
  invitationLine: string // Belonging
}

export function getActIICopy(
  archetype: string | null,
  family: ArchetypeFamily,
  contextActivity: string | null,
): ActIICopy {
  const name = archetype ? ARCHETYPE_NAMES[archetype] || '探索者' : null

  const familyInvitations: Record<ArchetypeFamily, string> = {
    warm: '这里有和你一样热情的人，在等一个发光的机会',
    cool: '这里有和你一样洒脱的人，在等一场不刻意的相遇',
    fire: '这里有和你一样明亮的人，在等一个被看见的舞台',
    calm: '这里有和你一样从容的人，在等一次走心的对话',
  }

  if (name) {
    return {
      heroTitle: `作为${name}的你，天生属于这里`,
      heroSubline: familyInvitations[family],
      contextLine: contextActivity
        ? `你刚看了《${contextActivity}》——那桌人需要你`
        : undefined,
      revealLine: '悦仔为你匹配了最适合的参与方式',
      invitationLine: '不是所有人都能加入，但你可以',
    }
  }

  return {
    heroTitle: '你身上有种特别的气质',
    heroSubline: '悦仔一眼就能认出来',
    contextLine: contextActivity
      ? `你刚看了《${contextActivity}》——那场局在等你`
      : undefined,
    revealLine: '悦仔为你匹配了最适合的参与方式',
    invitationLine: '不是所有人都能加入，但你可以',
  }
}

// ─── Act III: Choice (Achievement + Understood + Delight) ───

export interface ActIIICopy {
  sectionTitle: string
  sectionSubline: string
  progressLabel: string
  planDescriptions: Record<string, string>
  planReasons: Record<string, string> // Why this plan fits the archetype
  xiaoyueReactions: Record<string, string>
  valueAnchorLabels: {
    perSession: string
    perDay: string
    savings: string
    totalValue: string
  }
}

export function getActIIICopy(archetype: string | null): ActIIICopy {
  const name = archetype ? ARCHETYPE_NAMES[archetype] || '探索者' : null

  // Archetype-specific reasons for plan choice (Understood)
  const planReasons: Record<string, Record<string, string>> = {
    corgi: {
      vip_monthly: '这个月去发光吧，小太阳',
      vip_quarterly: '三个月，足够你照亮整个社群',
      pack_3: '三次机会，三次被看见的时刻',
      pack_6: '六次约会，六次让更多人认识你的机会',
    },
    rooster: {
      vip_monthly: '这一个月，舞台是你的',
      vip_quarterly: '三个月的聚光灯，够你发挥了',
      pack_3: '三次出场，三次惊艳',
      pack_6: '六次登台，六次发光',
    },
    fox: {
      vip_monthly: '一个月，足够收集一打新故事',
      vip_quarterly: '三个月，你的故事本会被填满',
      pack_3: '三个局，三段值得回味的对话',
      pack_6: '六个局，六个新朋友的故事',
    },
    dolphin_calm: {
      vip_monthly: '一个月，慢慢认识，不赶时间',
      vip_quarterly: '三个月，足够让陌生人变成朋友',
      pack_3: '三次机会，三次深度的连接',
      pack_6: '六次约会，六次静水流深的相遇',
    },
    default: {
      vip_monthly: '这个月，去遇见对的人',
      vip_quarterly: '三个月，慢慢认识，不赶时间',
      pack_3: '三次机会，三场不一样的故事',
      pack_6: '六次约会，足够遇见心动',
    },
  }

  const reasons = (archetype && planReasons[archetype]) || planReasons.default

  return {
    sectionTitle: '选一条路，打开属于你的夜晚',
    sectionSubline: name
      ? `${name}的局，从来不会无聊`
      : '每一条路，都通向不一样的故事',
    progressLabel: '第二步：选择你的参与方式',
    planDescriptions: {
      vip_monthly: '三十天，随心的局。想走就走。',
      vip_quarterly: '一季陪伴，慢慢认识对的人',
      pack_3: '三次机会，三场不一样的故事',
      pack_6: '六次约会，足够遇见心动',
    },
    planReasons: reasons,
    xiaoyueReactions: {
      vip_monthly: name
        ? `好选择。这一个月，去发光吧，${name}。`
        : '好选择。这一个月，去发光吧。',
      vip_quarterly: '三个月的陪伴，慢慢认识，不赶时间。',
      pack_3: '先试试看？悦仔猜你会回来选月的。',
      pack_6: '六次机会，足够找到那个对的人。',
    },
    valueAnchorLabels: {
      perSession: '每次仅需',
      perDay: '相当于每天',
      savings: '已省',
      totalValue: '总价值',
    },
  }
}

// ─── Social Proof (Belonging + Understood) ───

export function getSocialProofCopy(
  recentChoosers: number,
  archetypeName: string | null,
  isRecommended: boolean,
): string {
  if (isRecommended && recentChoosers > 0) {
    return `${recentChoosers}人和你一样，选了这条路`
  }
  if (recentChoosers >= 100) {
    return `${recentChoosers}人本周选了这条路`
  }
  if (recentChoosers >= 10) {
    return `${recentChoosers}人这周刚加入`
  }
  if (recentChoosers > 0) {
    return '本周新伙伴的选择'
  }
  if (archetypeName) {
    return `成为本周第一位${archetypeName}`
  }
  return '成为本周第一位'
}

export function getCommunityPledgeCopy(city: string, totalMembers: number): string {
  return `加入${city} ${totalMembers.toLocaleString()} 位探索者`
}

export function getCommunityPromiseCopy(): string {
  return '支付成功后，你将立即成为 JoyJoin 社群的一员'
}

// ─── Trust & Commitment (Ritual + Belonging) ───

export function getTrustLine(): string {
  return '安全支付 · 随时可退 · 悦仔7×24在线'
}

export function getCtaLabel(): string {
  return '确认加入'
}

export function getCtaSubLabel(planName: string, price: string): string {
  return `${planName} · ${price}`
}

export function getPledgeText(city: string, totalMembers: number): string {
  return `与 ${city} ${totalMembers.toLocaleString()} 位探索者，一起开启这段旅程`
}

// ─── Scarcity (gentle, not manipulative) ───

export function getScarcityCopy(remainingSpots: number): string | null {
  if (remainingSpots <= 0) return null
  if (remainingSpots <= 5) {
    return `本月最后 ${remainingSpots} 个席位`
  }
  if (remainingSpots <= 15) {
    return `本月仅剩 ${remainingSpots} 个位置`
  }
  if (remainingSpots <= 30) {
    return `本月还有 ${remainingSpots} 个席位`
  }
  return null
}

// ─── Achievement ───

export interface AchievementCopy {
  milestoneTitle: string
  milestoneBody: string
  progressLabel: string
  progressSteps: string[]
}

export function getAchievementCopy(archetypeName: string | null): AchievementCopy {
  const name = archetypeName || '探索者'

  return {
    milestoneTitle: '第一步，迈出去了',
    milestoneBody: `${name}，欢迎加入 JoyJoin 社群`,
    progressLabel: '你的旅程',
    progressSteps: [
      '选择参与方式',
      '完成首次支付',
      '收到活动邀请',
      '遇见同频的人',
    ],
  }
}

export function getStepAchievementCopy(step: number, total: number): string {
  return `第 ${step} / ${total} 步`
}

// ─── Fast Path ───

export function getFastPathCopy(): { title: string; subtitle: string; cta: string } {
  return {
    title: '欢迎回来，老伙计',
    subtitle: '悦仔知道你想走哪条路',
    cta: '一键续上',
  }
}

// ─── Zero States ───

export function getZeroCouponCopy(): string {
  return '邀请一位好友，你们各得一张券'
}

// ─── Archetype-Specific Value Propositions (Understood + Identity) ───

export function getArchetypeValueProposition(archetype: string | null): string | null {
  const propositions: Record<string, string> = {
    corgi: '你的阳光会感染整桌人',
    rooster: '你的光芒会让这个局更亮',
    hamster_praise: '你的赞美会打开所有人的话匣子',
    fox: '你的故事会让这个夜晚值得记住',
    dolphin_calm: '你的沉稳会让所有人感到安心',
    spider: '你的洞察会让对话走向更深处',
    koala: '你的温柔会让这个空间充满安全感',
    octopus: '你的多面性会让这个局充满惊喜',
    owl: '你的智慧会让这个对话升维',
    elephant: '你的靠谱会让这个局稳如磐石',
    turtle: '你的耐心会让你遇见真正对的人',
    cat: '你的独立视角会让所有人耳目一新',
  }

  return archetype ? propositions[archetype] || null : null
}

// ─── Easter Eggs (Delight) ───

const EASTER_EGG_LINES = [
  '再点我一下，有惊喜哦～',
  '悦仔今天心情很好，因为你来了。',
  '你知道吗？你的类型在这个局里很抢手。',
  '偷偷告诉你，这个局缺一个像你这样的人。',
]

// ─── Hesitation Nudge (Delight + Understood) ───

const HESITATION_LINES: Record<ArchetypeFamily, string[]> = {
  warm: [
    '还在犹豫吗？悦仔第一次付款也紧张呢，但加入后真的超开心',
    '别紧张，这里的每个人都和你一样，第一次都有点忐忑',
  ],
  cool: [
    '思考很对。不过这里的局，确实值得你去看看',
    '理性分析没问题，但有时候直觉更准确。你觉得呢？',
  ],
  fire: [
    '别怂啊，你的同类都在等你上桌呢',
    '犹豫不像你。冲一下，这个局需要你',
  ],
  calm: [
    '慢慢来，不着急。不过席位确实在减少哦',
    '仔细考虑是对的，但好机会也不会一直等',
  ],
}

export function getHesitationCopy(family: ArchetypeFamily): string {
  const lines = HESITATION_LINES[family]
  return lines[Math.floor(Math.random() * lines.length)]
}

export function getEasterEggLine(index: number): string {
  return EASTER_EGG_LINES[index % EASTER_EGG_LINES.length]
}
