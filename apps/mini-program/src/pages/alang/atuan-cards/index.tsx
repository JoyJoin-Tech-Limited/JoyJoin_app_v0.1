import Taro, { useRouter } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { ATUAN_FIRST_ACT_CARDS } from '@shared/alang/atuanFirstAct'
import './index.scss'

type GameMode = 'atuan' | 'alang' | 'momo' | 'shiqi'

interface GameChoice { id: string; label: string; icon: 'spark' | 'letter' | 'cover'; feedback: string }
interface GameItem { id: string; label: string; choices: readonly [GameChoice, GameChoice, GameChoice] }
interface GameConfig { eyebrow: string; title: string; copy: string; speaker: string; footer: string; items: readonly GameItem[] }
interface Placement { cardId: string; destinationId: string }

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
      { id: 'base', label: '第一层：原始浅痕', choices: [{ id: 'story', label: '先猜浅痕是谁留下的', icon: 'cover', feedback: '“动机还没有证据。先只记录它出现在哪里。”' }, { id: 'align', label: '对齐共同出现的位置', icon: 'spark', feedback: '“可以。共同出现的压痕，才有资格先被叫作事实。”' }, { id: 'ignore', label: '只看颜色最深的一笔', icon: 'letter', feedback: '“深不等于早。浅痕反而可能更稳定。”' }] },
      { id: 'copy', label: '第二层：路线复写', choices: [{ id: 'merge', label: '和底层直接叠成一张', icon: 'cover', feedback: '“先别合并。重合与不同都需要被看见。”' }, { id: 'compare', label: '沿折返点逐处比较', icon: 'spark', feedback: '“准确。方向是结果，折返点更接近过程。”' }, { id: 'newest', label: '只相信最新的箭头', icon: 'letter', feedback: '“新只能说明时间，不能自动说明正确。”' }] },
      { id: 'note', label: '第三层：后补说明', choices: [{ id: 'fact', label: '把说明直接写成事实', icon: 'cover', feedback: '“解释还没有被证实。措辞不能抢在证据前面。”' }, { id: 'separate', label: '单独放在事实旁边', icon: 'spark', feedback: '“对。现在可以同时看见事实与解释的距离。”' }, { id: 'discard', label: '把说明全部丢掉', icon: 'letter', feedback: '“不必删除。暂时不采信，也可以保留待查。”' }] },
    ],
  },
}

export default function AtuanCardsPage() {
  const { params } = useRouter()
  const mode: GameMode = params.mode === 'alang' || params.mode === 'momo' || params.mode === 'shiqi' ? params.mode : 'atuan'
  const storageKey = decodeURIComponent(params.key ?? '')
  const config = CONFIGS[mode]
  const orderedItems = useMemo(() => mode === 'atuan' && params.approach === 'notice_wait' ? [...config.items].reverse() : [...config.items], [config.items, mode, params.approach])
  const [index, setIndex] = useState(0)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [pending, setPending] = useState<{ placement: Placement; feedback: string } | null>(null)
  const item = orderedItems[index]

  const place = (choice: GameChoice) => {
    if (!item || pending) return
    setPending({ placement: { cardId: item.id, destinationId: choice.id }, feedback: choice.feedback })
  }

  const continueSorting = () => {
    if (!pending) return
    const next = [...placements, pending.placement]
    if (next.length === orderedItems.length) {
      Taro.setStorageSync(storageKey, next)
      void Taro.navigateBack()
      return
    }
    setPlacements(next)
    setPending(null)
    setIndex((current) => current + 1)
  }

  return (
    <View className='atuan-cards' data-game-mode={mode}>
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
          <View className='atuan-cards__continue' role='button' aria-label={index === orderedItems.length - 1 ? '收好最后一项' : '继续整理'} onClick={continueSorting}><Text>{index === orderedItems.length - 1 ? '收好最后一项' : '继续整理'}</Text></View>
        </View>
      ) : (
        <View className='atuan-cards__destinations'>{item?.choices.map((choice) => <View key={choice.id} className='atuan-cards__destination' hoverClass='atuan-cards__destination--pressed' role='button' aria-label={choice.label} onClick={() => place(choice)}><View className={`atuan-cards__icon atuan-cards__icon--${choice.icon}`} aria-hidden='true'><View className='atuan-cards__icon-shape' /></View><Text>{choice.label}</Text></View>)}</View>
      )}
      <Text className='atuan-cards__atuan-copy'>{mode === 'atuan' && params.approach === 'notice_wait' ? '“刚才那张是你接住的。我们最后看它。”' : config.footer}</Text>
    </View>
  )
}
