import { ScrollView, Text, View } from '@tarojs/components'
import type { FlashNpcReference } from '../../lib/alang/flashTypes'
import { FlashButton, FlashNpcPortrait } from './FlashUi'

export interface FlashStoryV2StageProps {
  npc: FlashNpcReference
  segments: Array<{ speaker?: string; text: string }>
  choices: Array<{ id: string; text: string }>
  isChoice: boolean
  isTerminal: boolean
  isClosure: boolean
  echo: number
  echoTier: '彻' | '深' | '轻'
  seasonTitle: string
  phase: number
  busy: boolean
  onChoice: (choiceId: string) => void
  onContinue: () => void
}

const ECHO_TIER_COPY: Record<'彻' | '深' | '轻', string> = {
  彻: '这箱旧物，把你今天的追问都记下了。',
  深: '旧物记下了今天的几句追问。',
  轻: '回声很轻，还留在箱子里。',
}

export function FlashStoryV2Stage({
  npc,
  segments,
  choices,
  isChoice,
  isTerminal,
  isClosure,
  echoTier,
  seasonTitle,
  phase,
  busy,
  onChoice,
  onContinue,
}: FlashStoryV2StageProps) {
  return (
    <View className='flash-dialogue__story-stage flash-dialogue__story-stage--v2' data-testid='flash-story-v2-stage'>
      <FlashNpcPortrait npc={npc} size='medium' />
      <View className='flash-dialogue__story-ambient' aria-hidden='true' />
      <View className='flash-dialogue__story-index' aria-label={`第 ${phase} 幕`}>
        <Text className='flash-dialogue__story-index-phase'>第 {phase} 幕</Text>
      </View>
      <View className='flash-dialogue__story-panel flash-dialogue__story-panel--v2' aria-live='polite'>
        <Text className='flash-dialogue__story-panel-season'>{seasonTitle}</Text>
        <ScrollView className='flash-dialogue__story-panel-scroll flash-story-v2__scroll' scrollY>
          <View className='flash-story-v2__segments'>
            {/* Story content contract caps a node at 3 items (validator E111/E110);
                slice guards renderer against overlong content while audit scans. */}
            {segments.slice(0, 3).map((segment, index) => (
              <Text key={index} className={`flash-story-v2__segment${segment.speaker ? ' flash-story-v2__segment--dialogue' : ''}`}>
                {segment.text}
              </Text>
            ))}
          </View>
          {isClosure ? (
            <View className='flash-story-v2__echo' data-testid='flash-story-v2-echo' aria-live='polite'>
              <Text className='flash-story-v2__echo-label'>旧物有了回声</Text>
              <Text className='flash-story-v2__echo-copy'>{ECHO_TIER_COPY[echoTier]}</Text>
            </View>
          ) : null}
          {isChoice ? (
            <View className='flash-dialogue__story-choices flash-story-v2__choices'>
              {choices.slice(0, 3).map((choice) => (
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
          ) : null}
        </ScrollView>
        {!isChoice && !isTerminal ? (
          <View className='flash-story-v2__continue'>
            <FlashButton onClick={onContinue} disabled={busy} ariaLabel='继续听下去'>
              继续听下去
            </FlashButton>
          </View>
        ) : null}
      </View>
    </View>
  )
}
