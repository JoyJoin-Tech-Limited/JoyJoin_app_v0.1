import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import {
  FirstActAtuanTemplateExperience,
  type FirstActAtuanTemplateConfig,
  type FirstActTemplateMigratedProgress,
} from './FirstActAtuanTemplateExperience'
import './LiziFirstActExperience.scss'

export type LiziFirstActApproachIndex = 0 | 1
type HighlightId = 'lizi' | 'palette' | 'swatches' | 'cart'

interface HighlightReply { id: string; label: string; response: string }
interface HighlightDefinition {
  id: HighlightId
  label: string
  speech: string
  replies: readonly [HighlightReply, HighlightReply]
}

export const LIZI_FIRST_ACT_HIGHLIGHTS: readonly HighlightDefinition[] = [
  {
    id: 'lizi', label: '栗子', speech: '栗子压着一卷干掉的彩笔。名字都磨没了，每支笔却还在纸上留下不同的手感。',
    replies: [
      { id: 'trust-marks', label: '名字没了，纸上的试写痕迹还在。', response: '对。颜色会干，留下的手感可不会突然装失忆。' },
      { id: 'keep-dry-markers', label: '都干了，你还留着它们？', response: '画不动不等于没用，它们还能帮我认回那三顶笔帽。' },
    ],
  },
  {
    id: 'palette', label: '左侧色板', speech: '色板上的名字被雨气晕开，只剩软边、细线和断点三种不同节奏。',
    replies: [
      { id: 'read-edges', label: '先看边缘，干掉以后差别更明显。', response: '没错。软边、细线、断点，比名字诚实多了。' },
      { id: 'marks-differ', label: '不叫名字，也能看出每道痕迹不一样。', response: '普通只是远看差不多。凑近了，谁都没那么省事。' },
    ],
  },
  {
    id: 'swatches', label: '悬挂色片', speech: '风把色片吹得轻轻错开，最安静的那一块反而留下最稳定的双细线。',
    replies: [
      { id: 'quiet-is-steady', label: '“静”不一定最淡，可能只是落笔更稳。', response: '这句我收下。稳稳的一笔，不用把自己藏浅。' },
      { id: 'read-rhythm', label: '风把每块色片的节奏吹出来了。', response: '对。先辨节奏，眼睛就不容易被颜色抢答。' },
    ],
  },
  {
    id: 'cart', label: '右侧工具车', speech: '工具车上散着三顶笔帽：圆弧缺口、双细纹、三短刻，正好对应三道试写痕迹。',
    replies: [
      { id: 'use-cuts', label: '这次不猜颜色，认笔帽上的切口。', response: '靠谱。圆弧像暖开的边，双细纹够静，三短刻一看就醒。' },
      { id: 'compare-one-by-one', label: '先把笔帽排开，再和痕迹逐一对照。', response: '好。少一点先入为主，多一点当场核对。' },
    ],
  },
] as const

export function liziFirstActStorageKey(encounterId: string): string {
  return `joyjoin_flash_lizi_first_act_v2_${encounterId}`
}

function migrateLiziV2Progress(value: unknown): FirstActTemplateMigratedProgress | null {
  if (!value || typeof value !== 'object') return null
  const legacy = value as { version?: unknown; phase?: unknown; replies?: unknown; approachIndex?: unknown }
  if (legacy.version !== 'lizi-first-act-v2') return null

  const validIds = new Set(LIZI_FIRST_ACT_HIGHLIGHTS.map(({ id }) => id))
  const replies = legacy.replies && typeof legacy.replies === 'object' ? legacy.replies as Record<string, unknown> : {}
  const seenIds = Object.keys(replies).filter((id) => validIds.has(id as HighlightId))
  const approachIndex = legacy.approachIndex === 0 || legacy.approachIndex === 1 ? legacy.approachIndex : null
  const phase = typeof legacy.phase === 'string' ? legacy.phase : 'arrival'
  const wasAtGame = ['transition', 'inspect', 'pair', 'error'].includes(phase)
  const wasFinished = phase === 'success' || phase === 'complete'

  if ((wasAtGame || wasFinished) && approachIndex !== null) {
    return {
      stage: wasFinished ? 'success' : 'conversation',
      seenIds: LIZI_FIRST_ACT_HIGHLIGHTS.map(({ id }) => id),
      activeId: null,
      approachIndex,
      objectSeenIds: ['soft-arc', 'fine-lines', 'short-notches'],
      activeObjectId: null,
      followUpIndex: 0,
    }
  }

  return {
    stage: seenIds.length === LIZI_FIRST_ACT_HIGHLIGHTS.length ? 'event' : 'scene',
    seenIds,
    activeId: null,
    approachIndex: null,
    objectSeenIds: [],
    activeObjectId: null,
    followUpIndex: null,
  }
}

const APPROACHES = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-lizi'].approaches
const CONFIG: FirstActAtuanTemplateConfig = {
  npcSlug: 'lizi',
  npcName: '栗子',
  objectCode: 'dry-markers',
  rootClassName: 'lizi-first-act',
  testId: 'lizi-first-act',
  sceneTestId: 'lizi-first-act-scene',
  fallbackTestId: 'lizi-first-act-scene-fallback',
  storageKey: liziFirstActStorageKey,
  migrateLegacyProgress: migrateLiziV2Progress,
  highlights: [
    { id: 'lizi', label: LIZI_FIRST_ACT_HIGHLIGHTS[0].label, clue: LIZI_FIRST_ACT_HIGHLIGHTS[0].speech, placementClassName: 'lizi-first-act__target--lizi' },
    { id: 'palette', label: LIZI_FIRST_ACT_HIGHLIGHTS[1].label, clue: LIZI_FIRST_ACT_HIGHLIGHTS[1].speech, placementClassName: 'lizi-first-act__target--palette' },
    { id: 'swatches', label: LIZI_FIRST_ACT_HIGHLIGHTS[2].label, clue: LIZI_FIRST_ACT_HIGHLIGHTS[2].speech, placementClassName: 'lizi-first-act__target--swatches' },
    { id: 'cart', label: LIZI_FIRST_ACT_HIGHLIGHTS[3].label, clue: LIZI_FIRST_ACT_HIGHLIGHTS[3].speech, placementClassName: 'lizi-first-act__target--cart' },
  ],
  unlockCopy: '工具车最上层露出三顶散开的笔帽，切口形状正好各不相同。',
  eventLabel: '接住滚向桌沿的三支彩笔',
  eventPrompt: '风掀开布卷，先按住哪一边？',
  approaches: [
    { label: APPROACHES[0].label, response: APPROACHES[0].response, hint: '先相信纸上留下的手感' },
    { label: APPROACHES[1].label, response: APPROACHES[1].response, hint: '先让三种节奏各自站稳' },
  ],
  objectExploration: {
    title: '摊开的三道试写痕迹',
    shortLabel: '试写纸',
    intro: '栗子把试写纸铺平。颜色已经褪淡，三种不同的落笔节奏却还清清楚楚。',
    details: [
      { id: 'soft-arc', label: '暖开的软弧边', clue: '第一道痕迹转弯很慢，边缘像被掌心焐开。它记住的是“暖”。' },
      { id: 'fine-lines', label: '安静的双细线', clue: '两条细线平稳贴在一起，一路没有忽深忽浅。它记住的是“静”。' },
      { id: 'short-notches', label: '醒目的短断点', clue: '三次短促起笔间隔清楚，像刚刚睁开眼。它记住的是“醒”。' },
    ],
    followUpPrompt: '看完三道痕迹，你想先问栗子什么？',
    followUps: [
      { label: '名字都没了，你为什么还认得它们？', response: '因为手感没走。软弧、双细线、短断点，还是各有各的脾气。', narration: '褪掉的颜色没有被重新命名；三种落笔节奏自己留下了证据。' },
      { label: '如果颜色看起来很像呢？', response: '先别让颜色抢答。看它怎么转弯、怎么停，再去找对应的笔帽。', narration: '栗子把三顶笔帽翻到背面，圆弧、双细纹和三短刻依次露出来。' },
    ],
    gamePrompt: '三种手感已经认清。接下来把对应的笔帽一顶一顶配回去。',
  },
  conversationNarration: '四处线索接在一起：名字会模糊，落笔的节奏和笔帽的切口不会。',
  gameAction: '和栗子一起配回三顶笔帽',
  successSpeech: '配上了。名字没有回来，可“暖、静、醒”都找到了自己的位置。',
  successNarration: '三顶笔帽依次归位，栗子把五支彩笔重新卷进布里。',
  completionLabel: '完成栗子第一幕',
}

export interface LiziFirstActExperienceProps {
  encounterId: string
  scene: string
  disabled?: boolean
  onSpeechChange: (speech: string) => void
  onComplete: (approachIndex: LiziFirstActApproachIndex) => void | Promise<void>
}

export function LiziFirstActExperience(props: LiziFirstActExperienceProps) {
  return <FirstActAtuanTemplateExperience {...props} config={CONFIG} />
}
