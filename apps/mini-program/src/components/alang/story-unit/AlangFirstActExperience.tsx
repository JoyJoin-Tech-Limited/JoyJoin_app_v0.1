import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS } from '@shared/alang/flashFirstActExperience'
import { haptics } from '../../../lib/utils/haptics'
import './AlangFirstActExperience.scss'

export type AlangApproachIndex = 0 | 1

type HighlightId = 'alang' | 'lifebuoy' | 'routeMap' | 'windowChairs'
type Stage = 'explore' | 'stance' | 'game' | 'success'

interface HighlightReply {
  label: string
  response: string
}

interface HighlightDefinition {
  id: HighlightId
  label: string
  speech: string
  replies: readonly [HighlightReply, HighlightReply]
}

export const ALANG_FIRST_ACT_HIGHLIGHTS: readonly HighlightDefinition[] = [
  {
    id: 'alang',
    label: '阿浪',
    speech: '面对面坐着，人会急着证明自己。道歉也容易说成争论。',
    replies: [
      {
        label: '所以道歉才容易听成辩解？',
        response: '嗯。目光一顶上，话就变硬了。',
      },
      {
        label: '那就先别急着看对方。',
        response: '可以。先把呼吸放回自己这边。',
      },
    ],
  },
  {
    id: 'lifebuoy',
    label: '救生圈绳结',
    speech: '绳结留了余量。太紧，反而不好解。',
    replies: [
      {
        label: '关系也该留一点松动。',
        response: '对。能退半步，才不至于拉断。',
      },
      {
        label: '但太松，会不会接不住人？',
        response: '会。所以不是放开，是让彼此能动。',
      },
    ],
  },
  {
    id: 'routeMap',
    label: '路线地图台',
    speech: '路线图把转角画得很清楚，却不替人决定往哪走。',
    replies: [
      {
        label: '说开，也不等于替对方选答案。',
        response: '准确。说明方向，不封住出口。',
      },
      {
        label: '绕一点，也可能到同一个地方。',
        response: '城市懂这个。人也可以。',
      },
    ],
  },
  {
    id: 'windowChairs',
    label: '窗边双椅',
    speech: '两把椅子。并肩，却没有贴在一起。',
    replies: [
      {
        label: '像邀请，不像拦住。',
        response: '嗯。靠近是动词，不是占位置。',
      },
      {
        label: '一把稍微转过去，是在等回应？',
        response: '不是等。是给对方一个愿意转过来的角度。',
      },
    ],
  },
] as const

const APPROACHES = FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS['s1-p1-alang'].approaches

const DISTANCE_LABELS = ['挤在一起', '有点近', '刚好的并肩', '偏远', '像两张单人桌'] as const
const DISTANCE_FEEDBACK = [
  '距离太紧，像两句话都在抢先。',
  '已经松开一些，还可以再留半步。',
  '并肩，但不挤。这个距离刚好。',
  '有点远，声音会被晚风带走。',
  '各坐各的，邀请感消失了。',
] as const
const ANGLE_LABELS = ['面对面', '微微同向', '完全同向', '各自转开'] as const
const ANGLE_FEEDBACK = [
  '太像一次必须立刻说清的对质。',
  '略微朝向同一侧，也还看得见彼此。',
  '方向相同，但少了一点回应的余地。',
  '彼此转开，话更难落到中间。',
] as const

export const ALANG_SPACING_TARGET = {
  objectCode: 'seat-plan',
  gameType: 'spacing',
  distance: 2,
  angle: 1,
} as const

interface AlangFirstActProgress {
  version: 1
  encounterId: string
  stage: Stage
  answers: Partial<Record<HighlightId, AlangApproachIndex>>
  activeHighlight: HighlightId | null
  approachIndex: AlangApproachIndex | null
  distance: number
  angle: number
  attempts: number
  needsRetry: boolean
}

export interface AlangFirstActExperienceProps {
  encounterId: string
  scene: string
  disabled?: boolean
  onSpeechChange: (speech: string) => void
  onComplete: (approachIndex: AlangApproachIndex) => void | Promise<void>
}

function createInitialProgress(encounterId: string): AlangFirstActProgress {
  return {
    version: 1,
    encounterId,
    stage: 'explore',
    answers: {},
    activeHighlight: null,
    approachIndex: null,
    distance: 0,
    angle: 0,
    attempts: 0,
    needsRetry: false,
  }
}

export function alangFirstActStorageKey(encounterId: string): string {
  return `joyjoin:alang:first-act:v1:${encounterId}`
}

function isHighlightId(value: unknown): value is HighlightId {
  return ALANG_FIRST_ACT_HIGHLIGHTS.some((item) => item.id === value)
}

function clampStep(value: unknown, max: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.max(0, Math.min(max, value))
    : 0
}

function restoreProgress(encounterId: string): AlangFirstActProgress {
  const fallback = createInitialProgress(encounterId)
  try {
    const stored = Taro.getStorageSync(alangFirstActStorageKey(encounterId)) as Partial<AlangFirstActProgress> | null
    if (!stored || stored.version !== 1 || stored.encounterId !== encounterId) return fallback

    const answers: Partial<Record<HighlightId, AlangApproachIndex>> = {}
    for (const item of ALANG_FIRST_ACT_HIGHLIGHTS) {
      const answer = stored.answers?.[item.id]
      if (answer === 0 || answer === 1) answers[item.id] = answer
    }
    const allHighlightsSeen = ALANG_FIRST_ACT_HIGHLIGHTS.every((item) => answers[item.id] !== undefined)
    const restoredStage: Stage = stored.stage === 'stance' || stored.stage === 'game' || stored.stage === 'success'
      ? stored.stage
      : 'explore'
    const stage = restoredStage !== 'explore' && !allHighlightsSeen ? 'explore' : restoredStage
    const approachIndex = stored.approachIndex === 0 || stored.approachIndex === 1
      ? stored.approachIndex
      : null

    return {
      ...fallback,
      stage: (stage === 'game' || stage === 'success') && approachIndex === null ? 'stance' : stage,
      answers,
      activeHighlight: stage === 'explore' && isHighlightId(stored.activeHighlight)
        ? stored.activeHighlight
        : null,
      approachIndex,
      distance: clampStep(stored.distance, DISTANCE_LABELS.length - 1),
      angle: clampStep(stored.angle, ANGLE_LABELS.length - 1),
      attempts: clampStep(stored.attempts, 99),
      needsRetry: Boolean(stored.needsRetry),
    }
  } catch {
    return fallback
  }
}

function resolveSpeech(progress: AlangFirstActProgress): string {
  if (progress.stage === 'success') {
    return '这样就好。看着同一条河，话不一定更容易。但至少，不必先赢。'
  }
  if (progress.stage === 'game') {
    return progress.needsRetry
      ? '太近了。也太像必须立刻把话说清。再留一点。'
      : '椅子不是答案。只是让两个人先站到同一边。'
  }
  if (progress.stage === 'stance') {
    return progress.approachIndex === null
      ? '面对面，容易把道歉说成辩解。并肩一点，也许能先把同一阵风听完。'
      : APPROACHES[progress.approachIndex].response
  }
  if (progress.activeHighlight) {
    const item = ALANG_FIRST_ACT_HIGHLIGHTS.find((candidate) => candidate.id === progress.activeHighlight)!
    const answer = progress.answers[item.id]
    return answer === undefined ? item.speech : item.replies[answer].response
  }
  return '风从河面过来。你替我看看，这里有没有一种不催人的距离。'
}

function countAnswers(answers: AlangFirstActProgress['answers']): number {
  return ALANG_FIRST_ACT_HIGHLIGHTS.filter((item) => answers[item.id] !== undefined).length
}

function hotspotClassSuffix(id: HighlightId): string {
  return id === 'windowChairs' ? 'window-chairs' : id
}

export function AlangFirstActExperience({
  encounterId,
  scene,
  disabled = false,
  onSpeechChange,
  onComplete,
}: AlangFirstActExperienceProps) {
  const [progress, setProgress] = useState<AlangFirstActProgress>(() => restoreProgress(encounterId))
  const [sceneAvailable, setSceneAvailable] = useState(true)
  const [completionRequested, setCompletionRequested] = useState(false)
  const speech = useMemo(() => resolveSpeech(progress), [progress])
  const answerCount = countAnswers(progress.answers)
  const activeDefinition = progress.activeHighlight
    ? ALANG_FIRST_ACT_HIGHLIGHTS.find((item) => item.id === progress.activeHighlight) ?? null
    : null
  const activeAnswer = activeDefinition ? progress.answers[activeDefinition.id] : undefined

  useEffect(() => {
    try {
      Taro.setStorageSync(alangFirstActStorageKey(encounterId), progress)
    } catch {
      // Local progress is recoverable convenience; interaction remains usable without storage.
    }
  }, [encounterId, progress])

  useEffect(() => {
    onSpeechChange(speech)
  }, [onSpeechChange, speech])

  const openHighlight = (id: HighlightId) => {
    if (disabled || progress.stage !== 'explore') return
    haptics('light')
    setProgress((current) => ({ ...current, activeHighlight: id }))
  }

  const answerHighlight = (replyIndex: AlangApproachIndex) => {
    if (disabled || !activeDefinition || activeAnswer !== undefined) return
    haptics('light')
    setProgress((current) => ({
      ...current,
      answers: { ...current.answers, [activeDefinition.id]: replyIndex },
    }))
  }

  const continueExploring = () => {
    if (disabled || !activeDefinition || activeAnswer === undefined) return
    haptics(answerCount === ALANG_FIRST_ACT_HIGHLIGHTS.length ? 'medium' : 'light')
    setProgress((current) => ({
      ...current,
      activeHighlight: null,
      stage: countAnswers(current.answers) === ALANG_FIRST_ACT_HIGHLIGHTS.length ? 'stance' : 'explore',
    }))
  }

  const selectApproach = (approachIndex: AlangApproachIndex) => {
    if (disabled || progress.stage !== 'stance') return
    haptics('light')
    setProgress((current) => ({ ...current, approachIndex }))
  }

  const enterGame = () => {
    if (disabled || progress.stage !== 'stance' || progress.approachIndex === null) return
    haptics('medium')
    setProgress((current) => ({ ...current, stage: 'game' }))
  }

  const adjustDistance = (delta: number) => {
    if (disabled || progress.stage !== 'game' || progress.needsRetry) return
    haptics('light')
    setProgress((current) => ({
      ...current,
      distance: Math.max(0, Math.min(DISTANCE_LABELS.length - 1, current.distance + delta)),
    }))
  }

  const adjustAngle = (delta: number) => {
    if (disabled || progress.stage !== 'game' || progress.needsRetry) return
    haptics('light')
    setProgress((current) => ({
      ...current,
      angle: Math.max(0, Math.min(ANGLE_LABELS.length - 1, current.angle + delta)),
    }))
  }

  const confirmSpacing = () => {
    if (disabled || progress.stage !== 'game' || progress.needsRetry) return
    const solved = progress.distance === ALANG_SPACING_TARGET.distance && progress.angle === ALANG_SPACING_TARGET.angle
    if (solved) haptics('success')
    else haptics('warning')
    setProgress((current) => ({
      ...current,
      attempts: current.attempts + 1,
      needsRetry: !solved,
      stage: solved ? 'success' : 'game',
    }))
  }

  const retrySpacing = () => {
    if (disabled || progress.stage !== 'game' || !progress.needsRetry) return
    haptics('light')
    setProgress((current) => ({ ...current, needsRetry: false }))
  }

  const completeExperience = () => {
    if (disabled || completionRequested || progress.stage !== 'success' || progress.approachIndex === null) return
    haptics('success')
    setCompletionRequested(true)
    void Promise.resolve(onComplete(progress.approachIndex)).catch(() => setCompletionRequested(false))
  }

  return (
    <View
      className={`alang-first-act alang-first-act--${progress.stage}${disabled ? ' alang-first-act--disabled' : ''}`}
      data-testid='alang-first-act-experience'
      data-stage={progress.stage}
      data-object-code='seat-plan'
      data-game-code='spacing'
      data-game-type='spacing'
    >
      {sceneAvailable ? (
        <Image
          className='alang-first-act__scene'
          src={scene}
          mode='aspectFill'
          aria-hidden='true'
          data-testid='alang-first-act-scene'
          onError={() => setSceneAvailable(false)}
        />
      ) : <View className='alang-first-act__scene-fallback' aria-hidden='true' />}
      <View className='alang-first-act__scene-grade' aria-hidden='true' />

      <View className='alang-first-act__speech' role='status' aria-live='polite' aria-atomic='true'>
        <Text className='alang-first-act__speaker'>阿浪</Text>
        <Text className='alang-first-act__speech-copy' data-testid='alang-scene-speech'>{speech}</Text>
      </View>

      {progress.stage === 'explore' ? (
        <>
          {ALANG_FIRST_ACT_HIGHLIGHTS.map((item) => {
            const seen = progress.answers[item.id] !== undefined
            const active = progress.activeHighlight === item.id
            return (
              <View
                key={item.id}
                className={`alang-first-act__hotspot alang-first-act__hotspot--${hotspotClassSuffix(item.id)}${seen ? ' alang-first-act__hotspot--seen' : ''}${active ? ' alang-first-act__hotspot--active' : ''}`}
                hoverClass={disabled ? '' : 'alang-first-act__hotspot--pressed'}
                onClick={() => openHighlight(item.id)}
                role='button'
                aria-label={`观察${item.label}`}
                aria-pressed={active}
                aria-disabled={disabled}
                data-testid={`alang-highlight-${item.id}`}
              >
                <View className='alang-first-act__hotspot-marker' aria-hidden='true'>
                  <Text>{seen ? '已' : '·'}</Text>
                </View>
              </View>
            )
          })}
          <View className='alang-first-act__progress'>
            <Text>{answerCount}/4 处观察</Text>
          </View>
        </>
      ) : null}

      <View className={`alang-first-act__panel alang-first-act__panel--${progress.stage}`}>
        {progress.stage === 'explore' ? (
          !activeDefinition ? (
            <View className='alang-first-act__copy-block'>
              <Text className='alang-first-act__kicker'>第一幕 · 并肩留白</Text>
              <Text className='alang-first-act__title'>替阿浪看一眼这个转角</Text>
              <Text className='alang-first-act__body'>风从栏杆缝里穿过。他想确认，这里是否适合让两个人把话说开。</Text>
              <Text className='alang-first-act__hint'>轻触阿浪和三处场景物件</Text>
            </View>
          ) : activeAnswer === undefined ? (
            <View className='alang-first-act__copy-block'>
              <Text className='alang-first-act__kicker'>观察 · {activeDefinition.label}</Text>
              <Text className='alang-first-act__prompt'>你怎么回应？</Text>
              <View className='alang-first-act__choices' aria-label={`回应${activeDefinition.label}`}>
                {activeDefinition.replies.map((reply, index) => (
                  <View
                    key={reply.label}
                    className='alang-first-act__choice'
                    hoverClass={disabled ? '' : 'alang-first-act__choice--pressed'}
                    onClick={() => answerHighlight(index as AlangApproachIndex)}
                    role='button'
                    aria-label={reply.label}
                    aria-disabled={disabled}
                  >
                    <Text className='alang-first-act__choice-mark' aria-hidden='true'>·</Text>
                    <Text className='alang-first-act__choice-copy'>{reply.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View className='alang-first-act__copy-block'>
              <Text className='alang-first-act__kicker'>阿浪的回应</Text>
              <Text className='alang-first-act__body'>他没有马上补充，只把目光放回{activeDefinition.label}。</Text>
              <View
                className='alang-first-act__primary-action'
                hoverClass={disabled ? '' : 'alang-first-act__primary-action--pressed'}
                onClick={continueExploring}
                role='button'
                aria-label={answerCount === ALANG_FIRST_ACT_HIGHLIGHTS.length ? '看完四处线索' : '继续观察'}
                aria-disabled={disabled}
              >
                <Text>{answerCount === ALANG_FIRST_ACT_HIGHLIGHTS.length ? '看完四处线索' : '继续观察'}</Text>
              </View>
            </View>
          )
        ) : null}

        {progress.stage === 'stance' ? (
          <View className='alang-first-act__copy-block'>
            <Text className='alang-first-act__kicker'>揭示 · 并肩留白</Text>
            <Text className='alang-first-act__body'>原来这里没有失踪的人。阿浪也不是在等谁。他只是在替两句总被说成争论的道歉，试一个能慢下来的位置。</Text>
            {progress.approachIndex === null ? (
              <>
                <Text className='alang-first-act__prompt'>如果是你，会把椅子怎么放？</Text>
                <View className='alang-first-act__choices' aria-label='选择阿浪的谈话立场'>
                  {APPROACHES.map((approach, index) => (
                    <View
                      key={approach.label}
                      className='alang-first-act__choice'
                      hoverClass={disabled ? '' : 'alang-first-act__choice--pressed'}
                      onClick={() => selectApproach(index as AlangApproachIndex)}
                      role='button'
                      aria-label={approach.label}
                      aria-disabled={disabled}
                    >
                      <Text className='alang-first-act__choice-mark' aria-hidden='true'>·</Text>
                      <Text className='alang-first-act__choice-copy'>{approach.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View
                className='alang-first-act__primary-action'
                hoverClass={disabled ? '' : 'alang-first-act__primary-action--pressed'}
                onClick={enterGame}
                role='button'
                aria-label='调一调两把椅子'
                aria-disabled={disabled}
              >
                <Text>调一调两把椅子</Text>
              </View>
            )}
          </View>
        ) : null}

        {progress.stage === 'game' ? (
          <View className='alang-first-act__game' data-testid='alang-spacing-game'>
            <Text className='alang-first-act__kicker'>旧物复原 · 座位图</Text>
            {progress.needsRetry ? (
              <>
                <View className='alang-first-act__error' role='alert'>
                  <Text className='alang-first-act__error-title'>第一次没调对</Text>
                  <Text>两把椅子太近，也太像一次必须立刻说清的对质。先留开一点，再让它们略微朝向同一侧。</Text>
                </View>
                <View
                  className='alang-first-act__secondary-action'
                  hoverClass={disabled ? '' : 'alang-first-act__secondary-action--pressed'}
                  onClick={retrySpacing}
                  role='button'
                  aria-label='再调一次'
                  aria-disabled={disabled}
                >
                  <Text>再调一次</Text>
                </View>
              </>
            ) : (
              <>
                <Text className='alang-first-act__game-instruction'>调两把椅子的距离与夹角：并肩但不挤，椅背略微朝向同一侧。</Text>
                <View
                  className={`alang-first-act__chair-board alang-first-act__chair-board--distance-${progress.distance} alang-first-act__chair-board--angle-${progress.angle}`}
                  data-testid='alang-chair-board'
                  data-seat-distance={progress.distance}
                  data-seat-angle={progress.angle}
                  aria-label={`椅距${DISTANCE_LABELS[progress.distance]}，方向${ANGLE_LABELS[progress.angle]}`}
                >
                  <View className='alang-first-act__chair alang-first-act__chair--left'>
                    <View className='alang-first-act__chair-back' />
                    <View className='alang-first-act__chair-base' />
                  </View>
                  <View className='alang-first-act__river-line' aria-hidden='true' />
                  <View className='alang-first-act__chair alang-first-act__chair--right'>
                    <View className='alang-first-act__chair-back' />
                    <View className='alang-first-act__chair-base' />
                  </View>
                </View>
                <View className='alang-first-act__game-feedback'>
                  <Text>{DISTANCE_FEEDBACK[progress.distance]}</Text>
                  <Text>{ANGLE_FEEDBACK[progress.angle]}</Text>
                </View>
                <View className='alang-first-act__control-row' aria-label='调整椅子距离'>
                  <View className='alang-first-act__control' role='button' aria-label='把椅子拉近一点' aria-disabled={disabled || progress.distance === 0} onClick={() => adjustDistance(-1)}><Text>拉近一点</Text></View>
                  <Text className='alang-first-act__control-value'>距离 · {DISTANCE_LABELS[progress.distance]}</Text>
                  <View className='alang-first-act__control' role='button' aria-label='把椅子留开一点' aria-disabled={disabled || progress.distance === DISTANCE_LABELS.length - 1} onClick={() => adjustDistance(1)}><Text>留开一点</Text></View>
                </View>
                <View className='alang-first-act__control-row' aria-label='调整椅子夹角'>
                  <View className='alang-first-act__control' role='button' aria-label='把椅子转回一点' aria-disabled={disabled || progress.angle === 0} onClick={() => adjustAngle(-1)}><Text>转回一点</Text></View>
                  <Text className='alang-first-act__control-value'>夹角 · {ANGLE_LABELS[progress.angle]}</Text>
                  <View className='alang-first-act__control' role='button' aria-label='让椅子朝向同一侧' aria-disabled={disabled || progress.angle === ANGLE_LABELS.length - 1} onClick={() => adjustAngle(1)}><Text>朝向同侧</Text></View>
                </View>
                <View
                  className='alang-first-act__primary-action alang-first-act__primary-action--compact'
                  hoverClass={disabled ? '' : 'alang-first-act__primary-action--pressed'}
                  onClick={confirmSpacing}
                  role='button'
                  aria-label='确认座位距离与夹角'
                  aria-disabled={disabled}
                >
                  <Text>确认这个位置</Text>
                </View>
              </>
            )}
          </View>
        ) : null}

        {progress.stage === 'success' ? (
          <View className='alang-first-act__copy-block alang-first-act__success'>
            <Text className='alang-first-act__kicker'>复原完成</Text>
            <Text className='alang-first-act__title'>并肩，但不挤</Text>
            <Text className='alang-first-act__body'>阿浪把折过很多次的座位图重新压平。两把椅子朝向同一段河面，也给转身和停顿留了余地。</Text>
            <View
              className='alang-first-act__primary-action'
              hoverClass={disabled || completionRequested ? '' : 'alang-first-act__primary-action--pressed'}
              onClick={completeExperience}
              role='button'
              aria-label='记下这段并肩留白'
              aria-disabled={disabled || completionRequested}
            >
              <Text>{disabled || completionRequested ? '正在记下这次相遇…' : '记下这段并肩留白'}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}
