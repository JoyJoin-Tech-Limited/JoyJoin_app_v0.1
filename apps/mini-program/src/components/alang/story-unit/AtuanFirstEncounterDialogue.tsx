import { Image, Text, View } from '@tarojs/components'
import type { FlashStoryUnitId } from '@shared/alang/flashStorySeason'
import {
  ATUAN_FIRST_ACT_CARDS,
  ATUAN_FIRST_ACT_FOLLOWUPS,
  ATUAN_FIRST_ACT_HIGHLIGHTS,
  resolveAtuanFirstActOutcome,
  toAtuanFirstActSubmission,
  type AtuanFirstActProgress,
  type AtuanFirstActSubmission,
} from '@shared/alang/atuanFirstAct'
import type { AtuanArrivalAssets } from './AtuanArrivalPrelude'

interface AtuanDialogueOption {
  id: string
  label: string
  reply: string
}

interface AtuanDialogueScript {
  opening: string
  openingOptions: readonly AtuanDialogueOption[]
  followUpOptions: readonly AtuanDialogueOption[]
  hookChoice: string
  hookReply: string
  closingChoice: string
}

const ATUAN_DIALOGUE_SCRIPTS: Partial<Record<FlashStoryUnitId, AtuanDialogueScript>> = {
  's1-p1-atuan': {
    opening: '你好，我叫阿团。不好意思，第一次见面就让你看见我在翻东西。我在找一张没送出去的观察卡——原本有六张，现在只剩五张。',
    openingOptions: [
      { id: 'ask-object', label: '你好，阿团。需要我一起找吗？', reply: '谢谢。卡片正面写的是我在城里看到的小事，背面写了收卡人的名字。丢的那张还写了具体时间，我怕别人捡到后打扰他。' },
      { id: 'offer-memory', label: '你最后一次在哪里见到它？', reply: '就在那盏绿灯下面。我当时忙着整理另外五张，可能把它落在长椅边了。谢谢你没有直接问卡上写了什么。' },
      { id: 'notice-weight', label: '那张卡为什么不能被别人看见？', reply: '因为上面有一个朋友的名字，还有他常去某个地方的时间。这些不是秘密，但也不该由陌生人拿走。' },
    ],
    followUpOptions: [
      { id: 'return-unread', label: '我们先找卡，不翻另外五张的背面。', reply: '好。你愿意帮忙，又不把好奇心放在别人前面。我记住了。' },
      { id: 'forget-glimpse', label: '如果有人捡到，我会请他直接还回来。', reply: '这样最好。找到卡比追问内容重要，卡上的人也不用担心被议论。' },
      { id: 'check-danger', label: '先确认卡上的人不会被打扰。', reply: '对，我最担心的是这个。卡丢了可以再写，但给朋友添麻烦就不好了。' },
    ],
    hookChoice: '卡上写的是你的朋友吗？',
    hookReply: '是。他叫默默，是个不太喜欢被人盯着看的朋友。我本来想用这张卡告诉他：我有认真记住他的习惯。',
    closingChoice: '明白了。我们先把能做的做好。',
  },
  's1-p2-atuan': {
    opening: '又见面了。上次谢谢你，那张卡后来找回来了，也没有人受到打扰。今天我想给你看另一件一直没送出去的东西：一张给默默画的座位图。',
    openingOptions: [
      { id: 'notice-distance', label: '找回来就好。这张图是专门给默默的？', reply: '对。他不喜欢太吵，也不喜欢别人突然靠得很近。我改了好几版，只想给他留一个舒服的位置。' },
      { id: 'name-the-person', label: '你这次为什么愿意给我看？', reply: '因为上次你帮我时没有乱翻卡片。我觉得你会先听我说完，也不会替默默做决定。' },
    ],
    followUpOptions: [
      { id: 'unsent-invitation', label: '你不是在安排座位，是想邀请他和你坐在一起。', reply: '是。我一直说自己只是在照顾他的习惯，其实也在给自己找一个靠近他的机会。' },
      { id: 'why-not-send', label: '既然都画好了，为什么一直没交给他？', reply: '我怕他知道我的意思以后会有压力。所以我反复改图，却一直没把真正想说的话写上去。' },
      { id: 'respect-distance', label: '如果他只愿意坐远一点，也没关系吧？', reply: '当然没关系。图是我的邀请，不是他的座位规定。他觉得舒服才是最重要的。' },
    ],
    hookChoice: '你是想邀请默默坐在你旁边，对吗？',
    hookReply: '对。我想和他并肩坐一会儿，不需要很近，也不需要很久。以前我不敢说，现在我想把这句话写清楚。',
    closingChoice: '那就把你的意思也写在图上。',
  },
  's1-p3-atuan': {
    opening: '你来了。上次分别后，我把那句话写上去了，也在两个位置旁写了我和默默的名字。今天我准备把图交给他。',
    openingOptions: [
      { id: 'state-invitation', label: '这次你已经准备好了吗？', reply: '准备好了。我会亲口告诉他这是邀请，不是安排。他愿不愿意、想坐多远，都由他决定。' },
      { id: 'accept-any-answer', label: '如果默默不接受呢？', reply: '我会有点失落，但不会怪他。朋友不应该因为拒绝一次邀请，就担心失去这段关系。' },
    ],
    followUpOptions: [
      { id: 'one-seat-is-enough', label: '告诉他：哪怕只坐一次，你也会很开心。', reply: '好，我会说。这样他知道我在期待什么，也知道这份期待没有附带条件。' },
      { id: 'say-it-was-for-him', label: '告诉他，这张图从一开始就是为他画的。', reply: '这句话我会自己说。我不想再让一张图替我绕弯子。' },
      { id: 'no-pressure', label: '也告诉他，不接受不会影响你们做朋友。', reply: '嗯，这句很重要。我想让他先安心，再考虑要不要接受我的邀请。' },
    ],
    hookChoice: '那你准备怎么开口？',
    hookReply: '我会说：“默默，这张图是我为我们画的。如果你愿意，我想和你并肩坐一会儿。你不用现在回答。”',
    closingChoice: '很好，就这样告诉他。',
  },
}

export interface AtuanDialogueState {
  followUp: AtuanDialogueOption | null
  hookAccepted: boolean
}

export const EMPTY_ATUAN_DIALOGUE_STATE: AtuanDialogueState = {
  followUp: null,
  hookAccepted: false,
}

function getScript(unitId: FlashStoryUnitId): AtuanDialogueScript {
  return ATUAN_DIALOGUE_SCRIPTS[unitId] ?? ATUAN_DIALOGUE_SCRIPTS['s1-p1-atuan']!
}

export function getAtuanOpeningOption(unitId: FlashStoryUnitId, optionIndex: number): AtuanDialogueOption {
  const options = getScript(unitId).openingOptions
  return options[optionIndex] ?? options[0]
}

export function resolveAtuanSpeech(unitId: FlashStoryUnitId, choiceLabel: string | null, state: AtuanDialogueState): string {
  const script = getScript(unitId)
  if (state.hookAccepted) return script.hookReply
  if (state.followUp) return state.followUp.reply
  if (!choiceLabel) return script.opening
  const opening = script.openingOptions.find((option) => option.label === choiceLabel)
  return opening?.reply ?? script.openingOptions[0].reply
}

interface AtuanStoryDialogueProps {
  unitId: FlashStoryUnitId
  state: AtuanDialogueState
  disabled?: boolean
  onStateChange: (state: AtuanDialogueState) => void
  onComplete: () => void
}

interface AtuanScenePresentation {
  narration: string
  dialogue: string
}

const APPROACH_PRESENTATION: Record<AtuanFirstActProgress['approachId'], AtuanScenePresentation> = {
  notice_wait: {
    narration: '你伸手接住被风掀起的卡片。阿团终于把目光从路口收回来。',
    dialogue: '谢谢。差一点，它又要替我去等人了。',
  },
  notice_again: {
    narration: '你俯身护住纸袋，散开的卡片停在长椅边。',
    dialogue: '谢谢。风今天好像比我更着急。',
  },
}

const FOLLOWUP_PRESENTATION: Record<NonNullable<AtuanFirstActProgress['followupId']>, AtuanScenePresentation> = {
  ask_who: {
    narration: '阿团把目光从路口收了回来。',
    dialogue: '一个答应来拿东西的人。我还没想好，他不来算不算一种回答。',
  },
  offer_help: {
    narration: '阿团第一次笑了一下。',
    dialogue: '几张一直没送出去的卡。本来不想麻烦刚认识的人，但你都走到这里了。',
  },
  move_forward: {
    narration: '阿团望向长椅，把纸袋往中间挪了挪。',
    dialogue: '好。那我们做点只有今天能做的事，别把黄昏全交给一个没出现的人。',
  },
}

const ENDING_PRESENTATION: Record<string, AtuanScenePresentation> = {
  felt_seen: {
    narration: '阿团把座位图往你这边挪了挪。',
    dialogue: '这些卡本来是写给不同人的。我不太想一个人打开。你愿意陪我一起整理吗？',
  },
  helped_first: {
    narration: '阿团把纸袋轻轻放到你们中间。',
    dialogue: '这些卡本来是写给不同人的。我不太想一个人打开。你愿意陪我一起整理吗？',
  },
  shared_the_trip: {
    narration: '阿团往旁边挪了挪，给你留出一个位置。',
    dialogue: '这些卡本来是写给不同人的。既然你来了，我们一起看看它们该去哪里。',
  },
}

export function resolveAtuanFirstActPresentation(
  encounterId: string,
  progress: AtuanFirstActProgress | null,
): AtuanScenePresentation {
  if (!progress) return { narration: '黄昏落在长椅边。阿团还在等你。', dialogue: '你来了。' }
  if (progress.benchReached) {
    const outcome = resolveAtuanFirstActOutcome(encounterId, progress)
    return ENDING_PRESENTATION[outcome.ending.id] ?? APPROACH_PRESENTATION[progress.approachId]
  }
  if (progress.followupId) return FOLLOWUP_PRESENTATION[progress.followupId]
  return APPROACH_PRESENTATION[progress.approachId]
}

export function AtuanFirstConversationScene({ assets }: { assets: AtuanArrivalAssets }) {
  return (
    <View className='atuan-conversation-scene' data-testid='atuan-conversation-scene' aria-hidden='true'>
      <Image className='atuan-conversation-scene__background' src={assets.scene} mode='aspectFill' data-testid='atuan-conversation-background' />
      <View className='atuan-conversation-scene__grade' />
      <Image className='atuan-conversation-scene__character' src={assets.character} mode='aspectFill' data-testid='atuan-conversation-character' />
      <Image className='atuan-conversation-scene__bag' src={assets.bag} mode='aspectFill' />
    </View>
  )
}

interface AtuanFirstEncounterDialogueProps {
  encounterId: string
  progress: AtuanFirstActProgress
  disabled?: boolean
  onStateChange: (state: AtuanFirstActProgress) => void
  onComplete: (submission: AtuanFirstActSubmission) => void
}

export function AtuanStoryDialogue({
  unitId,
  state,
  disabled = false,
  onStateChange,
  onComplete,
}: AtuanStoryDialogueProps) {
  const script = getScript(unitId)
  return (
    <View className='atuan-story-dialogue' data-testid='atuan-story-dialogue'>
      {!state.followUp ? (
        <View className='flash-dialogue__story-choices'>
          {script.followUpOptions.map((option) => (
            <View
              key={option.id}
              className='flash-dialogue__choice flash-dialogue__story-choice'
              hoverClass={disabled ? '' : 'flash-dialogue__choice--pressed'}
              onClick={() => { if (!disabled) onStateChange({ followUp: option, hookAccepted: false }) }}
              role='button'
              aria-label={option.label}
              aria-disabled={disabled}
            >
              <Text className='flash-dialogue__choice-mark' aria-hidden='true'>·</Text>
              <Text className='flash-dialogue__choice-text'>{option.label}</Text>
            </View>
          ))}
        </View>
      ) : !state.hookAccepted ? (
        <View className='flash-dialogue__story-choices'>
          <View
            className='flash-dialogue__choice flash-dialogue__story-choice'
            hoverClass={disabled ? '' : 'flash-dialogue__choice--pressed'}
            onClick={() => { if (!disabled) onStateChange({ ...state, hookAccepted: true }) }}
            role='button'
            aria-label={script.hookChoice}
            aria-disabled={disabled}
          >
            <Text className='flash-dialogue__choice-mark' aria-hidden='true'>·</Text>
            <Text className='flash-dialogue__choice-text'>{script.hookChoice}</Text>
          </View>
        </View>
      ) : (
        <View className='flash-dialogue__story-choices'>
          <View
            className='flash-dialogue__choice flash-dialogue__story-choice'
            hoverClass={disabled ? '' : 'flash-dialogue__choice--pressed'}
            onClick={() => { if (!disabled) onComplete() }}
            role='button'
            aria-label={script.closingChoice}
            aria-disabled={disabled}
          >
            <Text className='flash-dialogue__choice-mark' aria-hidden='true'>·</Text>
            <Text className='flash-dialogue__choice-text'>{disabled ? '正在记住这次见面…' : script.closingChoice}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

export function AtuanFirstEncounterDialogue({
  encounterId,
  progress,
  disabled = false,
  onStateChange,
  onComplete,
}: AtuanFirstEncounterDialogueProps) {
  const presentation = resolveAtuanFirstActPresentation(encounterId, progress)
  const storyCopy = (
    <View className='atuan-first-dialogue__story-copy' role='status' aria-live='polite'>
      <Text className='atuan-first-dialogue__narration' data-testid='atuan-scene-narration'>{presentation.narration}</Text>
      <Text className='atuan-first-dialogue__spoken' data-testid='atuan-scene-dialogue' aria-label={`阿团说：${presentation.dialogue}`}>“{presentation.dialogue}”</Text>
    </View>
  )

  const latestHighlight = progress.highlightOrder.length
    ? ATUAN_FIRST_ACT_HIGHLIGHTS.find((item) => item.id === progress.highlightOrder[progress.highlightOrder.length - 1])
    : null

  if (progress.highlightOrder.length < ATUAN_FIRST_ACT_HIGHLIGHTS.length) {
    return (
      <View className='atuan-first-dialogue' data-testid='atuan-first-dialogue'>
        {storyCopy}
        <View className='atuan-first-dialogue__highlight-story' aria-label='查看纸袋里的细节'>
          <Text>纸袋没有封口。你先后注意到：</Text>
          {ATUAN_FIRST_ACT_HIGHLIGHTS.map((item) => {
            const seen = progress.highlightOrder.includes(item.id)
            return (
              <View
                key={item.id}
                className={`atuan-first-dialogue__inline-highlight${seen ? ' atuan-first-dialogue__inline-highlight--seen' : ''}`}
                onClick={() => {
                  if (!disabled && !seen) onStateChange({ ...progress, highlightOrder: [...progress.highlightOrder, item.id] })
                }}
                role='button'
                aria-label={`查看${item.label}`}
                aria-disabled={disabled || seen}
              ><Text>{item.label}{item.id === 'blank_name' ? '' : '、'}</Text></View>
            )
          })}
          <Text>。阿团没有催你。</Text>
        </View>
        {latestHighlight ? <Text className='atuan-first-dialogue__highlight-reply'>“{latestHighlight.reply}”</Text> : null}
      </View>
    )
  }

  if (!progress.followupId) {
    return (
      <View className='atuan-first-dialogue' data-testid='atuan-first-dialogue'>
        {storyCopy}
        <Text className='atuan-first-dialogue__prompt'>你想先问什么？</Text>
        <View className='flash-dialogue__story-choices' aria-label='你准备怎么回应阿团'>
          {ATUAN_FIRST_ACT_FOLLOWUPS.map((option) => (
            <View
              key={option.id}
              className='flash-dialogue__choice flash-dialogue__story-choice'
              hoverClass={disabled ? '' : 'flash-dialogue__choice--pressed'}
              onClick={() => { if (!disabled) onStateChange({ ...progress, followupId: option.id }) }}
              role='button'
              aria-label={option.label}
              aria-disabled={disabled}
            >
              <Text className='flash-dialogue__choice-mark' aria-hidden='true'>·</Text>
              <Text className='flash-dialogue__choice-text'>{option.label}</Text>
            </View>
          ))}
        </View>
      </View>
    )
  }

  if (!progress.benchReached) {
    const nextCard = ATUAN_FIRST_ACT_CARDS.find((item) => !progress.sortedCardIds.includes(item.id))
    return (
      <View className='atuan-first-dialogue' data-testid='atuan-first-dialogue'>
        {storyCopy}
        <Text className='atuan-first-dialogue__prompt'>和阿团整理三张卡</Text>
        {nextCard ? (
          <View className='atuan-first-dialogue__sorting-game' data-testid='atuan-card-sorting-game'>
            <Text className='atuan-first-dialogue__sorting-card'>{nextCard.label}</Text>
            <View className='flash-dialogue__story-choices'>
              <View className='flash-dialogue__choice' role='button' aria-label={`整理${nextCard.label}`} onClick={() => {
                if (disabled) return
                const sortedCardIds = [...progress.sortedCardIds, nextCard.id]
                onStateChange({ ...progress, sortedCardIds, benchReached: sortedCardIds.length === ATUAN_FIRST_ACT_CARDS.length })
              }}><Text className='flash-dialogue__choice-text'>放到合适的位置</Text></View>
            </View>
          </View>
        ) : null}
      </View>
    )
  }

  const ending = resolveAtuanFirstActOutcome(encounterId, progress).ending
  return (
    <View className='atuan-first-dialogue atuan-first-dialogue--invitation' data-testid='atuan-first-dialogue'>
      {storyCopy}
      <Text className='atuan-first-dialogue__ending'>{ending.title}</Text>
      <View
        className='atuan-first-dialogue__continue'
        hoverClass={disabled ? '' : 'atuan-first-dialogue__continue--pressed'}
        onClick={() => { if (!disabled) onComplete(toAtuanFirstActSubmission(progress)) }}
        role='button'
        aria-label='和阿团一起整理卡片'
        aria-disabled={disabled}
      >
        <Text className='atuan-first-dialogue__continue-text'>和阿团一起整理卡片</Text>
      </View>
    </View>
  )
}
