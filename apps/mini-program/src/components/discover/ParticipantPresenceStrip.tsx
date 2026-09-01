import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import React from 'react'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import type { EventPoolSummary } from '@shared/api'
import ArchetypeHead from '../mascot/ArchetypeHead'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import {
  getPresenceStripCountLabel,
  getPresenceStripAriaLabel,
} from '../../lib/utils/discoverNarrativeCopy'

import './ParticipantPresenceStrip.scss'
import { getSystemReducedMotionCompat } from '../../lib/utils/systemInfo'

// ─── Constants ─────────────────────────────────────────────────

const COIN_SIZE = 40
const MAX_VISIBLE_COINS = 4
const HIGH_FILL_PCT = 75
const MAX_ANIMATION_INDEX = 5
const ANIMATION_STAGGER_MS = 40

export interface ParticipantPresenceStripProps {
  pool: EventPoolSummary
  userArchetype: string | null
  accentColor: string
  index: number
  /**
   * Optional override for the pool's max participant cap.
   * Falls back to `pool.maxParticipants` when not provided.
   */
  maxParticipants?: number
}

type StripState = 'empty' | 'partial' | 'almost_full' | 'full'

// ─── Helpers ───────────────────────────────────────────────────

export function resolveStripState(
  count: number,
  max: number | undefined,
): StripState {
  const hasMax = typeof max === 'number' && max > 0
  if (hasMax && count >= max) {
    return 'full'
  }
  if (count === 0) {
    return 'empty'
  }
  const fillPct = hasMax ? (count / max) * 100 : 0
  const spotsRemaining = hasMax ? Math.max(0, max - count) : Infinity
  if (fillPct >= HIGH_FILL_PCT || spotsRemaining <= 2) {
    return 'almost_full'
  }
  return 'partial'
}

function shouldAnimateEntrance(
  index: number,
  isDegradation: boolean,
  reduceMotion: boolean,
): boolean {
  if (index > MAX_ANIMATION_INDEX) return false
  if (isDegradation) return false
  return !reduceMotion
}

// ─── Component ─────────────────────────────────────────────────

export default React.memo(function ParticipantPresenceStrip({
  pool,
  userArchetype,
  accentColor,
  index,
  maxParticipants: maxParticipantsProp,
}: ParticipantPresenceStripProps) {
  const { isDegradation } = useDeviceTier()

  // Read reduced-motion once on mount — not during render.
  const reduceMotion = React.useMemo(() => {
    try {
      return getSystemReducedMotionCompat()
    } catch {
      return false
    }
  }, [])

  const count = pool.currentParticipants ?? pool.registrationCount ?? 0
  const max = maxParticipantsProp ?? pool.maxParticipants
  const state = resolveStripState(count, max)

  const sampleArchetypes = React.useMemo(() => {
    const raw = pool.sampleArchetypes ?? []
    // Defensive: filter out non-string entries without mutating original.
    return raw.filter((a): a is string => typeof a === 'string')
  }, [pool.sampleArchetypes])

  const totalPresence = pool.currentParticipants ?? pool.registrationCount ?? sampleArchetypes.length
  const visibleArchetypes = state === 'empty' ? [] : sampleArchetypes.slice(0, MAX_VISIBLE_COINS)
  const overflowCount = Math.max(0, totalPresence - visibleArchetypes.length)
  const hasCoins = visibleArchetypes.length > 0
  const isFull = state === 'full'

  // When people are present but the backend sent no sample archetypes,
  // fall back to the user's own archetype (if known) so the strip never looks
  // empty while the count claims otherwise.
  const fallbackArchetype = userArchetype && !hasCoins && count > 0 ? userArchetype : null
  const coinsToRender = state === 'empty'
    ? []
    : hasCoins
      ? visibleArchetypes
      : fallbackArchetype
        ? [fallbackArchetype]
        : []

  const countLabel = getPresenceStripCountLabel({ state, count, max })
  const ariaLabel = getPresenceStripAriaLabel({
    state,
    count,
    max,
    hasUserArchetype: !!userArchetype,
  })

  // Fire analytics once per card impression, batched to avoid request spam.
  const hasTrackedRef = React.useRef(false)
  React.useEffect(() => {
    if (hasTrackedRef.current) return
    hasTrackedRef.current = true
    const fillPct = max && max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0
    discoverAnalytics.trackPresenceStripImpression(pool.id, {
      state,
      fill_pct: fillPct,
      position_index: index,
      card_version: 'oracle_v1',
    })
  }, [pool.id, state, count, max, index])

  const animateEntrance = shouldAnimateEntrance(index, isDegradation, reduceMotion)
  const animatePulse = !isDegradation && !reduceMotion

  return (
    <View
      className={`participant-presence-strip participant-presence-strip--${state}`}
      role='status'
      aria-label={ariaLabel}
    >
      <View className='participant-presence-strip__coins' aria-hidden='true'>
        {state === 'empty' ? (
          <View
            className={`participant-presence-strip__empty-ring${animatePulse ? ' participant-presence-strip__empty-ring--animated' : ''}`}
            style={{ borderColor: accentColor }}
          >
            <View
              className='participant-presence-strip__empty-ring-glyph'
              style={{ backgroundColor: accentColor }}
            />
          </View>
        ) : (
          <>
            {coinsToRender.length === 0 ? (
              <View
                className={`participant-presence-strip__empty-coin${animateEntrance ? ' participant-presence-strip__empty-coin--animated' : ''}`}
              />
            ) : (
              coinsToRender.map((archetype, i) => {
                const isUser = archetype === userArchetype
                const token = getArchetypeTokens(archetype)
                const borderColor = isUser ? accentColor : token.primary

                return (
                  <View
                    key={`${pool.id}-${archetype}-${i}`}
                    className={`participant-presence-strip__coin${isUser ? ' participant-presence-strip__coin--user' : ''}${animateEntrance ? ' participant-presence-strip__coin--animated' : ''}`}
                    style={{
                      borderColor,
                      animationDelay: animateEntrance ? `${i * ANIMATION_STAGGER_MS}ms` : undefined,
                    }}
                  >
                    <ArchetypeHead
                      archetype={archetype}
                      size={COIN_SIZE}
                      variant='head'
                      fallback='initial'
                      fallbackText={archetype.charAt(0).toUpperCase()}
                    />
                  </View>
                )
              })
            )}

            {overflowCount > 0 && !isFull && (
              <View
                className={`participant-presence-strip__overflow${animateEntrance ? ' participant-presence-strip__overflow--animated' : ''}`}
                style={{ animationDelay: animateEntrance ? `${visibleArchetypes.length * ANIMATION_STAGGER_MS}ms` : undefined }}
              >
                <Text className='participant-presence-strip__overflow-text'>+{overflowCount}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {state === 'empty' ? (
        <View
          className='participant-presence-strip__count-pill participant-presence-strip__count-pill--empty'
          style={{
            color: accentColor,
            backgroundColor: `${accentColor}1A`,
          }}
          aria-hidden='true'
        >
          <Text className='participant-presence-strip__count participant-presence-strip__count--empty'>
            {countLabel}
          </Text>
        </View>
      ) : (
        <Text
          className={`participant-presence-strip__count${state === 'almost_full' ? ' participant-presence-strip__count--urgent' : ''}`}
          style={state === 'almost_full' ? { color: accentColor } : undefined}
          aria-hidden='true'
        >
          {countLabel}
        </Text>
      )}

      {isFull && (
        <View className='participant-presence-strip__full-badge'>
          <Text className='participant-presence-strip__full-badge-text'>已满员</Text>
        </View>
      )}
    </View>
  )
})
