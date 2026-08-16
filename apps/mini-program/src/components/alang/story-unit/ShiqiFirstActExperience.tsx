import { FirstActAtuanTemplateExperience, type FirstActAtuanTemplateConfig } from './FirstActAtuanTemplateExperience'
import './ShiqiFirstActExperience.scss'

type ApproachIndex = 0 | 1
type HotspotId = 'shiqi' | 'outing-book' | 'exchange-box' | 'inspection-light'
interface HighlightReply { id: string; label: string; response: string }
export interface ShiqiFirstActHighlight { id: HotspotId; label: string; observation: string; replies: readonly [HighlightReply, HighlightReply] }

export const SHIQI_FIRST_ACT_HIGHLIGHTS: readonly ShiqiFirstActHighlight[] = [
  { id: 'shiqi', label: '拾柒本人', observation: '拾柒没有直接圈结论。他把三份记录错开半页，只让三张纸都留下的压线露出来。', replies: [{ id: 'confirm-common-trace', label: '你先找三张纸都有的痕迹？', response: '对。三张纸都留下的痕迹，才能先记成事实。' }, { id: 'ask-revision', label: '你怀疑有人改过记录？', response: '先别急着说“改过”。目前只能确认，有些内容写得更晚。' }] },
  { id: 'outing-book', label: '外出记录册', observation: '三条路线都向东折，但只有两页的折返点有相同浅痕；第三页的箭头墨迹更新。', replies: [{ id: 'direction-is-not-route', label: '方向相同，不代表走法相同。', response: '准确。方向是结果，折返点才接近过程。' }, { id: 'set-arrow-aside', label: '先把新箭头放到一边。', response: '可以。不是删除，只是暂时不让它替浅痕发言。' }] },
  { id: 'exchange-box', label: '交换箱', observation: '交换箱的取件槽留着三道平行压痕，最上面一层比下面两层宽半格。', replies: [{ id: 'not-same-time', label: '三份记录可能不是同时放进去的。', response: '这是可检验的判断。压痕先后，比猜测动机可靠。' }, { id: 'later-insert', label: '最上层也许后来被补放。', response: '可以保留“也许”。在对齐前，不把它写成事实。' }] },
  { id: 'inspection-light', label: '竖向检视灯箱', observation: '灯箱透过三层路线纸：三张纸共同的折线完全重合，后来写上的备注各自偏了一个方向。', replies: [{ id: 'fact-and-interpretation', label: '先记三张纸都有的，再看后来写的。', response: '准确。先把共同部分单独留下。' }, { id: 'align-first', label: '先把三层纸对齐再判断。', response: '对。让纸自己证明哪里重合，不让说法抢先。' }] },
] as const

export const getShiqiFirstActStorageKey = (encounterId: string) => `joyjoin:flash:shiqi-first-act:v2:${encounterId}`
const PLACEMENTS = ['shiqi-first-act__hotspot--shiqi', 'shiqi-first-act__hotspot--outing-book', 'shiqi-first-act__hotspot--exchange-box', 'shiqi-first-act__hotspot--inspection-light'] as const
const CONFIG: FirstActAtuanTemplateConfig = {
  npcSlug: 'shiqi', npcName: '拾柒', objectCode: 'outing-book', rootClassName: 'shiqi-first-act',
  testId: 'shiqi-first-act-experience', sceneTestId: 'shiqi-first-act-scene', fallbackTestId: 'shiqi-first-act-scene-fallback', storageKey: getShiqiFirstActStorageKey,
  highlights: [
    { id: 'shiqi', label: SHIQI_FIRST_ACT_HIGHLIGHTS[0].label, clue: SHIQI_FIRST_ACT_HIGHLIGHTS[0].observation, placementClassName: PLACEMENTS[0] },
    { id: 'outing-book', label: SHIQI_FIRST_ACT_HIGHLIGHTS[1].label, clue: SHIQI_FIRST_ACT_HIGHLIGHTS[1].observation, placementClassName: PLACEMENTS[1] },
    { id: 'exchange-box', label: SHIQI_FIRST_ACT_HIGHLIGHTS[2].label, clue: SHIQI_FIRST_ACT_HIGHLIGHTS[2].observation, placementClassName: PLACEMENTS[2] },
    { id: 'inspection-light', label: SHIQI_FIRST_ACT_HIGHLIGHTS[3].label, clue: SHIQI_FIRST_ACT_HIGHLIGHTS[3].observation, placementClassName: PLACEMENTS[3] },
  ],
  unlockCopy: '三处记录都指向同一组共同痕迹，竖向检视灯箱在纸层后亮了起来。', eventLabel: '替拾柒接住滑下灯箱的路线纸', eventPrompt: '灯箱忽然一亮，先稳住哪一层？',
  approaches: [{ label: '先找三张纸都有的痕迹', response: '稳妥。三张纸共同留下的，先单独记下来。', hint: '先看共同留下的部分' }, { label: '把后来写上的箭头放到旁边', response: '可以。先看共同部分，再判断后来加上的内容。', hint: '把后写的内容分开' }],
  objectExploration: {
    title: '灯箱里的三层路线纸',
    shortLabel: '三层路线纸',
    intro: '拾柒把三张纸压在灯箱上。亮光穿过纸面，让共同留下的痕迹和后来写上的内容分开。',
    details: [
      { id: 'shared-turn', label: '同一个折返点', clue: '三张纸在同一个位置都向东折。纸面受力留下的细线完全重合。' },
      { id: 'later-arrow', label: '后写的箭头', clue: '只有最上层多出一枚深色箭头。它没有压进下面两张纸，显然写得更晚。' },
      { id: 'offset-corners', label: '错开的页角', clue: '三张纸的页角各错开半格，刚好能看见每一层原本留下的线，没有谁遮住谁。' },
    ],
    followUpPrompt: '看完三层纸，你想先和拾柒确认什么？',
    followUps: [
      { label: '哪些是三张纸都能证明的？', response: '同一个折返点，和相同的压痕。先把它们记成共同事实。', narration: '三层纸共同留下的部分被单独圈出。它们不解释原因，只证明同一个位置曾经被折过。' },
      { label: '那些后来写上的箭头怎么办？', response: '单独放着。它们可能有用，但不能替三张纸共同留下的痕迹作证。', narration: '深色箭头被移到旁边，没有被丢掉，也没有混进三张纸共同证明的部分。' },
    ],
    gamePrompt: '共同痕迹和后来标记已经分开。接下来把三层路线纸依次对齐。',
  },
  conversationNarration: '记录册和交换箱留下了线索；亮起的灯箱让三张纸共同的部分清楚地重合。', gameAction: '和拾柒一起核对三层路线纸',
  successSpeech: '现在可以确认：三张纸在同一个位置都留下了痕迹。至于原因，先不替它们回答。', successNarration: '三层纸逐一归位，共同痕迹与后来写上的说明终于分开。', completionLabel: '完成拾柒第一幕',
}

export interface ShiqiFirstActExperienceProps { encounterId: string; scene: string; disabled?: boolean; onSpeechChange: (speech: string) => void; onComplete: (approachIndex: ApproachIndex) => void }
export function ShiqiFirstActExperience(props: ShiqiFirstActExperienceProps) { return <FirstActAtuanTemplateExperience {...props} config={CONFIG} /> }
