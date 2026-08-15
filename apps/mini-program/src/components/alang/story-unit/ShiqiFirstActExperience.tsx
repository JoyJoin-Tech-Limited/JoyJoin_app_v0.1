import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import { haptics } from '../../../lib/utils/haptics'
import { FirstActDialogueChrome } from './FirstActDialogueChrome'
import { FirstActHighlightOverlay } from './FirstActHighlightOverlay'
import './ShiqiFirstActExperience.scss'

type ApproachIndex = 0 | 1
type HotspotId = 'shiqi' | 'outing-book' | 'exchange-box' | 'inspection-light'
type Stage = 'inspect' | 'approach' | 'approach-response' | 'game' | 'success'
type LayerIndex = 0 | 1 | 2

interface Offset {
  x: number
  y: number
}

interface HighlightReply {
  id: string
  label: string
  response: string
}

export interface ShiqiFirstActHighlight {
  id: HotspotId
  label: string
  observation: string
  replies: readonly [HighlightReply, HighlightReply]
}

interface ShiqiFirstActProgress {
  version: 'shiqi-first-act-v1'
  stage: Stage
  completedHotspots: HotspotId[]
  selectedReplies: Partial<Record<HotspotId, string>>
  activeHotspot: HotspotId | null
  activeReplyId: string | null
  approachIndex: ApproachIndex | null
  layerOffsets: [Offset, Offset, Offset]
  lockedLayers: [boolean, boolean, boolean]
  activeLayer: LayerIndex
  firstErrorShown: boolean
  gameStatus: 'idle' | 'error' | 'aligned'
}

export interface ShiqiFirstActExperienceProps {
  encounterId: string
  scene: string
  disabled?: boolean
  onSpeechChange: (speech: string) => void
  onComplete: (approachIndex: ApproachIndex) => void
}

export const SHIQI_FIRST_ACT_HIGHLIGHTS: readonly ShiqiFirstActHighlight[] = [
  {
    id: 'shiqi',
    label: '拾柒本人',
    observation: '拾柒没有直接圈结论。他把三份记录错开半页，只让纸张最浅的压痕露出来。',
    replies: [
      {
        id: 'confirm-common-trace',
        label: '你先确认共同的浅痕？',
        response: '对。共同出现的压痕，才有资格先被叫作事实。',
      },
      {
        id: 'ask-revision',
        label: '你怀疑有人改过记录？',
        response: '先别用“改过”。目前只能说，有些解释写得更晚。',
      },
    ],
  },
  {
    id: 'outing-book',
    label: '外出记录册',
    observation: '三条路线都向东折，但只有两页的折返点有相同浅痕；第三页的箭头墨迹更新。',
    replies: [
      {
        id: 'direction-is-not-route',
        label: '方向相同，不代表走法相同。',
        response: '准确。方向是结果，折返点才接近过程。',
      },
      {
        id: 'set-arrow-aside',
        label: '先把新箭头放到一边。',
        response: '可以。不是删除，只是暂时不让它替浅痕发言。',
      },
    ],
  },
  {
    id: 'exchange-box',
    label: '交换箱',
    observation: '交换箱的取件槽留着三道平行压痕，最上面一层比下面两层宽半格。',
    replies: [
      {
        id: 'not-same-time',
        label: '三份记录可能不是同时放进去的。',
        response: '这是可检验的判断。压痕先后，比猜测动机可靠。',
      },
      {
        id: 'later-insert',
        label: '最上层也许后来被补放。',
        response: '可以保留“也许”。在对齐前，不把它写成事实。',
      },
    ],
  },
  {
    id: 'inspection-light',
    label: '竖向检视灯箱',
    observation: '灯箱透过三层路线纸：底层的折线一致，上层备注各自偏了一个方向。',
    replies: [
      {
        id: 'fact-and-interpretation',
        label: '事实在底层，解释浮在上层。',
        response: '接近。更严谨地说：底层目前更稳定。',
      },
      {
        id: 'align-first',
        label: '先把三层浅痕对齐再判断。',
        response: '对。让纸自己证明重合，不让措辞抢先。',
      },
    ],
  },
] as const

const APPROACHES = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-shiqi'].approaches

const LAYER_TITLES = ['第一层 · 原始浅痕', '第二层 · 路线复写', '第三层 · 后补说明'] as const
const INITIAL_LAYER_OFFSETS: [Offset, Offset, Offset] = [
  { x: -1, y: 1 },
  { x: 2, y: -1 },
  { x: -2, y: -2 },
]

const INITIAL_PROGRESS: ShiqiFirstActProgress = {
  version: 'shiqi-first-act-v1',
  stage: 'inspect',
  completedHotspots: [],
  selectedReplies: {},
  activeHotspot: null,
  activeReplyId: null,
  approachIndex: null,
  layerOffsets: INITIAL_LAYER_OFFSETS.map((offset) => ({ ...offset })) as [Offset, Offset, Offset],
  lockedLayers: [false, false, false],
  activeLayer: 0,
  firstErrorShown: false,
  gameStatus: 'idle',
}

function copyInitialProgress(): ShiqiFirstActProgress {
  return {
    ...INITIAL_PROGRESS,
    completedHotspots: [],
    selectedReplies: {},
    layerOffsets: INITIAL_LAYER_OFFSETS.map((offset) => ({ ...offset })) as [Offset, Offset, Offset],
    lockedLayers: [false, false, false],
  }
}

function isHotspotId(value: unknown): value is HotspotId {
  return SHIQI_FIRST_ACT_HIGHLIGHTS.some((highlight) => highlight.id === value)
}

function isOffset(value: unknown): value is Offset {
  if (!value || typeof value !== 'object') return false
  const offset = value as Offset
  return Number.isInteger(offset.x) && Number.isInteger(offset.y) && Math.abs(offset.x) <= 3 && Math.abs(offset.y) <= 3
}

function restoreProgress(value: unknown): ShiqiFirstActProgress {
  if (!value || typeof value !== 'object') return copyInitialProgress()
  const candidate = value as Partial<ShiqiFirstActProgress>
  if (candidate.version !== 'shiqi-first-act-v1') return copyInitialProgress()
  const layerOffsets = Array.isArray(candidate.layerOffsets) && candidate.layerOffsets.length === 3 && candidate.layerOffsets.every(isOffset)
    ? candidate.layerOffsets.map((offset) => ({ ...offset })) as [Offset, Offset, Offset]
    : copyInitialProgress().layerOffsets
  const lockedLayers: [boolean, boolean, boolean] = Array.isArray(candidate.lockedLayers) && candidate.lockedLayers.length === 3
    ? [Boolean(candidate.lockedLayers[0]), Boolean(candidate.lockedLayers[1]), Boolean(candidate.lockedLayers[2])]
    : [false, false, false]
  const completedHotspots = Array.isArray(candidate.completedHotspots)
    ? candidate.completedHotspots.filter(isHotspotId)
    : []
  const stage: Stage = ['inspect', 'approach', 'approach-response', 'game', 'success'].includes(candidate.stage ?? '')
    ? candidate.stage as Stage
    : 'inspect'
  const approachIndex = candidate.approachIndex === 0 || candidate.approachIndex === 1 ? candidate.approachIndex : null
  const activeLayer: LayerIndex = candidate.activeLayer === 1 || candidate.activeLayer === 2 ? candidate.activeLayer : 0

  return {
    version: 'shiqi-first-act-v1',
    stage,
    completedHotspots,
    selectedReplies: candidate.selectedReplies && typeof candidate.selectedReplies === 'object' ? candidate.selectedReplies : {},
    activeHotspot: isHotspotId(candidate.activeHotspot) ? candidate.activeHotspot : null,
    activeReplyId: typeof candidate.activeReplyId === 'string' ? candidate.activeReplyId : null,
    approachIndex,
    layerOffsets,
    lockedLayers,
    activeLayer,
    firstErrorShown: candidate.firstErrorShown === true,
    gameStatus: candidate.gameStatus === 'error' || candidate.gameStatus === 'aligned' ? candidate.gameStatus : 'idle',
  }
}

export function getShiqiFirstActStorageKey(encounterId: string): string {
  return `joyjoin_flash_shiqi_first_act_v1:${encounterId}`
}

function loadProgress(encounterId: string): ShiqiFirstActProgress {
  try {
    return restoreProgress(Taro.getStorageSync(getShiqiFirstActStorageKey(encounterId)))
  } catch {
    return copyInitialProgress()
  }
}

function persistProgress(encounterId: string, progress: ShiqiFirstActProgress) {
  try {
    Taro.setStorageSync(getShiqiFirstActStorageKey(encounterId), progress)
  } catch {
    // The experience remains usable when local storage is temporarily unavailable.
  }
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

export function ShiqiFirstActExperience({
  encounterId,
  scene,
  disabled = false,
  onSpeechChange,
  onComplete,
}: ShiqiFirstActExperienceProps) {
  const [progress, setProgress] = useState<ShiqiFirstActProgress>(() => loadProgress(encounterId))

  useEffect(() => {
    setProgress(loadProgress(encounterId))
  }, [encounterId])

  const commit = useCallback((update: (current: ShiqiFirstActProgress) => ShiqiFirstActProgress) => {
    setProgress((current) => {
      const next = update(current)
      persistProgress(encounterId, next)
      return next
    })
  }, [encounterId])

  const activeHighlight = useMemo(() => (
    SHIQI_FIRST_ACT_HIGHLIGHTS.find((highlight) => highlight.id === progress.activeHotspot) ?? null
  ), [progress.activeHotspot])
  const activeReply = activeHighlight?.replies.find((reply) => reply.id === progress.activeReplyId) ?? null

  const speech = useMemo(() => {
    if (progress.stage === 'success') {
      return '三层浅痕已经重合。后来补上的解释仍各自偏开，但没有覆盖原始路线。'
    }
    if (progress.stage === 'game') {
      if (progress.gameStatus === 'error') return '还差一点。先让横向回到基准，再处理纵向。'
      if (progress.gameStatus === 'aligned') return '这一层对上了。继续看下一层，不急着下结论。'
      return '移动路线纸，只对齐浅痕。上面的解释先不参与判断。'
    }
    if (progress.stage === 'approach-response' && progress.approachIndex !== null) {
      return APPROACHES[progress.approachIndex].response
    }
    if (progress.stage === 'approach') {
      return '共同浅痕已经够清楚。最后决定怎么处理那些后加的解释。'
    }
    if (activeReply) return activeReply.response
    if (activeHighlight) return activeHighlight.observation
    return '三份记录看似一致。准确地说，只是方向一致；叙述还没有说完。'
  }, [activeHighlight, activeReply, progress.approachIndex, progress.gameStatus, progress.stage])

  useEffect(() => {
    onSpeechChange(speech)
  }, [onSpeechChange, speech])

  const openHighlight = (id: HotspotId) => {
    if (disabled || progress.completedHotspots.includes(id)) return
    haptics('light')
    commit((current) => ({ ...current, activeHotspot: id, activeReplyId: null }))
  }

  const selectReply = (reply: HighlightReply) => {
    if (disabled || !progress.activeHotspot) return
    haptics('light')
    commit((current) => ({
      ...current,
      activeReplyId: reply.id,
      selectedReplies: { ...current.selectedReplies, [current.activeHotspot!]: reply.id },
    }))
  }

  const closeHighlight = () => {
    if (disabled || !progress.activeHotspot || !progress.activeReplyId) return
    const completesInspection = progress.completedHotspots.length === SHIQI_FIRST_ACT_HIGHLIGHTS.length - 1
    haptics(completesInspection ? 'medium' : 'light')
    commit((current) => {
      const completedHotspots = current.completedHotspots.includes(current.activeHotspot!)
        ? current.completedHotspots
        : [...current.completedHotspots, current.activeHotspot!]
      return {
        ...current,
        completedHotspots,
        activeHotspot: null,
        activeReplyId: null,
        stage: completedHotspots.length === SHIQI_FIRST_ACT_HIGHLIGHTS.length ? 'approach' : 'inspect',
      }
    })
  }

  const chooseApproach = (approachIndex: ApproachIndex) => {
    if (disabled) return
    haptics('light')
    commit((current) => ({ ...current, approachIndex, stage: 'approach-response' }))
  }

  const beginGame = () => {
    if (disabled || progress.approachIndex === null) return
    haptics('medium')
    commit((current) => ({ ...current, stage: 'game', gameStatus: 'idle' }))
  }

  const moveLayer = (dx: number, dy: number) => {
    if (disabled || progress.stage !== 'game' || progress.lockedLayers[progress.activeLayer]) return
    haptics('light')
    commit((current) => {
      const layerOffsets = current.layerOffsets.map((offset) => ({ ...offset })) as [Offset, Offset, Offset]
      const offset = layerOffsets[current.activeLayer]
      layerOffsets[current.activeLayer] = {
        x: Math.max(-3, Math.min(3, offset.x + dx)),
        y: Math.max(-3, Math.min(3, offset.y + dy)),
      }
      return { ...current, layerOffsets, gameStatus: 'idle' }
    })
  }

  const checkLayer = () => {
    if (disabled || progress.stage !== 'game') return
    const offset = progress.layerOffsets[progress.activeLayer]
    if (offset.x !== 0 || offset.y !== 0) {
      haptics('warning')
      commit((current) => ({ ...current, firstErrorShown: true, gameStatus: 'error' }))
      return
    }
    haptics(progress.activeLayer === 2 ? 'success' : 'medium')
    commit((current) => {
      const lockedLayers = [...current.lockedLayers] as [boolean, boolean, boolean]
      lockedLayers[current.activeLayer] = true
      if (current.activeLayer === 2) {
        return { ...current, lockedLayers, stage: 'success', gameStatus: 'aligned' }
      }
      return {
        ...current,
        lockedLayers,
        activeLayer: (current.activeLayer + 1) as LayerIndex,
        gameStatus: 'aligned',
      }
    })
  }

  const resetGame = () => {
    if (disabled) return
    haptics('light')
    commit((current) => ({
      ...current,
      stage: 'game',
      layerOffsets: INITIAL_LAYER_OFFSETS.map((offset) => ({ ...offset })) as [Offset, Offset, Offset],
      lockedLayers: [false, false, false],
      activeLayer: 0,
      firstErrorShown: false,
      gameStatus: 'idle',
    }))
  }

  const finish = () => {
    if (disabled || progress.stage !== 'success' || progress.approachIndex === null) return
    haptics('success')
    onComplete(progress.approachIndex)
  }

  const activeOffset = progress.layerOffsets[progress.activeLayer]

  return (
    <View
      className={`shiqi-first-act${disabled ? ' shiqi-first-act--disabled' : ''}`}
      data-testid='shiqi-first-act-experience'
      data-object-code='outing-book'
      data-game-code='overlay'
      aria-label='拾柒第一幕：记录没有说完'
    >
      <Image data-testid='shiqi-first-act-scene' className='shiqi-first-act__scene' src={scene} mode='aspectFill' aria-hidden='true' />
      <View className='first-act-scene-grade' aria-hidden='true' />

      {progress.stage === 'inspect' && !activeHighlight ? (
        <FirstActHighlightOverlay
          npcSlug='shiqi'
          targets={SHIQI_FIRST_ACT_HIGHLIGHTS.map((highlight) => ({
            id: highlight.id,
            label: highlight.label,
            placementClassName: `shiqi-first-act__hotspot--${highlight.id}`,
          }))}
          completedIds={progress.completedHotspots}
          activeId={null}
          disabled={disabled}
          onSelect={(id) => openHighlight(id as HotspotId)}
        />
      ) : null}

      {progress.stage === 'inspect' && activeHighlight ? (
        <FirstActDialogueChrome
          npcSlug='shiqi'
          speaker='拾柒'
          speech={speech}
          narration={activeReply ? `你的判断：${activeReply.label}` : `你看向${activeHighlight.label}。`}
          prompt={activeReply ? '拾柒把事实和解释分开记下。' : '你接着说'}
          choices={activeReply ? [] : activeHighlight.replies.map((reply) => ({ id: reply.id, label: reply.label }))}
          action={activeReply ? { label: progress.completedHotspots.length === 3 ? '看完四处线索' : '继续观察', onClick: closeHighlight } : null}
          disabled={disabled}
          onChoose={(id) => {
            const reply = activeHighlight.replies.find((item) => item.id === id)
            if (reply) selectReply(reply)
          }}
        />
      ) : null}

      {progress.stage === 'approach' ? (
        <FirstActDialogueChrome
          npcSlug='shiqi'
          speaker='拾柒'
          speech={speech}
          narration='共同浅痕已经够清楚，后来补上的解释仍然各自偏开。'
          prompt='怎么区分事实与后来补上的解释？'
          choices={APPROACHES.map((approach, index) => ({ id: String(index), label: approach.label }))}
          disabled={disabled}
          onChoose={(id) => chooseApproach(Number(id) as ApproachIndex)}
        />
      ) : null}

      {progress.stage === 'approach-response' ? (
        <FirstActDialogueChrome
          npcSlug='shiqi'
          speaker='拾柒'
          speech={speech}
          narration='对齐的是浅痕，不是备注文字。'
          prompt='把三层路线纸放上检视灯箱。'
          action={{ label: '开始对齐浅痕', onClick: beginGame }}
          disabled={disabled}
        />
      ) : null}

      {progress.stage === 'game' ? (
        <View className='shiqi-first-act__bubble' role='status' aria-live='polite' aria-atomic='true'>
          <Text className='shiqi-first-act__bubble-name'>拾柒</Text>
          <Text className='shiqi-first-act__bubble-text' data-testid='shiqi-scene-speech'>{speech}</Text>
        </View>
      ) : null}

      {progress.stage === 'game' || progress.stage === 'success' ? (
        <View className='shiqi-first-act__overlay-board' data-testid='shiqi-overlay-game' aria-label='三层路线纸对齐区'>
          <View className='shiqi-first-act__baseline shiqi-first-act__baseline--vertical' aria-hidden='true' />
          <View className='shiqi-first-act__baseline shiqi-first-act__baseline--horizontal' aria-hidden='true' />
          {progress.layerOffsets.map((offset, index) => (
            <View
              key={LAYER_TITLES[index]}
              className='shiqi-first-act__paper'
              style={{
                opacity: index === progress.activeLayer ? 0.92 : progress.lockedLayers[index] ? 0.68 : 0.46,
                transform: `translate(${offset.x * 16}rpx, ${offset.y * 16}rpx) rotate(${index === 0 ? -1 : index === 1 ? 1 : 0}deg)`,
                zIndex: index === progress.activeLayer ? 4 : index + 1,
              }}
              aria-label={`${LAYER_TITLES[index]}，横向${signed(offset.x)}，纵向${signed(offset.y)}`}
            >
              <Text className='shiqi-first-act__layer-badge'>{index + 1}</Text>
              <View className='shiqi-first-act__paper-line shiqi-first-act__paper-line--a' aria-hidden='true' />
              <View className='shiqi-first-act__paper-line shiqi-first-act__paper-line--b' aria-hidden='true' />
              <View className='shiqi-first-act__paper-mark' aria-hidden='true' />
            </View>
          ))}
        </View>
      ) : null}

      {progress.stage === 'game' ? (
        <View className='shiqi-first-act__panel'>
          <Text className='shiqi-first-act__eyebrow'>检视灯箱 · {progress.activeLayer + 1}/3</Text>
          <Text className='shiqi-first-act__heading'>{LAYER_TITLES[progress.activeLayer]}</Text>
          <Text className='shiqi-first-act__offset' data-testid='shiqi-offset-feedback'>横向 {signed(activeOffset.x)} · 纵向 {signed(activeOffset.y)}</Text>
          {progress.gameStatus === 'error' ? (
            <View><Text className='shiqi-first-act__status'>还没重合。先看十字基准：横向差值归零，再处理纵向。</Text></View>
          ) : null}
          <View className='shiqi-first-act__direction-grid'>
            <View className='shiqi-first-act__direction-button' hoverClass={disabled ? '' : 'shiqi-first-act__direction-button--pressed'} onClick={() => moveLayer(-1, 0)} role='button' aria-label={`${LAYER_TITLES[progress.activeLayer].slice(0, 3)}向左`} aria-disabled={disabled}><Text>←</Text></View>
            <View className='shiqi-first-act__direction-button' hoverClass={disabled ? '' : 'shiqi-first-act__direction-button--pressed'} onClick={() => moveLayer(0, -1)} role='button' aria-label={`${LAYER_TITLES[progress.activeLayer].slice(0, 3)}向上`} aria-disabled={disabled}><Text>↑</Text></View>
            <View className='shiqi-first-act__direction-button' hoverClass={disabled ? '' : 'shiqi-first-act__direction-button--pressed'} onClick={() => moveLayer(0, 1)} role='button' aria-label={`${LAYER_TITLES[progress.activeLayer].slice(0, 3)}向下`} aria-disabled={disabled}><Text>↓</Text></View>
            <View className='shiqi-first-act__direction-button' hoverClass={disabled ? '' : 'shiqi-first-act__direction-button--pressed'} onClick={() => moveLayer(1, 0)} role='button' aria-label={`${LAYER_TITLES[progress.activeLayer].slice(0, 3)}向右`} aria-disabled={disabled}><Text>→</Text></View>
          </View>
          <View className='shiqi-first-act__game-actions'>
            <View className='shiqi-first-act__ghost shiqi-first-act__action-grow' hoverClass={disabled ? '' : 'shiqi-first-act__ghost--pressed'} onClick={resetGame} role='button' aria-label='重置三层路线纸' aria-disabled={disabled}><Text>重置</Text></View>
            <View className='shiqi-first-act__primary shiqi-first-act__primary--inline shiqi-first-act__action-grow' hoverClass={disabled ? '' : 'shiqi-first-act__primary--pressed'} onClick={checkLayer} role='button' aria-label={`核对${LAYER_TITLES[progress.activeLayer].slice(0, 3)}`} aria-disabled={disabled}><Text>核对这一层</Text></View>
          </View>
        </View>
      ) : null}

      {progress.stage === 'success' ? (
        <FirstActDialogueChrome
          npcSlug='shiqi'
          speaker='拾柒'
          speech={speech}
          narration='方向一致只是开头。现在能看见哪些是共同浅痕，哪些是后来补上的解释。'
          prompt='三层浅痕对齐了。'
          action={{ label: disabled ? '正在记下这次检视…' : '完成《记录没有说完》', onClick: finish }}
          disabled={disabled}
        />
      ) : null}
    </View>
  )
}
