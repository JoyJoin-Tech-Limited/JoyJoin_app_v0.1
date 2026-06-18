import { INTENT_FLOW_OPTIONS } from '../flowConfig'

const EMPTY_FEEDBACK = '先选 1–3 个期待方向，悦仔好知道怎么帮你配。'
const FLEXIBLE_ONLY_FEEDBACK = '没问题，把期待交给悦仔，我来帮你挑一个舒服的组合。'

const COMBO_FEEDBACK: Record<string, string> = {
  'friends,networking': '新朋友 + 新人脉，双管齐下最容易碰撞出意外收获。',
  'friends,discussion': '认识新朋友，也准备好一场走心的对话。',
  'friends,fun': '轻松认识有趣的人，这一局不会冷场。',
  'friends,romance': '在认识新朋友的过程里，悄悄留一点心动的可能。',
  'networking,discussion': '把人脉聊成真正的连接，而不只是交换名片。',
  'networking,fun': '拓展人脉也可以很轻松，边玩边聊更自然。',
  'networking,romance': '扩大圈子的同时，也许还会遇见那个让你心动的人。',
  'discussion,fun': '既能聊得深，也能笑得开，这种平衡感刚刚好。',
  'discussion,romance': '走心的对话里，最容易酝酿出温柔的默契。',
  'fun,romance': '轻松氛围里遇见心动，悦仔会帮你留一点浪漫的呼吸空间。',
  'friends,networking,discussion': '认识人、聊得深、还能拓展圈子，这一局信息量会很大。',
  'friends,fun,romance': '轻松社交 + 心动可能，适合想要一点惊喜的你。',
}

const SINGLE_FEEDBACK: Record<string, string> = {
  friends: '多认识一个有趣的人，这一局就值了。',
  networking: '悦仔会优先帮你匹配能互相增值的圈子。',
  discussion: '悦仔会优先帮你匹配也愿意深聊的桌友。',
  fun: '先别想太多，开心就是这次最重要的 KPI。',
  romance: '浪漫邂逅需要一点默契，悦仔会悄悄把氛围调柔。',
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

  return `看起来你想${labels.join('、')}，悦仔会把这个方向写进匹配公式。`
}
