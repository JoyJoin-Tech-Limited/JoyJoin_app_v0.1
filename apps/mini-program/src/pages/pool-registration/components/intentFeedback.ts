import { INTENT_FLOW_OPTIONS } from '../flowConfig'

const EMPTY_FEEDBACK = '先选 1–3 个期待方向，悦仔好知道怎么帮你配。'
const FLEXIBLE_ONLY_FEEDBACK = '没问题，把期待交给悦仔，我来帮你挑一个舒服的组合。'

const COMBO_FEEDBACK: Record<string, string> = {
  'friends,networking': '新朋友 + 新人脉，双管齐下最容易碰撞出意外收获。',
  'friends,discussion': '认识新朋友，也准备好一场走心的对话。',
  'friends,fun': '轻松认识有趣的人，这一局不会冷场。',
  'friends,explore': '认识新朋友之余，也想试试不一样的玩法。',
  'networking,discussion': '把人脉聊成真正的连接，而不只是交换名片。',
  'networking,fun': '拓展人脉也可以很轻松，边玩边聊更自然。',
  'networking,explore': '拓展圈子的同时，保持对新玩法的好奇。',
  'discussion,fun': '既能聊得深，也能笑得开，这种平衡感刚刚好。',
  'discussion,explore': '走心对话之外，也想体验一下新鲜节奏。',
  'fun,explore': '轻松氛围里尝鲜，悦仔会帮你安排有趣的互动。',
  'friends,networking,discussion': '认识人、聊得深、还能拓展圈子，这一局信息量会很大。',
  'friends,fun,explore': '轻松认识人、开心体验新玩法，这一局会很丰富。',
}

const SINGLE_FEEDBACK: Record<string, string> = {
  friends: '多认识一个有趣的人，这一局就值了。',
  networking: '悦仔会优先帮你匹配能互相增值的圈子。',
  discussion: '悦仔会优先帮你匹配也愿意深聊的桌友。',
  fun: '先别想太多，开心就是这次最重要的 KPI。',
  explore: '尝鲜体验，悦仔会帮你挑一个有趣的方向。',
  flexible: FLEXIBLE_ONLY_FEEDBACK,
}

export function getIntentFeedback(selectedValues: string[]): string {
  if (selectedValues.length === 0) {
    return EMPTY_FEEDBACK
  }

  if (selectedValues.length === 1) {
    return SINGLE_FEEDBACK[selectedValues[0]] ?? EMPTY_FEEDBACK
  }

  const key = selectedValues.filter((v) => v !== 'flexible').sort().join(',')
  if (COMBO_FEEDBACK[key]) {
    return COMBO_FEEDBACK[key]
  }

  const labels = selectedValues
    .map((value) => INTENT_FLOW_OPTIONS.find((o) => o.value === value)?.label)
    .filter(Boolean)

  if (labels.length === 0) {
    return EMPTY_FEEDBACK
  }

  return `看起来你想${labels.join('、')}，悦仔会把这个方向记进你的匹配偏好。`
}
