import { Text, View } from '@tarojs/components'
import './FirstActDialogueChrome.scss'

export interface FirstActDialogueChoice {
  id: string
  label: string
}

interface FirstActDialogueAction {
  label: string
  onClick: () => void
}

export interface FirstActDialogueChromeProps {
  npcSlug: string
  speaker: string
  speech: string
  narration?: string
  prompt: string
  choices?: readonly FirstActDialogueChoice[]
  selectedChoiceId?: string | null
  action?: FirstActDialogueAction | null
  disabled?: boolean
  onChoose?: (id: string) => void
}

export function FirstActDialogueChrome({
  npcSlug,
  speaker,
  speech,
  narration,
  prompt,
  choices = [],
  selectedChoiceId = null,
  action = null,
  disabled = false,
  onChoose,
}: FirstActDialogueChromeProps) {
  return (
    <>
      <View className='first-act-dialogue-chrome__speech' role='status' aria-live='polite' aria-atomic='true'>
        <Text className='first-act-dialogue-chrome__speaker'>{speaker}</Text>
        <Text className='first-act-dialogue-chrome__speech-copy' data-testid={`${npcSlug}-scene-speech`}>{speech}</Text>
      </View>

      <View className='first-act-dialogue-chrome__panel' data-testid={`${npcSlug}-first-act-dialogue-panel`}>
        {narration ? (
          <View className='first-act-dialogue-chrome__story-copy'>
            <Text className='first-act-dialogue-chrome__narration'>{narration}</Text>
          </View>
        ) : null}
        <Text className='first-act-dialogue-chrome__prompt'>{prompt}</Text>
        {choices.length ? (
          <View className='first-act-dialogue-chrome__choices' aria-label={prompt}>
            {choices.map((choice) => {
              const selected = selectedChoiceId === choice.id
              return (
                <View
                  key={choice.id}
                  className={`first-act-dialogue-chrome__choice${selected ? ' first-act-dialogue-chrome__choice--selected' : ''}`}
                  hoverClass={disabled ? '' : 'first-act-dialogue-chrome__choice--pressed'}
                  role='button'
                  aria-label={choice.label}
                  aria-pressed={selected}
                  aria-disabled={disabled}
                  data-testid={`${npcSlug}-highlight-reply`}
                  onClick={() => {
                    if (!disabled) onChoose?.(choice.id)
                  }}
                >
                  <Text>{choice.label}</Text>
                </View>
              )
            })}
          </View>
        ) : null}
        {action ? (
          <View
            className='first-act-dialogue-chrome__choice first-act-dialogue-chrome__choice--action'
            hoverClass={disabled ? '' : 'first-act-dialogue-chrome__choice--pressed'}
            role='button'
            aria-label={action.label}
            aria-disabled={disabled}
            onClick={() => {
              if (!disabled) action.onClick()
            }}
          >
            <Text>{action.label}</Text>
          </View>
        ) : null}
      </View>
    </>
  )
}
