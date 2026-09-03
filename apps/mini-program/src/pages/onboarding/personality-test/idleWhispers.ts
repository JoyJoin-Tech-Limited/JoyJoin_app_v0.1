/**
 * Idle mascot whisper copy (2026-09-02, WS-1).
 *
 * On question entry the speech bubble speaks a per-question line, replaced by
 * the per-option commentary once the user answers. Copy lives client-side
 * (shared question-bank field deferred to phase 2).
 *
 * Copy governance (🔴 rules): ≤28 CJK chars per line, zero emoji, no
 * 匹配/社交/灵魂/AI vocabulary, warm second-person xiaoyue tone, no
 * exclamation spam.
 */

export interface IdleWhisperQuestion {
  id: string
  category?: string
}

/** Category → whisper pool (rotation picked deterministically by question id).
 *  Every category owns a DISTINCT trio anchored to its actual question theme
 *  (see questionsV4*.ts scenarioText) — no two categories share a pool. */
export const IDLE_WHISPERS_BY_CATEGORY: Record<string, string[]> = {
  社交启动: [
    '凭第一感觉来，没有标准答案',
    '想象那个场景，你会怎么做',
    '选最像你的那个就好',
  ],
  // 热闹聚会邀请撞上期待已久的个人计划
  能量恢复: [
    '想想你真正放松的样子',
    '这道题，听你身体的声音',
    '没有对错，舒服最重要',
  ],
  能量优先级: [
    '期待已久的安排，也值得被守护',
    '想见的人和想守的时间，都重要',
    '听听心里更想去的那一边',
  ],
  // 周五晚上一个人在家，突然收到多个邀约
  独处偏好: [
    '一个人的周五晚上，也是好晚上',
    '想象邀约进来的那一刻，你的心情',
    '想出门还是想充电，都算答案',
  ],
  情感回应: [
    '代入那个瞬间，你会怎么选',
    '心里最先冒出来的，就是答案',
    '跟着感觉走，我在旁边看着',
  ],
  // 察觉氛围变化和他人未说出口的情绪
  情绪敏感度: [
    '那些没说出口的情绪，你看得见吗',
    '气氛的细微变化，谁先感觉到',
    '没有标准答案，只说你自己',
  ],
  决策风格: [
    '你会是那个拿主意的人吗',
    '别想太久，直觉最诚实',
    '选你第一反应的那个',
  ],
  // 讨论周末活动（剧本杀、Livehouse…）时的角色
  决策参与: [
    '一堆选项里，你通常是哪种角色',
    '查攻略、提点子，还是都可以',
    '选最像你日常状态的那个',
  ],
  // 一群人计划旅行，讨论中扮演的角色
  集体决策: [
    '一群人选目的地，你站在哪个位置',
    '出主意、找折中，还是等通知',
    '没有对错，只有你的习惯',
  ],
  新奇发现: [
    '未知的东西，让你心动还是紧张',
    '诚实一点，好奇还是抗拒',
    '你的第一反应，最珍贵',
  ],
  // 大型节日市集，怎么逛
  探索行为: [
    '想象你站在市集入口，先往哪走',
    '每个摊位都看，还是挑重点逛',
    '按你最舒服的节奏来就好',
  ],
  // 刺激但略有风险的新活动
  冒险尝鲜: [
    '有点刺激的事，你的第一反应',
    '心动和犹豫，哪个声音更大',
    '选你真实会做的那个',
  ],
  // 朋友推荐从未接触过的活动
  接受新事物: [
    '没接触过的活动，你的第一念头',
    '好奇多一点，还是谨慎多一点',
    '诚实一点，没有好坏之分',
  ],
  团体形象: [
    '别人眼里的你，和你想的一样吗',
    '不用谦虚，也不用逞强',
    '选最接近日常你的那个',
  ],
  // 才艺展示环节，自愿参与
  自我展示: [
    '台前那束光，你想站进去吗',
    '举手还是鼓掌，都是你',
    '想象现场的目光，你会怎么做',
  ],
  // 小组项目派代表做总结展示
  展示偏好: [
    '总结展示这事，你想在哪个位置',
    '台前讲和幕后准备，你选哪个',
    '不用逞强，选你舒服的',
  ],
  幽默风格: [
    '这题可以轻松一点',
    '想象你笑得最开心的那次',
    '玩这件事，你是哪种选手',
  ],
  // 规则复杂的策略桌游，期待什么
  玩乐态度: [
    '玩这件事，你图的是什么',
    '想赢、想笑，还是想看懂大家',
    '想象游戏刚开始，你的期待',
  ],
  // 即兴表演游戏，随机抽题现场表演
  即兴能力: [
    '随机抽题上台，心跳快了吗',
    '第一个举手，还是稳坐观众席',
    '想象题目抽到你，你的反应',
  ],
  关系深度: [
    '想想你最重要的那段关系',
    '朋友这件事，你看重什么',
    '诚实回答，这题只讲给我听',
  ],
  // 活动认识的新朋友，第二天在微信上找你闲聊
  关系推进: [
    '新朋友来找你聊天，心里什么感觉',
    '延续联系这件事，你期待还是压力',
    '想象拿起手机，你会怎么回',
  ],
  压力应对: [
    '深呼吸，想象那个场面',
    '你会先处理事，还是先处理心情',
    '选你大概率会做的那个',
  ],
  // 一句无意的不舒服的话，多久释怀
  情绪调节: [
    '那句话说完，你的心要多久平复',
    '几秒就过，还是会带回家想',
    '按你自己的节奏来就好',
  ],
  // 过道相撞，对方不客气地咕哝了一句
  意外冲突: [
    '撞上那一刻，你的第一反应是',
    '退一步、回一句，还是看一看',
    '选身体最诚实的那个反应',
  ],
  // 滑条题：周五下班后的当下电量
  能量感知: [
    '拖到你此刻最真实的位置',
    '此刻的你，想一个人还是想约人',
    '周五傍晚的电量，只有你知道',
  ],
}

/** Per-question overrides — beat the category pool when present. */
export const IDLE_WHISPER_OVERRIDES: Record<string, string> = {
  Q_PLAYFUL_SLIDER: '这题没有对错，拖到你舒服的位置就好',
  Q_PLAYFUL_EMOJI: '相信第一直觉，别回头改',
}

/** Generic fallback for categories without a dedicated pool. */
export const IDLE_WHISPER_GENERIC: string[] = [
  '慢慢来，这道题没有时限',
  '凭直觉选，往往最准',
  '没有标准答案，只有你的答案',
  '这题也很有意思，慢慢感受',
]

function hashQuestionId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Resolve the whisper line for a question: override → category pool → generic. */
export function resolveIdleWhisper(question: IdleWhisperQuestion): string {
  const override = IDLE_WHISPER_OVERRIDES[question.id]
  if (override) return override
  const pool = (question.category ? IDLE_WHISPERS_BY_CATEGORY[question.category] : undefined)
    ?? IDLE_WHISPER_GENERIC
  return pool[hashQuestionId(question.id) % pool.length]
}
