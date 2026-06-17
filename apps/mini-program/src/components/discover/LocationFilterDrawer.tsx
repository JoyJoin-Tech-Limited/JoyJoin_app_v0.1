import { View, Text, ScrollView, Image } from '@tarojs/components'
import React, { useCallback, useRef, useEffect } from 'react'
import {
  shenzhenClusters,
  heatConfig,
  type DistrictCluster,
  type District,
  type HeatLevel,
} from '@shared/districts'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { haptics } from '../../lib/utils/haptics'
import { localAsset } from '../../lib/utils/cdnAssets'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import './LocationFilterDrawer.scss'

const ALL_CLUSTER_ID = '__all__'
const ALL_DISTRICT_ID = '__all__'

interface LocationFilterDrawerProps {
  open: boolean
  selectedCluster: string
  selectedDistrict: string
  onSelect: (clusterId: string, districtId: string) => void
  onClose: () => void
}

export default function LocationFilterDrawer({
  open,
  selectedCluster,
  selectedDistrict,
  onSelect,
  onClose,
}: LocationFilterDrawerProps) {
  const transitioningRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track drawer open
  useEffect(() => {
    if (open) {
      discoverAnalytics.track('filter_open', undefined, {
        selectedCluster,
        selectedDistrict,
      })
    }
  }, [open, selectedCluster, selectedDistrict])

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

  const handleBackdropTap = useCallback(() => {
    if (transitioningRef.current) return
    haptics('light')
    discoverAnalytics.track('filter_close', undefined, {
      didSelect: false,
      selectedCluster,
      selectedDistrict,
    })
    onClose()
  }, [onClose, selectedCluster, selectedDistrict])

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
  const { shouldReduceMotion: reducedMotion } = useMiniRevealMotion()

  const heatBadgeClass = (heat: HeatLevel): string => {
    switch (heat) {
      case 'hot':
        return 'location-drawer__heat-badge--hot'
      case 'active':
        return 'location-drawer__heat-badge--active'
      case 'pending':
        return 'location-drawer__heat-badge--pending'
      default:
        return ''
    }
  }

  return (
    <View
      className={`location-drawer ${open ? 'location-drawer--open' : ''} ${reducedMotion ? 'location-drawer--reduce-motion' : ''}`}
    >
      {/* Backdrop */}
      <View
        className={`location-drawer__backdrop ${open ? 'location-drawer__backdrop--open' : ''}`}
        onClick={handleBackdropTap}
        catchMove
        role='button'
        aria-label='关闭区域选择'
      />

      {/* Drawer Surface — do not catchMove here: parent catchMove cancels the
          inner ScrollView's native scroll gestures in WeChat. */}
      <View
        className={`location-drawer__surface ${open ? 'location-drawer__surface--open' : ''}`}
        role='dialog'
        aria-modal='true'
        aria-label='偏好区域选择'
      >
        {/* Drag handle */}
        <View className='location-drawer__handle-bar' catchMove />

        {/* Header */}
        <View className='location-drawer__header' catchMove>
          <View className='location-drawer__title-row'>
            <Image
              className='location-drawer__title-mascot'
              src={localAsset('/assets/xiaoyue-expressions/xiaoyue-coach-guide.webp')}
              mode='aspectFit'
              aria-hidden='true'
            />
            <Text className='location-drawer__title'>偏好区域</Text>
          </View>
          <View
            className='location-drawer__close'
            onClick={handleCloseTap}
            hoverClass='location-drawer__close--hover'
            role='button'
            aria-label='关闭区域选择'
          >
            <JoyJoinIcon emoji='✕' size={24} className='location-drawer__close-icon' />
          </View>
        </View>

        {/* Scrollable content — WeChat scroll-y requires a concrete height. */}
        <ScrollView
          className='location-drawer__scroll'
          scrollY
          showScrollbar={false}
        >
          <View className='location-drawer__content'>
            {/* All Regions tile */}
            <View
              className={`location-drawer__all-tile ${isAllSelected ? 'location-drawer__all-tile--active' : ''}`}
              onClick={() => handleSelect(ALL_CLUSTER_ID, ALL_DISTRICT_ID)}
              hoverClass='location-drawer__tile--hover'
              role='button'
              aria-pressed={isAllSelected}
              aria-label='全部区域'
            >
              <JoyJoinIcon className='location-drawer__all-tile-icon' emoji='🌐' size={36} />
              <Text className='location-drawer__all-tile-text'>全部区域</Text>
            </View>

            {/* Cluster sections */}
            {shenzhenClusters.map((cluster: DistrictCluster) => (
              <View key={cluster.id} className='location-drawer__cluster'>
                <View className='location-drawer__cluster-header'>
                  <View className='location-drawer__cluster-dot' />
                  <Text className='location-drawer__cluster-name'>{cluster.displayName}</Text>
                </View>
                <View className='location-drawer__district-grid'>
                  {cluster.districts.map((district: District) => {
                    const isActive =
                      selectedCluster === cluster.id && selectedDistrict === district.id
                    const heatBadgeModifier = heatBadgeClass(district.heat)
                    const heatLabel = heatConfig[district.heat].label

                    return (
                      <View
                        key={district.id}
                        className={`location-drawer__district-tile ${isActive ? 'location-drawer__district-tile--active' : ''} ${district.heat === 'pending' ? 'location-drawer__district-tile--pending' : ''}`}
                        onClick={() => handleSelect(cluster.id, district.id)}
                        hoverClass='location-drawer__tile--hover'
                        role='button'
                        aria-pressed={isActive}
                        aria-label={`${district.name}${heatLabel ? '，' + heatLabel : ''}`}
                      >
                        {isActive ? (
                          <View className='location-drawer__check' aria-hidden='true'>
                            <Text className='location-drawer__check-icon'>✓</Text>
                          </View>
                        ) : (
                          heatLabel && (
                            <View
                              className={`location-drawer__heat-badge ${heatBadgeModifier}`}
                            >
                              <Text>{heatLabel}</Text>
                            </View>
                          )
                        )}
                        <Text className='location-drawer__district-name'>{district.name}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            ))}
          </View>

          {/* Safe area bottom padding */}
          <View className='location-drawer__safe-bottom' />
        </ScrollView>
      </View>
    </View>
  )
}
