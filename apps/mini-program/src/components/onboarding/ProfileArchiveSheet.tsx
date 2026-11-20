import { View, Text, ScrollView } from '@tarojs/components'
import type { CSSProperties } from 'react'
import InterestChipCloud from '../profile/InterestChipCloud'

export interface ProfileArchiveField {
  label: string
  value: string
}

export interface ProfileArchiveIntent {
  value: string
  label: string
}

export type ProfileArchiveInterestState = 'ready' | 'loading' | 'error' | 'empty'

export interface ProfileArchiveSheetProps {
  visible: boolean
  onClose: () => void
  fields: ProfileArchiveField[]
  intents: ProfileArchiveIntent[]
  interestLabels: string[]
  interestLevels?: Record<string, 1 | 2 | 3>
  interestCategories: string[]
  heatConclusion: string
  storyLine: string
  interestState: ProfileArchiveInterestState
  onRetryInterests?: () => void
  accentSurface?: string
  accentBorder?: string
  accentText?: string
  reduceMotion?: boolean
}

const FIELD_PLACEHOLDER = '资料待补充'
const INTEREST_ERROR_COPY = '兴趣数据暂时不可用'
const INTEREST_EMPTY_COPY = '还没有兴趣标签，之后可以在「我的」补充'
// 仅自己可见 and the share-poster promise answer the same question, so they live
// on one line. The old use-disclosure sentence (where the data goes) is
// deliberately absent: it restated the obvious and pushed the sheet's header
// tall for no reassurance.
const PRIVACY_LINE = '仅自己可见 · 不会出现在分享海报里'

/**
 * ProfileArchiveSheet — the back side of the entry card (入场卡背面).
 *
 * The entry card on profile-review is a keepsake; this sheet is its reverse
 * face: a warm paper archive page that lists the full small profile, the
 * intents typed at registration, and the interest heat map. Read-only by
 * design — there is no footer CTA, only 收起 and the scrim. The privacy line
 * is factual: the share poster strips 小档案 fields before canvas rendering.
 *
 * Always mounted (the parent toggles `visible`): the closed state is hidden by
 * `pointer-events: none` + `aria-hidden` + a fully translated panel, so the
 * page underneath stays usable without unmount churn.
 *
 * Styling note (subpackage trap): no SCSS side-effect import here —
 * `pages/onboarding/profile-review/index.scss` `@use`s ProfileArchiveSheet.scss.
 */
export default function ProfileArchiveSheet({
  visible,
  onClose,
  fields,
  intents,
  interestLabels,
  interestLevels,
  interestCategories,
  heatConclusion,
  storyLine,
  interestState,
  onRetryInterests,
  accentSurface,
  accentBorder,
  accentText,
  reduceMotion = false,
}: ProfileArchiveSheetProps): JSX.Element {
  const hasIntents = intents.length > 0

  // `ready` with nothing to show would render an empty section head; fall back
  // to the honest empty line instead of a heading over blank space.
  const readyHasContent =
    interestLabels.length > 0 ||
    interestCategories.length > 0 ||
    Boolean(heatConclusion) ||
    Boolean(storyLine)

  // Sections are marked by a short accent rule instead of 01/02/03: numbering
  // reads as an ordered checklist with steps left to complete, and this archive
  // has nothing left to do. The entry card's accent ink carries through when
  // the themed poster supplies one.
  const sectionRuleStyle: CSSProperties | undefined = accentText
    ? { backgroundColor: accentText }
    : undefined

  const panelStyle: CSSProperties = {}
  if (accentSurface) {
    // The entry card's accent surface is a gradient, so it lands on
    // background-image: the panel keeps its opaque $color-surface base beneath
    // it and the scrim can never tint the paper through the gradient's
    // translucent far stop.
    panelStyle.backgroundImage = accentSurface
  }
  if (accentBorder) {
    panelStyle.borderTopColor = accentBorder
  }
  const hasPanelStyle = Object.keys(panelStyle).length > 0

  const rootClassName = [
    'profile-archive-sheet',
    visible ? 'profile-archive-sheet--visible' : '',
    reduceMotion ? 'profile-archive-sheet--reduce-motion' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const renderInterestBody = () => {
    if (interestState === 'loading') {
      return (
        <View
          className='profile-archive-sheet__skeleton'
          role='status'
          aria-live='polite'
          aria-busy='true'
          aria-label='兴趣数据加载中'
        >
          <View className='profile-archive-sheet__skeleton-line' aria-hidden='true' />
          <View
            className='profile-archive-sheet__skeleton-line profile-archive-sheet__skeleton-line--short'
            aria-hidden='true'
          />
          <View className='profile-archive-sheet__skeleton-chips' aria-hidden='true'>
            <View className='profile-archive-sheet__skeleton-chip' aria-hidden='true' />
            <View className='profile-archive-sheet__skeleton-chip' aria-hidden='true' />
            <View className='profile-archive-sheet__skeleton-chip' aria-hidden='true' />
          </View>
        </View>
      )
    }

    if (interestState === 'error') {
      return (
        <View className='profile-archive-sheet__state' role='alert'>
          <Text className='profile-archive-sheet__state-text'>{INTEREST_ERROR_COPY}</Text>
          {onRetryInterests ? (
            <View
              className='profile-archive-sheet__retry'
              role='button'
              aria-label='重新加载兴趣数据'
              hoverClass='profile-archive-sheet__retry--pressed'
              onClick={onRetryInterests}
            >
              <Text className='profile-archive-sheet__retry-text'>重新加载</Text>
            </View>
          ) : null}
        </View>
      )
    }

    if (interestState === 'ready' && readyHasContent) {
      return (
        <View className='profile-archive-sheet__heat-map'>
          {heatConclusion ? (
            <Text className='profile-archive-sheet__heat-conclusion'>{heatConclusion}</Text>
          ) : null}

          {interestLabels.length > 0 ? (
            <InterestChipCloud
              labels={interestLabels}
              levels={interestLevels}
              accent
              className='profile-archive-sheet__interest-cloud'
            />
          ) : null}

          {interestCategories.length > 0 ? (
            <InterestChipCloud
              labels={interestCategories}
              className='profile-archive-sheet__category-cloud'
            />
          ) : null}

          {storyLine ? (
            <View className='profile-archive-sheet__story'>
              <View className='profile-archive-sheet__story-dot' aria-hidden='true' />
              <Text className='profile-archive-sheet__story-text'>{storyLine}</Text>
            </View>
          ) : null}
        </View>
      )
    }

    return (
      <View className='profile-archive-sheet__state'>
        <Text className='profile-archive-sheet__state-text'>{INTEREST_EMPTY_COPY}</Text>
      </View>
    )
  }

  return (
    <View className={rootClassName} aria-hidden={visible ? undefined : 'true'} catchMove={visible}>
      <View
        className='profile-archive-sheet__scrim'
        aria-hidden='true'
        onClick={visible ? onClose : undefined}
      />

      <View
        className='profile-archive-sheet__panel'
        role='dialog'
        aria-modal='true'
        aria-label='完整小档案'
        style={hasPanelStyle ? panelStyle : undefined}
      >
        <View className='profile-archive-sheet__header'>
          <View className='profile-archive-sheet__header-row'>
            <View className='profile-archive-sheet__header-main'>
              <Text
                className='profile-archive-sheet__eyebrow'
                style={accentText ? { color: accentText } : undefined}
              >
                入场卡背面
              </Text>
              <Text className='profile-archive-sheet__title'>完整小档案</Text>
              <View className='profile-archive-sheet__privacy'>
                <View className='profile-archive-sheet__privacy-dot' aria-hidden='true' />
                <Text className='profile-archive-sheet__privacy-text'>{PRIVACY_LINE}</Text>
              </View>
            </View>

            <View
              className='profile-archive-sheet__close'
              role='button'
              aria-label='收起完整小档案'
              hoverClass={visible ? 'profile-archive-sheet__close--pressed' : 'none'}
              onClick={visible ? onClose : undefined}
            >
              <Text className='profile-archive-sheet__close-text'>收起</Text>
            </View>
          </View>
        </View>

        <View className='profile-archive-sheet__body-wrap'>
          <ScrollView
            className='profile-archive-sheet__body'
            scrollY
            enhanced
            showScrollbar={false}
          >
            <View className='profile-archive-sheet__body-inner'>
              <View className='profile-archive-sheet__section'>
                <View className='profile-archive-sheet__section-head'>
                  <View
                    className='profile-archive-sheet__section-rule'
                    aria-hidden='true'
                    style={sectionRuleStyle}
                  />
                  <Text className='profile-archive-sheet__section-title'>你的小档案</Text>
                </View>

                {fields.length > 0 ? (
                  <View className='profile-archive-sheet__fields'>
                    {fields.map((field, index) => {
                      // 5 fields in a 2-column grid leave the last one alone on
                      // its own row. An odd tail spans the full width instead of
                      // leaving a hole where a field should be.
                      const isWideTail = fields.length % 2 === 1 && index === fields.length - 1
                      return (
                        <View
                          key={`${field.label}-${index}`}
                          className={
                            isWideTail
                              ? 'profile-archive-sheet__field profile-archive-sheet__field--wide'
                              : 'profile-archive-sheet__field'
                          }
                        >
                          <Text className='profile-archive-sheet__field-label'>{field.label}</Text>
                          <Text className='profile-archive-sheet__field-value'>{field.value}</Text>
                        </View>
                      )
                    })}
                  </View>
                ) : (
                  <Text className='profile-archive-sheet__placeholder'>{FIELD_PLACEHOLDER}</Text>
                )}
              </View>

              {hasIntents ? (
                <View className='profile-archive-sheet__section'>
                  <View className='profile-archive-sheet__section-head'>
                    <View
                      className='profile-archive-sheet__section-rule'
                      aria-hidden='true'
                      style={sectionRuleStyle}
                    />
                    <Text className='profile-archive-sheet__section-title'>来这里想要什么</Text>
                  </View>

                  <View className='profile-archive-sheet__intents'>
                    {intents.map((intent) => (
                      <View key={intent.value} className='profile-archive-sheet__intent'>
                        <Text className='profile-archive-sheet__intent-text'>{intent.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View className='profile-archive-sheet__section'>
                <View className='profile-archive-sheet__section-head'>
                  <View
                    className='profile-archive-sheet__section-rule'
                    aria-hidden='true'
                    style={sectionRuleStyle}
                  />
                  <Text className='profile-archive-sheet__section-title'>兴趣热量地图</Text>
                </View>

                {renderInterestBody()}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  )
}
