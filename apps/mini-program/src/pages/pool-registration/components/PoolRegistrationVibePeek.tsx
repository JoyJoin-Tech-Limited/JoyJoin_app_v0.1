import { View, Text } from '@tarojs/components'
import { useCallback, useMemo, useState } from 'react'
import type { PoolPersonaSnapshotResponse } from '@shared/api'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { haptics } from '../../../lib/utils/haptics'
import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'
import type { PoolEventType } from '../flowConfig'
import PersonaSnapshotCard from './PersonaSnapshotCard'
import PersonaSnapshotSheet from './PersonaSnapshotSheet'

const MAX_COMPACT_HEADS = 5
const SEAT_HEAD_SIZE = 48

interface PoolRegistrationVibePeekProps {
  poolId: string
  eventType: PoolEventType
  snapshot?: PoolPersonaSnapshotResponse | null
  isLoadingPersonaSnapshot: boolean
  personaSnapshotError: boolean
  onRetryPersonaSnapshot: () => void
  userArchetype?: string | null
  userId?: string | null
  sampleArchetypes?: string[]
  visible: boolean
  reduceMotion: boolean
  personaSnapshotEnabled: boolean
}

/**
 * PoolRegistrationVibePeek — Step 0 三拍化 (registration-ceremony-spec-20260817
 * §1): the seat heads + persona snapshot are data modules, so they live behind
 * a collapsed text-row expander between 悦仔的信 and the duo entry instead of
 * sharing equal billing with the 封面. Data modules get demoted, never equal
 * billing with the story — the letter stays the emotional hero of Step 0.
 */
export default function PoolRegistrationVibePeek({
  poolId,
  eventType,
  snapshot,
  isLoadingPersonaSnapshot,
  personaSnapshotError,
  onRetryPersonaSnapshot,
  userArchetype,
  userId,
  sampleArchetypes,
  visible,
  reduceMotion,
  personaSnapshotEnabled,
}: PoolRegistrationVibePeekProps) {
  const deviceTier = useDeviceTier()
  const [isOpen, setIsOpen] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const [sheetInitialDimension, setSheetInitialDimension] = useState<string | undefined>(undefined)

  const compactHeads = useMemo(() => {
    const archetypes = sampleArchetypes ?? []
    if (!archetypes.length) return []
    const counts = new Map<string, number>()
    for (const a of archetypes) {
      counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key)
    return sorted.slice(0, MAX_COMPACT_HEADS)
  }, [sampleArchetypes])

  const hasOverflow = (sampleArchetypes?.length ?? 0) > MAX_COMPACT_HEADS

  const handleToggle = useCallback(() => {
    haptics('light')
    setIsOpen((prev) => !prev)
  }, [])

  const isReadyForSheet = !!snapshot

  const openSheet = useCallback(
    (dimensionKey?: string) => {
      if (!snapshot) return
      haptics('light')
      setSheetInitialDimension(dimensionKey)
      setShowSheet(true)
    },
    [snapshot],
  )

  const handleCardClick = useCallback(() => {
    if (!isReadyForSheet) return
    discoverAnalytics.track('persona_snapshot_expand_sheet', poolId, {
      stateBand: snapshot.stateBand,
      totalRegistrants: snapshot.totalRegistrants,
    })
    openSheet()
  }, [isReadyForSheet, poolId, snapshot, openSheet])

  const handleDimensionTap = useCallback(
    (key: string) => {
      if (!snapshot) return
      discoverAnalytics.track('persona_snapshot_dimension_tap', poolId, {
        dimension: key,
        stateBand: snapshot.stateBand,
      })
      openSheet(key)
    },
    [snapshot, poolId, openSheet],
  )

  if (!personaSnapshotEnabled) {
    return null
  }

  return (
    <View className='pool-reg-vibe-peek'>
      <View
        className='pool-reg-vibe-peek__toggle'
        onClick={handleToggle}
        hoverClass='pool-reg-vibe-peek__toggle--active'
        role='button'
        aria-label={isOpen ? '收起氛围画像' : '看看这场局的氛围'}
      >
        <Text className='pool-reg-vibe-peek__toggle-text'>
          {isOpen ? '收起氛围画像' : '看看这场局的氛围'}
        </Text>
        <Text
          className={[
            'pool-reg-vibe-peek__toggle-chevron',
            isOpen ? 'pool-reg-vibe-peek__toggle-chevron--open' : '',
          ].join(' ')}
          aria-hidden='true'
        >
          ›
        </Text>
      </View>

      {isOpen ? (
        <View
          className={[
            'pool-reg-vibe-peek__content',
            reduceMotion ? 'pool-reg-vibe-peek__content--reduce-motion' : '',
          ].join(' ')}
          onClick={handleCardClick}
        >
          {compactHeads.length > 0 ? (
            <View className='pool-reg-vibe-peek__seat-heads'>
              {compactHeads.map((key, index) => {
                const tokens = getArchetypeTokens(key)
                return (
                  <View
                    key={key}
                    className='pool-reg-vibe-peek__seat-head'
                    style={{
                      borderColor: tokens.primary,
                      backgroundColor: tokens.background,
                      zIndex: compactHeads.length - index,
                    }}
                  >
                    <ArchetypeHead archetype={key} size={SEAT_HEAD_SIZE} variant='grid' />
                  </View>
                )
              })}
              {hasOverflow ? (
                <View className='pool-reg-vibe-peek__seat-overflow'>
                  <Text className='pool-reg-vibe-peek__seat-overflow-text'>+</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <PersonaSnapshotCard
            poolId={poolId}
            userId={userId}
            snapshot={snapshot}
            isLoading={isLoadingPersonaSnapshot}
            hasError={personaSnapshotError}
            onRetry={onRetryPersonaSnapshot}
            userArchetype={userArchetype}
            visible={visible}
            reduceMotion={reduceMotion}
            isDegradation={deviceTier.isDegradation}
            onDimensionTap={handleDimensionTap}
          />
        </View>
      ) : null}

      {showSheet && snapshot ? (
        <PersonaSnapshotSheet
          snapshot={snapshot}
          eventType={eventType}
          initialDimension={sheetInitialDimension}
          onClose={() => setShowSheet(false)}
        />
      ) : null}
    </View>
  )
}
