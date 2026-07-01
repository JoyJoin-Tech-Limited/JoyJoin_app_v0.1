import { View } from '@tarojs/components'
import { useCallback, useMemo, useState } from 'react'
import type { PoolPersonaSnapshotResponse } from '@shared/api'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
import { haptics } from '../../../lib/utils/haptics'
import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'
import type { PoolEventType } from '../flowConfig'
import PoolRegistrationHero from './PoolRegistrationHero'
import PersonaSnapshotCard from './PersonaSnapshotCard'
import PersonaSnapshotSheet from './PersonaSnapshotSheet'
import './PoolRegistrationHeroPersonaSection.scss'

interface PoolRegistrationHeroPersonaSectionProps {
  // Hero data
  eventType: PoolEventType
  dateTimeLabel?: string
  area?: string
  price?: number | null
  registrationTotal: number
  sampleArchetypes?: string[]
  // Persona data
  poolId: string
  snapshot?: PoolPersonaSnapshotResponse | null
  isLoadingPersonaSnapshot: boolean
  personaSnapshotError: boolean
  onRetryPersonaSnapshot: () => void
  userArchetype?: string | null
  // Shared
  visible: boolean
  personaSnapshotEnabled: boolean
}

export default function PoolRegistrationHeroPersonaSection({
  eventType,
  dateTimeLabel,
  area,
  price,
  registrationTotal,
  sampleArchetypes,
  poolId,
  snapshot,
  isLoadingPersonaSnapshot,
  personaSnapshotError,
  onRetryPersonaSnapshot,
  userArchetype,
  visible,
  personaSnapshotEnabled,
}: PoolRegistrationHeroPersonaSectionProps) {
  const deviceTier = useDeviceTier()
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])
  const [showSheet, setShowSheet] = useState(false)
  const [sheetInitialDimension, setSheetInitialDimension] = useState<string | undefined>(undefined)

  const cardClasses = [
    'hero-persona-section__card',
    visible ? 'hero-persona-section__card--enter' : 'hero-persona-section__card--hidden',
    deviceTier.isDegradation ? 'hero-persona-section__card--low-end' : '',
  ].join(' ')

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

  return (
    <View className='hero-persona-section'>
      <View
        className={cardClasses}
        onClick={handleCardClick}
        {...(isReadyForSheet
          ? { role: 'button', 'aria-label': '查看已报名伙伴画像' }
          : {})}
      >
        <PoolRegistrationHero
          eventType={eventType}
          dateTimeLabel={dateTimeLabel}
          area={area}
          price={price}
          registrationTotal={registrationTotal}
          sampleArchetypes={sampleArchetypes}
          visible={visible}
          reduceMotion={reduceMotion}
        />

        {personaSnapshotEnabled ? (
          <View className='hero-persona-section__persona-zone'>
            <PersonaSnapshotCard
              poolId={poolId}
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
      </View>

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
