import { View, Text, Button, Input, Textarea, ScrollView } from '@tarojs/components'
import type { EventParticipantSummary } from '@shared/api'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA, getDeepContrastArchetypeColor } from '@shared/archetypeColors'
import Chip from '../../../components/ui/Chip'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { haptics } from '../../../lib/utils/haptics'
import {
  ATTENDEE_TRAIT_PRESETS,
  IMPROVEMENT_AREA_PRESETS,
  MAX_IMPROVEMENT_AREAS,
  MAX_TAGS_PER_ATTENDEE,
} from '../feedbackOptions'
import { buildWrapupSummaryParts } from '../feedbackSummary'
import ParticipantAvatar from './ParticipantAvatar'

/** Brand-purple fallback for the attended ring when the attendee has no archetype. */
const ATTENDED_RING_FALLBACK = 'rgba(139, 92, 246, 0.5)'

/**
 * WrapupStep — presentational render for the event-feedback wrap-up step
 * (attendee impressions + improvement areas + free comment). Extracted from
 * index.tsx (2026-10-16 Batch C) to keep the page under the harness gate's
 * 1800-line limit. Pure render: every value and callback arrives via props;
 * no hooks live here.
 *
 * All styles live in `../index.scss` — NO .scss side-effect import here
 * (subpackage WXSS chunking trap, see AGENTS.md §15).
 */
export interface WrapupStepProps {
  /** renderStepProgress('wrapup', dotSteps) node from the page. */
  progressDots: React.ReactNode
  participants: EventParticipantSummary[]
  selectedConnections: string[]
  attendeeTraits: Record<string, { tags: string[]; note: string }>
  onToggleAttendeeTag: (userId: string, tag: string) => void
  onSetAttendeeNote: (userId: string, note: string) => void
  onNoteFocus: (userId: string) => void
  onArchetypeAssetError: (participantId: string) => void
  improvementAreas: string[]
  onToggleImprovementArea: (area: string) => void
  comment: string
  onCommentChange: (value: string) => void
  error: string
  isSubmitting: boolean
  submitted: boolean
  onBack: () => void
  onSubmit: () => void
}

export default function WrapupStep({
  progressDots,
  participants,
  selectedConnections,
  attendeeTraits,
  onToggleAttendeeTag,
  onSetAttendeeNote,
  onNoteFocus,
  onArchetypeAssetError,
  improvementAreas,
  onToggleImprovementArea,
  comment,
  onCommentChange,
  error,
  isSubmitting,
  submitted,
  onBack,
  onSubmit,
}: WrapupStepProps) {
  // Impressions only render for people picked on the connections step (轻量原则).
  const attendees = participants.filter((p) => selectedConnections.includes(p.id))
  const improvementRemaining = MAX_IMPROVEMENT_AREAS - improvementAreas.length
  // Batch C item 14: hint stutter fix — three clean branches (the old
  // 「最多选 3 个，还能选 3 个」 stammered at zero selections).
  const improvementHint =
    improvementAreas.length === 0
      ? `最多选 ${MAX_IMPROVEMENT_AREAS} 个`
      : improvementRemaining > 0
        ? `还能选 ${improvementRemaining} 个`
        : `已经选满 ${MAX_IMPROVEMENT_AREAS} 个，先这样吧`
  // Pre-submit order-summary (#14): proves the form understood the user at
  // the exact commit point. Renders nothing when everything is empty —
  // never shame an empty optional form. Derivation lives in
  // feedbackSummary.ts (pure + unit-tested).
  const summaryParts = buildWrapupSummaryParts({
    attendees,
    attendeeTraits,
    improvementAreas,
    comment,
  })
  return (
    <View className='event-feedback'>
      <View className='event-feedback__header'>
        <Text className='event-feedback__title'>最后，给选中的伙伴留个印象</Text>
        {progressDots}
      </View>

      <ScrollView className='event-feedback__deep-scroll' scrollY enhanced showScrollbar={false}>
        {attendees.length > 0 ? (
          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>参与者印象 · {attendees.length} 位</Text>
            <Text className='event-feedback__card-hint'>
              聊聊你在意的 TA，每人最多选 {MAX_TAGS_PER_ATTENDEE} 个
            </Text>
            {attendees.map((p, index) => {
              const entry = attendeeTraits[p.id] ?? { tags: [], note: '' }
              const name = p.displayName || p.firstName || '匿名'
              const archetypeDef = p.archetype ? resolveArchetype(p.archetype) : null
              const attended = entry.tags.length > 0
              const tagsFull = entry.tags.length >= MAX_TAGS_PER_ATTENDEE
              const archetypeHsl = archetypeDef ? getArchetypeHSL(archetypeDef.id) : null
              // Meta line: visibility-gated age band · gender · industry —
              // the same disclosure tier tablemates already get pre-event on
              // the pool-group detail, so an alias like 「晨曦」 maps back to
              // the actual person met at the table.
              const metaParts = [p.ageLabel, p.gender, p.industryLabel].filter(
                (part): part is string => typeof part === 'string' && part.length > 0,
              )
              return (
                <View
                  key={p.id}
                  className='event-feedback__attendee'
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <View
                    className='event-feedback__attendee-head'
                    aria-label={`${name}${archetypeDef ? `，${archetypeDef.nameCn}` : ''}${metaParts.length > 0 ? `，${metaParts.join('，')}` : ''}`}
                  >
                    <View
                      className='event-feedback__attendee-avatar'
                      style={
                        attended
                          ? {
                              borderColor: archetypeHsl
                                ? formatHSLAsRGBA(archetypeHsl, 0.5)
                                : ATTENDED_RING_FALLBACK,
                            }
                          : undefined
                      }
                    >
                      <ParticipantAvatar
                        participant={p}
                        name={name}
                        size={88}
                        attendee
                        onAssetError={() => onArchetypeAssetError(p.id)}
                      />
                    </View>
                    <View className='event-feedback__attendee-info'>
                      <View className='event-feedback__attendee-name-row'>
                        <Text className='event-feedback__attendee-name'>{name}</Text>
                        {archetypeDef && archetypeHsl && (
                          <Text
                            className='event-feedback__attendee-tag'
                            style={{
                              background: formatHSLAsRGBA(archetypeHsl, 0.1),
                              borderColor: formatHSLAsRGBA(archetypeHsl, 0.22),
                              color: getDeepContrastArchetypeColor(archetypeDef.id),
                            }}
                          >
                            {archetypeDef.nameCn}
                          </Text>
                        )}
                      </View>
                      {metaParts.length > 0 && (
                        <Text className='event-feedback__attendee-meta'>{metaParts.join(' · ')}</Text>
                      )}
                      {p.socialTag ? (
                        <Text className='event-feedback__attendee-socialtag'>「{p.socialTag}」</Text>
                      ) : null}
                    </View>
                  </View>
                  <View className='event-feedback__attendee-tags-caption'>
                    {tagsFull ? (
                      <Text className='event-feedback__attendee-tags-hint event-feedback__attendee-tags-hint--full'>
                        已选满，再点已选标签可取消
                      </Text>
                    ) : (
                      <Text className='event-feedback__attendee-tags-hint'>点标签，说说 TA 给你的感觉</Text>
                    )}
                    <Text
                      className={`event-feedback__attendee-tags-count ${tagsFull ? 'event-feedback__attendee-tags-count--full' : ''}`}
                    >
                      {entry.tags.length}/{MAX_TAGS_PER_ATTENDEE}
                    </Text>
                  </View>
                  <View className='event-feedback__attendee-tags' role='group' aria-label={`给${name}选择印象`}>
                    {ATTENDEE_TRAIT_PRESETS.map((tag) => {
                      const selected = entry.tags.includes(tag)
                      const disabled = !selected && entry.tags.length >= MAX_TAGS_PER_ATTENDEE
                      return (
                        <Chip
                          key={tag}
                          label={tag}
                          selected={selected}
                          compact
                          disabled={disabled}
                          onClick={() => {
                            haptics('light')
                            onToggleAttendeeTag(p.id, tag)
                          }}
                        />
                      )
                    })}
                  </View>
                  <Input
                    className='event-feedback__attendee-note'
                    placeholder={`对${name}的印象补充（选填）`}
                    value={entry.note}
                    onInput={(e) => onSetAttendeeNote(p.id, e.detail.value)}
                    onFocus={() => onNoteFocus(p.id)}
                    maxlength={100}
                    aria-label={`对${name}的印象补充（选填）`}
                  />
                </View>
              )
            })}
          </View>
        ) : null}

        <View className='event-feedback__card'>
          <Text className='event-feedback__card-title'>改进建议</Text>
          <Text className='event-feedback__card-hint'>{improvementHint}</Text>
          {/* Batch C item 14: compact pill flow (same grammar as the attendee
              impression Chips) — full-width recipe rows are retired. */}
          <View className='event-feedback__improve-list'>
            {IMPROVEMENT_AREA_PRESETS.map((area) => {
              const selected = improvementAreas.includes(area)
              const disabled = !selected && improvementAreas.length >= MAX_IMPROVEMENT_AREAS
              return (
                <View
                  key={area}
                  className={`event-feedback__improve-item ${selected ? 'event-feedback__improve-item--selected' : ''} ${disabled ? 'event-feedback__improve-item--disabled' : ''}`}
                  hoverClass={disabled ? undefined : 'event-feedback__improve-item--pressed'}
                  role='checkbox'
                  aria-checked={selected}
                  aria-disabled={disabled || undefined}
                  onClick={disabled ? undefined : () => {
                    haptics('light')
                    onToggleImprovementArea(area)
                  }}
                >
                  <Text className='event-feedback__improve-label'>{area}</Text>
                  {selected ? (
                    <JoyJoinIcon
                      emoji='✅'
                      size={28}
                      className='event-feedback__improve-check-icon'
                    />
                  ) : (
                    <View className='event-feedback__improve-ring' aria-hidden='true' />
                  )}
                </View>
              )
            })}
          </View>
        </View>

        <View className='event-feedback__card'>
          <Text className='event-feedback__card-title'>想说点什么？（可选）</Text>
          <Textarea
            className='event-feedback__textarea'
            placeholder='分享你的感受和建议…'
            value={comment}
            onInput={(e) => onCommentChange(e.detail.value)}
            maxlength={500}
            aria-label='分享你的感受和建议（可选）'
          />
        </View>
      </ScrollView>

      {error ? <View className='event-feedback__error' role='alert' aria-live='polite'><Text>{error}</Text></View> : null}

      <View className='event-feedback__footer'>
        {summaryParts.length > 0 && (
          <Text className='event-feedback__footer-summary'>{summaryParts.join(' · ')}</Text>
        )}
        <View className='event-feedback__footer-row'>
          <Button
            className='event-feedback__submit-ghost'
            onClick={onBack}
            disabled={isSubmitting}
            ariaLabel='返回上一步'
          >
            上一步
          </Button>
          <Button
            className={`event-feedback__submit${submitted ? ' event-feedback__submit--submitted' : ''}`}
            onClick={onSubmit}
            disabled={isSubmitting || submitted}
            ariaLabel='提交反馈'
          >
            {submitted ? '已提交' : '提交反馈'}
          </Button>
        </View>
      </View>
    </View>
  )
}
