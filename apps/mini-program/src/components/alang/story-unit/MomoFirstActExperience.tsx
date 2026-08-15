import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import { haptics } from '../../../lib/utils/haptics'
import { FirstActDialogueChrome } from './FirstActDialogueChrome'
import { FirstActHighlightOverlay } from './FirstActHighlightOverlay'
import './MomoFirstActExperience.scss'

type ApproachIndex = 0 | 1
type Stage = 'observe' | 'approach' | 'game' | 'success'
type RouteOutcome = 'idle' | 'early' | 'overrun' | 'wrong' | 'success'

const MOMO_APPROACHES = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-momo'].approaches

interface HighlightReply {
  label: string
  response: string
}

interface MomoHighlight {
  id: 'momo' | 'listening-window' | 'route-sign' | 'route-book'
  label: string
  speech: string
  hotspotClass: string
  replies: readonly [HighlightReply, HighlightReply]
}

export const MOMO_FIRST_ACT_HIGHLIGHTS: readonly MomoHighlight[] = [
  {
    id: 'momo',
    label: '默默本人',
    speech: '最后一条实线在空白页前停住。……我不是走丢，只是不确定停下算不算选择。',
    hotspotClass: 'momo-first-act__hotspot--momo',
    replies: [
      {
        label: '你在确认终点，还是确认自己想不想继续？',
        response: '后一个。终点有标记，我没有。',
      },
      {
        label: '先别替空白页补路线。',
        response: '……嗯。空着，也是一条记录。',
      },
    ],
  },
  {
    id: 'listening-window',
    label: '听音窗',
    speech: '檐水先密，后来慢下来。第三次间隔最长。',
    hotspotClass: 'momo-first-act__hotspot--listening-window',
    replies: [
      {
        label: '把变慢的三次当作路标。',
        response: '可以。声音不会把空白填满。',
      },
      {
        label: '只记最后一次安静下来。',
        response: '太少。前两次能确认方向。',
      },
    ],
  },
  {
    id: 'route-sign',
    label: '竖向路线牌',
    speech: '折线在中段向里收，末端没有箭头。',
    hotspotClass: 'momo-first-act__hotspot--route-sign',
    replies: [
      {
        label: '没有箭头，就别替它继续。',
        response: '……这句可以写在页边。',
      },
      {
        label: '先沿三处折点核对。',
        response: '对。折点比猜方向可靠。',
      },
    ],
  },
  {
    id: 'route-book',
    label: '路线书台',
    speech: '册子写到第三段。实线在空白页前停住，墨没有蹭开。',
    hotspotClass: 'momo-first-act__hotspot--route-book',
    replies: [
      {
        label: '不是没写完，是主动收笔。',
        response: '纸面很干净。像是刻意停下。',
      },
      {
        label: '先确认前三段能互相对上。',
        response: '嗯。声音、折点、实线，顺序能接上。',
      },
    ],
  },
] as const

const ROUTE_NODES = [
  '节点一：檐水变疏',
  '节点二：竖牌向内折',
  '节点三：实线在页边收住',
] as const

const INTRO_SPEECH = '雨停了。路线册还开着……最后一条实线，停在空白以前。'
const STORAGE_PREFIX = 'joyjoin:flash:momo-first-act:v1:'

interface MomoProgress {
  stage: Stage
  completedHighlightIds: MomoHighlight['id'][]
  activeHighlightId: MomoHighlight['id'] | null
  selectedReplyIndex: 0 | 1 | null
  approachIndex: ApproachIndex | null
  routeProgress: number
  routeOutcome: RouteOutcome
  speech: string
}

const DEFAULT_PROGRESS: MomoProgress = {
  stage: 'observe',
  completedHighlightIds: [],
  activeHighlightId: null,
  selectedReplyIndex: null,
  approachIndex: null,
  routeProgress: 0,
  routeOutcome: 'idle',
  speech: INTRO_SPEECH,
}

function isApproachIndex(value: unknown): value is ApproachIndex {
  return value === 0 || value === 1
}

function loadProgress(storageKey: string): MomoProgress {
  try {
    const stored = Taro.getStorageSync(storageKey) as Partial<MomoProgress> | undefined
    if (!stored || typeof stored !== 'object') return DEFAULT_PROGRESS

    const completedHighlightIds = Array.isArray(stored.completedHighlightIds)
      ? stored.completedHighlightIds.filter((id): id is MomoHighlight['id'] =>
        MOMO_FIRST_ACT_HIGHLIGHTS.some((highlight) => highlight.id === id))
      : []
    const stage: Stage = ['observe', 'approach', 'game', 'success'].includes(stored.stage ?? '')
      ? stored.stage as Stage
      : 'observe'
    const routeProgress = typeof stored.routeProgress === 'number'
      ? Math.max(0, Math.min(3, Math.floor(stored.routeProgress)))
      : 0

    return {
      ...DEFAULT_PROGRESS,
      ...stored,
      stage,
      completedHighlightIds,
      activeHighlightId: MOMO_FIRST_ACT_HIGHLIGHTS.some(({ id }) => id === stored.activeHighlightId)
        ? stored.activeHighlightId as MomoHighlight['id']
        : null,
      selectedReplyIndex: stored.selectedReplyIndex === 0 || stored.selectedReplyIndex === 1
        ? stored.selectedReplyIndex
        : null,
      approachIndex: isApproachIndex(stored.approachIndex) ? stored.approachIndex : null,
      routeProgress,
      routeOutcome: ['idle', 'early', 'overrun', 'wrong', 'success'].includes(stored.routeOutcome ?? '')
        ? stored.routeOutcome as RouteOutcome
        : 'idle',
      speech: typeof stored.speech === 'string' ? stored.speech : INTRO_SPEECH,
    }
  } catch {
    return DEFAULT_PROGRESS
  }
}

export interface MomoFirstActExperienceProps {
  encounterId: string
  scene: string
  disabled: boolean
  onSpeechChange: (speech: string) => void
  onComplete: (approachIndex: ApproachIndex) => void
}

export function MomoFirstActExperience({
  encounterId,
  scene,
  disabled,
  onSpeechChange,
  onComplete,
}: MomoFirstActExperienceProps) {
  const storageKey = `${STORAGE_PREFIX}${encounterId}`
  const [progress, setProgress] = useState<MomoProgress>(() => loadProgress(storageKey))

  useEffect(() => {
    try {
      Taro.setStorageSync(storageKey, progress)
    } catch {
      // A full storage quota must not block this self-contained encounter.
    }
  }, [progress, storageKey])

  useEffect(() => {
    onSpeechChange(progress.speech)
  }, [onSpeechChange, progress.speech])

  const activeHighlight = useMemo(
    () => MOMO_FIRST_ACT_HIGHLIGHTS.find(({ id }) => id === progress.activeHighlightId) ?? null,
    [progress.activeHighlightId],
  )

  const patchProgress = useCallback((patch: Partial<MomoProgress>) => {
    setProgress((current) => ({ ...current, ...patch }))
  }, [])

  const openHighlight = (highlight: MomoHighlight) => {
    if (disabled || progress.completedHighlightIds.includes(highlight.id)) return
    haptics('light')
    patchProgress({
      activeHighlightId: highlight.id,
      selectedReplyIndex: null,
      speech: highlight.speech,
    })
  }

  const selectReply = (replyIndex: 0 | 1) => {
    if (disabled || !activeHighlight) return
    haptics('light')
    patchProgress({
      selectedReplyIndex: replyIndex,
      speech: activeHighlight.replies[replyIndex].response,
    })
  }

  const finishHighlight = () => {
    if (disabled || !activeHighlight || progress.selectedReplyIndex === null) return
    const completedHighlightIds = progress.completedHighlightIds.includes(activeHighlight.id)
      ? progress.completedHighlightIds
      : [...progress.completedHighlightIds, activeHighlight.id]
    const allObserved = completedHighlightIds.length === MOMO_FIRST_ACT_HIGHLIGHTS.length
    haptics(allObserved ? 'medium' : 'light')
    patchProgress({
      completedHighlightIds,
      activeHighlightId: null,
      selectedReplyIndex: null,
      stage: allObserved ? 'approach' : 'observe',
      speech: allObserved
        ? '三处线索接上了。……空白页还在。你觉得，我该怎么记？'
        : '记下了。再看一处。',
    })
  }

  const chooseApproach = (approachIndex: ApproachIndex) => {
    if (disabled) return
    haptics('light')
    patchProgress({
      approachIndex,
      speech: MOMO_APPROACHES[approachIndex].response,
    })
  }

  const startGame = () => {
    if (disabled || progress.approachIndex === null) return
    haptics('medium')
    patchProgress({
      stage: 'game',
      routeProgress: 0,
      routeOutcome: 'idle',
      speech: '从檐水开始。到空白页以前，自己停。',
    })
  }

  const selectRouteNode = (nodeIndex: number) => {
    if (disabled || progress.routeOutcome === 'success') return
    if (nodeIndex === progress.routeProgress) {
      haptics('light')
      const routeProgress = progress.routeProgress + 1
      patchProgress({
        routeProgress,
        routeOutcome: 'idle',
        speech: routeProgress === 3 ? '三处都对上了。下一步没有画线。' : '嗯。接得上。',
      })
      return
    }
    haptics('warning')
    patchProgress({
      routeOutcome: 'wrong',
      speech: '顺序没接上。先听檐水，再看折点。',
    })
  }

  const stopHere = () => {
    if (disabled || progress.routeOutcome === 'success') return
    if (progress.routeProgress < ROUTE_NODES.length) {
      haptics('warning')
      patchProgress({
        routeOutcome: 'early',
        speech: '停早了。檐水、折点和实线还没接齐。',
      })
      return
    }
    haptics('success')
    patchProgress({
      stage: 'success',
      routeOutcome: 'success',
      speech: '……就在这里。不是断掉，是我决定收笔。',
    })
  }

  const enterBlankPage = () => {
    if (disabled || progress.routeOutcome === 'success') return
    haptics('warning')
    patchProgress({
      routeOutcome: 'overrun',
      speech: '走过头了。空白页不是下一段路。',
    })
  }

  const retryRoute = () => {
    if (disabled) return
    haptics('light')
    patchProgress({
      stage: 'game',
      routeProgress: 0,
      routeOutcome: 'idle',
      speech: '再来。檐水、折点、实线。到空白以前停。',
    })
  }

  const complete = () => {
    if (disabled || progress.stage !== 'success' || progress.approachIndex === null) return
    haptics('success')
    onComplete(progress.approachIndex)
  }

  return (
    <View className={`momo-first-act${disabled ? ' momo-first-act--disabled' : ''}`} data-object-code='route-book' data-game-code='path'>
      <Image
        className='momo-first-act__scene'
        src={scene}
        mode='aspectFill'
        data-testid='momo-first-act-scene'
      />
      <View className='first-act-scene-grade' aria-hidden='true' />

      {progress.stage === 'observe' && !activeHighlight && (
        <FirstActHighlightOverlay
          npcSlug='momo'
          className='momo-first-act__hotspots'
          targets={MOMO_FIRST_ACT_HIGHLIGHTS.map((highlight) => ({
            id: highlight.id,
            label: highlight.label,
            placementClassName: highlight.hotspotClass,
          }))}
          completedIds={progress.completedHighlightIds}
          activeId={null}
          disabled={disabled}
          onSelect={(id) => {
            const highlight = MOMO_FIRST_ACT_HIGHLIGHTS.find((item) => item.id === id)
            if (highlight) openHighlight(highlight)
          }}
        />
      )}

      {progress.stage === 'observe' && activeHighlight ? (
        <FirstActDialogueChrome
          npcSlug='momo'
          speaker='默默'
          speech={progress.speech}
          narration={`你看向${activeHighlight.label}。`}
          prompt={progress.selectedReplyIndex === null ? '你接着说' : '默默把这句话写在页边。'}
          choices={progress.selectedReplyIndex === null ? activeHighlight.replies.map((reply, index) => ({ id: String(index), label: reply.label })) : []}
          action={progress.selectedReplyIndex === null ? null : { label: progress.completedHighlightIds.length === 3 ? '看完四处线索' : '继续观察', onClick: finishHighlight }}
          disabled={disabled}
          onChoose={(id) => selectReply(Number(id) as 0 | 1)}
        />
      ) : null}

      {progress.stage === 'approach' ? (
        <FirstActDialogueChrome
          npcSlug='momo'
          speaker='默默'
          speech={progress.speech}
          narration='三处环境线索和默默手里的路线册接成了一条线。空白页不是下一段路，而是一个可以自己决定的停顿。'
          prompt={progress.approachIndex === null ? '你想怎样记下这个停顿？' : '默默把路线册翻回第一页。'}
          choices={progress.approachIndex === null ? MOMO_APPROACHES.map((approach, index) => ({ id: String(index), label: approach.label })) : []}
          selectedChoiceId={progress.approachIndex === null ? null : String(progress.approachIndex)}
          action={progress.approachIndex === null ? null : { label: '开始走这段雨路', onClick: startGame }}
          disabled={disabled}
          onChoose={(id) => chooseApproach(Number(id) as ApproachIndex)}
        />
      ) : null}

      {progress.stage === 'success' ? (
        <FirstActDialogueChrome
          npcSlug='momo'
          speaker='默默'
          speech={progress.speech}
          narration='三处线索都接上，最后一步由默默自己决定。'
          prompt='空白页前停住了。'
          action={{ label: '完成《雨停在空白以前》', onClick: complete }}
          disabled={disabled}
        />
      ) : null}

      {progress.stage === 'game' ? (
        <View className='momo-first-act__speech' data-testid='momo-game-speech' role='status' aria-live='polite' aria-atomic='true'>
          <Text className='momo-first-act__speaker'>默默</Text>
          <Text className='momo-first-act__speech-copy'>{progress.speech}</Text>
        </View>
      ) : null}

      {progress.stage === 'game' ? <View className='momo-first-act__panel'>

        {progress.stage === 'game' && (
          <RouteGame
            disabled={disabled}
            progress={progress.routeProgress}
            outcome={progress.routeOutcome}
            onSelectNode={selectRouteNode}
            onBlankPage={enterBlankPage}
            onStop={stopHere}
            onRetry={retryRoute}
          />
        )}

      </View> : null}
    </View>
  )
}

function RouteGame({
  disabled,
  progress,
  outcome,
  onSelectNode,
  onBlankPage,
  onStop,
  onRetry,
}: {
  disabled: boolean
  progress: number
  outcome: RouteOutcome
  onSelectNode: (index: number) => void
  onBlankPage: () => void
  onStop: () => void
  onRetry: () => void
}) {
  const feedback = outcome === 'early'
    ? '停早了：三处线索还没接齐。'
    : outcome === 'overrun'
      ? '走过头了：空白页不是下一段路。'
      : outcome === 'wrong'
        ? '顺序还没接上。'
        : ''

  return (
    <View className='momo-first-act__game' data-testid='momo-route-game'>
      <View className='momo-first-act__game-heading'>
        <Text className='momo-first-act__eyebrow'>路线册 · 雨路节点</Text>
        <Text className='momo-first-act__counter' data-testid='momo-route-progress'>{progress} / 3</Text>
      </View>
      <Text className='momo-first-act__game-instruction'>按线索顺序走，在进入空白页前主动停下。</Text>
      <View className='momo-first-act__route-nodes'>
        {ROUTE_NODES.map((label, index) => (
          <View
            key={label}
            className={`momo-first-act__route-node${index < progress ? ' momo-first-act__route-node--visited' : ''}`}
            role='button'
            aria-label={label}
            aria-disabled={disabled || index < progress}
            hoverClass='momo-first-act__route-node--pressed'
            onClick={() => index >= progress && onSelectNode(index)}
          >
            <Text className='momo-first-act__route-index'>{index + 1}</Text>
            <Text>{label.replace(/^节点.：/, '')}</Text>
          </View>
        ))}
        <View
          className='momo-first-act__route-node momo-first-act__route-node--blank'
          role='button'
          aria-label='空白页'
          aria-disabled={disabled}
          hoverClass='momo-first-act__route-node--pressed'
          onClick={onBlankPage}
        >
          <Text>空白页</Text>
        </View>
      </View>
      {feedback && (
        <View className='momo-first-act__feedback'>
          <Text>{feedback}</Text>
        </View>
      )}
      <View className='momo-first-act__game-actions'>
        <ActionButton label='停在这里' disabled={disabled} onClick={onStop} />
        {feedback && (
          <View
            className='momo-first-act__secondary-action'
            role='button'
            aria-label='重新走这段雨路'
            aria-disabled={disabled}
            hoverClass='momo-first-act__secondary-action--pressed'
            onClick={onRetry}
          >
            <Text>重新走这段雨路</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function ActionButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <View
      className='momo-first-act__primary-action'
      role='button'
      aria-label={label}
      aria-disabled={disabled}
      hoverClass='momo-first-act__primary-action--pressed'
      onClick={onClick}
    >
      <Text>{label}</Text>
    </View>
  )
}
