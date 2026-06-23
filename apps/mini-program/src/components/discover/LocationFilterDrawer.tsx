import { View, Text, ScrollView } from '@tarojs/components'
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

  // Track drawer open exactly once per open.
  // Do NOT include selectedCluster/selectedDistrict in the dependency array;
  // the area drawer is multi-select/filter-by-cluster and those values change
  // while the drawer stays open, which would pollute the filter_open funnel.
  useEffect(() => {
    if (open) {
      discoverAnalytics.track('filter_open', undefined, {
        selectedCluster,
        selectedDistrict,
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
    <PickerShell
      visible={open}
      onClose={handleCloseTap}
      mascotExpression='coachGuide'
      title='偏好区域'
      showClose
      reduceMotion={reduceMotion}
      className='location-drawer'
    >
      <ScrollView
        className='location-drawer__scroll'
        scrollY
        showScrollbar={false}
        // VirtualList is intentionally not used: Shenzhen districts max 17 items.
      >
        <View className='location-drawer__content'>
          {/* All Regions tile */}
          <SelectableTile
            variant='compact'
            label='全部区域'
            selected={isAllSelected}
            onClick={() => handleSelect(ALL_CLUSTER_ID, ALL_DISTRICT_ID)}
            icon={
              <JoyJoinIcon
                emoji='🌐'
                size={36}
                className='location-drawer__all-tile-icon'
              />
            }
            ariaLabel='全部区域'
          />

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
                    <SelectableTile
                      key={district.id}
                      variant='large'
                      label={district.name}
                      selected={isActive}
                      pending={district.heat === 'pending'}
                      onClick={() => handleSelect(cluster.id, district.id)}
                      ariaLabel={`${district.name}${heatLabel ? '，' + heatLabel : ''}`}
                    >
                      {!isActive && heatLabel && (
                        <View
                          className={`location-drawer__heat-badge ${heatBadgeModifier}`}
                          aria-hidden='true'
                        >
                          <Text>{heatLabel}</Text>
                        </View>
                      )}
                    </SelectableTile>
                  )
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Safe area bottom padding */}
        <View className='location-drawer__safe-bottom' />
      </ScrollView>
    </PickerShell>
  )
}
