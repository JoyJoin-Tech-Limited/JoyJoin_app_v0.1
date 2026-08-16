import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import {
  FirstActAtuanTemplateExperience,
  type FirstActAtuanTemplateConfig,
} from './FirstActAtuanTemplateExperience'
import './AlangFirstActExperience.scss'

export type AlangApproachIndex = 0 | 1
type HighlightId = 'alang' | 'lifebuoy' | 'routeMap' | 'windowChairs'

interface HighlightReply { label: string; response: string }
interface HighlightDefinition {
  id: HighlightId
  label: string
  speech: string
  replies: readonly [HighlightReply, HighlightReply]
}

export const ALANG_FIRST_ACT_HIGHLIGHTS: readonly HighlightDefinition[] = [
  { id: 'alang', label: '阿浪', speech: '面对面坐着，人会急着证明自己。道歉也容易说成争论。', replies: [{ label: '所以道歉才容易听成辩解？', response: '嗯。目光一顶上，话就变硬了。' }, { label: '那就先别急着看对方。', response: '可以。先把呼吸放回自己这边。' }] },
  { id: 'lifebuoy', label: '救生圈绳结', speech: '绳结留了余量。太紧，反而不好解。', replies: [{ label: '关系也该留一点松动。', response: '对。能退半步，才不至于拉断。' }, { label: '但太松，会不会接不住人？', response: '会。所以不是放开，是让彼此能动。' }] },
  { id: 'routeMap', label: '路线地图台', speech: '路线图把转角画得很清楚，却不替人决定往哪走。', replies: [{ label: '说开，也不等于替对方选答案。', response: '准确。说明方向，不封住出口。' }, { label: '绕一点，也可能到同一个地方。', response: '城市懂这个。人也可以。' }] },
  { id: 'windowChairs', label: '窗边双椅', speech: '两把椅子并肩放着，却没有贴在一起；其中一把微微转开，刚好留下回应的角度。', replies: [{ label: '像邀请，不像拦住。', response: '嗯。靠近是动词，不是占位置。' }, { label: '一把稍微转过去，是在等回应？', response: '不是等。是给对方一个愿意转过来的角度。' }] },
] as const

export const ALANG_SPACING_TARGET = { objectCode: 'seat-plan', gameType: 'spacing', distance: 2, angle: 1 } as const
export const alangFirstActStorageKey = (encounterId: string) => `joyjoin:alang:first-act:v2:${encounterId}`

const APPROACHES = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-alang'].approaches
const CONFIG: FirstActAtuanTemplateConfig = {
  npcSlug: 'alang', npcName: '阿浪', objectCode: 'seat-plan', rootClassName: 'alang-first-act',
  testId: 'alang-first-act-experience', sceneTestId: 'alang-first-act-scene', fallbackTestId: 'alang-first-act-scene-fallback',
  storageKey: alangFirstActStorageKey,
  highlights: [
    { id: 'alang', label: '阿浪', clue: ALANG_FIRST_ACT_HIGHLIGHTS[0].speech, placementClassName: 'alang-first-act__hotspot--alang' },
    { id: 'lifebuoy', label: '救生圈绳结', clue: ALANG_FIRST_ACT_HIGHLIGHTS[1].speech, placementClassName: 'alang-first-act__hotspot--lifebuoy' },
    { id: 'routeMap', label: '路线地图台', clue: ALANG_FIRST_ACT_HIGHLIGHTS[2].speech, placementClassName: 'alang-first-act__hotspot--routeMap' },
    { id: 'windowChairs', label: '窗边双椅', clue: ALANG_FIRST_ACT_HIGHLIGHTS[3].speech, placementClassName: 'alang-first-act__hotspot--window-chairs' },
  ],
  unlockCopy: '河岸小屋的窗边，原来还放着两把彼此留有余量的椅子。',
  eventLabel: '按住被风掀起的河岸草图',
  eventPrompt: '草图被风掀起，先稳住哪一边？',
  approaches: [
    { label: APPROACHES[0].label, response: APPROACHES[0].response, hint: '先把同一阵风听完' },
    { label: APPROACHES[1].label, response: APPROACHES[1].response, hint: '给彼此留下转身余量' },
  ],
  objectExploration: {
    title: '反复折过的座位图',
    shortLabel: '座位图',
    intro: '阿浪把草图摊平。纸面没有写答案，却留下了三处反复修改的痕迹。',
    details: [
      { id: 'chair-pencil-marks', label: '椅脚铅点', clue: '同一把椅子被轻轻挪过三次。每次只退半格，铅点都没有被擦掉。' },
      { id: 'turning-arc', label: '转身弧线', clue: '椅背旁画着一段浅弧。坐下的人不用起身，也能自然地转开目光。' },
      { id: 'blank-name-line', label: '空着的名字栏', clue: '两把椅子旁都留着名字栏。阿浪只写了自己的名字，另一格仍然空着。' },
    ],
    followUpPrompt: '看完这张图，你想先问阿浪什么？',
    followUps: [
      { label: '你一直改的，是椅子，还是开口的距离？', response: '一开始是椅子。后来才承认，我是在找一句不会逼人的邀请。', narration: '那几处铅点不是犹豫的废稿，而是阿浪一次次给对方留出的退路。' },
      { label: '如果对方把椅子再挪远一点呢？', response: '那就远一点。能自己选择的位置，才算真的舒服。', narration: '空着的名字栏没有被补上。邀请可以被说清楚，位置仍由坐下的人决定。' },
    ],
    gamePrompt: '座位图里的余量已经看清。接下来替两把椅子找到合适的位置。',
  },
  conversationNarration: '四处线索接成了同一个意思：并肩不等于逼近，留白也不是疏远。',
  gameAction: '和阿浪一起摆好两把椅子',
  successSpeech: '这样刚好。坐得见彼此，也都有转开的余地。',
  successNarration: '三次选择落定后，两把椅子终于不像对质，也不像逃开。',
  completionLabel: '完成阿浪第一幕',
}

export interface AlangFirstActExperienceProps {
  encounterId: string
  scene: string
  disabled?: boolean
  onSpeechChange: (speech: string) => void
  onComplete: (approachIndex: AlangApproachIndex) => void | Promise<void>
}

export function AlangFirstActExperience(props: AlangFirstActExperienceProps) {
  return <FirstActAtuanTemplateExperience {...props} config={CONFIG} />
}
