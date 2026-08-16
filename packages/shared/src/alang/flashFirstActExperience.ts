export const FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS = {
  's1-p1-alang': {
    npcSlug: 'alang',
    opening: '风从河面过来。你替我看看，这里有没有一种不催人的距离。',
    action: '阿浪把两把椅子的草图压在河岸地图旁，绳结、转角和窗边座位互相呼应。',
    discovery: '四处线索都在说同一件事：靠近不是挤占，而是留出能回应的角度。',
    prompt: '看完四处线索，你想把两把椅子怎样摆？',
    approaches: [
      {
        id: 's1-p1-alang-cooperate-a',
        label: '先并肩看河。话慢一点再说。',
        response: '我偏向这个。先共享一个方向，再谈分歧。',
      },
      {
        id: 's1-p1-alang-cooperate-b',
        label: '留一点角度。既同向，也看得见彼此。',
        response: '也好。不是躲开，只是不给目光太多压力。',
      },
    ],
    closing: '两把椅子并肩留出半步，既能一起看河，也给彼此留下转身回应的余地。',
  },
  's1-p1-lizi': {
    npcSlug: 'lizi',
    opening: '来得正好。我正和一卷干掉的彩笔较劲。名字都磨没了，偏偏每支还留着自己的脾气。',
    action: '栗子把色板、悬挂色片和工具车上的三顶笔帽一一摊开。',
    discovery: '名字会模糊，软边、细线和断点留下的手感却不会抢答。',
    prompt: '四处都看过了，你想先相信什么？',
    approaches: [
      {
        id: 's1-p1-lizi-cooperate-a',
        label: '先相信纸上留下的痕迹。',
        response: '好。先信纸上留下的东西，名字晚一点回来也没关系。',
      },
      {
        id: 's1-p1-lizi-cooperate-b',
        label: '先把三种手感排成顺序。',
        response: '成交。把三种手感排开，让颜色这次别抢答。',
      },
    ],
    closing: '“暖、静、醒”重新找到各自的笔帽，颜色没有走丢，只是暂时没有名字。',
  },
  's1-p1-momo': {
    npcSlug: 'momo',
    opening: '最后一条实线在空白页前停住。……我不是走丢，只是不确定停下算不算选择。',
    action: '默默把檐水的节奏、路线牌的折点和册子里的实线按顺序排好。',
    discovery: '声音、折点和实线能彼此印证；空白没有要求任何人替它补完。',
    prompt: '三处线索接上了，你想怎样记下停步？',
    approaches: [
      {
        id: 's1-p1-momo-cooperate-a',
        label: '停下也算路线的一部分',
        response: '……那我把停下，也记成一笔。',
      },
      {
        id: 's1-p1-momo-cooperate-b',
        label: '先核对最后三处，再决定停下',
        response: '好。声音、折点、实线，先接一遍。',
      },
    ],
    closing: '雨路在空白页前稳稳停住。没有多画的箭头，也没有被替写的下一站。',
  },
  's1-p1-shiqi': {
    npcSlug: 'shiqi',
    opening: '三份记录看似一致。准确地说，只是方向一致；叙述还没有说完。',
    action: '拾柒把外出记录册、交换箱压痕和三层路线纸放到检视灯箱前。',
    discovery: '三张纸都留下的痕迹可以先记下来；更晚出现的箭头和备注要单独放在旁边。',
    prompt: '四处都看过了，你想先核对哪一部分？',
    approaches: [
      {
        id: 's1-p1-shiqi-cooperate-a',
        label: '先找三张纸都有的痕迹',
        response: '稳妥。三张纸共同留下的，先单独记下来。',
      },
      {
        id: 's1-p1-shiqi-cooperate-b',
        label: '把后来写上的箭头放到旁边',
        response: '可以。先看共同部分，再判断后来加上的内容。',
      },
    ],
    closing: '三层路线纸已经对齐。共同留下的痕迹单独保留，后来补上的说明也各自有了位置。',
  },
} as const

export type FlashFirstActExperienceUnitId = keyof typeof FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS

export function isFlashFirstActExperienceUnitId(value: string): value is FlashFirstActExperienceUnitId {
  return Object.prototype.hasOwnProperty.call(FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS, value)
}

export function getFlashFirstActExperienceContract(value: string) {
  return isFlashFirstActExperienceUnitId(value) ? FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS[value] : null
}
