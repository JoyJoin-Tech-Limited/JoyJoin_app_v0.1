import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MatchCompassGenderComposition,
  MatchCompassResponse,
  MatchCompassTemperatureBand,
  UpdateMatchCompassPreferencesRequest,
} from '@shared/api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'

const COMPASS_PRELOAD_EXPRESSIONS: Array<'compassScan' | 'compassInsight' | 'compassCelebrate'> = [
  'compassScan',
  'compassInsight',
  'compassCelebrate',
]

// ── Constants ─────────────────────────────────────────────────────

const DEFAULT_DISTRICTS = ['南山区', '福田区', '罗湖区', '宝安区', '龙岗区', '龙华区']

const TEMPERATURE_LABEL_MAP: Record<MatchCompassTemperatureBand, string> = {
  cold: '偏冷',
  mild: '温和',
  warm: '稳健',
  fire: '炽热',
}

const STRICTNESS_CHIP_META: {
  value: number
  label: string
  expression: 'compassScan' | 'compassInsight' | 'compassCelebrate'
}[] = [
  { value: 100, label: '优先契合', expression: 'compassScan' },
  { value: 50, label: '平衡体验', expression: 'compassInsight' },
  { value: 0, label: '探索惊喜', expression: 'compassCelebrate' },
]

const GENDER_COMPOSITION_OPTIONS: { value: MatchCompassGenderComposition; label: string }[] = [
  { value: 'mixed', label: '男女混合' },
  { value: 'female_only', label: '女生局' },
  { value: 'no_pref', label: '不限' },
]

const AGE_RANGE_OPTIONS = ['同龄优先', '上下3岁', '上下5岁', '不限']
const TABLE_VIBE_OPTIONS = ['轻松聊天', '深度交流', '游戏互动', '不限']

// ── Helpers ───────────────────────────────────────────────────────

function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )
}

// ── Strictness Chips ──────────────────────────────────────────────

interface StrictnessChipsProps {
  value: number
  onChange: (value: number) => void
  shouldReduceMotion: boolean
}

function StrictnessChips({ value, onChange, shouldReduceMotion }: StrictnessChipsProps) {
  const handleSelect = useCallback(
    (chipValue: number) => {
      // Q1-2: the optimistic-apply haptic in useMatchingStatusController is
      // the single save feedback (fires same tick as the chip save applies);
      // no chip-local haptic here to avoid doubling.
      onChange(chipValue)
    },
    [onChange]
  )

  const debouncedSelect = useDebouncedCallback(handleSelect, 250)

  return (
    <View className='match-compass__chips-row'>
      {STRICTNESS_CHIP_META.map((chip) => {
        const isActive = value === chip.value
        return (
          <View
            key={chip.value}
            className={[
              'match-compass__chip',
              isActive ? 'match-compass__chip--active' : '',
            ].join(' ')}
            onClick={() => debouncedSelect(chip.value)}
            aria-role='button'
            aria-pressed={isActive}
          >
            <Image
              className='match-compass__chip-mascot'
              src={getXiaoyueExpressionAsset(chip.expression)}
              mode='aspectFit'
              lazyLoad={false}
              style={{ opacity: isActive || shouldReduceMotion ? 1 : 0.6 }}
            />
            <Text className='match-compass__chip-label'>{chip.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

// ── Confidence Gauge ──────────────────────────────────────────────

interface ConfidenceGaugeProps {
  temperatureScore: number
  temperatureBand: MatchCompassTemperatureBand
  shouldReduceMotion: boolean
}

function ConfidenceGauge({ temperatureScore, temperatureBand, shouldReduceMotion }: ConfidenceGaugeProps) {
  const circumference = 2 * Math.PI * 36 // r=36
  const progress = Math.min(Math.max(temperatureScore / 100, 0), 1)
  const dashOffset = circumference * (1 - progress)

  return (
    <View className='match-compass__gauge'>
      <svg
        className='match-compass__gauge-svg'
        viewBox='0 0 84 84'
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          className='match-compass__gauge-track'
          cx='42'
          cy='42'
          r='36'
          fill='none'
          strokeWidth='6'
        />
        <circle
          className={`match-compass__gauge-fill match-compass__gauge-fill--${temperatureBand}`}
          cx='42'
          cy='42'
          r='36'
          fill='none'
          strokeWidth='6'
          strokeLinecap='round'
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: shouldReduceMotion ? 'none' : 'stroke-dashoffset 0.2s ease-out',
          }}
        />
      </svg>
      <View className='match-compass__gauge-center'>
        <Text className='match-compass__gauge-band'>
          {TEMPERATURE_LABEL_MAP[temperatureBand]}
        </Text>
      </View>
    </View>
  )
}

// ── Temperature Strip ─────────────────────────────────────────────

interface TemperatureStripProps {
  band: MatchCompassTemperatureBand
  eligibleUserCount: number
}

interface TemperatureStripProps {
  band: MatchCompassTemperatureBand
  eligibleUserCount: number
  viewerArchetype?: string | null
}

function TemperatureStrip({ band, eligibleUserCount, viewerArchetype }: TemperatureStripProps) {
  return (
    <View className='match-compass__temp-strip'>
      <ArchetypeHead archetype={viewerArchetype ?? 'corgi'} size={20} className='match-compass__temp-strip-icon' variant='head' />
      <View className={`match-compass__temp-pill match-compass__temp-pill--${band}`}>
        <Text className='match-compass__temp-label'>{TEMPERATURE_LABEL_MAP[band]}</Text>
      </View>
      <Text className='match-compass__temp-count'>
        {eligibleUserCount > 0 ? `${eligibleUserCount} 位契合好友` : '正在为你寻找契合好友'}
      </Text>
    </View>
  )
}

// ── Dealbreaker Cards ─────────────────────────────────────────────

interface DealbreakerCardsProps {
  districts: string[] | null
  genderComposition: MatchCompassGenderComposition | null
  acceptPairs: boolean | null
  availableDistricts: string[]
  onChange: (patch: UpdateMatchCompassPreferencesRequest) => void
}

function DealbreakerCards({
  districts,
  genderComposition,
  acceptPairs,
  availableDistricts,
  onChange,
}: DealbreakerCardsProps) {
  const toggleDistrict = useCallback(
    (district: string) => {
      const current = districts ?? []
      const next = current.includes(district)
        ? current.filter((d) => d !== district)
        : [...current, district]
      onChange({ preferredDistricts: next.length > 0 ? next : null })
    },
    [districts, onChange]
  )

  return (
    <View className='match-compass__dealbreakers'>
      {/* District */}
      <View className='match-compass__pref-card'>
        <View className='match-compass__pref-title-row'>
          <JoyJoinIcon emoji='📋' size={20} className='match-compass__pref-title-icon' />
          <Text className='match-compass__pref-title'>活动区域</Text>
        </View>
        <View className='match-compass__pref-chips'>
          {availableDistricts.map((district) => {
            const isSelected = (districts ?? []).includes(district)
            return (
              <View
                key={district}
                className={[
                  'match-compass__pref-chip',
                  isSelected ? 'match-compass__pref-chip--active' : '',
                ].join(' ')}
                onClick={() => toggleDistrict(district)}
              >
                <Text className='match-compass__pref-chip-text'>{district}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Gender Composition */}
      <View className='match-compass__pref-card'>
        <View className='match-compass__pref-title-row'>
          <JoyJoinIcon emoji='📋' size={20} className='match-compass__pref-title-icon' />
          <Text className='match-compass__pref-title'>同桌氛围</Text>
        </View>
        <View className='match-compass__pref-chips'>
          {GENDER_COMPOSITION_OPTIONS.map((option) => {
            const isSelected = genderComposition === option.value
            return (
              <View
                key={option.value}
                className={[
                  'match-compass__pref-chip',
                  isSelected ? 'match-compass__pref-chip--active' : '',
                ].join(' ')}
                onClick={() => onChange({ genderComposition: option.value })}
              >
                <Text className='match-compass__pref-chip-text'>{option.label}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Pair Acceptance */}
      <View className='match-compass__pref-card match-compass__pref-card--inline'>
        <View className='match-compass__pref-title-row'>
          <JoyJoinIcon emoji='📋' size={20} className='match-compass__pref-title-icon' />
          <Text className='match-compass__pref-title'>接受带朋友</Text>
        </View>
        <View
          className={[
            'match-compass__toggle',
            acceptPairs ? 'match-compass__toggle--on' : '',
          ].join(' ')}
          onClick={() => onChange({ acceptPairs: !acceptPairs })}
        >
          <View className='match-compass__toggle-knob' />
        </View>
      </View>
    </View>
  )
}

// ── Nice-to-Have Cards ────────────────────────────────────────────

interface NiceToHaveCardsProps {
  ageMatchPreference: string | null
  tableVibePreference: string | null
  onOpenModal: (mode: 'age' | 'vibe') => void
}

function NiceToHaveCards({ ageMatchPreference, tableVibePreference, onOpenModal }: NiceToHaveCardsProps) {
  return (
    <View className='match-compass__nice-to-haves'>
      <View
        className='match-compass__pref-card match-compass__pref-card--collapsed'
        onClick={() => onOpenModal('age')}
      >
        <View className='match-compass__pref-card-left'>
          <View className='match-compass__pref-title-row'>
            <JoyJoinIcon emoji='📋' size={20} className='match-compass__pref-title-icon' />
            <Text className='match-compass__pref-title'>年龄范围</Text>
          </View>
          <Text className='match-compass__pref-value'>
            {ageMatchPreference ?? '未设置'}
          </Text>
        </View>
        <Text className='match-compass__pref-chevron'>›</Text>
      </View>

      <View
        className='match-compass__pref-card match-compass__pref-card--collapsed'
        onClick={() => onOpenModal('vibe')}
      >
        <View className='match-compass__pref-card-left'>
          <View className='match-compass__pref-title-row'>
            <JoyJoinIcon emoji='📋' size={20} className='match-compass__pref-title-icon' />
            <Text className='match-compass__pref-title'>桌面氛围</Text>
          </View>
          <Text className='match-compass__pref-value'>
            {tableVibePreference ?? '未设置'}
          </Text>
        </View>
        <Text className='match-compass__pref-chevron'>›</Text>
      </View>
    </View>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────

interface DetailModalProps {
  mode: 'age' | 'vibe' | null
  initialValue: string | null
  onSave: (value: string) => void
  onClose: () => void
  shouldReduceMotion: boolean
}

function DetailModal({ mode, initialValue, onSave, onClose, shouldReduceMotion }: DetailModalProps) {
  const [selected, setSelected] = useState<string | null>(initialValue)
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSelected(initialValue)
  }, [initialValue, mode])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  if (!mode) return null

  const options = mode === 'age' ? AGE_RANGE_OPTIONS : TABLE_VIBE_OPTIONS
  const title = mode === 'age' ? '选择年龄范围' : '选择桌面氛围'

  const scheduleClose = (callback: () => void) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false)
      callback()
    }, shouldReduceMotion ? 0 : 300)
  }

  const handleSave = () => {
    if (selected) {
      // Q1-2: controller-level optimistic-apply haptic covers the save.
      onSave(selected)
    }
    scheduleClose(onClose)
  }

  const handleClose = () => {
    scheduleClose(onClose)
  }

  return (
    <View
      className={[
        'matching-status__overlay',
        'match-compass__modal',
        isClosing ? 'match-compass__modal--closing' : '',
      ].join(' ')}
    >
      <View
        className='matching-status__overlay-backdrop'
        onClick={handleClose}
      />
      <View
        className='matching-status__overlay-card match-compass__modal-card'
        style={{
          opacity: isClosing ? 0 : 1,
          transform: isClosing ? 'translateY(12rpx) scale(0.98)' : 'translateY(0) scale(1)',
          transition: shouldReduceMotion ? 'none' : 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <View className='match-compass__modal-title-row'>
          <JoyJoinIcon emoji='🧭' size={24} className='match-compass__modal-title-icon' />
          <Text className='match-compass__modal-title'>{title}</Text>
        </View>
        <View className='match-compass__modal-options'>
          {options.map((option) => (
            <View
              key={option}
              className={[
                'match-compass__modal-option',
                selected === option ? 'match-compass__modal-option--active' : '',
              ].join(' ')}
              onClick={() => setSelected(option)}
            >
              <Text className='match-compass__modal-option-text'>{option}</Text>
              {selected === option ? (
                <View className='match-compass__modal-check' />
              ) : null}
            </View>
          ))}
        </View>
        <Button className='match-compass__modal-save' onClick={handleSave}>
          保存
        </Button>
      </View>
    </View>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────

interface MatchCompassSkeletonProps {
  shouldReduceMotion: boolean
}

function MatchCompassSkeleton({ shouldReduceMotion }: MatchCompassSkeletonProps) {
  return (
    <View
      className='match-compass match-compass--skeleton'
      style={{
        opacity: 1,
        transition: shouldReduceMotion ? 'none' : 'opacity 0.2s ease',
      }}
    >
      <Card className='match-compass__card'>
        {/* Header skeleton */}
        <View className='match-compass__header'>
          <View className='match-compass__header-left'>
            <View className='match-compass__skeleton-title' />
            <View className='match-compass__skeleton-subtitle' />
          </View>
          <View className='match-compass__skeleton-gauge' />
        </View>

        {/* Chips skeleton */}
        <View className='match-compass__chips-row'>
          <View className='match-compass__skeleton-chip' />
          <View className='match-compass__skeleton-chip' />
          <View className='match-compass__skeleton-chip' />
        </View>

        {/* Dealbreakers skeleton */}
        <View className='match-compass__section-label match-compass__section-label--skeleton' />
        <View className='match-compass__dealbreakers'>
          <View className='match-compass__pref-card match-compass__pref-card--skeleton'>
            <View className='match-compass__skeleton-chip-row'>
              <View className='match-compass__skeleton-pill' />
              <View className='match-compass__skeleton-pill' />
              <View className='match-compass__skeleton-pill' />
              <View className='match-compass__skeleton-pill' />
            </View>
          </View>
          <View className='match-compass__pref-card match-compass__pref-card--skeleton'>
            <View className='match-compass__skeleton-chip-row'>
              <View className='match-compass__skeleton-pill' />
              <View className='match-compass__skeleton-pill' />
              <View className='match-compass__skeleton-pill' />
            </View>
          </View>
          <View className='match-compass__pref-card match-compass__pref-card--inline match-compass__pref-card--skeleton'>
            <View className='match-compass__skeleton-toggle' />
          </View>
        </View>

        {/* Nice-to-haves skeleton */}
        <View className='match-compass__section-label match-compass__section-label--skeleton' />
        <View className='match-compass__nice-to-haves'>
          <View className='match-compass__pref-card match-compass__pref-card--collapsed match-compass__pref-card--skeleton'>
            <View className='match-compass__skeleton-line--short' />
          </View>
          <View className='match-compass__pref-card match-compass__pref-card--collapsed match-compass__pref-card--skeleton'>
            <View className='match-compass__skeleton-line--short' />
          </View>
        </View>

        {/* Temperature strip skeleton */}
        <View className='match-compass__temp-strip match-compass__temp-strip--skeleton'>
          <View className='match-compass__skeleton-pill--small' />
          <View className='match-compass__skeleton-line--tiny' />
        </View>
      </Card>
    </View>
  )
}

// ── Shell (crossfade wrapper) ─────────────────────────────────────

export interface MatchCompassShellProps {
  data: MatchCompassResponse | null | undefined
  onUpdate: (patch: UpdateMatchCompassPreferencesRequest) => void
  shouldReduceMotion: boolean
  isUpdating: boolean
  availableDistricts?: string[]
  viewerArchetype?: string | null
}

const COMPASS_TIMEOUT_MS = 10_000

export function MatchCompassShell({
  data,
  onUpdate,
  shouldReduceMotion,
  isUpdating,
  availableDistricts = DEFAULT_DISTRICTS,
  viewerArchetype,
}: MatchCompassShellProps) {
  const [showSkeleton, setShowSkeleton] = useState(!data)
  const [dashboardEntered, setDashboardEntered] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (data) {
      setDashboardEntered(true)
      setTimedOut(false)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = setTimeout(() => {
        setShowSkeleton(false)
      }, shouldReduceMotion ? 0 : 200)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    } else {
      setShowSkeleton(true)
      setDashboardEntered(false)
      setTimedOut(false)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setTimedOut(true)
      }, COMPASS_TIMEOUT_MS)
    }

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [data, shouldReduceMotion])

  if (timedOut) {
    return (
      <Card className='match-compass__error'>
        <ArchetypeHead archetype={viewerArchetype ?? 'corgi'} size={32} className='match-compass__error-icon' variant='head' />
        <Text className='match-compass__error-title'>偏好数据暂时不可用</Text>
        <Text className='match-compass__error-text'>匹配偏好加载超时，正在重试中</Text>
      </Card>
    )
  }

  return (
    <View className='match-compass__shell'>
      {showSkeleton && (
        <View
          className='match-compass__shell-layer'
          style={{
            opacity: dashboardEntered ? 0 : 1,
            position: dashboardEntered ? 'absolute' : 'relative',
            pointerEvents: dashboardEntered ? 'none' : 'auto',
            transition: shouldReduceMotion ? 'none' : 'opacity 0.2s ease',
            width: '100%',
          }}
        >
          <MatchCompassSkeleton shouldReduceMotion={shouldReduceMotion} />
        </View>
      )}

      {data && (
        <View
          className='match-compass__shell-layer'
          style={{
            opacity: dashboardEntered ? 1 : 0,
            transition: shouldReduceMotion ? 'none' : 'opacity 0.2s ease, transform 0.2s ease',
            transform: dashboardEntered ? 'translateY(0)' : 'translateY(8rpx)',
            width: '100%',
          }}
        >
          <MatchCompassDashboard
            data={data}
            onUpdate={onUpdate}
            shouldReduceMotion={shouldReduceMotion}
            isUpdating={isUpdating}
            availableDistricts={availableDistricts}
            viewerArchetype={viewerArchetype}
          />
        </View>
      )}
    </View>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────

export interface MatchCompassDashboardProps {
  data: MatchCompassResponse
  onUpdate: (patch: UpdateMatchCompassPreferencesRequest) => void
  shouldReduceMotion: boolean
  isUpdating: boolean
  availableDistricts?: string[]
  viewerArchetype?: string | null
}

function MatchCompassDashboard({
  data,
  onUpdate,
  shouldReduceMotion,
  isUpdating,
  availableDistricts = DEFAULT_DISTRICTS,
  viewerArchetype,
}: MatchCompassDashboardProps) {
  const [modalMode, setModalMode] = useState<'age' | 'vibe' | null>(null)

  const handleStrictnessChange = useCallback(
    (strictness: number) => {
      onUpdate({ strictness })
    },
    [onUpdate]
  )

  const handleModalSave = useCallback(
    (value: string) => {
      if (modalMode === 'age') {
        onUpdate({ ageMatchPreference: value })
      } else if (modalMode === 'vibe') {
        onUpdate({ tableVibePreference: value })
      }
      // Note: modal unmounts via onClose after its own close animation completes
    },
    [modalMode, onUpdate]
  )

  const modalInitialValue = modalMode === 'age' ? data.ageMatchPreference : data.tableVibePreference

  return (
    <View className='match-compass'>
      {/* Eager preload all 3 Xiaoyue compass assets (AC-11, SCA-03) */}
      <View className='match-compass__preload-layer' aria-hidden='true'>
        {COMPASS_PRELOAD_EXPRESSIONS.map((expr) => (
          <Image
            key={expr}
            className='match-compass__preload-image'
            src={getXiaoyueExpressionAsset(expr)}
            mode='aspectFit'
            lazyLoad={false}
            aria-hidden='true'
          />
        ))}
      </View>

      <Card className='match-compass__card'>
        <View className='match-compass__header'>
          <View className='match-compass__header-left'>
            <View className='match-compass__title-row'>
              <JoyJoinIcon emoji='🧭' size={28} className='match-compass__title-icon' />
              <Text className='match-compass__title'>匹配罗盘</Text>
            </View>
            <Text className='match-compass__subtitle'>
              调整偏好，让{data.primaryArchetype ? `「${data.primaryArchetype}」` : '你'}遇到更对味的人
            </Text>
          </View>
          <ConfidenceGauge
            temperatureScore={data.temperatureScore}
            temperatureBand={data.temperatureBand}
            shouldReduceMotion={shouldReduceMotion}
          />
        </View>

        <StrictnessChips
          value={data.strictness}
          onChange={handleStrictnessChange}
          shouldReduceMotion={shouldReduceMotion}
        />

        <View className='match-compass__section-label-row'>
          <JoyJoinIcon emoji='📋' size={20} className='match-compass__section-label-icon' />
          <Text className='match-compass__section-label'>必须满足</Text>
        </View>
        <DealbreakerCards
          districts={data.preferredDistricts}
          genderComposition={data.genderComposition}
          acceptPairs={data.acceptPairs}
          availableDistricts={availableDistricts}
          onChange={onUpdate}
        />

        <View className='match-compass__section-label-row'>
          <JoyJoinIcon emoji='📋' size={20} className='match-compass__section-label-icon' />
          <Text className='match-compass__section-label'>加分项</Text>
        </View>
        <NiceToHaveCards
          ageMatchPreference={data.ageMatchPreference}
          tableVibePreference={data.tableVibePreference}
          onOpenModal={setModalMode}
        />

        <TemperatureStrip band={data.temperatureBand} eligibleUserCount={data.eligibleUserCount} />

        {isUpdating ? (
          <Text className='match-compass__updating-hint'>正在保存…</Text>
        ) : null}
      </Card>

      <DetailModal
        mode={modalMode}
        initialValue={modalInitialValue}
        onSave={handleModalSave}
        onClose={() => setModalMode(null)}
        shouldReduceMotion={shouldReduceMotion}
      />
    </View>
  )
}
