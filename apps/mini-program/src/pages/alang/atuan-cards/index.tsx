import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { ATUAN_FIRST_ACT_CARDS } from '@shared/alang/atuanFirstAct'
import {
  createFlashActGameProgress,
  restoreFlashActGameProgress,
  type FlashActGamePlacement as Placement,
  type FlashActGameProgress,
} from '../../../lib/alang/flashActGameProgress'
import './index.scss'

type GameMode = 'atuan' | 'alang' | 'lizi' | 'momo' | 'shiqi'

interface GameChoice { id: string; label: string; icon: 'spark' | 'letter' | 'cover'; feedback: string; isCorrect?: boolean }
interface GameItem { id: string; label: string; choices: readonly [GameChoice, GameChoice, GameChoice] }
interface GameConfig { eyebrow: string; title: string; copy: string; speaker: string; footer: string; items: readonly GameItem[]; requireCorrectChoice?: boolean }
const ATUAN_CHOICES: readonly [GameChoice, GameChoice, GameChoice] = [
  { id: 'keep', label: '可以一起记住', icon: 'spark', feedback: '“好。能让人觉得被记住，又不会让他不自在的事，可以留下。”' },
  { id: 'return', label: '只留给卡上的人', icon: 'letter', feedback: '“那就装进信封，只交给卡上的人。别人不需要替他读完。”' },
  { id: 'cover', label: '先替他遮住', icon: 'cover', feedback: '“嗯，先盖住。等我问过他，再决定这句话该不该留下。”' },
]

const CONFIGS: Record<GameMode, GameConfig> = {
  atuan: {
    eyebrow: '阿团的小纸袋', title: '替卡片找个舒服的位置', copy: '不是猜标准答案。你在决定：这句话可以被谁看见。', speaker: '阿团', footer: '“纸袋里的短线你看见了。帮我再数一次。”',
    items: ATUAN_FIRST_ACT_CARDS.map((card) => ({ id: card.id, label: card.label, choices: ATUAN_CHOICES })),
  },
  alang: {
    eyebrow: '阿浪的窗边双椅', title: '把邀请摆成舒服的并肩', copy: '一次只处理一个决定。选完以后，先听阿浪怎么说。', speaker: '阿浪', footer: '“靠近不是占住位置。让两个人都还能转身。”',
    items: [
      { id: 'distance', label: '先决定两把椅子之间的距离', choices: [{ id: 'close', label: '紧紧挨在一起', icon: 'cover', feedback: '“太近了，像两句话都在抢先。再给呼吸留一点位置。”' }, { id: 'half-step', label: '留出半步距离', icon: 'spark', feedback: '“这个距离刚好。听得见，也不用马上面对彼此。”' }, { id: 'far', label: '各放在窗户两端', icon: 'letter', feedback: '“有点远，邀请会被风吹散。可以再靠近一点。”' }] },
      { id: 'angle', label: '再决定椅背朝向哪里', choices: [{ id: 'face', label: '完全面对面', icon: 'cover', feedback: '“太像必须立刻说清楚的对质。”' }, { id: 'same', label: '微微朝向同一边', icon: 'spark', feedback: '“嗯，并肩看同一片水，也还看得见彼此。”' }, { id: 'away', label: '各自转向两边', icon: 'letter', feedback: '“这样更像散场，不像邀请。”' }] },
      { id: 'exit', label: '最后，给对方留不留离开的余地', choices: [{ id: 'block', label: '把椅子抵住墙角', icon: 'cover', feedback: '“没有退路的靠近，会让人先想逃开。”' }, { id: 'open', label: '留出能起身的通道', icon: 'spark', feedback: '“对。愿意留下，应该是选择，不是被困住。”' }, { id: 'separate', label: '干脆只留一把椅子', icon: 'letter', feedback: '“那就没有邀请了。两把都留着，答案交给来的人。”' }] },
    ],
  },
  lizi: {
    eyebrow: '栗子的试色桌', title: '把三顶笔帽配回原位', copy: '一次只核对一道痕迹。先看落笔节奏，再找相同形状的切口。', speaker: '栗子', footer: '“名字会磨掉，手感还会留在纸上。”',
    requireCorrectChoice: true,
    items: [
      { id: 'warm', label: '第一道：边缘缓缓转成一段软弧', choices: [{ id: 'fine-pair', label: '配双细纹帽', icon: 'cover', feedback: '“这顶太直了，接不上软弧。再看它转弯的形状。”' }, { id: 'soft-arc', label: '配圆弧缺口帽', icon: 'spark', feedback: '“对。圆弧接住软边，这支笔记住的是‘暖’。”', isCorrect: true }, { id: 'quick-notch', label: '配三短刻帽', icon: 'letter', feedback: '“短刻太急，和这道慢慢转弯的痕迹不是同一种节奏。”' }] },
      { id: 'quiet', label: '第二道：两条细线平稳地贴在一起', choices: [{ id: 'soft-arc', label: '配圆弧缺口帽', icon: 'cover', feedback: '“圆弧太松了。这里留下的是两条始终并行的细线。”' }, { id: 'fine-pair', label: '配双细纹帽', icon: 'spark', feedback: '“接上了。两道细纹不抢位置，这支笔记住的是‘静’。”', isCorrect: true }, { id: 'quick-notch', label: '配三短刻帽', icon: 'letter', feedback: '“短刻会把线打断。再找一顶能和双细线并排的。”' }] },
      { id: 'awake', label: '第三道：三次短促起笔，停顿清楚', choices: [{ id: 'soft-arc', label: '配圆弧缺口帽', icon: 'cover', feedback: '“这道痕迹没有慢慢转弯。它是三次很清楚的短起笔。”' }, { id: 'quick-notch', label: '配三短刻帽', icon: 'spark', feedback: '“就是它。三道短刻对上三次起笔，这支笔记住的是‘醒’。”', isCorrect: true }, { id: 'fine-pair', label: '配双细纹帽', icon: 'letter', feedback: '“双细纹太连贯了，接不上这三次有间隔的停顿。”' }] },
    ],
  },
  momo: {
    eyebrow: '默默的路线册', title: '把三段雨路放回顺序', copy: '一次核对一段。路线走到空白以前，就可以停下。', speaker: '默默', footer: '“空着，也是一条记录。别替它补完。”',
    items: [
      { id: 'rain', label: '第一段：檐水由密变疏', choices: [{ id: 'skip', label: '直接跳到最后一滴', icon: 'cover', feedback: '“太快了。前两次间隔能确认变化不是偶然。”' }, { id: 'listen', label: '听完三次间隔', icon: 'spark', feedback: '“嗯。声音慢下来，才是这段路的起点。”' }, { id: 'repeat', label: '一直等到再次下雨', icon: 'letter', feedback: '“不用等新的证据。已经发生的三次足够了。”' }] },
      { id: 'turn', label: '第二段：竖牌在中段向里折', choices: [{ id: 'guess', label: '猜箭头原本朝右', icon: 'cover', feedback: '“没有箭头。猜方向会把空白写成答案。”' }, { id: 'trace', label: '只沿三处折点核对', icon: 'spark', feedback: '“对。折点留下了，方向没有。”' }, { id: 'straight', label: '把折线改成直线', icon: 'letter', feedback: '“那会变成另一条路，不是核对这条路。”' }] },
      { id: 'blank', label: '第三段：实线停在空白页前', choices: [{ id: 'continue', label: '替它画进空白页', icon: 'cover', feedback: '“走过头了。空白页不是下一段路。”' }, { id: 'stop', label: '在页边主动收笔', icon: 'spark', feedback: '“……对。停下不是走丢，是我决定走到这里。”' }, { id: 'erase', label: '把最后一段擦掉', icon: 'letter', feedback: '“不用否认走过的部分。只要允许它停下。”' }] },
    ],
  },
  shiqi: {
    eyebrow: '拾柒的检视灯箱', title: '让三层路线纸各自说话', copy: '一次核对一层。先看稳定痕迹，再处理后来写下的解释。', speaker: '拾柒', footer: '“先让纸证明重合，不让措辞抢先。”',
    items: [
      { id: 'base', label: '第一层：三张纸都有的痕迹', choices: [{ id: 'story', label: '先猜痕迹是谁留下的', icon: 'cover', feedback: '“还没有证据说明是谁。先只记录它出现在哪里。”' }, { id: 'align', label: '对齐三张纸共同的位置', icon: 'spark', feedback: '“可以。三张纸都留下的痕迹，才能先记成共同事实。”' }, { id: 'ignore', label: '只看颜色最深的一笔', icon: 'letter', feedback: '“颜色深不代表出现得早。三张纸共同留下的更可靠。”' }] },
      { id: 'copy', label: '第二层：路线复写', choices: [{ id: 'merge', label: '和底层直接叠成一张', icon: 'cover', feedback: '“先别合并。重合与不同都需要被看见。”' }, { id: 'compare', label: '沿折返点逐处比较', icon: 'spark', feedback: '“准确。方向是结果，折返点更接近过程。”' }, { id: 'newest', label: '只相信最新的箭头', icon: 'letter', feedback: '“新只能说明时间，不能自动说明正确。”' }] },
      { id: 'note', label: '第三层：后来补写的说明', choices: [{ id: 'fact', label: '把说明直接当成事实', icon: 'cover', feedback: '“这段说明还没有被证明，不能抢在共同痕迹前面。”' }, { id: 'separate', label: '单独放在共同痕迹旁边', icon: 'spark', feedback: '“对。现在能同时看见共同留下的部分，和后来写上的说法。”' }, { id: 'discard', label: '把说明全部丢掉', icon: 'letter', feedback: '“不用删除。先分开放着，以后仍然可以核对。”' }] },
    ],
  },
}

export default function AtuanCardsPage() {
  const { params } = useRouter()
  const mode: GameMode = params.mode === 'alang' || params.mode === 'lizi' || params.mode === 'momo' || params.mode === 'shiqi' ? params.mode : 'atuan'
  const storageKey = decodeURIComponent(params.key ?? '')
  const config = CONFIGS[mode]
  const unitId = params.unitId ?? `s1-p1-${mode}`
  const parsedPhase = Number(params.phase)
  const phase = (parsedPhase === 2 || parsedPhase === 3 ? parsedPhase : 1) as 1 | 2 | 3
  const orderedItems = useMemo(() => mode === 'atuan' && params.approach === 'notice_wait' ? [...config.items].reverse() : [...config.items], [config.items, mode, params.approach])
  const [saved, setSaved] = useState<FlashActGameProgress>(() => {
    const expected = { unitId, phase, mode, itemIds: orderedItems.map(({ id }) => id) }
    try { return restoreFlashActGameProgress(Taro.getStorageSync(storageKey), expected) } catch { return createFlashActGameProgress(expected) }
  })
  const index = Math.min(saved.placements.length, orderedItems.length - 1)
  const placements = saved.placements
  const item = orderedItems[index]
  const pendingChoice = saved.pending && item
    ? item.choices.find(({ id }) => id === saved.pending?.destinationId) ?? null
    : null
  const pending = saved.pending && pendingChoice
    ? { placement: saved.pending, feedback: pendingChoice.feedback, isCorrect: !config.requireCorrectChoice || pendingChoice.isCorrect === true }
    : null

  const persist = (next: FlashActGameProgress) => {
    setSaved(next)
    if (!storageKey) return
    try { Taro.setStorageSync(storageKey, next) } catch { /* Story remains recoverable from its act screen. */ }
  }

  useEffect(() => {
    if (saved.status === 'completed') void Taro.navigateBack()
  }, [saved.status])

  const place = (choice: GameChoice) => {
    if (!item || pending) return
    persist({ ...saved, pending: { cardId: item.id, destinationId: choice.id } })
  }

  const continueSorting = () => {
    if (!pending) return
    if (!pending.isCorrect) {
      persist({ ...saved, pending: null })
      return
    }
    const next = [...placements, pending.placement]
    if (next.length === orderedItems.length) {
      persist({ ...saved, status: 'completed', placements: next, pending: null })
      return
    }
    persist({ ...saved, placements: next, pending: null })
  }

  return (
    <View className='atuan-cards' data-game-mode={mode} data-story-unit={unitId} data-story-phase={phase}>
      <View>
        <Text className='atuan-cards__eyebrow'>{config.eyebrow}</Text>
        <Text className='atuan-cards__title'>{config.title}</Text>
        <Text className='atuan-cards__copy'>{config.copy}</Text>
      </View>
      <View className='atuan-cards__progress' aria-label={`已整理 ${placements.length} 张，共 ${orderedItems.length} 张`}>
        {orderedItems.map((candidate, itemIndex) => <View key={candidate.id} className={`atuan-cards__progress-dot${itemIndex <= index ? ' atuan-cards__progress-dot--active' : ''}`} />)}
      </View>
      {item ? <View className='atuan-cards__card'><View className='atuan-cards__card-string' /><Text className='atuan-cards__card-count'>{index + 1} / {orderedItems.length}</Text><Text className='atuan-cards__card-copy'>{item.label}</Text></View> : null}
      {pending ? (
        <View className='atuan-cards__feedback' role='status' aria-live='polite'>
          <Text className='atuan-cards__feedback-name'>{config.speaker}</Text><Text className='atuan-cards__feedback-copy'>{pending.feedback}</Text>
          <View className='atuan-cards__continue' role='button' aria-label={!pending.isCorrect ? '再看一次' : index === orderedItems.length - 1 ? '收好最后一项' : '继续整理'} onClick={continueSorting}><Text>{!pending.isCorrect ? '再看一次' : index === orderedItems.length - 1 ? '收好最后一项' : '继续整理'}</Text></View>
        </View>
      ) : (
        <View className='atuan-cards__destinations'>{item?.choices.map((choice) => <View key={choice.id} className='atuan-cards__destination' hoverClass='atuan-cards__destination--pressed' role='button' aria-label={choice.label} onClick={() => place(choice)}><View className={`atuan-cards__icon atuan-cards__icon--${choice.icon}`} aria-hidden='true'><View className='atuan-cards__icon-shape' /></View><Text>{choice.label}</Text></View>)}</View>
      )}
      <Text className='atuan-cards__atuan-copy'>{mode === 'atuan' && params.approach === 'notice_wait' ? '“刚才那张是你接住的。我们最后看它。”' : config.footer}</Text>
    </View>
  )
}
