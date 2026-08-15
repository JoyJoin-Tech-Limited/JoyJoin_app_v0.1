import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import { FirstActAtuanTemplateExperience, type FirstActAtuanTemplateConfig } from './FirstActAtuanTemplateExperience'
import './ShiqiFirstActExperience.scss'

type ApproachIndex = 0 | 1
type HotspotId = 'shiqi' | 'outing-book' | 'exchange-box' | 'inspection-light'
interface HighlightReply { id: string; label: string; response: string }
export interface ShiqiFirstActHighlight { id: HotspotId; label: string; observation: string; replies: readonly [HighlightReply, HighlightReply] }

export const SHIQI_FIRST_ACT_HIGHLIGHTS: readonly ShiqiFirstActHighlight[] = [
  { id: 'shiqi', label: '拾柒本人', observation: '拾柒没有直接圈结论。他把三份记录错开半页，只让纸张最浅的压痕露出来。', replies: [{ id: 'confirm-common-trace', label: '你先确认共同的浅痕？', response: '对。共同出现的压痕，才有资格先被叫作事实。' }, { id: 'ask-revision', label: '你怀疑有人改过记录？', response: '先别用“改过”。目前只能说，有些解释写得更晚。' }] },
  { id: 'outing-book', label: '外出记录册', observation: '三条路线都向东折，但只有两页的折返点有相同浅痕；第三页的箭头墨迹更新。', replies: [{ id: 'direction-is-not-route', label: '方向相同，不代表走法相同。', response: '准确。方向是结果，折返点才接近过程。' }, { id: 'set-arrow-aside', label: '先把新箭头放到一边。', response: '可以。不是删除，只是暂时不让它替浅痕发言。' }] },
  { id: 'exchange-box', label: '交换箱', observation: '交换箱的取件槽留着三道平行压痕，最上面一层比下面两层宽半格。', replies: [{ id: 'not-same-time', label: '三份记录可能不是同时放进去的。', response: '这是可检验的判断。压痕先后，比猜测动机可靠。' }, { id: 'later-insert', label: '最上层也许后来被补放。', response: '可以保留“也许”。在对齐前，不把它写成事实。' }] },
  { id: 'inspection-light', label: '竖向检视灯箱', observation: '灯箱透过三层路线纸：底层的折线一致，上层备注各自偏了一个方向。', replies: [{ id: 'fact-and-interpretation', label: '事实在底层，解释浮在上层。', response: '接近。更严谨地说：底层目前更稳定。' }, { id: 'align-first', label: '先把三层浅痕对齐再判断。', response: '对。让纸自己证明重合，不让措辞抢先。' }] },
] as const

export const getShiqiFirstActStorageKey = (encounterId: string) => `joyjoin:flash:shiqi-first-act:v2:${encounterId}`
const APPROACHES = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-shiqi'].approaches
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
  unlockCopy: '三处记录都指向同一组浅痕，竖向检视灯箱在纸层后亮了起来。', eventLabel: '替拾柒接住滑下灯箱的路线纸', eventPrompt: '灯箱忽然一亮，先稳住哪一层？',
  approaches: [{ label: APPROACHES[0].label, response: APPROACHES[0].response, hint: '先让共同浅痕说话' }, { label: APPROACHES[1].label, response: APPROACHES[1].response, hint: '把后来补写的内容分开' }],
  conversationNarration: '人物、记录册与交换箱只提供事实；亮起的灯箱才让三层纸彼此校准。', gameAction: '和拾柒一起核对三层路线纸',
  successSpeech: '现在可以说：底层的痕迹一致。至于为什么，先留在下一页。', successNarration: '三层纸逐一归位，事实与解释终于没有叠在一起。', completionLabel: '完成拾柒第一幕',
}

export interface ShiqiFirstActExperienceProps { encounterId: string; scene: string; disabled?: boolean; onSpeechChange: (speech: string) => void; onComplete: (approachIndex: ApproachIndex) => void }
export function ShiqiFirstActExperience(props: ShiqiFirstActExperienceProps) { return <FirstActAtuanTemplateExperience {...props} config={CONFIG} /> }
