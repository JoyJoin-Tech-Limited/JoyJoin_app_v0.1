import { Text, View } from '@tarojs/components'
import type { FlashStoryUnitId } from '@shared/alang/flashStorySeason'

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
