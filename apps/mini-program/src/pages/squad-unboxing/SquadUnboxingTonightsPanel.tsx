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
        {/* Event-brief header: date-led. Big day numeral + month/weekday·time
            on the left; event-type pill + the shared OracleCard corner
            vignette (dining/drinks) on the right. Collapses gracefully —
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
          </View>
        </View>

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

        {group.theme || group.themeEmoji || group.vibe ? (
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
              <Text className='squad-unboxing__meta-value'>
                {group.theme || '今晚的主题'}
                {group.vibe ? ` · ${getVibeLabel(group.vibe)}` : ''}
              </Text>
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
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}
