import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react'
import {
  shenzhenClusters,
  getClusterById,
  getClusterIdByDistrictName,
  districtNameToClusterId,
  externalDistrictToClusterId,
  clusterProximityMap,
  type DistrictCluster,
  type District,
} from '@shared/districts'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { haptics } from '../../lib/utils/haptics'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { apiRequest } from '../../lib/api/api'
import { formatNextEventLabel } from '../../lib/utils/discoverCounts'
import PickerShell from './PickerShell'
import SelectableTile from './SelectableTile'
import './LocationFilterDrawer.scss'

const ALL_CLUSTER_ID = '__all__'
const ALL_DISTRICT_ID = '__all__'

interface LocationFilterDrawerProps {
  open: boolean
  selectedCluster: string
  selectedDistrict: string
  /** This-week counts + next-event dates (display semantics). */
  weekCountsByCluster?: Record<string, number>
  weekTotal?: number
  nextEventByCluster?: Record<string, string>
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

interface GeoResult {
  success: boolean
  city?: string
  district?: string
  name?: string
  source: string
  code?: string
  error?: string
}

// Geo is attempted once per app session; failures degrade silently (no tag,
// no hint card — the coverage map stays fully usable without location).
let sessionGeo: { district: string | null } | 'loading' | 'failed' | null = null

export default function LocationFilterDrawer({
  open,
  selectedCluster,
  selectedDistrict,
  weekCountsByCluster,
  weekTotal = 0,
  nextEventByCluster,
  countsReady = false,
  totalPoolCount = null,
  onSelect,
  onClose,
}: LocationFilterDrawerProps) {
  const { shouldReduceMotion: reduceMotion } = useMiniRevealMotion()

  const [rescue, setRescue] = useState<RescueState | null>(null)
  const [pendingExpanded, setPendingExpanded] = useState(false)
  const [geoDistrict, setGeoDistrict] = useState<string | null | undefined>(undefined)
  // Whether any selection happened during this open session — feeds the
  // dismiss funnel event (filter_close) so abandonment stays measurable
  // now that selection no longer auto-closes.
  const didSelectRef = useRef(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset transient dialog/section state whenever the sheet closes so a
  // re-open always starts from the collapsed coverage map. Geo is cached for
  // the whole app session (see module-level sessionGeo).
  useEffect(() => {
    if (!open) {
      setRescue(null)
      setPendingExpanded(false)
      didSelectRef.current = false
    }
  }, [open])

  // One-shot reverse geocode per session (2026-09-30 精细化: 最近 tag +
  // pending-district hint). Fail-open: any error → no tag, no hint.
  // Politeness: never trigger the system permission prompt from a filter
  // drawer — geocode only when scope.userLocation was already granted.
  useEffect(() => {
    let cancelled = false
    if (!open || sessionGeo !== null) {
      if (sessionGeo && sessionGeo !== 'loading' && sessionGeo !== 'failed') {
        setGeoDistrict(sessionGeo.district)
      }
      return
    }
    sessionGeo = 'loading'
    Taro.getSetting()
      .then((setting) => {
        if (setting.authSetting?.['scope.userLocation'] !== true) {
          sessionGeo = 'failed'
          if (!cancelled) setGeoDistrict(null)
          return Promise.reject(new Error('location-not-authorized'))
        }
        return Taro.getLocation({ type: 'gcj02' })
      })
      .then((loc) =>
        apiRequest<GeoResult>({
          path: '/api/geo/reverse-geocode',
          method: 'POST',
          data: { latitude: loc.latitude, longitude: loc.longitude },
          timeout: 6000,
        }),
      )
      .then((res) => {
        sessionGeo = { district: res?.success && res.district ? res.district : null }
        if (!cancelled) setGeoDistrict(sessionGeo.district)
      })
      .catch(() => {
        sessionGeo = 'failed'
        if (!cancelled) setGeoDistrict(null)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [])

  // ── Coverage model ──────────────────────────────────────────────
  const liveClusters = useMemo(
    () => shenzhenClusters.filter((c) => c.districts.some((d) => d.heat !== 'pending')),
    []
  )
  const pendingCluster = useMemo(
    () => shenzhenClusters.find((c) => c.districts.every((d) => d.heat === 'pending')),
    []
  )

  const isAllSelected = selectedCluster === ALL_CLUSTER_ID && selectedDistrict === ALL_DISTRICT_ID

  // Display count (this-week semantics); null while data has not loaded.
  const countFor = useCallback(
    (clusterId: string): number | null => {
      if (!countsReady) return null
      return weekCountsByCluster?.[clusterId] ?? 0
    },
    [countsReady, weekCountsByCluster]
  )

  // Clusters worth showing: unknown-count (loading), >0 this week, or the
  // current selection (so a stale saved pick stays visible + hintable).
  const visibleLiveClusters = useMemo(() => {
    return liveClusters.filter((c) => {
      const count = countFor(c.id)
      return count === null || count > 0 || c.id === selectedCluster
    })
  }, [liveClusters, countFor, selectedCluster])

  const heroTotal =
    countsReady && typeof totalPoolCount === 'number' ? totalPoolCount : null

  // Nearest bookable cluster with at least one event this week.
  const findSuggestedCluster = useCallback(
    (fromClusterId: string | null): string | null => {
      const candidates = liveClusters.filter((c) => (weekCountsByCluster?.[c.id] ?? 0) > 0)
      if (candidates.length === 0) return null
      if (!fromClusterId) return candidates[0].id
      const prox = clusterProximityMap[fromClusterId] ?? {}
      return [...candidates].sort(
        (a, b) => (prox[a.id] ?? 999) - (prox[b.id] ?? 999)
      )[0].id
    },
    [liveClusters, weekCountsByCluster]
  )

  // ── Geo intelligence (最近 tag + pending hint) ──────────────────
  const nearestClusterId = useMemo(() => {
    if (!geoDistrict) return null
    if (!(geoDistrict in districtNameToClusterId)) return null // only live 区 tag 最近
    const clusterId = getClusterIdByDistrictName(geoDistrict)
    if (!clusterId || (weekCountsByCluster?.[clusterId] ?? 0) <= 0) return null
    return clusterId
  }, [geoDistrict, weekCountsByCluster])

  // ── Smart hint card (priority: stale saved pick > geo pending 区) ─
  const smartHint = useMemo(() => {
    if (!countsReady) return null
    // 1. Saved selection went quiet this week → one-tap recovery.
    if (selectedCluster !== ALL_CLUSTER_ID) {
      const count = weekCountsByCluster?.[selectedCluster] ?? 0
      if (count === 0) {
        const cluster = getClusterById(selectedCluster)
        const suggestionClusterId = findSuggestedCluster(selectedCluster)
        if (cluster && suggestionClusterId) {
          const suggestion = getClusterById(suggestionClusterId)
          if (suggestion) {
            return {
              title: `${cluster.displayName}本周暂无场次`,
              body: `${suggestion.displayName}本周有 ${weekCountsByCluster?.[suggestionClusterId] ?? 0} 场可报名`,
              targetClusterId: suggestionClusterId,
            }
          }
        }
      }
    }
    // 2. User sits in a pending district → point at the nearest bookable cluster.
    if (geoDistrict && geoDistrict in externalDistrictToClusterId) {
      const mapped = externalDistrictToClusterId[geoDistrict]
      const suggestionClusterId =
        mapped && (weekCountsByCluster?.[mapped] ?? 0) > 0
          ? mapped
          : findSuggestedCluster(mapped)
      if (suggestionClusterId) {
        const suggestion = getClusterById(suggestionClusterId)
        if (suggestion) {
          return {
            title: `你在${geoDistrict}`,
            body: `离你最近的${suggestion.displayName}本周有 ${weekCountsByCluster?.[suggestionClusterId] ?? 0} 场可报名`,
            targetClusterId: suggestionClusterId,
          }
        }
      }
    }
    return null
  }, [countsReady, selectedCluster, weekCountsByCluster, geoDistrict, findSuggestedCluster])

  const allQuiet = countsReady && weekTotal === 0

  // ── Subtitle (live meta) ────────────────────────────────────────
  const liveWithEvents = useMemo(
    () => liveClusters.filter((c) => (weekCountsByCluster?.[c.id] ?? 0) > 0).length,
    [liveClusters, weekCountsByCluster]
  )
  const subtitle =
    countsReady && weekTotal > 0
      ? `本周 ${weekTotal} 场 · ${liveWithEvents} 个区域`
      : '选一个方便去的区域'

  // ── Selection (selection applies; the sheet stays open — the footer
  //    CTA or ✕/backdrop/drag closes it) ───────────────────────────
  const handleSelect = useCallback(
    (clusterId: string, districtId: string) => {
      haptics('light')
      didSelectRef.current = true
      discoverAnalytics.track('filter_select', undefined, {
        clusterId,
        districtId,
        isAll: clusterId === ALL_CLUSTER_ID && districtId === ALL_DISTRICT_ID,
      })
      onSelect(clusterId, districtId)
    },
    [onSelect]
  )

  // Single funnel exit event for every close path (✕, backdrop, drag, CTA).
  const handleDismiss = useCallback(() => {
    discoverAnalytics.track('filter_close', undefined, {
      didSelect: didSelectRef.current,
      selectedCluster,
      selectedDistrict,
    })
    onClose()
  }, [onClose, selectedCluster, selectedDistrict])

  const handleConfirmView = useCallback(() => {
    haptics('light')
    handleDismiss()
  }, [handleDismiss])

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
        mapped && (weekCountsByCluster?.[mapped] ?? 0) > 0
          ? mapped
          : findSuggestedCluster(mapped)
      setRescue({
        kind: 'pending',
        name: district.name,
        fromId: district.id,
        suggestionClusterId,
      })
    },
    [weekCountsByCluster, findSuggestedCluster]
  )

  const handlePendingToggle = useCallback(() => {
    haptics('light')
    if (!pendingExpanded) {
      discoverAnalytics.track('pending_expand', undefined, undefined)
    }
    setPendingExpanded((prev) => !prev)
  }, [pendingExpanded])

  // Hint CTA / rescue accept: select the suggestion so the check pops on the
  // target tile, give a medium haptic, then let the pop read before closing.
  const acceptSuggestion = useCallback(
    (targetClusterId: string, fromId: string) => {
      haptics('medium')
      didSelectRef.current = true
      discoverAnalytics.track('coverage_adjacent_accept', undefined, {
        from: fromId,
        to: targetClusterId,
      })
      onSelect(targetClusterId, ALL_DISTRICT_ID)
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null
        handleDismiss()
      }, 300)
    },
    [onSelect, handleDismiss]
  )

  const handleRescueAccept = useCallback(() => {
    if (!rescue) return
    const targetClusterId = rescue.suggestionClusterId ?? ALL_CLUSTER_ID
    const fromId = rescue.fromId
    setRescue(null)
    if (targetClusterId === ALL_CLUSTER_ID) {
      // No bookable cluster at all — select 全部区域, no celebratory close.
      handleSelect(ALL_CLUSTER_ID, ALL_DISTRICT_ID)
      return
    }
    acceptSuggestion(targetClusterId, fromId)
  }, [rescue, handleSelect, acceptSuggestion])

  const handleRescueDismiss = useCallback(() => {
    haptics('light')
    setRescue(null)
  }, [])

  // ── Dynamic surface height (#2 简洁) ────────────────────────────
  const sheetHeightRpx = useMemo(() => {
    let h = 96 + 96 + 40 + 16 // handle + header + subtitle + breathing
    h += 96 // hero tile
    if (smartHint) h += 16 + 96
    if (visibleLiveClusters.length === 1) {
      h += 16 + 96
    } else if (visibleLiveClusters.length >= 2) {
      const rows = Math.ceil(visibleLiveClusters.length / 2)
      h += 40 + 48 + rows * 96 + (rows - 1) * 16
    }
    if (pendingCluster) {
      h += 40 + 40 // section gap + toggle row
      if (pendingExpanded) {
        const chipRows = Math.ceil(pendingCluster.districts.length / 2)
        h += 16 + chipRows * 72 + (chipRows - 1) * 16
      }
    }
    if (allQuiet) h += 24 + 40
    if (!isAllSelected) h += 24 + 128 // footer CTA
    h += 24 // safe bottom base
    return Math.min(1100, Math.max(560, Math.ceil(h / 8) * 8))
  }, [smartHint, visibleLiveClusters, pendingCluster, pendingExpanded, allQuiet, isAllSelected])

  // ── Rescue dialog copy ──────────────────────────────────────────
  const suggestionCluster = rescue?.suggestionClusterId
    ? getClusterById(rescue.suggestionClusterId)
    : undefined
  const suggestionCount = rescue?.suggestionClusterId
    ? weekCountsByCluster?.[rescue.suggestionClusterId] ?? 0
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

  // ── Footer CTA label (#13) ──────────────────────────────────────
  const selectedWeekCount =
    selectedCluster !== ALL_CLUSTER_ID ? (weekCountsByCluster?.[selectedCluster] ?? 0) : 0
  const footerLabel = !countsReady
    ? '查看活动'
    : selectedWeekCount > 0
      ? `查看本周 ${selectedWeekCount} 场`
      : '查看活动'

  return (
    <PickerShell
      visible={open}
      onClose={handleDismiss}
      mascotExpression={allQuiet ? 'matchWaiting' : 'coachGuide'}
      title='偏好区域'
      subtitle={subtitle}
      showClose
      reduceMotion={reduceMotion}
      className='location-drawer'
      heightRpx={sheetHeightRpx}
      footer={
        !isAllSelected ? (
          <View
            className='location-drawer__confirm'
            onClick={handleConfirmView}
            hoverClass='location-drawer__confirm--hover'
            role='button'
            aria-label={footerLabel}
          >
            <Text className='location-drawer__confirm-text'>{footerLabel}</Text>
          </View>
        ) : undefined
      }
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
          {/* Smart hint: stale saved pick or pending-district recovery (#7/#10) */}
          {smartHint && (
            <View className='location-drawer__hint location-drawer__reveal location-drawer__reveal--1'>
              <View className='location-drawer__hint-copy'>
                <Text className='location-drawer__hint-title'>{smartHint.title}</Text>
                <Text className='location-drawer__hint-body'>{smartHint.body}</Text>
              </View>
              <View
                className='location-drawer__hint-cta'
                onClick={() =>
                  acceptSuggestion(smartHint.targetClusterId, selectedCluster !== ALL_CLUSTER_ID ? selectedCluster : 'geo')
                }
                hoverClass='location-drawer__hint-cta--hover'
                role='button'
                aria-label={`看看${getClusterById(smartHint.targetClusterId)?.displayName ?? ''}`}
              >
                <Text className='location-drawer__hint-cta-text'>
                  {`看看${getClusterById(smartHint.targetClusterId)?.displayName ?? ''}`}
                </Text>
              </View>
            </View>
          )}

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
                  size={40}
                  className='location-drawer__all-tile-icon'
                />
              }
              ariaLabel='全部区域'
            >
              {!isAllSelected && heroTotal !== null && (
                <Text className='location-drawer__all-count' aria-hidden='true'>
                  {`共 ${heroTotal} 场`}
                </Text>
              )}
            </SelectableTile>
          </View>

          {/* Bookable clusters — this-week live counts; section header only
              when 2+ visible, bare tile when exactly 1 (#1/#5 简洁) */}
          {visibleLiveClusters.length === 1 ? (
            <View className='location-drawer__single'>{renderClusterTile(visibleLiveClusters[0], 0)}</View>
          ) : visibleLiveClusters.length >= 2 ? (
            <View className='location-drawer__section'>
              <View className='location-drawer__section-header'>
                <View className='location-drawer__section-dot' />
                <Text className='location-drawer__section-name'>已开放区域</Text>
              </View>
              <View className='location-drawer__district-grid'>
                {visibleLiveClusters.map((cluster, idx) => renderClusterTile(cluster, idx))}
              </View>
            </View>
          ) : null}

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

          {/* All-quiet whisper (#18 精致) */}
          {allQuiet && (
            <View className='location-drawer__whisper' aria-live='polite'>
              <Text className='location-drawer__whisper-text'>新局正在路上，先看看全部区域吧</Text>
            </View>
          )}
        </View>

        {/* Safe area bottom padding */}
        <View className='location-drawer__safe-bottom' />
      </ScrollView>
    </PickerShell>
  )

  // Cluster tile renderer — declared after hooks (stable identity per render).
  function renderClusterTile(cluster: DistrictCluster, idx: number) {
    const isActive = selectedCluster === cluster.id
    const count = countFor(cluster.id)
    const weekdayLabel =
      count === 1 ? formatNextEventLabel(nextEventByCluster?.[cluster.id]) : null
    const isNearest = nearestClusterId === cluster.id && !isActive

    const ariaLabel =
      count !== null
        ? `${cluster.displayName}，${count > 0 ? `本周 ${count} 场可报名` : '本周暂无场次'}`
        : cluster.displayName

    return (
      <View
        className='location-drawer__reveal-tile'
        style={{ animationDelay: `${60 + idx * 30}ms` }}
        key={cluster.id}
      >
        <SelectableTile
          variant='large'
          label={cluster.displayName}
          selected={isActive}
          onClick={() => handleClusterTap(cluster)}
          ariaLabel={ariaLabel}
        >
          {!isActive && count !== null && (
            <View
              className={`location-drawer__count-pill ${count === 0 ? 'location-drawer__count-pill--muted' : ''}`}
              aria-hidden='true'
            >
              {count > 0 && (
                <View className='location-drawer__count-dot' aria-hidden='true' />
              )}
              {isNearest && (
                <View className='location-drawer__nearest-tag' aria-hidden='true'>
                  <Text className='location-drawer__nearest-tag-text'>最近</Text>
                </View>
              )}
              {count === 0 ? (
                <Text key='zero' className='location-drawer__count-text'>
                  暂无场次
                </Text>
              ) : count === 1 && weekdayLabel ? (
                <View key={`${weekdayLabel}-1`} className='location-drawer__count-text'>
                  <Text className='location-drawer__count-unit'>{weekdayLabel}</Text>
                  <Text className='location-drawer__count-num'>1</Text>
                  <Text className='location-drawer__count-unit'>场</Text>
                </View>
              ) : (
                <View key={count} className='location-drawer__count-text'>
                  <Text className='location-drawer__count-num'>{count}</Text>
                  <Text className='location-drawer__count-unit'>场</Text>
                </View>
              )}
            </View>
          )}
        </SelectableTile>
      </View>
    )
  }
}
