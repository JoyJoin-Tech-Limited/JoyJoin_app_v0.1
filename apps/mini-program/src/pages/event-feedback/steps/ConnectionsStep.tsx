import { View, Text, Button, ScrollView } from '@tarojs/components'
import type { EventParticipantSummary } from '@shared/api'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA, getDeepContrastArchetypeColor } from '@shared/archetypeColors'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { haptics } from '../../../lib/utils/haptics'
import ParticipantAvatar from './ParticipantAvatar'

/** Brand-purple fallback for the selected ring when the person has no archetype. */
const SELECTED_RING_FALLBACK = 'rgba(139, 92, 246, 0.5)'

/**
 * ConnectionsStep — presentational render for the event-feedback connections
 * step. Extracted from index.tsx (2026-10-16 Batch C) to keep the page under
 * the harness gate's 1800-line limit. Pure render: every value and callback
 * arrives via props; no hooks live here.
 *
 * All styles live in `../index.scss` — NO .scss side-effect import here
 * (subpackage WXSS chunking trap, see AGENTS.md §15).
 */
export interface ConnectionsStepProps {
  /** renderStepProgress('connections', dotSteps) node from the page. */
  progressDots: React.ReactNode
  participants: EventParticipantSummary[]
  participantsError: boolean
  selectedConnections: string[]
  onToggleConnection: (userId: string) => void
  onRetryParticipants: () => void
  onNext: () => void
}

export default function ConnectionsStep({
  progressDots,
  participants,
  participantsError,
  selectedConnections,
  onToggleConnection,
  onRetryParticipants,
  onNext,
}: ConnectionsStepProps) {
  return (
    <View className='event-feedback'>
      <View className='event-feedback__header'>
        <Text className='event-feedback__title'>想继续了解谁？</Text>
        {progressDots}
      </View>

      <ScrollView className='event-feedback__deep-scroll' scrollY enhanced showScrollbar={false}>
        {/* Batch C item 6: same scroll-inner centering grammar as the wechat
            step — the benefit strip + card group centers when short and
            collapses to top-aligned scroll when the roster overflows. */}
        <View className='event-feedback__scroll-inner'>
          {/* Batch C item 7: the mutual-selection hook moved UP from the old
              card-hint (deduped away) to a contract block under the title —
              same tint family as the wechat privacy block. */}
          <View className='event-feedback__benefit'>
            <JoyJoinIcon
              emoji='🛡️'
              tier='ui'
              size={28}
              className='event-feedback__benefit-icon'
            />
            <Text className='event-feedback__benefit-text'>互相选择后，即可看到对方的微信号</Text>
          </View>

          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>选择想保持联系的人</Text>
            {participantsError ? (
              <View className='event-feedback__participants-error' role='alert' aria-live='polite'>
                <Text className='event-feedback__participants-error-text'>参与者信息加载失败</Text>
                <Button
                  className='event-feedback__participants-retry'
                  onClick={onRetryParticipants}
                  ariaLabel='重试加载参与者'
                >
                  重试
                </Button>
              </View>
            ) : participants.length === 0 ? (
              <Text className='event-feedback__empty-participants'>暂时没有其他参与者信息</Text>
            ) : (
              <View className='event-feedback__participant-grid'>
                {participants.map((p) => {
                  const isSelected = selectedConnections.includes(p.id)
                  const participantName = p.displayName || p.firstName || '匿名'
                  // Same enamel identity tag as the wrap-up rows (#16) — the
                  // person must look identical on both steps or mis-picks happen.
                  const archetypeDef = p.archetype ? resolveArchetype(p.archetype) : null
                  const archetypeHsl = archetypeDef ? getArchetypeHSL(archetypeDef.id) : null
                  // Batch C item 9: memory anchors — the same visibility-gated
                  // meta line + social identity tag the wrap-up rows show.
                  const metaParts = [p.ageLabel, p.gender, p.industryLabel].filter(
                    (part): part is string => typeof part === 'string' && part.length > 0,
                  )
                  return (
                    <View
                      key={p.id}
                      className={`event-feedback__participant-item ${isSelected ? 'event-feedback__participant-item--selected' : ''}`}
                      onClick={() => {
                        haptics('light')
                        onToggleConnection(p.id)
                      }}
                      role='button'
                      aria-pressed={isSelected}
                      aria-label={`选择${participantName}`}
                    >
                      {/* Batch C item 8: selected = archetype-color attended
                          ring (same token logic as the wrap-up attendee rows)
                          + a quiet lift (SCSS, transform-only, RM-gated). */}
                      <View
                        className='event-feedback__participant-ring'
                        style={
                          isSelected
                            ? {
                                borderColor: archetypeHsl
                                  ? formatHSLAsRGBA(archetypeHsl, 0.5)
                                  : SELECTED_RING_FALLBACK,
                              }
                            : undefined
                        }
                      >
                        <ParticipantAvatar participant={p} name={participantName} size={112} large />
                      </View>
                      <Text className='event-feedback__participant-name'>
                        {participantName}
                      </Text>
                      {archetypeDef && archetypeHsl && (
                        <Text
                          className='event-feedback__participant-tag'
                          style={{
                            background: formatHSLAsRGBA(archetypeHsl, 0.1),
                            borderColor: formatHSLAsRGBA(archetypeHsl, 0.22),
                            color: getDeepContrastArchetypeColor(archetypeDef.id),
                          }}
                        >
                          {archetypeDef.nameCn}
                        </Text>
                      )}
                      {metaParts.length > 0 && (
                        <Text className='event-feedback__participant-meta'>{metaParts.join(' · ')}</Text>
                      )}
                      {p.socialTag ? (
                        <Text className='event-feedback__participant-socialtag'>「{p.socialTag}」</Text>
                      ) : null}
                      {isSelected && (
                        <Text className='event-feedback__participant-check'>✓</Text>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View className='event-feedback__footer'>
        {/* Batch C item 8: quiet selection count chip floating above the CTA. */}
        {selectedConnections.length > 0 && (
          <View className='event-feedback__selection-count'>
            <Text className='event-feedback__selection-count-text'>已选 {selectedConnections.length} 位</Text>
          </View>
        )}
        <Button
          className='event-feedback__submit'
          onClick={onNext}
          ariaLabel={selectedConnections.length > 0 ? `已选 ${selectedConnections.length} 人，进入下一步` : '进入下一步'}
        >
          {selectedConnections.length > 0
            ? `已选 ${selectedConnections.length} 人，下一步`
            : '下一步'}
        </Button>
      </View>
    </View>
  )
}
