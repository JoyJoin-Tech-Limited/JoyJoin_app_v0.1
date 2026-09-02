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

/** Category → whisper pool (rotation picked deterministically by question id). */
export const IDLE_WHISPERS_BY_CATEGORY: Record<string, string[]> = {
  社交启动: [
    '凭第一感觉来，没有标准答案',
    '想象那个场景，你会怎么做',
    '选最像你的那个就好',
  ],
  能量恢复: [
    '想想你真正放松的样子',
    '这道题，听你身体的声音',
    '没有对错，舒服最重要',
  ],
  能量优先级: [
    '想想你真正放松的样子',
    '这道题，听你身体的声音',
    '没有对错，舒服最重要',
  ],
  独处偏好: [
    '一个人待着的时候，你最自在',
    '这道题，听你身体的声音',
    '没有对错，舒服最重要',
  ],
  情感回应: [
    '代入那个瞬间，你会怎么选',
    '心里最先冒出来的，就是答案',
    '跟着感觉走，我在旁边看着',
  ],
  情绪敏感度: [
    '代入那个瞬间，你会怎么选',
    '心里最先冒出来的，就是答案',
    '跟着感觉走，我在旁边看着',
  ],
  决策风格: [
    '你会是那个拿主意的人吗',
    '别想太久，直觉最诚实',
    '选你第一反应的那个',
  ],
  决策参与: [
    '你会是那个拿主意的人吗',
    '别想太久，直觉最诚实',
    '选你第一反应的那个',
  ],
  集体决策: [
    '你会是那个拿主意的人吗',
    '别想太久，直觉最诚实',
    '选你第一反应的那个',
  ],
  新奇发现: [
    '未知的东西，让你心动还是紧张',
    '诚实一点，好奇还是抗拒',
    '你的第一反应，最珍贵',
  ],
  探索行为: [
    '未知的东西，让你心动还是紧张',
    '诚实一点，好奇还是抗拒',
    '你的第一反应，最珍贵',
  ],
  冒险尝鲜: [
    '未知的东西，让你心动还是紧张',
    '诚实一点，好奇还是抗拒',
    '你的第一反应，最珍贵',
  ],
  接受新事物: [
    '未知的东西，让你心动还是紧张',
    '诚实一点，好奇还是抗拒',
    '你的第一反应，最珍贵',
  ],
  团体形象: [
    '别人眼里的你，和你想的一样吗',
    '不用谦虚，也不用逞强',
    '选最接近日常你的那个',
  ],
  自我展示: [
    '别人眼里的你，和你想的一样吗',
    '不用谦虚，也不用逞强',
    '选最接近日常你的那个',
  ],
  展示偏好: [
    '别人眼里的你，和你想的一样吗',
    '不用谦虚，也不用逞强',
    '选最接近日常你的那个',
  ],
  幽默风格: [
    '这题可以轻松一点',
    '想象你笑得最开心的那次',
    '玩这件事，你是哪种选手',
  ],
  玩乐态度: [
    '这题可以轻松一点',
    '想象你笑得最开心的那次',
    '玩这件事，你是哪种选手',
  ],
  即兴能力: [
    '这题可以轻松一点',
    '想象你笑得最开心的那次',
    '玩这件事，你是哪种选手',
  ],
  关系深度: [
    '想想你最重要的那段关系',
    '朋友这件事，你看重什么',
    '诚实回答，我不告诉别人',
  ],
  关系推进: [
    '想想你最重要的那段关系',
    '朋友这件事，你看重什么',
    '诚实回答，我不告诉别人',
  ],
  压力应对: [
    '深呼吸，想象那个场面',
    '你会先处理事，还是先处理心情',
    '选你大概率会做的那个',
  ],
  情绪调节: [
    '深呼吸，想象那个场面',
    '你会先处理事，还是先处理心情',
    '选你大概率会做的那个',
  ],
  意外冲突: [
    '深呼吸，想象那个场面',
    '你会先处理事，还是先处理心情',
    '选你大概率会做的那个',
  ],
  能量感知: [
    '拖到你此刻最真实的位置',
    '没有对错，舒服最重要',
    '听你身体的声音就好',
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
