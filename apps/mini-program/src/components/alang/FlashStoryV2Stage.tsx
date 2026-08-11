import { Text, View } from '@tarojs/components'
import type { FlashNpcReference } from '../../lib/alang/flashTypes'
import { FlashButton, FlashNpcPortrait } from './FlashUi'

export interface FlashStoryV2StageProps {
  npc: FlashNpcReference
  segments: Array<{ speaker?: string; text: string }>
  choices: Array<{ id: string; text: string }>
  isChoice: boolean
  isTerminal: boolean
  seasonTitle: string
  phase: number
  busy: boolean
  onChoice: (choiceId: string) => void
  onContinue: () => void
}

export function FlashStoryV2Stage({
  npc,
  segments,
  choices,
  isChoice,
  isTerminal,
  seasonTitle,
  phase,
  busy,
  onChoice,
  onContinue,
}: FlashStoryV2StageProps) {
  const lastSegment = segments[segments.length - 1]
  return (
    <View className='flash-dialogue__story-stage flash-dialogue__story-stage--v2' data-testid='flash-story-v2-stage'>
      <FlashNpcPortrait npc={npc} size='medium' />
      <View className='flash-dialogue__story-ambient' aria-hidden='true' />
      <View className='flash-dialogue__story-index' aria-label={`第 ${phase} 幕`}>
        <Text className='flash-dialogue__story-index-phase'>第 {phase} 幕</Text>
      </View>
      <View className='flash-dialogue__story-panel flash-dialogue__story-panel--v2' aria-live='polite'>
        <Text className='flash-dialogue__story-panel-season'>{seasonTitle}</Text>
        <View className='flash-story-v2__segments'>
          {segments.map((segment, index) => (
            <Text key={index} className={`flash-story-v2__segment${segment.speaker ? ' flash-story-v2__segment--dialogue' : ''}`}>
              {segment.text}
            </Text>
          ))}
        </View>
        {isChoice ? (
          <View className='flash-dialogue__story-choices flash-story-v2__choices'>
            {choices.map((choice) => (
              <View
                key={choice.id}
                className={`flash-dialogue__choice flash-dialogue__story-choice${busy ? ' flash-dialogue__choice--disabled' : ''}`}
                hoverClass={busy ? '' : 'flash-dialogue__choice--pressed'}
                onClick={() => { if (!busy) onChoice(choice.id) }}
                role='button'
                aria-label={choice.text}
                aria-disabled={busy}
              >
                <Text className='flash-dialogue__choice-mark' aria-hidden='true'>·</Text>
                <Text className='flash-dialogue__choice-text'>{choice.text}</Text>
              </View>
            ))}
          </View>
        ) : (
          !isTerminal && lastSegment ? (
            <FlashButton onClick={onContinue} disabled={busy} ariaLabel='继续听下去'>
              继续听下去
            </FlashButton>
          ) : null
        )}
      </View>
    </View>
  )
}
