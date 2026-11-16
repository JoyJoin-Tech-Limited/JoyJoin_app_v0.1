import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useCallback, useRef, useState } from 'react'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { haptics } from '../../lib/utils/haptics'
import {
  COST_ONSITE_MENU_NOTE,
  COST_ROW_ONSITE_HINT,
  COST_SHEET_CURRENT_BUDGET,
  COST_SHEET_EXCLUDED_TITLE,
  COST_SHEET_PHASE_NOTE,
  COST_SHEET_SUBTITLE,
  COST_SHEET_TITLE,
  COST_SHEET_VENUE_NOTE,
} from '@shared/copy/eventCostCopy'

interface IcebreakerInclusionSheetProps {
  visible: boolean
  onClose: () => void
  shouldReduceMotion?: boolean
  /** Read-only display input produced by the page budget formatter. */
  onSiteBudgetLabel?: string | null
  /** Centralised dining/drinks hint; no budget derivation belongs here. */
  onSiteHint?: string
}

// Representative sample of the phase pool. The actual run plan is compiled
// per session by tier/vibe; this list is for user education only.
const PHASES = [
  { name: '话题卡', desc: '轻松开场，快速破冰', tint: 'amber' },
  { name: '人格骰子', desc: '用骰子打开话匣子', tint: 'pink' },
  { name: '机智对决', desc: '气氛升温，接梗互动', tint: 'gold' },
  { name: '谁是卧底', desc: '小游戏里拉近距离', tint: 'blue' },
  { name: '迷你剧本杀', desc: '沉浸式共创小故事', tint: 'primary' },
] as const

const DRAG_THRESHOLD_PX = 100
const DRAG_RESISTANCE = 0.6

export default function IcebreakerInclusionSheet({
  visible,
  onClose,
  shouldReduceMotion = false,
  onSiteBudgetLabel,
  onSiteHint,
}: IcebreakerInclusionSheetProps) {
  const [dragY, setDragY] = useState(0)
  const startYRef = useRef(0)
  const isDraggingRef = useRef(false)
  const scrollTopRef = useRef(0)

  useEffect(() => {
    if (visible && !shouldReduceMotion) {
      haptics('light')
    }
    if (!visible) {
      setDragY(0)
      scrollTopRef.current = 0
    }
  }, [visible, shouldReduceMotion])

  // Close the sheet when the user navigates away via system back / swipe-back.
  useEffect(() => {
    if (!visible) return
    const closeOnRouteChange = (): void => {
      onClose()
    }
    Taro.eventCenter.on('__taroRouterChange', closeOnRouteChange)
    return () => {
      Taro.eventCenter.off('__taroRouterChange', closeOnRouteChange)
    }
  }, [visible, onClose])

  const closeSheet = useCallback(() => {
    if (!shouldReduceMotion) {
      haptics('light')
    }
    onClose()
  }, [onClose, shouldReduceMotion])

  const handleOverlayClick = useCallback(() => {
    closeSheet()
  }, [closeSheet])

  const handleSheetClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }, [])

  const handleCloseClick = useCallback(() => {
    closeSheet()
  }, [closeSheet])

  const handleScroll = useCallback((e: any) => {
    scrollTopRef.current = e.detail?.scrollTop ?? 0
  }, [])

  const handleTouchStart = useCallback((e: any) => {
    startYRef.current = e.touches[0]?.clientY ?? 0
    isDraggingRef.current = scrollTopRef.current <= 0
  }, [])

  const handleTouchMove = useCallback((e: any) => {
    if (!isDraggingRef.current) return
    const currentY = e.touches[0]?.clientY ?? 0
    const deltaY = currentY - startYRef.current
    if (deltaY > 0) {
      setDragY(Math.round(deltaY * DRAG_RESISTANCE))
    }
    e.stopPropagation()
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    if (dragY > DRAG_THRESHOLD_PX) {
      closeSheet()
    } else {
      setDragY(0)
    }
  }, [dragY, closeSheet])

  if (!visible) return null

  const sheetStyle = dragY > 0 && !shouldReduceMotion
    ? { transform: `translateY(${dragY}px)` }
    : undefined

  return (
    <View className='icebreaker-sheet-overlay' onClick={handleOverlayClick}>
      <View
        className='icebreaker-sheet'
        style={sheetStyle}
        onClick={handleSheetClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <View className='icebreaker-sheet__handle' />

        <View className='icebreaker-sheet__header'>
          <View className='icebreaker-sheet__header-left'>
            <Image
              className='icebreaker-sheet__mascot'
              src={getXiaoyueExpressionAsset('paymentTrust')}
              mode='aspectFit'
              aria-hidden='true'
            />
            <Text className='icebreaker-sheet__title'>{COST_SHEET_TITLE}</Text>
          </View>
          <View
            className='icebreaker-sheet__close'
            hoverClass='icebreaker-sheet__close--pressed'
            onClick={handleCloseClick}
            aria-role='button'
            aria-label='关闭'
          >
            <Text className='icebreaker-sheet__close-icon'>×</Text>
          </View>
        </View>

        <Text className='icebreaker-sheet__subtitle'>
          {COST_SHEET_SUBTITLE}
        </Text>

        <ScrollView
          className='icebreaker-sheet__scroll'
          scrollY
          onScroll={handleScroll}
        >
          <View className='icebreaker-sheet__phase-list'>
            {PHASES.map((phase, idx) => (
              <View key={phase.name} className='icebreaker-sheet__phase-item'>
                <View className='icebreaker-sheet__phase-number'>
                  <Text>{idx + 1}</Text>
                </View>
                <View className='icebreaker-sheet__phase-body'>
                  <View className='icebreaker-sheet__phase-name-row'>
                    <View className={`icebreaker-sheet__phase-dot icebreaker-sheet__phase-dot--${phase.tint}`} />
                    <Text className='icebreaker-sheet__phase-name'>{phase.name}</Text>
                  </View>
                  <Text className='icebreaker-sheet__phase-desc'>{phase.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className='icebreaker-sheet__excluded'>
            <Text className='icebreaker-sheet__excluded-title'>{COST_SHEET_EXCLUDED_TITLE}</Text>
            {onSiteBudgetLabel ? (
              <View className='icebreaker-sheet__budget-row'>
                <Text className='icebreaker-sheet__budget-label'>{COST_SHEET_CURRENT_BUDGET}</Text>
                <Text className='icebreaker-sheet__budget-value'>{onSiteBudgetLabel}</Text>
              </View>
            ) : (
              <Text className='icebreaker-sheet__menu-note'>{COST_ONSITE_MENU_NOTE}</Text>
            )}
            <Text className='icebreaker-sheet__excluded-hint'>
              {onSiteHint ?? COST_ROW_ONSITE_HINT}
            </Text>
          </View>

          <View className='icebreaker-sheet__note'>
            <Text className='icebreaker-sheet__note-text'>{COST_SHEET_PHASE_NOTE}</Text>
          </View>
          <View className='icebreaker-sheet__note icebreaker-sheet__note--venue'>
            <Text className='icebreaker-sheet__note-text'>{COST_SHEET_VENUE_NOTE}</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}
