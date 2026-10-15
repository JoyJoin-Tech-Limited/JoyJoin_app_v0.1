import { View, Text, Image } from '@tarojs/components'
import { useState } from 'react'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { getOracleCardCornerAsset } from '../../components/discover/oracleCardAssets'
import {
  buildEventBriefDate,
  getEventTypeLabel,
  getEventTypePillTone,
  getVibeLabel,
} from './squadUnboxingViewModels'
import type { PoolGroupSummary, PoolGroupSourceSummary } from '@shared/api'

interface SquadUnboxingTonightsPanelProps {
  group: PoolGroupSummary
  pool: PoolGroupSourceSummary
  groupAnalysis: { overallChemistry?: string } | null | undefined
  groupThemeHighlights: string[]
  /** who's-coming 摘要行 (2026-10-14 PRD D15) — e.g. 「6 位同桌 · 25–34 岁 ·
   *  暖意融融的一桌」. Prebuilt by the page, '' renders nothing. */
  whosComingLine: string
  /** 今晚开场钩子 (PRD D16) — first theme tag, e.g. 「今晚的开场，从科技聊起。」
   *  No tag → line omitted. */
  openingHook: string
  /** 主题/亮点/开场钩子 row — 2026-10-15: this row measures 145.6px and the
   *  revealed fan column only offers ~407px against a 402px panel, so it
   *  debuts in the relaxed post-fold column — the same idiom the 2026-08-19
   *  auto-pocket work established for the 「都认识了」 transition line + 桌卡
   *  (shipped post-fold rather than born half-cut). false in the fan phase. */
  showThemeRow: boolean
  dealSettled: boolean
  allCardsUp: boolean
  headerReady: boolean
  onCopyVenue: () => void
}

export default function SquadUnboxingTonightsPanel({
  group,
  pool,
  groupAnalysis,
  groupThemeHighlights,
  whosComingLine,
  openingHook,
  showThemeRow,
  dealSettled,
  allCardsUp,
  headerReady,
  onCopyVenue,
}: SquadUnboxingTonightsPanelProps) {
  const [briefVignetteFailed, setBriefVignetteFailed] = useState(false)
  const briefDate = buildEventBriefDate(group.finalDateTime ?? pool.dateTime)
  const briefVignetteSrc = getOracleCardCornerAsset(pool.eventType ?? undefined)

  return (
    <View
      className={[
        'squad-unboxing__tonights-panel',
        // Post-review fix: --open follows dealSettled (people first,
        // logistics second) — the chapter never renders during the deal.
        dealSettled ? 'squad-unboxing__tonights-panel--open' : '',
      ].filter(Boolean).join(' ')}
      role='region'
      aria-label='今晚这桌详情'
    >
      <View className={[
        'squad-unboxing__chapter',
        'squad-unboxing__chapter--meta',
        // Chemistry-tint foil top border (2026-07-24 P2): the event card
        // inherits the table's chemistry colour so "人" flows into "事".
        `squad-unboxing__chapter--chem-${groupAnalysis?.overallChemistry ?? 'fallback'}`,
        allCardsUp ? 'squad-unboxing__chapter--late' : '',
        headerReady && dealSettled ? 'squad-unboxing__chapter--ready' : '',
      ]
        .filter(Boolean)
        .join(' ')}>
        {/* OracleCard-style corner vignette (2026-10-14 PRD A-group): anchored
            to the chapter's top-right with a negative bleed, clipped by the
            chapter's overflow — previously it hung off the small pill aside,
            reading as a floating sticker crossing the header divider. */}
        {briefVignetteSrc && !briefVignetteFailed ? (
          <Image
            className='squad-unboxing__brief-vignette'
            src={briefVignetteSrc}
            mode='aspectFit'
            lazyLoad
            aria-hidden='true'
            onError={() => setBriefVignetteFailed(true)}
          />
        ) : null}
        {/* Event-brief header: date-led. Big day numeral + month/weekday·time
            on the left; event-type pill on the right. Collapses gracefully —
            with no dateTime the date block drops and the pill stays. */}
        <View className='squad-unboxing__brief-header'>
          <View className='squad-unboxing__brief-header-main'>
            <Text className='squad-unboxing__chapter-title'>今晚这桌</Text>
            {briefDate ? (
              <View className='squad-unboxing__brief-date'>
                <Text className='squad-unboxing__brief-date-day'>{briefDate.day}</Text>
                <View className='squad-unboxing__brief-date-side'>
                  <Text className='squad-unboxing__brief-date-month'>{briefDate.month}</Text>
                  <Text className='squad-unboxing__brief-date-weekday'>
                    {briefDate.weekday} · {briefDate.time}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
          <View className='squad-unboxing__brief-header-aside'>
            <View
              className={`squad-unboxing__brief-type-pill squad-unboxing__brief-type-pill--${getEventTypePillTone(pool.eventType)}`}
            >
              <Text className='squad-unboxing__brief-type-pill-text'>{getEventTypeLabel(pool.eventType)}</Text>
            </View>
          </View>
        </View>

        {/* who's-coming 摘要行 (2026-10-14 PRD D15): 把「人」带回「场合」 —
            count · age band · chemistry word. Fail-closed: the page only
            passes a line when the roster yields one. */}
        {whosComingLine ? (
          <Text className='squad-unboxing__brief-who'>{whosComingLine}</Text>
        ) : null}

        <View className='squad-unboxing__meta-row'>
          <View className='squad-unboxing__meta-label'>
            <JoyJoinIcon emoji='📍' size={24} className='squad-unboxing__meta-icon' />
            <Text>地点</Text>
          </View>
          <View className='squad-unboxing__meta-value-wrap'>
            <View className='squad-unboxing__meta-value-line'>
              <Text className='squad-unboxing__meta-value'>
                {group.venueName || [pool.city, pool.district].filter(Boolean).join(' · ') || '地点待定'}
              </Text>
              {group.venueName ? (
                <View
                  className='squad-unboxing__copy-chip'
                  hoverClass='squad-unboxing__copy-chip--pressed'
                  role='button'
                  aria-label='复制地址'
                  onClick={onCopyVenue}
                >
                  <Text className='squad-unboxing__copy-chip-text'>复制</Text>
                </View>
              ) : null}
            </View>
            <Text className={`squad-unboxing__meta-status ${group.venueName ? 'squad-unboxing__meta-status--assigned' : 'squad-unboxing__meta-status--pending'}`}>
              {group.venueName ? '场地已确定' : '场地待定，悦仔会在确认后提醒你'}
            </Text>
            {group.venueAddress ? (
              <Text className='squad-unboxing__meta-sub'>{group.venueAddress}</Text>
            ) : null}
          </View>
        </View>

        {/* 主题 row (2026-10-14 PRD D16): highlights no longer ride the theme
            triple's gate — a pool with highlights but no theme copy still
            surfaces them. The value line only renders when theme/vibe exist
            (never a fabricated 「今晚的主题」 placeholder).
            2026-10-15: whole row is `showThemeRow`-gated (fan phase hides it)
            — see the prop docstring. */}
        {showThemeRow && (group.theme || group.themeEmoji || group.vibe || groupThemeHighlights.length > 0) ? (
          <View className='squad-unboxing__meta-row squad-unboxing__meta-row--theme'>
            <View className='squad-unboxing__meta-label'>
              {group.themeEmoji ? (
                <JoyJoinIcon emoji={group.themeEmoji} size={24} className='squad-unboxing__meta-icon' />
              ) : (
                <JoyJoinIcon emoji='✨' size={24} className='squad-unboxing__meta-icon' />
              )}
              <Text>主题</Text>
            </View>
            <View className='squad-unboxing__meta-value-wrap'>
              {group.theme || group.vibe ? (
                <Text className='squad-unboxing__meta-value'>
                  {group.theme ?? ''}
                  {group.theme && group.vibe ? ' · ' : ''}
                  {group.vibe ? getVibeLabel(group.vibe) : ''}
                </Text>
              ) : null}
              {group.subtitle ? (
                <Text className='squad-unboxing__meta-sub'>{group.subtitle}</Text>
              ) : null}
              {groupThemeHighlights.length > 0 ? (
                <View className='squad-unboxing__meta-highlights'>
                  {groupThemeHighlights.map((highlight) => (
                    <View key={highlight} className='squad-unboxing__meta-highlight'>
                      <Text className='squad-unboxing__meta-highlight-text'>{highlight}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {/* 今晚开场钩子 (PRD D16): turns the panel from a notice into an
                  invitation — only when a governed theme tag exists. */}
              {openingHook ? (
                <Text className='squad-unboxing__meta-hook'>{openingHook}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}
