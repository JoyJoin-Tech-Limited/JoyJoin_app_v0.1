import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'

export interface LoadingWhisper {
  text: string
  archetypes?: string[]
}

const DEFAULT_MASCOT_NAME = DEFAULT_MASCOT_DISPLAY_NAME

function m(text: string, mascotName = DEFAULT_MASCOT_NAME): string {
  return text.replace(/\{\{mascot\}\}/g, mascotName)
}

export const loadingWhispers: LoadingWhisper[] = [
  { text: '今天也要把快乐传染给新朋友哦！', archetypes: ['社牛柯基'] },
  { text: '太阳照常升起，有趣的搭子正在路上。', archetypes: ['小太阳鸡'] },
  { text: '你的真诚夸奖，是别人的一整天。', archetypes: ['夸夸仓鼠'] },
  { text: '机智如你，总能在关键时刻找到最优解。', archetypes: ['寻宝狐'] },
  { text: '深海般沉稳，是你最迷人的气场。', archetypes: ['机灵海豚'] },
  { text: '每一张你织的网，都连接着意想不到的同好。', archetypes: ['人脉蛛'] },
  { text: '你的温暖，是别人最想靠近的港湾。', archetypes: ['树洞考拉'] },
  { text: '灵感正在八爪并行地赶来…', archetypes: ['脑洞章鱼'] },
  { text: '思考是你的超能力，答案已经在路上。', archetypes: ['好奇猫头鹰'] },
  { text: '泰山崩于前而色不变，说的就是你。', archetypes: ['靠谱大象'] },
  { text: '慢慢来，稳一点，每一步都算数。', archetypes: ['慢热龟'] },
  { text: '隐身不是消失，是在选择最佳时机出现。', archetypes: ['小透明猫'] },
  { text: '{{mascot}}正在帮你读取这场活动的信息…' },
  { text: '有人和你一样讨厌香菜 · 正在揭晓中…' },
  { text: '你的下一场美好相遇，正在加载中。' },
  { text: '同好不是随机数，是共同兴趣慢慢算出来的默契。' },
  { text: '桌友们的头像正在排队化妆…' },
  { text: '{{mascot}}正在把盲盒摇匀，保证公平。' },
  { text: '悦仔已经喝了三杯咖啡，精神得很。' },
  { text: '每一个等待的瞬间，都是惊喜的伏笔。' },
  { text: '你的合拍DNA正在高速解析中…' },
  { text: '{{mascot}}偷偷看了眼结果，嘴角已经上扬。' },
]

export function getRandomWhisper(archetype?: string, mascotName = DEFAULT_MASCOT_NAME): string {
  const pool = archetype
    ? loadingWhispers.filter((w) => w.archetypes?.includes(archetype))
    : loadingWhispers.filter((w) => !w.archetypes || w.archetypes.length === 0)
  if (pool.length > 0) {
    return m(pool[Math.floor(Math.random() * pool.length)].text, mascotName)
  }
  const fallback = loadingWhispers.filter((w) => !w.archetypes || w.archetypes.length === 0)
  return m(fallback[Math.floor(Math.random() * fallback.length)]?.text ?? '{{mascot}}正在赶来…', mascotName)
}
