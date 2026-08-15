import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import { FirstActAtuanTemplateExperience, type FirstActAtuanTemplateConfig } from './FirstActAtuanTemplateExperience'
import './MomoFirstActExperience.scss'

type ApproachIndex = 0 | 1
interface HighlightReply { label: string; response: string }
interface MomoHighlight { id: 'momo' | 'listening-window' | 'route-sign' | 'route-book'; label: string; speech: string; hotspotClass: string; replies: readonly [HighlightReply, HighlightReply] }

export const MOMO_FIRST_ACT_HIGHLIGHTS: readonly MomoHighlight[] = [
  { id: 'momo', label: '默默本人', speech: '最后一条实线在空白页前停住。……我不是走丢，只是不确定停下算不算选择。', hotspotClass: 'momo-first-act__hotspot--momo', replies: [{ label: '你在确认终点，还是确认自己想不想继续？', response: '后一个。终点有标记，我没有。' }, { label: '先别替空白页补路线。', response: '……嗯。空着，也是一条记录。' }] },
  { id: 'listening-window', label: '听音窗', speech: '檐水先密，后来慢下来。第三次间隔最长。', hotspotClass: 'momo-first-act__hotspot--listening-window', replies: [{ label: '把变慢的三次当作路标。', response: '可以。声音不会把空白填满。' }, { label: '只记最后一次安静下来。', response: '太少。前两次能确认方向。' }] },
  { id: 'route-sign', label: '竖向路线牌', speech: '折线在中段向里收，末端没有箭头。', hotspotClass: 'momo-first-act__hotspot--route-sign', replies: [{ label: '没有箭头，就别替它继续。', response: '……这句可以写在页边。' }, { label: '先沿三处折点核对。', response: '对。折点比猜方向可靠。' }] },
  { id: 'route-book', label: '路线书台', speech: '册子写到第三段。实线在空白页前停住，墨没有蹭开。', hotspotClass: 'momo-first-act__hotspot--route-book', replies: [{ label: '不是没写完，是主动收笔。', response: '纸面很干净。像是刻意停下。' }, { label: '先确认前三段能互相对上。', response: '嗯。声音、折点、实线，顺序能接上。' }] },
] as const

export const momoFirstActStorageKey = (encounterId: string) => `joyjoin:flash:momo-first-act:v2:${encounterId}`
const APPROACHES = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-momo'].approaches
const CONFIG: FirstActAtuanTemplateConfig = {
  npcSlug: 'momo', npcName: '默默', objectCode: 'route-book', rootClassName: 'momo-first-act',
  testId: 'momo-first-act-experience', sceneTestId: 'momo-first-act-scene', fallbackTestId: 'momo-first-act-scene-fallback', storageKey: momoFirstActStorageKey,
  highlights: [
    { id: 'momo', label: MOMO_FIRST_ACT_HIGHLIGHTS[0].label, clue: MOMO_FIRST_ACT_HIGHLIGHTS[0].speech, placementClassName: MOMO_FIRST_ACT_HIGHLIGHTS[0].hotspotClass },
    { id: 'listening-window', label: MOMO_FIRST_ACT_HIGHLIGHTS[1].label, clue: MOMO_FIRST_ACT_HIGHLIGHTS[1].speech, placementClassName: MOMO_FIRST_ACT_HIGHLIGHTS[1].hotspotClass },
    { id: 'route-sign', label: MOMO_FIRST_ACT_HIGHLIGHTS[2].label, clue: MOMO_FIRST_ACT_HIGHLIGHTS[2].speech, placementClassName: MOMO_FIRST_ACT_HIGHLIGHTS[2].hotspotClass },
    { id: 'route-book', label: MOMO_FIRST_ACT_HIGHLIGHTS[3].label, clue: MOMO_FIRST_ACT_HIGHLIGHTS[3].speech, placementClassName: MOMO_FIRST_ACT_HIGHLIGHTS[3].hotspotClass },
  ],
  unlockCopy: '三处声音与折点对上以后，路线书台上的册子自己翻到了空白页。',
  eventLabel: '替默默扶住晃动的路线册', eventPrompt: '风又钻进站亭，先按住哪一处？',
  approaches: [{ label: APPROACHES[0].label, response: APPROACHES[0].response, hint: '承认停下也是选择' }, { label: APPROACHES[1].label, response: APPROACHES[1].response, hint: '沿着证据走到页边' }],
  conversationNarration: '檐水、折点和实线依次接上；空白页没有催促默默继续。', gameAction: '和默默一起整理三段路线',
  successSpeech: '……对。走到这里就够了。停下不是走丢。', successNarration: '三段路线各自有了落点，最后的空白仍然保持空白。', completionLabel: '完成默默第一幕',
}

export interface MomoFirstActExperienceProps { encounterId: string; scene: string; disabled: boolean; onSpeechChange: (speech: string) => void; onComplete: (approachIndex: ApproachIndex) => void }
export function MomoFirstActExperience(props: MomoFirstActExperienceProps) { return <FirstActAtuanTemplateExperience {...props} config={CONFIG} /> }
