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
    opening: '……还是少了一张。奇怪，我明明写了六张。',
    openingOptions: [
      { id: 'ask-object', label: '你在找什么？', reply: '几张准备送出去的观察卡。不是什么贵重东西，只是……写得有点具体。如果你捡到那张卡，会怎么做？' },
      { id: 'offer-memory', label: '需要我帮你回忆一下吗？', reply: '你居然没有先问我写了什么。最后一次见到它，是在那盏绿灯下面。如果是你捡到了，会怎么做？' },
      { id: 'notice-weight', label: '听起来，那张卡对你很重要。', reply: '对我不重要。对上面写到的那个人，可能很重要。所以我想先问你：如果你捡到了，会怎么做？' },
    ],
    followUpOptions: [
      { id: 'return-unread', label: '我会直接还给你，不打开。', reply: '你很会替别人守门。要是第六张真的落到你手里，我会放心一点。' },
      { id: 'forget-glimpse', label: '如果看见了一点，我会当作没看见。', reply: '看见以后还能闭嘴，比完全没看见更难。不过你现在大概也猜到了，那张卡写的是谁。' },
      { id: 'check-danger', label: '我会先确认，那个人会不会因此受伤。', reply: '你会先看谁可能受伤。那你应该明白，我为什么急着找它。' },
    ],
    hookChoice: '所以，第六张卡写了谁？',
    hookReply: '这个问题，今天先不回答。如果下次你还认得那盏绿灯，我就告诉你。',
    closingChoice: '好，下次见。',
  },
  's1-p2-atuan': {
    opening: '你还记得那盏绿灯。来，帮我看一眼这张座位图。我改了很多次，却一直没把它交出去。',
    openingOptions: [
      { id: 'notice-distance', label: '你每一版都在躲开什么？', reply: '太近的声音、突然靠过来的人，还有会让默默不自在的位置。你觉得，这还只是一张普通座位图吗？' },
      { id: 'name-the-person', label: '你其实早就知道要留给谁了，对吗？', reply: '……知道。只是知道该照顾谁，和承认自己为什么这么在意，是两回事。你看出了什么？' },
    ],
    followUpOptions: [
      { id: 'unsent-invitation', label: '它不像建议，更像一份没送出的邀请。', reply: '我画的时候只想着让他舒服一点。画完才发现，我也在给自己留一个靠近他的位置。' },
      { id: 'why-not-send', label: '你照顾得很仔细，为什么一直没交给他？', reply: '因为交出去以后，他就会知道，我想要的不只是替他安排一个舒服的位置。' },
      { id: 'respect-distance', label: '如果他还是想坐远一点呢？', reply: '那就远一点。距离应该由坐在那里的人决定，不该由画图的人偷偷决定。' },
    ],
    hookChoice: '所以你怕的不是位置不对，是他知道你想靠近？',
    hookReply: '……嗯。照顾一个人容易，承认自己想靠近他，难一点。不过这次，我不想再把图藏回去了。',
    closingChoice: '那这次，别再把图收回去了。',
  },
  's1-p3-atuan': {
    opening: '这次我把两个名字都写上了。一个是我，一个是默默。他怎么回答，应该留给他自己。',
    openingOptions: [
      { id: 'state-invitation', label: '你只需要说清邀请，不需要替默默回答。', reply: '对。我能决定的是把图交出去，不能决定他愿意坐多近、坐多久。' },
      { id: 'accept-any-answer', label: '如果他的答案不是你想要的呢？', reply: '那也是答案。我不想让这张图变成一道必须答对的题。你觉得我还漏了什么？' },
    ],
    followUpOptions: [
      { id: 'one-seat-is-enough', label: '告诉他：哪怕只并肩坐一次，也算回应。', reply: '好。一次也好，远一点也好。邀请是我的，边界和答案是他的。' },
      { id: 'say-it-was-for-him', label: '至少让他知道，这张图一直是为他画的。', reply: '这句话我会自己说。绕了这么久，不该再让一张图替我含糊。' },
      { id: 'no-pressure', label: '也告诉他，不接受不会失去你这个朋友。', reply: '嗯。靠近不该拿关系做交换。我想让他先安心，再听见我的邀请。' },
    ],
    hookChoice: '那你现在准备好把图交给他了吗？',
    hookReply: '准备好了。我的意思已经写明白，接下来不替他回答，也不催他回答。',
    closingChoice: '去吧，我在这里等你的后续。',
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
