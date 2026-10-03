import { View, Text, ScrollView } from '@tarojs/components'
import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import {
  shenzhenClusters,
  getClusterById,
  externalDistrictToClusterId,
  clusterProximityMap,
  type DistrictCluster,
  type District,
} from '@shared/districts'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { haptics } from '../../lib/utils/haptics'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import PickerShell from './PickerShell'
import SelectableTile from './SelectableTile'
import './LocationFilterDrawer.scss'

const ALL_CLUSTER_ID = '__all__'
const ALL_DISTRICT_ID = '__all__'

interface LocationFilterDrawerProps {
  open: boolean
  selectedCluster: string
  selectedDistrict: string
  countsByCluster?: Record<string, number>
  countsReady?: boolean
  totalPoolCount?: number | null
  onSelect: (clusterId: string, districtId: string) => void
  onClose: () => void
}

interface RescueState {
  kind: 'pending' | 'zero'
  name: string
  fromId: string
  suggestionClusterId: string | null
}

export default function LocationFilterDrawer({
  open,
  selectedCluster,
  selectedDistrict,
  countsByCluster,
  countsReady = false,
  totalPoolCount = null,
  onSelect,
  onClose,
}: LocationFilterDrawerProps) {
  const transitioningRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track drawer open exactly once per open.
  // Do NOT include selectedCluster/selectedDistrict in the dependency array;
  // those values change while the drawer stays open (single-select cluster
  // filter), which would pollute the filter_open funnel.
  useEffect(() => {
    if (open) {
      discoverAnalytics.track('filter_open', undefined, {
        selectedCluster,
        selectedDistrict,
        countsByCluster,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const handleSelect = useCallback(
    (clusterId: string, districtId: string) => {
      if (transitioningRef.current) return
      transitioningRef.current = true
      haptics('light')

      discoverAnalytics.track('filter_select', undefined, {
        clusterId,
        districtId,
        isAll: clusterId === ALL_CLUSTER_ID && districtId === ALL_DISTRICT_ID,
      })

      onSelect(clusterId, districtId)
      // Allow selection feedback to register before closing
      closeTimerRef.current = setTimeout(() => {
        onClose()
        transitioningRef.current = false
        closeTimerRef.current = null
      }, 150)
    },
    [onSelect, onClose]
  )

  const handleCloseTap = useCallback(() => {
    if (transitioningRef.current) return
    haptics('light')
    discoverAnalytics.track('filter_close', undefined, {
      didSelect: false,
      selectedCluster,
      selectedDistrict,
    })
    onClose()
  }, [onClose, selectedCluster, selectedDistrict])

  const isAllSelected = selectedCluster === ALL_CLUSTER_ID && selectedDistrict === ALL_DISTRICT_ID
  const { shouldReduceMotion: reduceMotion } = useMiniRevealMotion()

  const [rescue, setRescue] = useState<RescueState | null>(null)
  const [pendingExpanded, setPendingExpanded] = useState(false)

  // Reset transient dialog/section state whenever the sheet closes so a
  // re-open always starts from the collapsed coverage map.
  useEffect(() => {
    if (!open) {
      setRescue(null)
      setPendingExpanded(false)
    }
  }, [open])

  // Coverage model: clusters with at least one non-pending district are the
  // bookable areas; the all-pending cluster renders as a collapsed section.
  const liveClusters = useMemo(
    () => shenzhenClusters.filter((c) => c.districts.some((d) => d.heat !== 'pending')),
    []
  )
  const pendingCluster = useMemo(
    () => shenzhenClusters.find((c) => c.districts.every((d) => d.heat === 'pending')),
    []
  )

  // Live count per cluster; null while pool data has not loaded successfully
  // (never show a fabricated zero).
  const countFor = useCallback(
    (clusterId: string): number | null => {
      if (!countsReady) return null
      return countsByCluster?.[clusterId] ?? 0
    },
    [countsReady, countsByCluster]
  )

  // Hero caption counts everything the 全部区域 feed would show (including
  // pools whose district maps to no cluster), so caption and feed agree.
  const totalCount = countsReady && typeof totalPoolCount === 'number' ? totalPoolCount : null

  // Nearest bookable cluster with at least one event, by commute proximity.
  const findSuggestedCluster = useCallback(
    (fromClusterId: string | null): string | null => {
      const candidates = liveClusters.filter((c) => (countsByCluster?.[c.id] ?? 0) > 0)
      if (candidates.length === 0) return null
      if (!fromClusterId) return candidates[0].id
      const prox = clusterProximityMap[fromClusterId] ?? {}
      return [...candidates].sort(
        (a, b) => (prox[a.id] ?? 999) - (prox[b.id] ?? 999)
      )[0].id
    },
    [liveClusters, countsByCluster]
  )

  const handleClusterTap = useCallback(
    (cluster: DistrictCluster) => {
      const count = countFor(cluster.id)
      if (count === 0) {
        haptics('light')
        discoverAnalytics.track('coverage_empty_tap', undefined, {
          kind: 'zero',
          clusterId: cluster.id,
        })
        setRescue({
          kind: 'zero',
          name: cluster.displayName,
          fromId: cluster.id,
          suggestionClusterId: findSuggestedCluster(cluster.id),
        })
        return
      }
      handleSelect(cluster.id, ALL_DISTRICT_ID)
    },
    [countFor, findSuggestedCluster, handleSelect]
  )

  const handlePendingChipTap = useCallback(
    (district: District) => {
      haptics('light')
      discoverAnalytics.track('coverage_empty_tap', undefined, {
        kind: 'pending',
        districtId: district.id,
      })
      const mapped = externalDistrictToClusterId[district.name] ?? null
      const suggestionClusterId =
        mapped && (countsByCluster?.[mapped] ?? 0) > 0
          ? mapped
          : findSuggestedCluster(mapped)
      setRescue({
        kind: 'pending',
        name: district.name,
        fromId: district.id,
        suggestionClusterId,
      })
    },
    [countsByCluster, findSuggestedCluster]
  )

  const handlePendingToggle = useCallback(() => {
    haptics('light')
    if (!pendingExpanded) {
      discoverAnalytics.track('pending_expand', undefined, undefined)
    }
    setPendingExpanded((prev) => !prev)
  }, [pendingExpanded])

  const handleRescueAccept = useCallback(() => {
    if (!rescue) return
    const targetClusterId = rescue.suggestionClusterId ?? ALL_CLUSTER_ID
    discoverAnalytics.track('coverage_adjacent_accept', undefined, {
      from: rescue.fromId,
      to: targetClusterId,
      fallback: rescue.suggestionClusterId === null,
    })
    setRescue(null)
    handleSelect(targetClusterId, ALL_DISTRICT_ID)
  }, [rescue, handleSelect])

  const handleRescueDismiss = useCallback(() => {
    haptics('light')
    setRescue(null)
  }, [])

  const suggestionCluster = rescue?.suggestionClusterId
    ? getClusterById(rescue.suggestionClusterId)
    : undefined
  const suggestionCount = rescue?.suggestionClusterId
    ? countsByCluster?.[rescue.suggestionClusterId] ?? 0
    : 0
  const rescueTitle = rescue
    ? rescue.kind === 'pending'
      ? `${rescue.name}还在筹备中`
      : `${rescue.name}本周暂无场次`
    : ''
  const rescueBody = rescue
    ? suggestionCluster
      ? rescue.kind === 'pending'
        ? `离你最近的${suggestionCluster.displayName}本周有 ${suggestionCount} 场可报名`
        : `${suggestionCluster.displayName}本周有 ${suggestionCount} 场可报名`
      : '本周活动还在筹备中，先看看全部区域吧'
    : ''
  const rescueCta = suggestionCluster ? `看看${suggestionCluster.displayName}` : '看看全部区域'

  return (
    <PickerShell
      visible={open}
      onClose={handleCloseTap}
      mascotExpression='coachGuide'
      title='偏好区域'
      subtitle='选一个方便去的区域'
      showClose
      reduceMotion={reduceMotion}
      className='location-drawer'
      overlay={
        rescue ? (
          <View className='location-drawer__rescue'>
            <View
              className='location-drawer__rescue-backdrop'
              onClick={handleRescueDismiss}
              catchMove
            />
            <View className='location-drawer__rescue-card' role='dialog' aria-modal='true'>
              <Text className='location-drawer__rescue-title'>{rescueTitle}</Text>
              <Text className='location-drawer__rescue-body'>{rescueBody}</Text>
              <View className='location-drawer__rescue-actions'>
                <View
                  className='location-drawer__rescue-btn location-drawer__rescue-btn--primary'
                  onClick={handleRescueAccept}
                  hoverClass='location-drawer__rescue-btn--hover'
                  role='button'
                  aria-label={rescueCta}
                >
                  <Text className='location-drawer__rescue-btn-text location-drawer__rescue-btn-text--primary'>
                    {rescueCta}
                  </Text>
                </View>
                <View
                  className='location-drawer__rescue-btn location-drawer__rescue-btn--ghost'
                  onClick={handleRescueDismiss}
                  hoverClass='location-drawer__rescue-btn--hover'
                  role='button'
                  aria-label='知道了'
                >
                  <Text className='location-drawer__rescue-btn-text location-drawer__rescue-btn-text--ghost'>
                    知道了
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : undefined
      }
    >
      {/* key remounts the ScrollView on each open so the entrance stagger
          replays and the scroll offset resets; state lives in this
          component, so nothing user-facing is wiped. */}
      <ScrollView
        key={open ? 'open' : 'closed'}
        className='location-drawer__scroll'
        scrollY
        showScrollbar={false}
        // VirtualList is intentionally not used: the coverage map is ≤ 13 items.
      >
        <View className='location-drawer__content'>
          {/* All Regions hero tile */}
          <View className='location-drawer__reveal location-drawer__reveal--1 location-drawer__hero'>
            <SelectableTile
              variant='compact'
              label='全部区域'
              selected={isAllSelected}
              onClick={() => handleSelect(ALL_CLUSTER_ID, ALL_DISTRICT_ID)}
              icon={
                <JoyJoinIcon
                  emoji='🌐'
                  size={20}
                  className='location-drawer__all-tile-icon'
                />
              }
              ariaLabel='全部区域'
            >
              {!isAllSelected && totalCount !== null && (
                <Text className='location-drawer__all-count' aria-hidden='true'>
                  {`${totalCount} 场可报名`}
                </Text>
              )}
            </SelectableTile>
          </View>

          {/* Bookable clusters with live counts */}
          {liveClusters.length > 0 && (
            <View className='location-drawer__section location-drawer__reveal location-drawer__reveal--2'>
              <View className='location-drawer__section-header'>
                <View className='location-drawer__section-dot' />
                <Text className='location-drawer__section-name'>已开放区域</Text>
              </View>
              <View className='location-drawer__district-grid'>
                {liveClusters.map((cluster: DistrictCluster) => {
                  const isActive = selectedCluster === cluster.id
                  const count = countFor(cluster.id)

                  return (
                    <SelectableTile
                      key={cluster.id}
                      variant='large'
                      label={cluster.displayName}
                      selected={isActive}
                      onClick={() => handleClusterTap(cluster)}
                      ariaLabel={
                        count !== null
                          ? `${cluster.displayName}，${count > 0 ? `${count} 场可报名` : '暂无场次'}`
                          : cluster.displayName
                      }
                    >
                      {!isActive && count !== null && (
                        <View
                          className={`location-drawer__count-pill ${count === 0 ? 'location-drawer__count-pill--muted' : ''}`}
                          aria-hidden='true'
                        >
                          {count > 0 && (
                            <View className='location-drawer__count-dot' aria-hidden='true' />
                          )}
                          <Text>{count > 0 ? `${count} 场可报名` : '暂无场次'}</Text>
                        </View>
                      )}
                    </SelectableTile>
                  )
                })}
              </View>
            </View>
          )}

          {/* Pending districts — collapsed coverage honesty */}
          {pendingCluster && (
            <View className='location-drawer__section location-drawer__reveal location-drawer__reveal--3'>
              <View
                className='location-drawer__pending-toggle'
                onClick={handlePendingToggle}
                hoverClass='location-drawer__pending-toggle--hover'
                role='button'
                aria-expanded={pendingExpanded}
                aria-label={`更多区域，即将开放，${pendingCluster.districts.length} 个区域`}
              >
                <View className='location-drawer__section-header'>
                  <View className='location-drawer__section-dot location-drawer__section-dot--muted' />
                  <Text className='location-drawer__section-name location-drawer__section-name--muted'>
                    更多区域
                  </Text>
                </View>
                <View className='location-drawer__pending-meta'>
                  <Text className='location-drawer__pending-count'>
                    {`即将开放 · ${pendingCluster.districts.length} 个区域`}
                  </Text>
                  <Text
                    className={`location-drawer__pending-chevron ${pendingExpanded ? 'location-drawer__pending-chevron--expanded' : ''}`}
                    aria-hidden='true'
                  >
                    ›
                  </Text>
                </View>
              </View>
              {pendingExpanded && (
                <View className='location-drawer__pending-grid'>
                  {pendingCluster.districts.map((district: District) => (
                    <View
                      key={district.id}
                      className='location-drawer__pending-chip'
                      onClick={() => handlePendingChipTap(district)}
                      hoverClass='location-drawer__pending-chip--hover'
                      role='button'
                      aria-label={`${district.name}，即将开放`}
                    >
                      <Text className='location-drawer__pending-chip-name'>{district.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Safe area bottom padding */}
        <View className='location-drawer__safe-bottom' />
      </ScrollView>
    </PickerShell>
  )
}
