import Taro from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import { haptics, type HapticType } from '../../../lib/utils/haptics'
import { FirstActDialogueChrome } from './FirstActDialogueChrome'
import { FirstActHighlightOverlay } from './FirstActHighlightOverlay'
import './LiziFirstActExperience.scss'

export type LiziFirstActApproachIndex = 0 | 1

const LIZI_APPROACHES = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-lizi'].approaches

export interface LiziFirstActExperienceProps {
  encounterId: string
  scene: string
  disabled?: boolean
  onSpeechChange: (speech: string) => void
  onComplete: (approachIndex: LiziFirstActApproachIndex) => void
}

type HighlightId = 'lizi' | 'palette' | 'swatches' | 'cart'
type MarkId = 'warm' | 'quiet' | 'awake'
type CapId = 'soft-arc' | 'fine-pair' | 'quick-notch'
type Phase = 'arrival' | 'approach' | 'explore' | 'transition' | 'inspect' | 'pair' | 'error' | 'success' | 'complete'

interface HighlightReply {
  id: string
  label: string
  response: string
  memory: string
}

interface HighlightDefinition {
  id: HighlightId
  label: string
  speech: string
  narration: string
  replies: readonly [HighlightReply, HighlightReply]
}

interface MarkDefinition {
  id: MarkId
  name: string
  texture: string
  clue: string
  speech: string
}

interface CapDefinition {
  id: CapId
  name: string
  hint: string
}

interface LiziFirstActProgress {
  version: 'lizi-first-act-v2'
  encounterId: string
  phase: Phase
  activeHighlight: HighlightId | null
  replies: Partial<Record<HighlightId, string>>
  approachIndex: LiziFirstActApproachIndex | null
  activeMark: MarkId | null
  inspectedMarks: MarkId[]
  selectedCap: CapId | null
  pairings: Partial<Record<MarkId, CapId>>
  attempts: number
}

export const LIZI_FIRST_ACT_HIGHLIGHTS: readonly HighlightDefinition[] = [
  {
    id: 'lizi',
    label: '栗子',
    speech: '来得正好。我正和一卷干掉的彩笔较劲。名字都磨没了，偏偏每支还留着自己的脾气。',
    narration: '栗子压住布卷，把三支没盖笔帽的彩笔排开。',
    replies: [
      {
        id: 'trust-the-marks',
        label: '名字没了，纸上的试写痕迹还在。',
        response: '对，我也这么想。颜色会干，留下的手感可不会突然装失忆。',
        memory: '栗子更相信纸上留下的手感。',
      },
      {
        id: 'ask-why-keep',
        label: '都干了，你还留着它们？',
        response: '当然。画不动不等于没用，至少还能帮我认回那三顶笔帽。',
        memory: '干掉的笔也能帮她认回笔帽。',
      },
    ],
  },
  {
    id: 'palette',
    label: '左侧色板',
    speech: '这块色板以前写满了漂亮名字。雨气一上来，字先糊了，颜色倒还挺坦然。',
    narration: '色板只剩几道断续试色，没有一个名字能完整读出来。',
    replies: [
      {
        id: 'ordinary-is-specific',
        label: '不叫名字，也能看出每道痕迹不一样。',
        response: '好眼力。普通只是远看差不多，凑近了，谁都没那么省事。',
        memory: '远看相近的痕迹，近看各有节奏。',
      },
      {
        id: 'follow-the-edge',
        label: '先看边缘，干掉以后差别更明显。',
        response: '没错。软边、细线、断点——比名字诚实多了。',
        memory: '软边、细线、断点是三种辨认线索。',
      },
    ],
  },
  {
    id: 'swatches',
    label: '悬挂色片',
    speech: '上面的色片不是色卡，是我晒的心情样本。风一吹，最安静的那块反而最好认。',
    narration: '几块色片轻轻错开，只有一块几乎不晃，像把声音收进了纸里。',
    replies: [
      {
        id: 'notice-quiet',
        label: '“静”不一定最淡，可能只是落笔更稳。',
        response: '这句我收下。稳稳的一笔，确实不用把自己藏浅。',
        memory: '“静”来自稳定连贯，不由深浅决定。',
      },
      {
        id: 'notice-rhythm',
        label: '风把每块色片的节奏吹出来了。',
        response: '对。看颜色之前先看节奏，眼睛就不容易被抢答。',
        memory: '先辨节奏，再辨颜色。',
      },
    ],
  },
  {
    id: 'cart',
    label: '右侧工具车',
    speech: '车里找到三顶散开的笔帽。我昨晚凭颜色配过一次——结果一顶都没配对，很有创意。',
    narration: '工具车最上层放着三顶笔帽：圆弧缺口、双细纹、三短刻，各不相同。',
    replies: [
      {
        id: 'use-cut-shapes',
        label: '这次不猜颜色，认笔帽上的切口。',
        response: '靠谱。圆弧像暖开的边，双细纹够静，三短刻一看就醒。',
        memory: '圆弧、双细纹、三短刻分别呼应暖、静、醒。',
      },
      {
        id: 'compare-first',
        label: '先把笔帽排开，再和试写痕迹一一对照。',
        response: '好，少一点先入为主，多一点当场核对。动手。',
        memory: '把笔帽排开，逐一对照试写痕迹。',
      },
    ],
  },
]

const MARKS: readonly MarkDefinition[] = [
  {
    id: 'warm',
    name: '第一道试写痕迹',
    texture: '软弧边',
    clue: '转弯慢，边缘像被掌心焐开。它记住的是“暖”。',
    speech: '这一道不急着往前冲，弯过去还留一点软边。我把它叫“暖”。',
  },
  {
    id: 'quiet',
    name: '第二道试写痕迹',
    texture: '双细线',
    clue: '两条细线平稳连贯，没有忽深忽浅。它记住的是“静”。',
    speech: '这两条线贴得很近，一路没抢谁的声音。它是“静”。',
  },
  {
    id: 'awake',
    name: '第三道试写痕迹',
    texture: '短断点',
    clue: '三次短促起笔，间隔清楚，像刚睁开眼。它记住的是“醒”。',
    speech: '三下都落得干脆，停顿也精神。这个不用犹豫，是“醒”。',
  },
]

const CAPS: readonly CapDefinition[] = [
  { id: 'soft-arc', name: '圆弧缺口帽', hint: '一个柔软圆弧' },
  { id: 'fine-pair', name: '双细纹帽', hint: '两道平行细纹' },
  { id: 'quick-notch', name: '三短刻帽', hint: '三道短促刻痕' },
]

const CORRECT_PAIRINGS: Record<MarkId, CapId> = {
  warm: 'soft-arc',
  quiet: 'fine-pair',
  awake: 'quick-notch',
}

const HIGHLIGHT_IDS = new Set<HighlightId>(LIZI_FIRST_ACT_HIGHLIGHTS.map((item) => item.id))
const MARK_IDS = new Set<MarkId>(MARKS.map((item) => item.id))
const CAP_IDS = new Set<CapId>(CAPS.map((item) => item.id))
const PHASES = new Set<Phase>(['arrival', 'approach', 'explore', 'transition', 'inspect', 'pair', 'error', 'success', 'complete'])

export function liziFirstActStorageKey(encounterId: string): string {
  return `joyjoin_flash_lizi_first_act_v2_${encounterId}`
}

function createProgress(encounterId: string): LiziFirstActProgress {
  return {
    version: 'lizi-first-act-v2',
    encounterId,
    phase: 'arrival',
    activeHighlight: null,
    replies: {},
    approachIndex: null,
    activeMark: null,
    inspectedMarks: [],
    selectedCap: null,
    pairings: {},
    attempts: 0,
  }
}

function restoreProgress(encounterId: string): LiziFirstActProgress {
  const fallback = createProgress(encounterId)
  try {
    const candidate = Taro.getStorageSync(liziFirstActStorageKey(encounterId)) as Partial<LiziFirstActProgress> | null
    if (!candidate || candidate.version !== fallback.version || candidate.encounterId !== encounterId) return fallback
    if (!candidate.phase || !PHASES.has(candidate.phase)) return fallback

    const replies = Object.fromEntries(
      Object.entries(candidate.replies ?? {}).filter(([id, replyId]) => {
        const highlight = LIZI_FIRST_ACT_HIGHLIGHTS.find((item) => item.id === id)
        return Boolean(highlight?.replies.some((reply) => reply.id === replyId))
      }),
    ) as LiziFirstActProgress['replies']
    const inspectedMarks = (candidate.inspectedMarks ?? []).filter((id): id is MarkId => MARK_IDS.has(id as MarkId))
    const pairings = Object.fromEntries(
      Object.entries(candidate.pairings ?? {}).filter(([markId, capId]) => MARK_IDS.has(markId as MarkId) && CAP_IDS.has(capId as CapId)),
    ) as LiziFirstActProgress['pairings']

    const restored: LiziFirstActProgress = {
      ...fallback,
      ...candidate,
      replies,
      inspectedMarks: Array.from(new Set(inspectedMarks)),
      pairings,
      activeHighlight: candidate.activeHighlight && HIGHLIGHT_IDS.has(candidate.activeHighlight) ? candidate.activeHighlight : null,
      activeMark: candidate.activeMark && MARK_IDS.has(candidate.activeMark) ? candidate.activeMark : null,
      selectedCap: candidate.selectedCap && CAP_IDS.has(candidate.selectedCap) ? candidate.selectedCap : null,
      approachIndex: candidate.approachIndex === 0 || candidate.approachIndex === 1 ? candidate.approachIndex : null,
      attempts: Number.isInteger(candidate.attempts) && (candidate.attempts ?? 0) >= 0 ? candidate.attempts! : 0,
    }

    const replyCount = Object.keys(restored.replies).length
    const hasApproach = restored.approachIndex === 0 || restored.approachIndex === 1
    const hasAllReplies = replyCount === LIZI_FIRST_ACT_HIGHLIGHTS.length
    const hasAllMarks = restored.inspectedMarks.length === MARKS.length
    const hasUniquePairings = new Set(Object.values(restored.pairings)).size === Object.values(restored.pairings).length
    const hasCorrectPairings = MARKS.every((mark) => restored.pairings[mark.id] === CORRECT_PAIRINGS[mark.id])

    if (restored.phase === 'arrival' && (hasApproach || replyCount > 0)) return fallback
    if (restored.phase === 'approach' && (hasApproach || replyCount > 0)) return fallback
    if (restored.phase === 'explore' && !hasApproach) return fallback
    if (['transition', 'inspect', 'pair', 'error', 'success', 'complete'].includes(restored.phase) && (!hasApproach || !hasAllReplies)) return fallback
    if (['pair', 'error', 'success', 'complete'].includes(restored.phase) && !hasAllMarks) return fallback
    if (!hasUniquePairings) return fallback
    if (['success', 'complete'].includes(restored.phase) && !hasCorrectPairings) return fallback

    return restored
  } catch {
    return fallback
  }
}

function getHighlight(id: HighlightId | null): HighlightDefinition | null {
  return LIZI_FIRST_ACT_HIGHLIGHTS.find((item) => item.id === id) ?? null
}

function getSelectedReply(progress: LiziFirstActProgress, highlight: HighlightDefinition | null): HighlightReply | null {
  if (!highlight) return null
  const replyId = progress.replies[highlight.id]
  return highlight.replies.find((item) => item.id === replyId) ?? null
}

function resolveSpeech(progress: LiziFirstActProgress): string {
  if (progress.phase === 'arrival') return '风从画室顶棚穿过去了。先别管颜色，帮我接一下桌沿那三支笔。'
  if (progress.phase === 'approach') return '接住了。名字都磨掉了，但它们落在纸上的手感还在。你想先相信哪一种线索？'
  if (progress.phase === 'explore') {
    const highlight = getHighlight(progress.activeHighlight)
    if (!highlight) return '别急着替颜色找名字。先看看我、色板、上面的色片，还有那辆工具车。'
    return getSelectedReply(progress, highlight)?.response ?? highlight.speech
  }
  if (progress.phase === 'transition') return progress.approachIndex === 1 ? LIZI_APPROACHES[1].response : LIZI_APPROACHES[0].response
  if (progress.phase === 'inspect') {
    const mark = MARKS.find((item) => item.id === progress.activeMark)
    return mark?.speech ?? '三条试写痕迹都在这里。慢一点看，它们说话的方式完全不一样。'
  }
  if (progress.phase === 'pair') return '轮到笔帽了。别认颜色，只认“暖、静、醒”留下的形状和节奏。'
  if (progress.phase === 'error') return '有笔帽串门了。没事，干掉的笔最不怕再试一次。回去对照软弧、双细纹和短断点。'
  return '配上了。名字没有回来，可三种颜色都找到了自己的位置。'
}

function ChoiceButton({
  label,
  disabled,
  selected = false,
  feedback = 'light',
  onClick,
}: {
  label: string
  disabled: boolean
  selected?: boolean
  feedback?: HapticType
  onClick: () => void
}) {
  return (
    <View
      className={`lizi-first-act__choice${selected ? ' lizi-first-act__choice--selected' : ''}${disabled ? ' lizi-first-act__choice--disabled' : ''}`}
      hoverClass={disabled ? '' : 'lizi-first-act__choice--pressed'}
      onClick={() => { if (!disabled) { haptics(feedback); onClick() } }}
      role='button'
      aria-label={label}
      aria-disabled={disabled}
    >
      <View className='lizi-first-act__choice-dot' aria-hidden='true' />
      <Text className='lizi-first-act__choice-text'>{label}</Text>
    </View>
  )
}

export function LiziFirstActExperience({
  encounterId,
  scene,
  disabled = false,
  onSpeechChange,
  onComplete,
}: LiziFirstActExperienceProps) {
  const [progress, setProgress] = useState<LiziFirstActProgress>(() => restoreProgress(encounterId))
  const [sceneFailed, setSceneFailed] = useState(false)
  const speechChangeRef = useRef(onSpeechChange)
  const activeHighlight = useMemo(() => getHighlight(progress.activeHighlight), [progress.activeHighlight])
  const selectedReply = useMemo(() => getSelectedReply(progress, activeHighlight), [activeHighlight, progress])
  const speech = useMemo(() => resolveSpeech(progress), [progress])
  const exploredCount = Object.keys(progress.replies).length

  useEffect(() => {
    speechChangeRef.current = onSpeechChange
  }, [onSpeechChange])

  useEffect(() => {
    if (progress.encounterId !== encounterId) setProgress(restoreProgress(encounterId))
  }, [encounterId, progress.encounterId])

  useEffect(() => {
    if (progress.encounterId !== encounterId) return
    try { Taro.setStorageSync(liziFirstActStorageKey(encounterId), progress) } catch { /* Local recovery is best-effort. */ }
  }, [encounterId, progress])

  useEffect(() => {
    speechChangeRef.current(speech)
  }, [speech])

  const update = (recipe: (current: LiziFirstActProgress) => LiziFirstActProgress) => {
    if (disabled) return
    setProgress((current) => recipe(current))
  }

  const inspectHighlight = (id: HighlightId) => {
    if (disabled) return
    haptics('light')
    update((current) => ({ ...current, activeHighlight: id }))
  }

  const chooseHighlightReply = (reply: HighlightReply) => {
    if (disabled || !activeHighlight) return
    haptics('light')
    update((current) => ({
      ...current,
      replies: { ...current.replies, [activeHighlight.id]: reply.id },
    }))
  }

  const closeHighlight = () => {
    if (disabled) return
    haptics(exploredCount === LIZI_FIRST_ACT_HIGHLIGHTS.length ? 'medium' : 'light')
    update((current) => {
      const completedCount = Object.keys(current.replies).length
      return {
        ...current,
        activeHighlight: null,
        phase: completedCount === LIZI_FIRST_ACT_HIGHLIGHTS.length ? 'transition' : 'explore',
      }
    })
  }

  const chooseApproach = (approachIndex: LiziFirstActApproachIndex) => {
    if (disabled) return
    haptics('light')
    update((current) => ({ ...current, approachIndex, phase: 'explore' }))
  }

  const inspectMark = (id: MarkId) => {
    if (disabled) return
    haptics('light')
    update((current) => ({
      ...current,
      activeMark: id,
      inspectedMarks: current.inspectedMarks.includes(id) ? current.inspectedMarks : [...current.inspectedMarks, id],
    }))
  }

  const chooseCap = (id: CapId) => {
    if (disabled) return
    haptics('light')
    update((current) => ({ ...current, selectedCap: id }))
  }

  const placeSelectedCap = (markId: MarkId) => {
    if (disabled) return
    if (progress.selectedCap) haptics('slotLand')
    update((current) => {
      if (!current.selectedCap) return current
      const existingMark = Object.entries(current.pairings).find(([, capId]) => capId === current.selectedCap)?.[0] as MarkId | undefined
      const pairings = { ...current.pairings }
      if (existingMark) delete pairings[existingMark]
      pairings[markId] = current.selectedCap
      return { ...current, pairings, selectedCap: null }
    })
  }

  const checkPairings = () => {
    if (disabled) return
    const solved = MARKS.every((mark) => progress.pairings[mark.id] === CORRECT_PAIRINGS[mark.id])
    haptics(solved ? 'success' : 'warning')
    update((current) => {
      return { ...current, phase: solved ? 'success' : 'error', attempts: current.attempts + 1, selectedCap: null }
    })
  }

  const complete = () => {
    if (disabled || (progress.approachIndex !== 0 && progress.approachIndex !== 1)) return
    haptics('success')
    const approachIndex = progress.approachIndex
    setProgress((current) => ({ ...current, phase: 'complete' }))
    onComplete(approachIndex)
  }

  const allMarksInspected = progress.inspectedMarks.length === MARKS.length
  const allMarkersPaired = MARKS.every((mark) => Boolean(progress.pairings[mark.id]))
  const gameActive = progress.phase === 'inspect' || progress.phase === 'pair' || progress.phase === 'error'

  return (
    <View
      className={`lizi-first-act lizi-first-act--${progress.phase}${gameActive ? ' lizi-first-act--game' : ''}${disabled ? ' lizi-first-act--disabled' : ''}`}
      data-object-code='dry-markers'
      data-game-code='pairing'
      data-testid='lizi-first-act'
      data-phase={progress.phase}
    >
      {!sceneFailed ? (
        <Image
          className='lizi-first-act__scene'
          src={scene}
          mode='aspectFill'
          onError={() => setSceneFailed(true)}
          data-testid='lizi-first-act-scene'
          aria-hidden='true'
        />
      ) : (
        <View className='lizi-first-act__scene-fallback' data-testid='lizi-first-act-scene-fallback' aria-hidden='true'>
          <View className='lizi-first-act__fallback-awning' />
          <View className='lizi-first-act__fallback-paper' />
        </View>
      )}
      <View className='first-act-scene-grade' aria-hidden='true' />

      {progress.phase === 'arrival' ? (
        <FirstActDialogueChrome
          npcSlug='lizi'
          speaker='栗子'
          speech={speech}
          narration='风把色片翻了个面'
          prompt='三支没盖笔帽的彩笔正滚向桌沿。'
          choices={[]}
          action={{
            label: '接住滚向桌沿的三支彩笔',
            onClick: () => {
              if (disabled) return
              haptics('medium')
              update((current) => ({ ...current, phase: 'approach' }))
            },
          }}
          disabled={disabled}
          onChoose={() => undefined}
        />
      ) : null}

      {progress.phase === 'approach' ? (
        <FirstActDialogueChrome
          npcSlug='lizi'
          speaker='栗子'
          speech={speech}
          narration='你把滚落的三支彩笔拢回布卷；另外两支还安静躺在里面。五支笔身上的颜色名都已经磨得看不清。'
          prompt='你想先相信什么？'
          choices={LIZI_APPROACHES.map((approach, index) => ({ id: String(index), label: approach.label }))}
          action={null}
          disabled={disabled}
          onChoose={(id) => chooseApproach(Number(id) as LiziFirstActApproachIndex)}
        />
      ) : null}

      {progress.phase === 'explore' && !activeHighlight ? (
        <FirstActHighlightOverlay
          npcSlug='lizi'
          targets={LIZI_FIRST_ACT_HIGHLIGHTS.map((highlight) => ({
            id: highlight.id,
            label: highlight.label,
            placementClassName: `lizi-first-act__target--${highlight.id}`,
          }))}
          completedIds={Object.keys(progress.replies)}
          activeId={null}
          disabled={disabled}
          onSelect={(id) => inspectHighlight(id as HighlightId)}
        />
      ) : null}

      {progress.phase === 'explore' && activeHighlight ? (
        <FirstActDialogueChrome
          npcSlug='lizi'
          speaker='栗子'
          speech={speech}
          narration={selectedReply ? selectedReply.memory : activeHighlight.narration}
          prompt={selectedReply ? '栗子记住了你分辨颜色的方式。' : '你接着说'}
          choices={selectedReply ? [] : activeHighlight.replies.map((reply) => ({ id: reply.id, label: reply.label }))}
          action={selectedReply ? { label: exploredCount === 4 ? '看完四处线索' : '继续观察', onClick: closeHighlight } : null}
          disabled={disabled}
          onChoose={(id) => {
            const reply = activeHighlight.replies.find((item) => item.id === id)
            if (reply) chooseHighlightReply(reply)
          }}
        />
      ) : null}

      {progress.phase === 'transition' ? (
        <FirstActDialogueChrome
          npcSlug='lizi'
          speaker='栗子'
          speech={speech}
          narration='四处细节接成了一条线：颜色名会消失，痕迹的节奏却还在。'
          prompt='栗子把试色纸和三顶笔帽铺到你们中间。'
          choices={[]}
          action={{
            label: '和栗子一起辨认三条痕迹',
            onClick: () => {
              if (disabled) return
              haptics('medium')
              update((current) => ({ ...current, phase: 'inspect', activeMark: null }))
            },
          }}
          disabled={disabled}
          onChoose={() => undefined}
        />
      ) : null}

      {(progress.phase === 'success' || progress.phase === 'complete') ? (
        <FirstActDialogueChrome
          npcSlug='lizi'
          speaker='栗子'
          speech={speech}
          narration='暖的软弧、静的双细线、醒的短断点，都在纸上替三种颜色记着。'
          prompt='三支笔帽归位，五支彩笔重新排齐。颜色没有走丢。'
          action={{ label: progress.phase === 'complete' ? '再把这次整理交给栗子' : '把三支笔放回布卷', onClick: complete }}
          disabled={disabled}
        />
      ) : null}

      {(progress.phase === 'inspect' || progress.phase === 'pair' || progress.phase === 'error') ? <View className='lizi-first-act__panel'>
        <ScrollView className='lizi-first-act__panel-scroll' scrollY>
          <View className='lizi-first-act__panel-content'>
            <View className='lizi-first-act__game-intro'>
              <Text className='lizi-first-act__eyebrow'>栗子的试色桌</Text>
              <Text className='lizi-first-act__game-copy'>先摸清每道痕迹留下的节奏，再把笔帽交还给对应的笔。别让颜色替手感抢答。</Text>
              <View className='lizi-first-act__game-guide' role='status' aria-live='polite' aria-atomic='true'>
                <Text className='lizi-first-act__game-guide-speaker'>栗子</Text>
                <Text className='lizi-first-act__game-guide-copy' data-testid='lizi-game-speech'>{speech}</Text>
              </View>
              <View className='lizi-first-act__game-progress' aria-label={`小游戏第 ${progress.phase === 'inspect' ? 1 : 2} 步，共 2 步`}>
                <View className='lizi-first-act__game-progress-dot lizi-first-act__game-progress-dot--active' />
                <View className={`lizi-first-act__game-progress-dot${progress.phase !== 'inspect' ? ' lizi-first-act__game-progress-dot--active' : ''}`} />
              </View>
            </View>
            {progress.phase === 'inspect' ? (
              <>
                <View className='lizi-first-act__game-heading'>
                  <Text className='lizi-first-act__game-step'>先看痕迹 · 1/2</Text>
                  <Text className='lizi-first-act__game-title'>三种手感</Text>
                </View>
                <View className='lizi-first-act__marks' aria-label='三条不同质感的试写痕迹'>
                  {MARKS.map((mark) => {
                    const seen = progress.inspectedMarks.includes(mark.id)
                    const active = progress.activeMark === mark.id
                    return (
                      <View
                        key={mark.id}
                        className={`lizi-first-act__mark lizi-first-act__mark--${mark.id}${seen ? ' lizi-first-act__mark--seen' : ''}${active ? ' lizi-first-act__mark--active' : ''}`}
                        hoverClass={disabled ? '' : 'lizi-first-act__mark--pressed'}
                        onClick={() => inspectMark(mark.id)}
                        role='button'
                        aria-label={`查看${mark.name}：${mark.texture}`}
                        aria-disabled={disabled}
                      >
                        <View className='lizi-first-act__mark-stroke' aria-hidden='true' />
                        <Text className='lizi-first-act__mark-name'>{mark.name}</Text>
                        <Text className='lizi-first-act__mark-texture'>{seen ? mark.texture : '轻触辨认'}</Text>
                      </View>
                    )
                  })}
                </View>
                {progress.activeMark ? (
                  <View className='lizi-first-act__clue'>
                    <Text>{MARKS.find((mark) => mark.id === progress.activeMark)?.clue}</Text>
                  </View>
                ) : null}
                {allMarksInspected ? (
                  <ChoiceButton label='按“暖、静、醒”配回笔帽' disabled={disabled} onClick={() => update((current) => ({ ...current, phase: 'pair', activeMark: null }))} />
                ) : null}
              </>
            ) : null}

            {progress.phase === 'pair' || progress.phase === 'error' ? (
              <>
                <View className='lizi-first-act__game-heading'>
                  <Text className='lizi-first-act__game-step'>再配笔帽 · 2/2</Text>
                  <Text className='lizi-first-act__game-title'>别让颜色抢答</Text>
                </View>
                <View className='lizi-first-act__caps' aria-label='可选择的三顶笔帽'>
                  {CAPS.map((cap) => (
                    <View
                      key={cap.id}
                      className={`lizi-first-act__cap lizi-first-act__cap--${cap.id}${progress.selectedCap === cap.id ? ' lizi-first-act__cap--selected' : ''}`}
                      hoverClass={disabled || progress.phase === 'error' ? '' : 'lizi-first-act__cap--pressed'}
                      onClick={() => { if (progress.phase === 'pair') chooseCap(cap.id) }}
                      role='button'
                      aria-label={`选择${cap.name}：${cap.hint}`}
                      aria-disabled={disabled || progress.phase === 'error'}
                    >
                      <View className='lizi-first-act__cap-shape' aria-hidden='true' />
                      <Text>{cap.name}</Text>
                    </View>
                  ))}
                </View>
                <View className='lizi-first-act__markers' aria-label='三支还没配帽的干彩笔'>
                  {MARKS.map((mark) => {
                    const pairedCap = CAPS.find((cap) => cap.id === progress.pairings[mark.id])
                    return (
                      <View
                        key={mark.id}
                        className={`lizi-first-act__marker lizi-first-act__marker--${mark.id}${pairedCap ? ' lizi-first-act__marker--paired' : ''}`}
                        hoverClass={disabled || progress.phase === 'error' ? '' : 'lizi-first-act__marker--pressed'}
                        onClick={() => { if (progress.phase === 'pair') placeSelectedCap(mark.id) }}
                        role='button'
                        aria-label={`${mark.texture}干笔${pairedCap ? `，已配${pairedCap.name}` : '，还没配笔帽'}`}
                        aria-disabled={disabled || progress.phase === 'error' || !progress.selectedCap}
                      >
                        <View className='lizi-first-act__marker-body' aria-hidden='true' />
                        <View className='lizi-first-act__marker-copy'>
                          <Text className='lizi-first-act__marker-clue'>{mark.id === 'warm' ? '暖' : mark.id === 'quiet' ? '静' : '醒'} · {mark.texture}</Text>
                          <Text className='lizi-first-act__marker-cap'>{pairedCap?.name ?? (progress.selectedCap ? '轻触配上所选笔帽' : '先选一顶笔帽')}</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
                {progress.phase === 'error' ? (
                  <View className='lizi-first-act__error' role='alert'>
                    <Text>这组没有完全接上三条试写痕迹。颜色相近也不算数，再对照一次软弧、双细纹和短断点。</Text>
                    <ChoiceButton label='重新配一次' disabled={disabled} onClick={() => update((current) => ({ ...current, phase: 'pair', pairings: {}, selectedCap: null }))} />
                  </View>
                ) : (
                  <ChoiceButton label='检查三顶笔帽' disabled={disabled || !allMarkersPaired} onClick={checkPairings} />
                )}
              </>
            ) : null}

          </View>
        </ScrollView>
      </View> : null}
    </View>
  )
}
