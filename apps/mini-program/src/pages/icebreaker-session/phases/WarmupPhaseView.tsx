import { View, Text, Image } from '@tarojs/components'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import ArchetypeGlyph from '../../../components/mascot/ArchetypeGlyph'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import type { AtmosphereMood } from '@shared/socialIcebreaker'
import {
  PhaseHeaderIcon,
  getMoodLabel,
  MOOD_OPTIONS,
  type SessionParticipant,
} from '../phaseUtils'

export function WarmupPhaseView({
  topics,
  currentIndex,
  readyUserIds,
  participants,
  currentUserId,
  selectedMood,
  isHost,
  onGenerateTopics,
  onToggleReady,
  onNextTopic,
  onAdvance,
  isGeneratingTopics,
  isUpdatingReady,
  isAdvancingTopic,
  isAdvancing,
}: {
  topics: Array<{ question: string; emoji?: string; mood?: string }>
  currentIndex: number
  readyUserIds: string[]
  participants: SessionParticipant[]
  currentUserId: string
  selectedMood?: AtmosphereMood
  isHost: boolean
  onGenerateTopics: (mood: AtmosphereMood) => void
  onToggleReady: () => void
  onNextTopic: () => void
  onAdvance: () => void
  isGeneratingTopics: boolean
  isUpdatingReady: boolean
  isAdvancingTopic: boolean
  isAdvancing: boolean
}) {
  const currentTopic = topics[currentIndex]
  const isReady = readyUserIds.includes(currentUserId)
  const everyoneReady = participants.length > 0 && readyUserIds.length >= participants.length
  const moodLabel = getMoodLabel(selectedMood)

  return (
    <View className='icebreaker__warmup'>
      {currentTopic ? (
        <Card className='icebreaker__warmup-card'>
          <View className='icebreaker__warmup-emoji'>
            <JoyJoinIcon emoji={currentTopic.emoji ?? ''} size={48} />
          </View>
          <Text className='icebreaker__warmup-question'>
            {currentTopic.question}
          </Text>
          <Text className='icebreaker__warmup-index'>
            {currentIndex + 1} / {topics.length}
          </Text>
          {selectedMood ? (
            <Text className='icebreaker__warmup-mood'>今晚氛围 · {moodLabel}</Text>
          ) : null}
        </Card>
      ) : (
        <Card className='icebreaker__warmup-card'>
          <View className='icebreaker__warmup-emoji'><PhaseHeaderIcon phase="warmup" size={80} /></View>
          <Text className='icebreaker__warmup-question'>
            热身话题准备中…
          </Text>
        </Card>
      )}

      <View className='icebreaker__warmup-status'>
        <Text className='icebreaker__warmup-ready-count'>
          {readyUserIds.length} / {participants.length} 人已准备
        </Text>
        {isReady && (
          <Text className='icebreaker__warmup-ready-badge'>你已准备</Text>
        )}
      </View>

      {participants.length > 0 && (
        <View className='icebreaker__participants'>
          {participants.map((p) => (
            <View
              key={p.userId}
              className={
                'icebreaker__participant' +
                (readyUserIds.includes(p.userId) ? ' icebreaker__participant--ready' : '')
              }
            >
              <Text className='icebreaker__participant-name'>
                {p.displayName ?? '匿名'}
              </Text>
              {p.archetype && (
                <ArchetypeGlyph archetype={p.archetype} size={16} />
              )}
              {p.isHost && (
                <Image
                  src={require('../../assets/icons/status-icons/status-crown.png')}
                  style={{ width: '20rpx', height: '20rpx', marginLeft: '4rpx' }}
                  lazyLoad
                  className='icebreaker__participant-host'
                />
              )}
              {readyUserIds.includes(p.userId) && (
                <Text className='icebreaker__participant-check'>已加入</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View className='icebreaker__action-stack'>
        {!currentTopic ? (
          isHost ? (
            <>
              <View className='icebreaker__mood-grid'>
                {MOOD_OPTIONS.map((option) => (
                  <View
                    key={option.mood}
                    className={
                      'icebreaker__mood-option' +
                      (selectedMood === option.mood ? ' icebreaker__mood-option--active' : '') +
                      (isGeneratingTopics ? ' icebreaker__mood-option--disabled' : '')
                    }
                    onClick={() => {
                      if (!isGeneratingTopics) {
                        onGenerateTopics(option.mood)
                      }
                    }}
                  >
                    <Image
                      src={option.asset}
                      style={{ width: '48rpx', height: '48rpx' }}
                      lazyLoad
                      className='icebreaker__mood-option-emoji'
                    />
                    <Text className='icebreaker__mood-option-label'>{option.label}</Text>
                  </View>
                ))}
              </View>
              <Text className='icebreaker__helper-text'>
                {isGeneratingTopics ? `${DEFAULT_MASCOT_DISPLAY_NAME}正在根据你选的氛围出题…` : `先选一个氛围，${DEFAULT_MASCOT_DISPLAY_NAME}会生成这一轮的热身题目。`}
              </Text>
            </>
          ) : (
            <Text className='icebreaker__helper-text'>
              {selectedMood
                ? `主持人选择了${moodLabel}氛围，正在生成热身话题…`
                : '等待主持人选择今晚的热身氛围…'}
            </Text>
          )
        ) : (
          <>
            <Button
              variant={isReady ? 'secondary' : 'primary'}
              className='icebreaker__action-btn'
              onClick={onToggleReady}
              disabled={isUpdatingReady}
              loading={isUpdatingReady}
            >
              {isUpdatingReady ? '提交中…' : isReady ? '取消准备' : '我准备好了'}
            </Button>

            {isHost && everyoneReady && currentIndex < topics.length - 1 ? (
              <Button
                variant='secondary'
                className='icebreaker__action-btn'
                onClick={onNextTopic}
                disabled={isAdvancingTopic}
                loading={isAdvancingTopic}
              >
                {isAdvancingTopic ? '切换中…' : '切换下一题'}
              </Button>
            ) : null}

            {isHost && everyoneReady && currentIndex >= topics.length - 1 ? (
              <Button
                variant='primary'
                className='icebreaker__action-btn'
                onClick={onAdvance}
                disabled={isAdvancing}
                loading={isAdvancing}
              >
                {isAdvancing ? '切换中…' : '进入下一阶段'}
              </Button>
            ) : null}

            {!isHost && !everyoneReady ? (
              <Text className='icebreaker__helper-text'>大家都准备好后，主持人才可以推进下一步。</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}
