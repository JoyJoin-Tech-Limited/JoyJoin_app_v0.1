import { useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import {
  getAtuanLaterActDefinition,
  resolveAtuanLaterActOutcome,
  toAtuanLaterActSubmission,
  type AtuanLaterActProgress,
  type AtuanLaterActSubmission,
  type AtuanLaterActUnitId,
  type AtuanSecondActArrivalReplyId,
  type AtuanSecondActFollowupId,
  type AtuanSecondActHighlightId,
  type AtuanThirdActArrivalReplyId,
  type AtuanThirdActFollowupId,
  type AtuanThirdActHighlightId,
} from '@shared/alang/atuanLaterActs'
import { haptics } from '../../../lib/utils/haptics'
import './AtuanLaterActExperience.scss'

interface AtuanLaterActSceneProps {
  unitId: AtuanLaterActUnitId
  background: string
  character: string
  speech: string
  progress?: AtuanLaterActProgress | null
  disabled?: boolean
  onInspect?: (highlightId: string) => void
}

const HOTSPOT_CLASS: Record<AtuanLaterActUnitId, readonly string[]> = {
  's1-p2-atuan': ['plan', 'chair', 'place'],
  's1-p3-atuan': ['box', 'card', 'seat'],
}

export function AtuanLaterActScene({ unitId, background, character, speech, progress = null, disabled = false, onInspect }: AtuanLaterActSceneProps) {
  const [backgroundFailed, setBackgroundFailed] = useState(false)
  const [focusedHighlightId, setFocusedHighlightId] = useState<string | null>(null)
  const definition = getAtuanLaterActDefinition(unitId)
  const highlights = definition.highlights as readonly { id: string; label: string }[]
  const exploring = Boolean(progress?.arrivalReplyId && progress.highlightOrder.length < highlights.length)

  return (
    <View className={`atuan-later-scene atuan-later-scene--${unitId === 's1-p2-atuan' ? 'second' : 'third'}${backgroundFailed ? ' atuan-later-scene--fallback' : ''}`} data-testid='atuan-later-scene'>
      {!backgroundFailed ? <Image className='atuan-later-scene__background' src={background} mode='aspectFill' onError={() => setBackgroundFailed(true)} data-testid='atuan-later-background' aria-hidden='true' /> : null}
      <View className='atuan-later-scene__grade' aria-hidden='true' />
      <Image className={`atuan-later-scene__character${exploring ? ' atuan-later-scene__character--quiet' : ''}`} src={character} mode='aspectFit' aria-hidden='true' />
      {progress && onInspect ? (
        <View className='atuan-later-scene__hotspots' aria-label='探索场景细节'>
          {highlights.map((highlight, index) => {
            const seen = (progress.highlightOrder as readonly string[]).includes(highlight.id)
            const focused = focusedHighlightId === highlight.id
            return (
              <View
                key={highlight.id}
                className={`atuan-later-scene__hotspot atuan-later-scene__hotspot--${HOTSPOT_CLASS[unitId][index]}${seen ? ' atuan-later-scene__hotspot--seen' : ''}${focused ? ' atuan-later-scene__hotspot--focused' : ''}`}
                role='button'
                aria-label={`${focused ? '正在查看' : seen ? '已查看' : '查看'}${highlight.label}`}
                aria-disabled={disabled || seen}
                onClick={() => {
                  if (disabled || seen) return
                  setFocusedHighlightId(highlight.id)
                  onInspect(highlight.id)
                }}
              >
                <View className='atuan-later-scene__hotspot-ring' aria-hidden='true' />
              </View>
            )
          })}
        </View>
      ) : null}
      <View className='atuan-later-scene__speech' role='status' aria-live='polite' aria-atomic='true'>
        <Text className='atuan-later-scene__speaker'>阿团</Text>
        <Text className='atuan-later-scene__speech-copy'>{speech}</Text>
      </View>
    </View>
  )
}

interface AtuanLaterActExperienceProps {
  unitId: AtuanLaterActUnitId
  background: string
  character: string
  progress: AtuanLaterActProgress
  disabled?: boolean
  onProgress: (progress: AtuanLaterActProgress) => void
  onComplete: (submission: AtuanLaterActSubmission) => void
}

interface AtuanLaterActPreludeProps {
  unitId: AtuanLaterActUnitId
  background: string
  character: string
  disabled?: boolean
  onBegin: (approachIndex: number, label: string) => void
}

export function AtuanLaterActPrelude({ unitId, background, character, disabled = false, onBegin }: AtuanLaterActPreludeProps) {
  const definition = getAtuanLaterActDefinition(unitId)
  const approaches = definition.approaches as readonly { id: string; label: string }[]
  return (
    <View className='atuan-later-experience' data-testid='atuan-later-prelude' data-unit-id={unitId}>
      <AtuanLaterActScene unitId={unitId} background={background} character={character} speech={definition.opening} />
      <View className='atuan-later-experience__chapter'><Text>{unitId === 's1-p2-atuan' ? '第二幕 · 没写完的座位图' : '第三幕 · 回来的第六张卡'}</Text></View>
      <View className='atuan-later-experience__panel atuan-later-experience__panel--prelude' aria-label='选择你的现场动作'>
        <View className='atuan-later-experience__section'>
          <Text className='atuan-later-experience__eyebrow'>阿团的故事还在继续</Text>
          <Text className='atuan-later-experience__prompt'>你先从哪里接近这件旧物？</Text>
          <View className='atuan-later-experience__choices'>
            {approaches.map((approach, index) => (
              <View key={approach.id} className='atuan-later-experience__choice' hoverClass={disabled ? '' : 'atuan-later-experience__choice--pressed'} role='button' aria-label={approach.label} aria-disabled={disabled} onClick={() => { if (!disabled) { haptics('light'); onBegin(index, approach.label) } }}><Text>{approach.label}</Text></View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

function latestSpeech(progress: AtuanLaterActProgress): string {
  const definition = getAtuanLaterActDefinition(progress.unitId)
  if (progress.unitId === 's1-p2-atuan') {
    if (progress.game.chairGap === 'breathing') return resolveAtuanLaterActOutcome(progress).responseCopy
    if (progress.game.planUpright) return '图已经正过来了。现在只决定阿团这一边：靠近不是越多越好，能自在说话才算合适。'
  } else {
    if (progress.game.otherSeat === 'blank') return resolveAtuanLaterActOutcome(progress).responseCopy
    if (progress.game.atuanNamePlaced) return '阿团的名字已经放好。另一边不是一道要替默默完成的题。'
    if (progress.game.invitationPlaced) return '第六张卡已经摆在座位图中央。现在只放好发出邀请的人，再把回答的位置留出来。'
    if (progress.game.boxUnlocked) return '第六张卡在夹层里。把这份迟到的邀请摆回第二幕的座位图上吧。'
  }
  if (progress.followupId) {
    return (definition.followups as readonly { id: string; reply: string }[]).find((item) => item.id === progress.followupId)?.reply ?? definition.opening
  }
  const latestHighlightId = progress.highlightOrder[progress.highlightOrder.length - 1]
  if (latestHighlightId) {
    return (definition.highlights as readonly { id: string; reply: string }[]).find((item) => item.id === latestHighlightId)?.reply ?? definition.opening
  }
  if (progress.arrivalReplyId) {
    return (definition.arrivalReplies as readonly { id: string; reply: string }[]).find((item) => item.id === progress.arrivalReplyId)?.reply ?? definition.opening
  }
  return (definition.approaches as readonly { id: string; reply: string }[]).find((item) => item.id === progress.approachId)?.reply ?? definition.opening
}

export function AtuanLaterActExperience({ unitId, background, character, progress, disabled = false, onProgress, onComplete }: AtuanLaterActExperienceProps) {
  const definition = getAtuanLaterActDefinition(unitId)
  const highlightsComplete = progress.highlightOrder.length === definition.highlights.length
  const arrivalReplies = (definition.arrivalReplies as readonly { id: string; approachId: string; label: string }[]).filter((option) => option.approachId === progress.approachId)

  const inspect = (highlightId: string) => {
    haptics('light')
    if (progress.unitId === 's1-p2-atuan') {
      onProgress({ ...progress, highlightOrder: [...progress.highlightOrder, highlightId as AtuanSecondActHighlightId] })
    } else {
      onProgress({ ...progress, highlightOrder: [...progress.highlightOrder, highlightId as AtuanThirdActHighlightId] })
    }
  }

  const chooseArrivalReply = (arrivalReplyId: string) => {
    haptics('light')
    if (progress.unitId === 's1-p2-atuan') onProgress({ ...progress, arrivalReplyId: arrivalReplyId as AtuanSecondActArrivalReplyId })
    else onProgress({ ...progress, arrivalReplyId: arrivalReplyId as AtuanThirdActArrivalReplyId })
  }

  const chooseFollowup = (followupId: string) => {
    haptics('light')
    if (progress.unitId === 's1-p2-atuan') onProgress({ ...progress, followupId: followupId as AtuanSecondActFollowupId })
    else onProgress({ ...progress, followupId: followupId as AtuanThirdActFollowupId })
  }

  const gameComplete = progress.unitId === 's1-p2-atuan'
    ? progress.game.planUpright && progress.game.chairGap === 'breathing'
    : progress.game.boxUnlocked && progress.game.invitationPlaced && progress.game.atuanNamePlaced && progress.game.otherSeat === 'blank'
  const gameTotal = progress.unitId === 's1-p2-atuan' ? 2 : 4
  const gameProgress = progress.unitId === 's1-p2-atuan'
    ? Number(progress.game.planUpright) + Number(progress.game.chairGap === 'breathing')
    : Number(progress.game.boxUnlocked) + Number(progress.game.invitationPlaced) + Number(progress.game.atuanNamePlaced) + Number(progress.game.otherSeat === 'blank')
  const gameHeader = progress.gameStarted ? (
    <>
      <Text className='atuan-later-experience__eyebrow'>{progress.unitId === 's1-p2-atuan' ? '阿团的小座位图' : '阿团的第六张卡'}</Text>
      <Text className='atuan-later-experience__game-title'>{progress.unitId === 's1-p2-atuan' ? '替两把椅子找个舒服的位置' : '把迟到的邀请放回正确的位置'}</Text>
      <Text className='atuan-later-experience__game-copy'>{progress.unitId === 's1-p2-atuan' ? '不是越近越好。先说清想靠近，再给回答留下呼吸感。' : '只完成阿团这一边。另一边可以空着，等它的主人自己决定。'}</Text>
      <View className='atuan-later-experience__game-progress' aria-label={`已完成 ${gameProgress} 步，共 ${gameTotal} 步`}>
        {Array.from({ length: gameTotal }, (_, index) => <View key={index} className={`atuan-later-experience__game-progress-dot${index < gameProgress ? ' atuan-later-experience__game-progress-dot--active' : ''}`} />)}
      </View>
    </>
  ) : null

  return (
    <View className={`atuan-later-experience${progress.gameStarted ? ' atuan-later-experience--game' : ''}`} data-testid='atuan-later-experience' data-unit-id={unitId}>
      <AtuanLaterActScene unitId={unitId} background={background} character={character} speech={latestSpeech(progress)} progress={progress} disabled={disabled} onInspect={progress.arrivalReplyId ? inspect : undefined} />
      <View className='atuan-later-experience__chapter'>
        <Text>{unitId === 's1-p2-atuan' ? '第二幕 · 没写完的座位图' : '第三幕 · 回来的第六张卡'}</Text>
      </View>
      <View className='atuan-later-experience__panel'>
        <ScrollView className='atuan-later-experience__scroll' scrollY>
          {!progress.arrivalReplyId ? (
            <View className='atuan-later-experience__section'>
              <Text className='atuan-later-experience__eyebrow'>你接着说</Text>
              <Text className='atuan-later-experience__prompt'>阿团看着你，等你把刚才的话继续说完。</Text>
              <View className='atuan-later-experience__choices'>
                {arrivalReplies.map((option) => (
                  <View key={option.id} className='atuan-later-experience__choice' hoverClass={disabled ? '' : 'atuan-later-experience__choice--pressed'} role='button' aria-label={option.label} aria-disabled={disabled} onClick={() => { if (!disabled) chooseArrivalReply(option.id) }}><Text>{option.label}</Text></View>
                ))}
              </View>
            </View>
          ) : !highlightsComplete ? (
            <View className='atuan-later-experience__section'>
              <Text className='atuan-later-experience__eyebrow'>场景里还有细节</Text>
              <Text className='atuan-later-experience__prompt'>点亮三处旧物，再替阿团理清这次邀请。</Text>
              <Text className='atuan-later-experience__progress'>{progress.highlightOrder.length}/3 已查看</Text>
            </View>
          ) : !progress.followupId ? (
            <View className='atuan-later-experience__section'>
              <Text className='atuan-later-experience__prompt'>你想怎么回应阿团？</Text>
              <View className='atuan-later-experience__choices'>
                {(definition.followups as readonly { id: string; label: string }[]).map((option) => (
                  <View key={option.id} className='atuan-later-experience__choice' hoverClass={disabled ? '' : 'atuan-later-experience__choice--pressed'} role='button' aria-label={option.label} aria-disabled={disabled} onClick={() => { if (!disabled) chooseFollowup(option.id) }}><Text>{option.label}</Text></View>
                ))}
              </View>
            </View>
          ) : !progress.gameStarted ? (
            <View className='atuan-later-experience__section atuan-later-experience__section--transition'>
              <Text className='atuan-later-experience__prompt'>{definition.action.prompt}</Text>
              <View className='atuan-later-experience__game-action' hoverClass={disabled ? '' : 'atuan-later-experience__game-action--pressed'} role='button' aria-label={definition.action.label} aria-disabled={disabled} onClick={() => { if (!disabled) { haptics('medium'); onProgress({ ...progress, gameStarted: true }) } }}><Text>{definition.action.label}</Text></View>
            </View>
          ) : progress.unitId === 's1-p2-atuan' ? (
            <View className='atuan-later-experience__section' data-testid='atuan-second-act-game'>
              {gameHeader}
              {!progress.game.planUpright ? (
                <View className='atuan-later-experience__game-action' hoverClass={disabled ? '' : 'atuan-later-experience__game-action--pressed'} role='button' aria-label='把座位图转正' aria-disabled={disabled} onClick={() => { if (!disabled) { haptics('light'); onProgress({ ...progress, game: { ...progress.game, planUpright: true } }) } }}><Text>把座位图转正</Text></View>
              ) : progress.game.chairGap !== 'breathing' ? (
                <>
                  {progress.game.chairGap ? <View className='atuan-later-experience__feedback' role='alert'><Text>{progress.game.chairGap === 'close' ? '太近会替默默做决定，再留一点呼吸感。' : '太远又藏住了阿团的邀请，再试一次。'}</Text></View> : null}
                  <Text className='atuan-later-experience__prompt'>两把椅子停在哪里？</Text>
                  <View className='atuan-later-experience__choices atuan-later-experience__choices--compact'>
                    {([
                      ['close', '把椅子挪得更近'],
                      ['breathing', '留出能自在说话的距离'],
                      ['far', '把椅子推得很远'],
                    ] as const).map(([chairGap, label]) => <View key={chairGap} className='atuan-later-experience__choice' hoverClass={disabled ? '' : 'atuan-later-experience__choice--pressed'} role='button' aria-label={label} aria-disabled={disabled} onClick={() => { if (!disabled) { haptics(chairGap === 'breathing' ? 'medium' : 'light'); onProgress({ ...progress, game: { ...progress.game, chairGap, attempts: progress.game.attempts + (chairGap === 'breathing' ? 0 : 1) } }) } }}><Text>{label}</Text></View>)}
                  </View>
                </>
              ) : null}
            </View>
          ) : (
            <View className='atuan-later-experience__section' data-testid='atuan-third-act-game'>
              {gameHeader}
              {!progress.game.boxUnlocked ? <View className='atuan-later-experience__game-action' hoverClass={disabled ? '' : 'atuan-later-experience__game-action--pressed'} role='button' aria-label='用钥匙打开夹层' aria-disabled={disabled} onClick={() => { if (!disabled) { haptics('medium'); onProgress({ ...progress, game: { ...progress.game, boxUnlocked: true } }) } }}><Text>用钥匙打开夹层</Text></View>
                : !progress.game.invitationPlaced ? <View className='atuan-later-experience__game-action' hoverClass={disabled ? '' : 'atuan-later-experience__game-action--pressed'} role='button' aria-label='把第六张卡摆到座位图中央' aria-disabled={disabled} onClick={() => { if (!disabled) { haptics('light'); onProgress({ ...progress, game: { ...progress.game, invitationPlaced: true } }) } }}><Text>把第六张卡摆到座位图中央</Text></View>
                  : !progress.game.atuanNamePlaced ? <View className='atuan-later-experience__game-action' hoverClass={disabled ? '' : 'atuan-later-experience__game-action--pressed'} role='button' aria-label='放上阿团的名牌' aria-disabled={disabled} onClick={() => { if (!disabled) { haptics('light'); onProgress({ ...progress, game: { ...progress.game, atuanNamePlaced: true } }) } }}><Text>放上阿团的名牌</Text></View>
                  : progress.game.otherSeat !== 'blank' ? (
                    <>
                      {progress.game.attempts > 0 ? <View className='atuan-later-experience__feedback' role='alert'><Text>不能替默默写下答案。邀请可以被看见，回应仍要由他自己决定。</Text></View> : null}
                      <Text className='atuan-later-experience__prompt'>另一边怎么放？</Text>
                      <View className='atuan-later-experience__choices atuan-later-experience__choices--compact'>
                        <View className='atuan-later-experience__choice' hoverClass={disabled ? '' : 'atuan-later-experience__choice--pressed'} role='button' aria-label='替默默写上名字' aria-disabled={disabled} onClick={() => { if (!disabled) { haptics('light'); onProgress({ ...progress, game: { ...progress.game, attempts: progress.game.attempts + 1 } }) } }}><Text>替默默写上名字</Text></View>
                        <View className='atuan-later-experience__choice' hoverClass={disabled ? '' : 'atuan-later-experience__choice--pressed'} role='button' aria-label='把另一边留空' aria-disabled={disabled} onClick={() => { if (!disabled) { haptics('medium'); onProgress({ ...progress, game: { ...progress.game, otherSeat: 'blank' } }) } }}><Text>把另一边留空</Text></View>
                      </View>
                    </>
                  ) : null}
            </View>
          )}
        </ScrollView>
        {gameComplete ? (
          // Keep the terminal action outside WeChat's native ScrollView layer.
          // Absolutely positioned children can render there while missing taps on device.
          <View className='atuan-later-experience__ending'>
            <Text className='atuan-later-experience__ending-title'>{resolveAtuanLaterActOutcome(progress).ending.title}</Text>
            <View className='atuan-later-experience__complete' hoverClass={disabled ? '' : 'atuan-later-experience__complete--pressed'} role='button' aria-label='收好阿团的这段故事' aria-disabled={disabled} onClick={() => { if (!disabled) { haptics('medium'); onComplete(toAtuanLaterActSubmission(progress)) } }}><Text>{disabled ? '正在收好这段故事…' : '收好阿团的这段故事'}</Text></View>
          </View>
        ) : null}
      </View>
    </View>
  )
}
