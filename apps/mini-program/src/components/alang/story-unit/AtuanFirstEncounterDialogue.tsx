import { Text, View } from '@tarojs/components'
import { FlashButton } from '../FlashUi'
import type { StoryUnitChoice } from './StoryUnitRuntime'

interface AtuanDialogueOption {
  id: string
  label: string
  reply: string
}

export const ATUAN_OPENING = '……还是少了一张。奇怪，我明明写了六张。'
export const ATUAN_HOOK_REPLY = '好。如果你还认得那盏绿灯，我就告诉你第六张卡写了谁。'

export const ATUAN_OPENING_OPTIONS: readonly AtuanDialogueOption[] = [
  { id: 'ask-object', label: '你在找什么？', reply: '几张准备送出去的观察卡。不是什么贵重东西，只是……写得有点具体。' },
  { id: 'offer-memory', label: '需要我帮你回忆一下吗？', reply: '你居然没有先问我写了什么。最后一次见到它，是在那盏绿灯下面。' },
  { id: 'notice-weight', label: '听起来，那张卡对你很重要。', reply: '对我不重要。对上面写到的那个人，可能很重要。' },
]

const FOLLOW_UP_OPTIONS: readonly AtuanDialogueOption[] = [
  { id: 'return-unread', label: '如果我捡到了，会直接还给你，不打开。', reply: '你很会替别人守门。不是每个人都忍得住不往里面看。' },
  { id: 'forget-glimpse', label: '如果已经看见一点，我会当作没看见。', reply: '看见以后还能闭嘴，比完全没看见更难。' },
  { id: 'check-danger', label: '我会先确认，那个人会不会因此受伤。', reply: '你不是只守规矩。你会先看看，谁可能受伤。' },
]

const HOOK_CHOICE = '下次见面，你得把后半句告诉我。'

export interface AtuanDialogueState {
  followUp: AtuanDialogueOption | null
  hookAccepted: boolean
}

export const EMPTY_ATUAN_DIALOGUE_STATE: AtuanDialogueState = {
  followUp: null,
  hookAccepted: false,
}

export function getAtuanOpeningOption(optionIndex: number): AtuanDialogueOption {
  return ATUAN_OPENING_OPTIONS[optionIndex] ?? ATUAN_OPENING_OPTIONS[0]
}

export function resolveAtuanSpeech(choice: StoryUnitChoice | null, state: AtuanDialogueState): string {
  if (state.hookAccepted) return ATUAN_HOOK_REPLY
  if (state.followUp) return state.followUp.reply
  if (!choice) return ATUAN_OPENING
  const opening = ATUAN_OPENING_OPTIONS.find((option) => option.label === choice.label)
  return opening?.reply ?? ATUAN_OPENING_OPTIONS[0].reply
}

interface AtuanFirstEncounterDialogueProps {
  choice: StoryUnitChoice
  state: AtuanDialogueState
  disabled?: boolean
  onStateChange: (state: AtuanDialogueState) => void
  onComplete: () => void
}

export function AtuanFirstEncounterDialogue({
  choice,
  state,
  disabled = false,
  onStateChange,
  onComplete,
}: AtuanFirstEncounterDialogueProps) {
  return (
    <View className='atuan-first-dialogue' data-testid='atuan-first-dialogue'>
      {!state.followUp ? (
        <>
          <Text className='flash-dialogue__story-panel-prompt'>如果你捡到那张卡，会怎么做？</Text>
          <View className='flash-dialogue__story-choices'>
            {FOLLOW_UP_OPTIONS.map((option) => (
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
        </>
      ) : (
        <>
          <View className='flash-dialogue__user-turn' aria-label={`你说：${state.followUp.label}`}>
            <Text className='flash-dialogue__user-turn-name'>你</Text>
            <Text className='flash-dialogue__user-turn-copy'>{state.followUp.label}</Text>
          </View>
          {!state.hookAccepted ? (
            <View className='flash-dialogue__story-choices'>
              <View
                className='flash-dialogue__choice flash-dialogue__story-choice'
                hoverClass={disabled ? '' : 'flash-dialogue__choice--pressed'}
                onClick={() => { if (!disabled) onStateChange({ ...state, hookAccepted: true }) }}
                role='button'
                aria-label={HOOK_CHOICE}
                aria-disabled={disabled}
              >
                <Text className='flash-dialogue__choice-mark' aria-hidden='true'>·</Text>
                <Text className='flash-dialogue__choice-text'>{HOOK_CHOICE}</Text>
              </View>
            </View>
          ) : (
            <>
              <View className='flash-dialogue__user-turn' aria-label={`你说：${HOOK_CHOICE}`}>
                <Text className='flash-dialogue__user-turn-name'>你</Text>
                <Text className='flash-dialogue__user-turn-copy'>{HOOK_CHOICE}</Text>
              </View>
              <FlashButton disabled={disabled} onClick={onComplete}>
                {disabled ? '正在收下这次见面…' : '先聊到这里'}
              </FlashButton>
            </>
          )}
        </>
      )}
      <View className='sr-only' aria-label={`这次选择从“${choice.label}”开始`} />
    </View>
  )
}
