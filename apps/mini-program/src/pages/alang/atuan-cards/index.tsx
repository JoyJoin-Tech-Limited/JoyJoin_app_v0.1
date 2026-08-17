import Taro, { useRouter } from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { ATUAN_FIRST_ACT_CARDS } from '@shared/alang/atuanFirstAct'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { deterministicGameOrder, getFailureAssistance } from '../../../lib/alang/flashGameDifficulty'
import {
  createFlashActGameProgress,
  restoreFlashActGameProgress,
  type FlashActGamePlacement as Placement,
  type FlashActGameProgress,
} from '../../../lib/alang/flashActGameProgress'
import './index.scss'

type GameMode = 'atuan' | 'alang' | 'lizi' | 'momo' | 'shiqi'

export interface GameChoice { id: string; label: string; icon: 'spark' | 'letter' | 'cover'; feedback: string; isCorrect?: boolean }
export interface GameItem { id: string; label: string; observation: string; clue: string; choices: readonly [GameChoice, GameChoice, GameChoice] }
export interface GameConfig { eyebrow: string; title: string; copy: string; speaker: string; footer: string; items: readonly GameItem[] }
const ATUAN_CHOICES: readonly [GameChoice, GameChoice, GameChoice] = [
  { id: 'keep', label: '可以一起记住', icon: 'spark', feedback: '“好。能让人觉得被记住，又不会让他不自在的事，可以留下。”' },
  { id: 'return', label: '只留给卡上的人', icon: 'letter', feedback: '“那就装进信封，只交给卡上的人。别人不需要替他读完。”' },
  { id: 'cover', label: '先替他遮住', icon: 'cover', feedback: '“嗯，先盖住。等我问过他，再决定这句话该不该留下。”' },
]

export const FIRST_ACT_GAME_CONFIGS: Record<GameMode, GameConfig> = {
  atuan: {
    eyebrow: '阿团的小纸袋', title: '替卡片找个舒服的位置', copy: '不是猜标准答案。你在决定：这句话可以被谁看见。', speaker: '阿团', footer: '“纸袋里的短线你看见了。帮我再数一次。”',
    items: ATUAN_FIRST_ACT_CARDS.map((card) => ({
      id: card.id,
      label: card.label,
      observation: card.id === 'city' ? '这件小事不指向具体行踪，分享后只会留下共同记忆。' : card.id === 'habit' ? '习惯指向一个具体的人，应该先把阅读权还给卡片主人。' : '固定时间会暴露行踪，在本人答应以前需要先遮住。',
      clue: card.id === 'city' ? '找不会让人被定位、却值得一起记住的位置。' : card.id === 'habit' ? '谁是这句话的主人，就把决定权交还给谁。' : '先保护能推断出行踪的细节。',
      choices: ATUAN_CHOICES.map((choice) => ({ ...choice, isCorrect: choice.id === card.destination })) as unknown as readonly [GameChoice, GameChoice, GameChoice],
    })),
  },
  alang: {
    eyebrow: '阿浪的窗边双椅', title: '把邀请摆成舒服的并肩', copy: '一次只处理一个决定。选完以后，先听阿浪怎么说。', speaker: '阿浪', footer: '“靠近不是占住位置。让两个人都还能转身。”',
    items: [
      { id: 'distance', label: '先决定两把椅子之间的距离', observation: '地面两道浅痕相隔半步，近到能听见，远到不必贴住。', clue: '寻找既能交谈、又保留呼吸感的距离。', choices: [{ id: 'close', label: '紧紧挨在一起', icon: 'cover', feedback: '“太近了，像两句话都在抢先。再给呼吸留一点位置。”' }, { id: 'half-step', label: '留出半步距离', icon: 'spark', feedback: '“这个距离刚好。听得见，也不用马上面对彼此。”', isCorrect: true }, { id: 'far', label: '各放在窗户两端', icon: 'letter', feedback: '“有点远，邀请会被风吹散。可以再靠近一点。”' }] },
      { id: 'angle', label: '再决定椅背朝向哪里', observation: '椅脚磨痕朝着同一片水面微微内收，没有完全相对。', clue: '并肩不是背对，也不是要求对视。', choices: [{ id: 'face', label: '完全面对面', icon: 'cover', feedback: '“太像必须立刻说清楚的对质。”' }, { id: 'same', label: '微微朝向同一边', icon: 'spark', feedback: '“嗯，并肩看同一片水，也还看得见彼此。”', isCorrect: true }, { id: 'away', label: '各自转向两边', icon: 'letter', feedback: '“这样更像散场，不像邀请。”' }] },
      { id: 'exit', label: '最后，给对方留不留离开的余地', observation: '靠外一侧没有椅脚痕，像是有人一直保留起身的通道。', clue: '舒服的邀请必须允许对方自由离开。', choices: [{ id: 'block', label: '把椅子抵住墙角', icon: 'cover', feedback: '“没有退路的靠近，会让人先想逃开。”' }, { id: 'open', label: '留出能起身的通道', icon: 'spark', feedback: '“对。愿意留下，应该是选择，不是被困住。”', isCorrect: true }, { id: 'separate', label: '干脆只留一把椅子', icon: 'letter', feedback: '“那就没有邀请了。两把都留着，答案交给来的人。”' }] },
    ],
  },
  lizi: {
    eyebrow: '栗子的试色桌', title: '把三顶笔帽配回原位', copy: '一次只核对一道痕迹。先看落笔节奏，再找相同形状的切口。', speaker: '栗子', footer: '“名字会磨掉，手感还会留在纸上。”',
    items: [
      { id: 'warm', label: '第一道：边缘缓缓转成一段软弧', observation: '墨迹在转弯处没有断开，像被手腕慢慢带出一个圆弧。', clue: '让笔帽的缺口形状接住这段连续软弧。', choices: [{ id: 'fine-pair', label: '配双细纹帽', icon: 'cover', feedback: '“这顶太直了，接不上软弧。再看它转弯的形状。”' }, { id: 'soft-arc', label: '配圆弧缺口帽', icon: 'spark', feedback: '“对。圆弧接住软边，这支笔记住的是‘暖’。”', isCorrect: true }, { id: 'quick-notch', label: '配三短刻帽', icon: 'letter', feedback: '“短刻太急，和这道慢慢转弯的痕迹不是同一种节奏。”' }] },
      { id: 'quiet', label: '第二道：两条细线平稳地贴在一起', observation: '两条细线间距始终相同，没有交叉，也没有突然停顿。', clue: '寻找能和两条平行细线保持同一节奏的刻纹。', choices: [{ id: 'soft-arc', label: '配圆弧缺口帽', icon: 'cover', feedback: '“圆弧太松了。这里留下的是两条始终并行的细线。”' }, { id: 'fine-pair', label: '配双细纹帽', icon: 'spark', feedback: '“接上了。两道细纹不抢位置，这支笔记住的是‘静’。”', isCorrect: true }, { id: 'quick-notch', label: '配三短刻帽', icon: 'letter', feedback: '“短刻会把线打断。再找一顶能和双细线并排的。”' }] },
      { id: 'awake', label: '第三道：三次短促起笔，停顿清楚', observation: '三个短点力度相近，中间各留一次清楚的呼吸。', clue: '找同样由三次短促节奏组成的笔帽刻口。', choices: [{ id: 'soft-arc', label: '配圆弧缺口帽', icon: 'cover', feedback: '“这道痕迹没有慢慢转弯。它是三次很清楚的短起笔。”' }, { id: 'quick-notch', label: '配三短刻帽', icon: 'spark', feedback: '“就是它。三道短刻对上三次起笔，这支笔记住的是‘醒’。”', isCorrect: true }, { id: 'fine-pair', label: '配双细纹帽', icon: 'letter', feedback: '“双细纹太连贯了，接不上这三次有间隔的停顿。”' }] },
    ],
  },
  momo: {
    eyebrow: '默默的路线册', title: '把三段雨路放回顺序', copy: '一次核对一段。路线走到空白以前，就可以停下。', speaker: '默默', footer: '“空着，也是一条记录。别替它补完。”',
    items: [
      { id: 'rain', label: '第一段：檐水由密变疏', observation: '雨滴前三次间隔依次变长，第四格没有新的水印。', clue: '先确认变化持续发生，不追逐尚未出现的下一滴。', choices: [{ id: 'skip', label: '直接跳到最后一滴', icon: 'cover', feedback: '“太快了。前两次间隔能确认变化不是偶然。”' }, { id: 'listen', label: '听完三次间隔', icon: 'spark', feedback: '“嗯。声音慢下来，才是这段路的起点。”', isCorrect: true }, { id: 'repeat', label: '一直等到再次下雨', icon: 'letter', feedback: '“不用等新的证据。已经发生的三次足够了。”' }] },
      { id: 'turn', label: '第二段：竖牌在中段向里折', observation: '纸面只保留三处折点，末端没有箭头或方向文字。', clue: '只沿真实留下的折点核对，不猜消失的方向。', choices: [{ id: 'guess', label: '猜箭头原本朝右', icon: 'cover', feedback: '“没有箭头。猜方向会把空白写成答案。”' }, { id: 'trace', label: '只沿三处折点核对', icon: 'spark', feedback: '“对。折点留下了，方向没有。”', isCorrect: true }, { id: 'straight', label: '把折线改成直线', icon: 'letter', feedback: '“那会变成另一条路，不是核对这条路。”' }] },
      { id: 'blank', label: '第三段：实线停在空白页前', observation: '最后一笔在页边收住，空白处没有擦除痕迹。', clue: '尊重主动停笔，不补画，也不抹掉走过的线。', choices: [{ id: 'continue', label: '替它画进空白页', icon: 'cover', feedback: '“走过头了。空白页不是下一段路。”' }, { id: 'stop', label: '在页边主动收笔', icon: 'spark', feedback: '“……对。停下不是走丢，是我决定走到这里。”', isCorrect: true }, { id: 'erase', label: '把最后一段擦掉', icon: 'letter', feedback: '“不用否认走过的部分。只要允许它停下。”' }] },
    ],
  },
  shiqi: {
    eyebrow: '拾柒的检视灯箱', title: '让三层路线纸各自说话', copy: '一次核对一层。先看稳定痕迹，再处理后来写下的解释。', speaker: '拾柒', footer: '“先让纸证明重合，不让措辞抢先。”',
    items: [
      { id: 'base', label: '第一层：三张纸都有的痕迹', observation: '同一处浅痕在三张纸上重合，颜色深浅却各不相同。', clue: '共同出现比颜色浓淡更适合先记成事实。', choices: [{ id: 'story', label: '先猜痕迹是谁留下的', icon: 'cover', feedback: '“还没有证据说明是谁。先只记录它出现在哪里。”' }, { id: 'align', label: '对齐三张纸共同的位置', icon: 'spark', feedback: '“可以。三张纸都留下的痕迹，才能先记成共同事实。”', isCorrect: true }, { id: 'ignore', label: '只看颜色最深的一笔', icon: 'letter', feedback: '“颜色深不代表出现得早。三张纸共同留下的更可靠。”' }] },
      { id: 'copy', label: '第二层：路线复写', observation: '三层在折返点重合，箭头方向却出现两种不同画法。', clue: '逐处比较过程，别让最新箭头覆盖差异。', choices: [{ id: 'merge', label: '和底层直接叠成一张', icon: 'cover', feedback: '“先别合并。重合与不同都需要被看见。”' }, { id: 'compare', label: '沿折返点逐处比较', icon: 'spark', feedback: '“准确。方向是结果，折返点更接近过程。”', isCorrect: true }, { id: 'newest', label: '只相信最新的箭头', icon: 'letter', feedback: '“新只能说明时间，不能自动说明正确。”' }] },
      { id: 'note', label: '第三层：后来补写的说明', observation: '说明文字的墨色更新，只存在于最上面一层。', clue: '保留说明，但把它和三层共同痕迹分开。', choices: [{ id: 'fact', label: '把说明直接当成事实', icon: 'cover', feedback: '“这段说明还没有被证明，不能抢在共同痕迹前面。”' }, { id: 'separate', label: '单独放在共同痕迹旁边', icon: 'spark', feedback: '“对。现在能同时看见共同留下的部分，和后来写上的说法。”', isCorrect: true }, { id: 'discard', label: '把说明全部丢掉', icon: 'letter', feedback: '“不用删除。先分开放着，以后仍然可以核对。”' }] },
    ],
  },
}

export default function AtuanCardsPage() {
  const { params } = useRouter()
  const mode: GameMode = params.mode === 'alang' || params.mode === 'lizi' || params.mode === 'momo' || params.mode === 'shiqi' ? params.mode : 'atuan'
  const storageKey = decodeURIComponent(params.key ?? '')
  const config = FIRST_ACT_GAME_CONFIGS[mode]
  const unitId = params.unitId ?? `s1-p1-${mode}`
  const parsedPhase = Number(params.phase)
  const phase = (parsedPhase === 2 || parsedPhase === 3 ? parsedPhase : 1) as 1 | 2 | 3
  const orderedItems = useMemo(() => mode === 'atuan' && params.approach === 'notice_wait' ? [...config.items].reverse() : [...config.items], [config.items, mode, params.approach])
  const [saved, setSaved] = useState<FlashActGameProgress>(() => {
    const expected = { unitId, phase, mode, itemIds: orderedItems.map(({ id }) => id) }
    try { return restoreFlashActGameProgress(Taro.getStorageSync(storageKey), expected) } catch { return createFlashActGameProgress(expected) }
  })
  const returningRef = useRef(false)
  const [returnError, setReturnError] = useState('')
  const index = Math.min(saved.placements.length, orderedItems.length - 1)
  const placements = saved.placements
  const item = orderedItems[index]
  const orderedChoices = useMemo(() => item ? deterministicGameOrder(item.choices, `${storageKey}:${item.id}`) : [], [item, storageKey])
  const pendingChoice = saved.pending && item
    ? item.choices.find(({ id }) => id === saved.pending?.destinationId) ?? null
    : null
  const pending = saved.pending && pendingChoice
    ? { placement: saved.pending, feedback: pendingChoice.feedback, isCorrect: pendingChoice.isCorrect === true }
    : null
  const revealed = Boolean(item && saved.revealedItemIds.includes(item.id))
  const itemAttempts = item ? saved.attemptsByItem[item.id] ?? 0 : 0
  const assistance = getFailureAssistance(itemAttempts)
  const feedbackAssistance = getFailureAssistance(itemAttempts + (pending && !pending.isCorrect ? 1 : 0))

  const persist = (next: FlashActGameProgress) => {
    setSaved(next)
    if (!storageKey) return
    try { Taro.setStorageSync(storageKey, next) } catch { /* Story remains recoverable from its act screen. */ }
  }

  const returnToStory = async () => {
    if (returningRef.current) return
    returningRef.current = true
    setReturnError('')

    try {
      if (Taro.getCurrentPages().length > 1) {
        await Taro.navigateBack()
        return
      }
    } catch {
      // The parent webview can disappear while WeChat is processing another
      // route. Rebuild the Flash stack from its server-owned home instead.
    }

    try {
      await Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.alangEvent })
    } catch {
      returningRef.current = false
      setReturnError('页面暂时没有接上。请再点一次返回，进度已经保存。')
    }
  }

  const place = (choice: GameChoice) => {
    if (!item || !revealed || pending) return
    persist({ ...saved, pending: { cardId: item.id, destinationId: choice.id } })
  }

  const reveal = () => {
    if (!item || revealed || pending) return
    persist({ ...saved, revealedItemIds: [...saved.revealedItemIds, item.id] })
  }

  const applyAssistance = () => {
    if (!item || !assistance.assist) return
    const correct = item.choices.find(({ isCorrect }) => isCorrect)
    if (!correct) return
    persist({ ...saved, pending: { cardId: item.id, destinationId: correct.id } })
  }

  const continueSorting = () => {
    if (!pending) return
    if (!pending.isCorrect) {
      const attempts = Math.min(20, itemAttempts + 1)
      persist({ ...saved, pending: null, attemptsByItem: { ...saved.attemptsByItem, [pending.placement.cardId]: attempts } })
      return
    }
    const next = [...placements, pending.placement]
    if (next.length === orderedItems.length) {
      persist({ ...saved, status: 'completed', placements: next, pending: null })
      void returnToStory()
      return
    }
    persist({ ...saved, placements: next, pending: null })
  }

  if (saved.status === 'completed') {
    return (
      <View className='atuan-cards' data-game-mode={mode} data-story-unit={unitId} data-story-phase={phase}>
        <View className='atuan-cards__feedback' role='status' aria-live='polite'>
          <Text className='atuan-cards__feedback-name'>{config.speaker}</Text>
          <Text className='atuan-cards__feedback-copy'>这一段已经整理好了，进度也已经保存。</Text>
          <View
            className='atuan-cards__continue'
            role='button'
            aria-label='回到角色故事'
            onClick={() => { void returnToStory() }}
          >
            <Text>回到角色故事</Text>
          </View>
          {returnError ? <View role='alert'><Text>{returnError}</Text></View> : null}
        </View>
      </View>
    )
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
      {item ? (
        <View className={`atuan-cards__card${revealed ? ' atuan-cards__card--revealed' : ''}`}>
          <View className='atuan-cards__card-string' />
          <Text className='atuan-cards__card-count'>{index + 1} / {orderedItems.length}</Text>
          <Text className='atuan-cards__card-copy'>{revealed ? item.label : '先翻开这一项，观察它留下的痕迹'}</Text>
          {revealed ? <Text className='atuan-cards__observation'>{item.observation}</Text> : (
            <View className='atuan-cards__reveal' hoverClass='atuan-cards__reveal--pressed' role='button' aria-label='翻开并观察这一项' onClick={reveal}><Text>翻开观察</Text></View>
          )}
        </View>
      ) : null}
      {pending ? (
        <View className='atuan-cards__feedback' role='status' aria-live='polite'>
          <Text className='atuan-cards__feedback-name'>{config.speaker}</Text><Text className='atuan-cards__feedback-copy'>{pending.feedback}</Text>
          {!pending.isCorrect && feedbackAssistance.showClue ? <Text className='atuan-cards__clue'>线索：{item?.clue}</Text> : null}
          <View className='atuan-cards__continue' hoverClass='atuan-cards__continue--pressed' role='button' aria-label={!pending.isCorrect ? '再看一次' : index === orderedItems.length - 1 ? '收好最后一项' : '继续整理'} onClick={continueSorting}><Text>{!pending.isCorrect ? '再看一次' : index === orderedItems.length - 1 ? '收好最后一项' : '继续整理'}</Text></View>
        </View>
      ) : revealed ? (
        <View className='atuan-cards__destinations'>{orderedChoices.map((choice) => <View key={choice.id} className='atuan-cards__destination' hoverClass='atuan-cards__destination--pressed' role='button' aria-label={choice.label} onClick={() => place(choice)}><View className={`atuan-cards__icon atuan-cards__icon--${choice.icon}`} aria-hidden='true'><View className='atuan-cards__icon-shape' /></View><Text>{choice.label}</Text></View>)}</View>
      ) : null}
      {!pending && assistance.assist && item ? <View className='atuan-cards__assist' hoverClass='atuan-cards__assist--pressed' role='button' aria-label='请角色标出关键线索' onClick={applyAssistance}><Text>请{config.speaker}标出关键线索</Text></View> : null}
      <Text className='atuan-cards__atuan-copy'>{mode === 'atuan' && params.approach === 'notice_wait' ? '“刚才那张是你接住的。我们最后看它。”' : config.footer}</Text>
    </View>
  )
}
