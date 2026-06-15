import { View, Text, Input, Picker, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CURRENT_CITY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  INTENT_FLEXIBLE_OPTION,
  INTENT_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS,
} from '@shared/constants'
import {
  getOccupationGuidance,
  WORK_MODES,
} from '@shared/occupations'
import { submitEssentialData, type AuthUserResponse } from '@shared/api'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../../lib/utils/uiConstants'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useOnboardingCheckpoint } from '../../../hooks/onboarding/useOnboardingCheckpoint'
import { navigateToMiniProgramNextStep } from '../../../lib/onboarding/onboardingNavigation'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { getMascotDisplayName } from '../../../lib/mascot/mascotDisplay'
import { logError, logInfo } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import CheckBadge from '../../../components/ui/CheckBadge'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import { ResponsiveSpacer } from '../../../components/ui/ResponsiveSpacer'
import FormStepper from '../../../components/ui/FormStepper'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import ProfessionChatOverlay from '../../../components/ProfessionChatOverlay'
import ContentBlockedError from '../../../components/ContentBlockedError'
import type { ProfessionClassificationData } from '../../../components/ProfessionChatOverlay'
import { getArchetypeVisual, getXiaoyueAsset } from '../personality-test/visuals'
import './index.scss'

const MAX_INTENTS = 3
const currentYear = new Date().getFullYear()
const BIRTH_YEAR_RANGE = Array.from(
  { length: currentYear - 1970 - 17 },
  (_, index) => currentYear - 18 - index,
)

interface StepConfig {
  id: string
  title: string
  subtitle: string
  mascotMessage: string
  mascotPose: 'thinking' | 'casual' | 'pointing'
}

const STEP_CONFIG: StepConfig[] = [
  {
    id: 'displayName',
    title: '大家怎么称呼你？',
    subtitle: '这是大家在活动中看到的名字',
    mascotMessage: '嘿！给自己起个响亮的名字吧，活动中大家会这么叫你~',
    mascotPose: 'casual',
  },
  {
    id: 'genderBirthday',
    title: '基本信息',
    subtitle: '帮助匹配更合适的活动',
    mascotMessage: '帮你找到年龄相近、聊得来的朋友！',
    mascotPose: 'pointing',
  },
  {
    id: 'professionalProfile',
    title: '你的职业身份',
    subtitle: '学历+行业一起搞定',
    mascotMessage: '学历+行业一起搞定，说不定能遇到同行大佬！',
    mascotPose: 'pointing',
  },
  {
    id: 'location',
    title: '你从哪来，在哪混？',
    subtitle: '老乡见老乡，两眼泪汪汪',
    mascotMessage: '老乡见老乡，配桌优先排！',
    mascotPose: 'casual',
  },
  {
    id: 'intent',
    title: '这次聚会，你最想……',
    subtitle: '选得越准，同桌的人越对味',
    mascotMessage: '最后一个问题！选完之后我就知道该把你安排在哪桌了',
    mascotPose: 'casual',
  },
]

const TOTAL_STEPS = STEP_CONFIG.length

const ESSENTIAL_DATA_CACHE_KEY = 'joyjoin_essential_data_progress'

interface CachedProgress {
  currentStep: number
  displayName: string
  gender: string
  birthYear: number
  currentCity: string
  hometownRegionCity: string
  relationshipStatus: string
  educationLevel: string
  occupationId: string
  workMode: string
  intent: string[]
  timestamp: number
}

function getBirthYear(user: Record<string, unknown> | undefined): number {
  if (!user) return 0
  const raw = user.birthYear
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  const birthdate = typeof user.birthdate === 'string' ? user.birthdate : ''
  if (birthdate !== '') {
    const year = new Date(birthdate).getFullYear()
    if (Number.isFinite(year)) return year
  }
  return 0
}

function readCachedProgress(): CachedProgress | null {
  try {
    const raw = Taro.getStorageSync(ESSENTIAL_DATA_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedProgress
    const age = Date.now() - (parsed.timestamp || 0)
    if (age > 24 * 60 * 60 * 1000) {
      Taro.removeStorageSync(ESSENTIAL_DATA_CACHE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveCachedProgress(data: CachedProgress) {
  try {
    Taro.setStorageSync(ESSENTIAL_DATA_CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }))
  } catch {
    // ignore
  }
}

export default function EssentialDataPage() {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const [currentStep, setCurrentStep] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState('')
  const [birthYear, setBirthYear] = useState(0)
  const [currentCity, setCurrentCity] = useState('')
  const [hometownRegionCity, setHometownRegionCity] = useState('')
  const [relationshipStatus, setRelationshipStatus] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [professionText, setProfessionText] = useState('')
  const [isProfessionOverlayClosing, setIsProfessionOverlayClosing] = useState(false)
  const [workMode, setWorkMode] = useState('')
  const [intent, setIntent] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [error, setError] = useState('')
  const [contentViolations, setContentViolations] = useState<Record<string, string>>({})
  const [showProfessionOverlay, setShowProfessionOverlay] = useState(false)
  const [professionClassification, setProfessionClassification] = useState<ProfessionClassificationData | null>(null)

  useResetOnShow(setIsPageExiting, setIsSubmitting)
  const [mascotReaction, setMascotReaction] = useState('')
  const mascotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { user, isLoading } = useAuthGuard({
    suspendOnboardingRedirect: isSubmitting || isPageExiting,
  })
  const userArchetype = (user?.primaryArchetype as string | undefined) || (user?.archetype as string | undefined) || ''
  const archetypeVisual = userArchetype ? getArchetypeVisual(userArchetype) : null
  const accentColor = archetypeVisual?.accent || ''
  const invalidateAuth = useInvalidateAuth()
  const analytics = useOnboardingAnalytics('essential-data', { enabled: !isLoading })
  const { saveCheckpoint } = useOnboardingCheckpoint()

  // Restore from cache or user data on mount
  useEffect(() => {
    if (isLoading || !user) return

    const cached = readCachedProgress()
    const source = user as unknown as Record<string, unknown>

    setDisplayName((c) => c || cached?.displayName || (typeof source.displayName === 'string' ? source.displayName : '') || '')
    setGender((c) => c || cached?.gender || (typeof source.gender === 'string' ? source.gender : '') || '')
    setBirthYear((c) => c || cached?.birthYear || getBirthYear(source))
    setCurrentCity((c) => c || cached?.currentCity || (typeof source.currentCity === 'string' ? source.currentCity : '') || '')
    setHometownRegionCity((c) => c || cached?.hometownRegionCity || (typeof source.hometownRegionCity === 'string' ? source.hometownRegionCity : '') || '')
    setRelationshipStatus((c) => c || cached?.relationshipStatus || (typeof source.relationshipStatus === 'string' ? source.relationshipStatus : '') || '')
    setEducationLevel((c) => c || cached?.educationLevel || (typeof source.educationLevel === 'string' ? source.educationLevel : '') || '')
    setProfessionText((c) => {
      if (c) return c
      if (cached?.occupationId) return cached.occupationId
      if (typeof source.occupationId === 'string') {
        return source.occupationId
      }
      return ''
    })
    setWorkMode((c) => c || cached?.workMode || (typeof source.workMode === 'string' ? source.workMode : '') || '')
    setIntent((c) => (c.length > 0 ? c : cached?.intent || (Array.isArray(source.intent) ? source.intent.filter((item): item is string => typeof item === 'string') : [])))
    setCurrentStep((c) => (c === 0 && cached?.currentStep ? Math.min(cached.currentStep, TOTAL_STEPS - 1) : c))
  }, [user, isLoading])

  // Auto-save to cache on field changes
  useEffect(() => {
    saveCachedProgress({
      currentStep,
      displayName,
      gender,
      birthYear,
      currentCity,
      hometownRegionCity,
      relationshipStatus,
      educationLevel,
      occupationId: professionText,
      workMode,
      intent,
      timestamp: Date.now(),
    })
  }, [currentStep, displayName, gender, birthYear, currentCity, hometownRegionCity, relationshipStatus, educationLevel, professionText, workMode, intent])

  const cityOptions = useMemo(() => [...CURRENT_CITY_OPTIONS], [])
  const relationshipOptions = useMemo(() => [...RELATIONSHIP_STATUS_OPTIONS], [])
  const occupationGuidance = useMemo(() => getOccupationGuidance(intent[0] ?? INTENT_OPTIONS[0].value), [intent])

  const birthYearIndex = birthYear > 0 ? BIRTH_YEAR_RANGE.indexOf(birthYear) : -1
  const currentCityIndex = currentCity ? cityOptions.findIndex((option) => option === currentCity) : -1
  const relationshipIndex = relationshipStatus ? relationshipOptions.findIndex((option) => option === relationshipStatus) : -1
  const intentOptions = useMemo(() => [...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION], [])

  const stepConfig = STEP_CONFIG[currentStep]

  /** Set a temporary mascot reaction message; clears on step change. */
  const triggerMascotReaction = useCallback((message: string) => {
    if (mascotTimeoutRef.current) {
      clearTimeout(mascotTimeoutRef.current)
    }
    setMascotReaction(message)
    mascotTimeoutRef.current = setTimeout(() => {
      setMascotReaction('')
      mascotTimeoutRef.current = null
    }, 3000)
  }, [])

  // Cleanup mascot reaction timeout on unmount
  useEffect(() => {
    return () => {
      if (mascotTimeoutRef.current) {
        clearTimeout(mascotTimeoutRef.current)
      }
    }
  }, [])

  const isStepValid = useMemo(() => {
    switch (currentStep) {
      case 0:
        return displayName.trim().length >= 2
      case 1:
        return gender !== '' && birthYear > 0
      case 2:
        return true
      case 3:
        return currentCity !== ''
      case 4:
        return intent.length > 0
      default:
        return false
    }
  }, [currentStep, displayName, gender, birthYear, currentCity, intent.length])

  const handleNext = useCallback(() => {
    if (!isStepValid) {
      analytics.validationFailed('step', `step-${currentStep}-incomplete`)
      Taro.showToast({ title: '请完成当前步骤', icon: 'none', duration: TOAST_DEFAULT_MS })
      return
    }
    if (currentStep < TOTAL_STEPS - 1) {
      analytics.stepCompleted({ stepId: stepConfig.id, stepNumber: currentStep + 1 })
      haptics('medium')
      setCurrentStep((s) => s + 1)
      setMascotReaction('')
    }
  }, [isStepValid, currentStep, analytics, stepConfig.id])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      haptics('light')
      setCurrentStep((s) => s - 1)
      setMascotReaction('')
    }
  }, [currentStep])

  const handleForceSkip = useCallback(async () => {
    try {
      const { confirm } = await Taro.showModal({
        title: '跳过当前步骤',
        content: '确定要跳过这一步吗？悦仔建议尽量完成，匹配会更精准。',
        confirmText: '确认跳过',
        cancelText: '继续填写',
      })
      if (!confirm) return
      setIsSubmitting(true)
      const response = await apiRequest<AuthUserResponse>({ path: '/api/auth/onboarding/force-skip', method: 'POST' })
      await invalidateAuth()
      const nextStep = response.nextStep ?? 'discover'
      await navigateToMiniProgramNextStep(nextStep, { mode: 'replace' })
    } catch (err) {
      const message = err instanceof Error ? err.message : '跳过失败，请重试'
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_FATAL_MS })
    } finally {
      setIsSubmitting(false)
    }
  }, [invalidateAuth])

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError('')

    try {
      const payload = {
        displayName: displayName.trim(),
        gender,
        birthYear,
        currentCity,
        ...(hometownRegionCity.trim() !== '' ? { hometownRegionCity: hometownRegionCity.trim() } : {}),
        ...(relationshipStatus ? { relationshipStatus } : {}),
        ...(educationLevel ? { educationLevel } : {}),
        ...(professionText.trim() !== '' ? {
          occupationId: professionText.trim(),
          industryRawInput: professionText.trim(),
          ...(workMode ? { workMode } : {}),
          ...(professionClassification?.standardizedOccupationId ? { standardizedOccupationId: professionClassification.standardizedOccupationId } : {}),
          ...(professionClassification?.industryCategoryLabel ? { industryCategoryLabel: professionClassification.industryCategoryLabel } : {}),
          ...(professionClassification?.industrySegmentLabel ? { industrySegmentLabel: professionClassification.industrySegmentLabel } : {}),
          ...(professionClassification?.industryNicheLabel ? { industryNicheLabel: professionClassification.industryNicheLabel } : {}),
          ...(professionClassification?.industryCategory ? { industryCategory: professionClassification.industryCategory } : {}),
          ...(professionClassification?.industrySegmentNew ? { industrySegmentNew: professionClassification.industrySegmentNew } : {}),
          ...(professionClassification?.industryNiche ? { industryNiche: professionClassification.industryNiche } : {}),
          ...(professionClassification?.industrySource ? { industrySource: professionClassification.industrySource } : {}),
          ...(professionClassification?.industryConfidence !== undefined ? { industryConfidence: professionClassification.industryConfidence } : {}),
        } : {}),
        ...(intent.length > 0 ? { intent } : {}),
      }

      logInfo('[EssentialData] Submitting', { fields: Object.keys(payload).length })
      await submitEssentialData(apiRequest, payload)
      await saveCheckpoint('essential-data')
      await invalidateAuth()
      Taro.removeStorageSync(ESSENTIAL_DATA_CACHE_KEY)
      const userState = await getUserState()

      analytics.stepCompleted({
        fieldsCompleted: Object.keys(payload).length,
        nextStep: userState.nextStep ?? 'extended-data',
      })

      Taro.showToast({ title: '入场名片已保存', icon: 'success', duration: TOAST_DEFAULT_MS })
      await navigateToMiniProgramNextStep(userState.nextStep, {
        mode: 'replace',
        transition: { beforeNavigate: () => setIsPageExiting(true) },
      })
    } catch (err) {
      // Check for content violation (server 敏感词过滤)
      const errorData = (err as Record<string, unknown>)?.data as Record<string, unknown> | undefined
      if (errorData?.code === 'CONTENT_VIOLATION') {
        const violation = errorData?.violation as Record<string, unknown> | undefined
        const field = (violation?.field as string) || ''
        const fieldMessage = (violation?.message as string) || (err instanceof Error ? err.message : getErrorMessage('submit-failed'))

        if (field) {
          setContentViolations((prev) => ({ ...prev, [field]: fieldMessage }))
          // Navigate to the step containing this field if needed
          if (field === 'displayName' && currentStep !== 0) {
            setCurrentStep(0)
          }
          setError('')
        } else {
          setError(fieldMessage)
          Taro.showToast({ title: fieldMessage, icon: 'none', duration: TOAST_FATAL_MS })
        }

        analytics.errorOccurred('content_violation', fieldMessage)
        logError('[EssentialData] Content violation', { field, message: fieldMessage })
        return
      }

      const message = err instanceof Error ? err.message : getErrorMessage('submit-failed')
      setError(message)
      analytics.errorOccurred('submit_failed', message)
      logError('[EssentialData] Submit failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_FATAL_MS })
    } finally {
      setIsSubmitting(false)
    }
  }, [analytics, birthYear, currentCity, displayName, educationLevel, gender, hometownRegionCity, intent, invalidateAuth, isSubmitting, professionText, professionClassification, relationshipStatus, saveCheckpoint, workMode, contentViolations, currentStep])

  const handleProfessionSubmit = useCallback((value: string, classification?: ProfessionClassificationData) => {
    setProfessionText(value)
    if (classification) {
      setProfessionClassification(classification)
    }
    setIsProfessionOverlayClosing(true)
    setTimeout(() => {
      setShowProfessionOverlay(false)
      setIsProfessionOverlayClosing(false)
    }, shouldReduceMotion ? 0 : 350)
  }, [shouldReduceMotion])

  const handleProfessionSkip = useCallback(() => {
    setIsProfessionOverlayClosing(true)
    setTimeout(() => {
      setShowProfessionOverlay(false)
      setIsProfessionOverlayClosing(false)
    }, shouldReduceMotion ? 0 : 350)
  }, [shouldReduceMotion])

  const toggleIntent = useCallback(
    (value: string) => {
      haptics('light')
      if (value === INTENT_FLEXIBLE_OPTION.value) {
        // Toggle flexible independently; when turned off, keep other explicit selections
        if (intent.includes(value)) {
          setIntent(intent.filter((item) => item !== value))
        } else {
          setIntent([...intent, value])
        }
        return
      }

      // Regular option toggle
      if (intent.includes(value)) {
        setIntent(intent.filter((item) => item !== value))
        return
      }

      const explicitCount = intent.filter((item) => item !== INTENT_FLEXIBLE_OPTION.value).length
      if (explicitCount >= MAX_INTENTS) {
        analytics.validationFailed('intent', 'max-selection-reached')
        Taro.showToast({ title: `最多选择 ${MAX_INTENTS} 个意图`, icon: 'none', duration: TOAST_DEFAULT_MS })
        return
      }
      setIntent([...intent, value])
    },
    [analytics, intent],
  )

  // Memoize intent grid to prevent re-render on unrelated state changes
  const intentGrid = useMemo(() => {
    const isFlexibleActive = intent.includes(INTENT_FLEXIBLE_OPTION.value)
    const explicitCount = intent.filter((item) => item !== INTENT_FLEXIBLE_OPTION.value).length
    const isCapReached = explicitCount >= MAX_INTENTS
    return (
      <View className='essential-data__intent-grid'>
        {intentOptions.map((option) => {
          const isExplicitlySelected = intent.includes(option.value)
          const isFlexibleOption = option.value === INTENT_FLEXIBLE_OPTION.value
          const isDimmed = isFlexibleActive && !isFlexibleOption && !isExplicitlySelected
          const isDisabled = isCapReached && !isExplicitlySelected && !isFlexibleOption
          const visuallySelected = isExplicitlySelected || isDimmed
          return (
            <View
              key={option.value}
              className={[
                'essential-data__intent-card',
                visuallySelected ? 'essential-data__intent-card--selected' : '',
                isDimmed ? 'essential-data__intent-card--dimmed' : '',
                isDisabled ? 'essential-data__intent-card--disabled' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => !isDisabled && toggleIntent(option.value)}
              role='button'
              aria-pressed={isExplicitlySelected}
              aria-disabled={isDisabled}
              aria-label={`${option.label}：${option.subtitle}${isDisabled ? '（已达上限）' : ''}`}
            >
              <JoyJoinIcon
                emoji={option.emoji}
                tier='intent'
                size={48}
                className='essential-data__intent-icon'
              />
              <Text className='essential-data__intent-label'>{option.label}</Text>
              <Text className='essential-data__intent-subtitle'>{option.subtitle}</Text>
              {visuallySelected && (
                <CheckBadge className='essential-data__intent-check' />
              )}
            </View>
          )
        })}
      </View>
    )
  }, [intentOptions, intent, toggleIntent])

  if (isLoading) {
    return (
      <OnboardingLoadingShell
        stepLabel='Onboarding 2 / 4'
        title={`${getMascotDisplayName(user)}在整理你的入场名片`}
        subtitle='把这一步铺好后，后面的兴趣热度和资料预览都会顺滑接上。'
      />
    )
  }

  const pageClass = ['essential-data', isPageExiting ? 'essential-data--exiting' : ''].filter(Boolean).join(' ')

  return (
    <View className={pageClass}>
      <FormStepper
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        stepLabels={STEP_CONFIG.map((s) => s.title)}
        onBack={handleBack}
        showBack={currentStep > 0}
      />

      <ScrollView className='essential-data__scroll' scrollY enhanced showScrollbar={false}>
        <View className='essential-data__shell'>
          {/* Xiaoyue coaching bubble */}
          <View className='essential-data__stage essential-data__stage--1'>
            <XiaoyueChatBubble
              content={mascotReaction || stepConfig.mascotMessage}
              pose={stepConfig.mascotPose}
              horizontal
              showGlow
            />
          </View>

          {/* Step 1: Display name */}
          {currentStep === 0 && (
            <Card className='essential-data__card essential-data__stage essential-data__stage--2'>
              <View className='essential-data__field' id='field-displayName'>
                <Text className='essential-data__label'>
                  昵称<Text className='essential-data__required'>*</Text>
                </Text>
                <Input
                  className={`essential-data__input ${contentViolations.displayName ? 'essential-data__input--error' : ''}`}
                  placeholder='大家在活动里会怎么称呼你'
                  value={displayName}
                  onInput={(e) => {
                    setDisplayName(e.detail.value)
                    setContentViolations((prev) => ({ ...prev, displayName: '' }))
                  }}
                  onBlur={(e) => {
                    const v = e.detail.value.trim()
                    if (v !== '' && v.length < 2) analytics.validationFailed('displayName', 'too-short')
                  }}
                  maxlength={20}
                />
                <Text className='essential-data__hint'>2-20 个字符，会显示在活动和匹配资料里。</Text>
                <ContentBlockedError
                  message={contentViolations.displayName || ''}
                  visible={!!contentViolations.displayName}
                  fieldName='displayName'
                  onDismiss={() => setContentViolations((prev) => {
                    const next = { ...prev }
                    delete next.displayName
                    return next
                  })}
                />
              </View>
            </Card>
          )}

          {/* Step 2: Gender + Birth year */}
          {currentStep === 1 && (
            <Card className='essential-data__card essential-data__stage essential-data__stage--2'>
              <View className='essential-data__field'>
                <Text className='essential-data__label'>
                  性别<Text className='essential-data__required'>*</Text>
                </Text>
                <View className='essential-data__choice-row'>
                  {GENDER_OPTIONS.map((option) => {
                    const selected = gender === option
                    return (
                      <View
                        key={option}
                        className={['essential-data__choice-chip', selected ? 'essential-data__choice-chip--selected' : ''].filter(Boolean).join(' ')}
                        onClick={() => setGender(option)}
                      >
                        <Text className='essential-data__choice-chip-text'>{option}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              <View className='essential-data__field'>
                <Text className='essential-data__label'>
                  出生年份<Text className='essential-data__picker-badge'>必填</Text>
                </Text>
                <Picker
                  mode='selector'
                  range={BIRTH_YEAR_RANGE}
                  value={birthYearIndex >= 0 ? birthYearIndex : 0}
                  onChange={(e) => {
                    const year = BIRTH_YEAR_RANGE[Number(e.detail.value)] ?? 0
                    setBirthYear(year)
                    triggerMascotReaction(` ${year}年，正是好年纪！✨`)
                  }}
                >
                  <View
                    className={['essential-data__picker', birthYear > 0 ? 'essential-data__picker--cta-selected' : 'essential-data__picker--cta'].filter(Boolean).join(' ')}
                    style={birthYear > 0 && accentColor ? { borderColor: accentColor, boxShadow: `0 2rpx 8rpx ${accentColor}20` } : undefined}
                    aria-label={birthYear > 0 ? `出生年份：${birthYear} 年` : '请选择出生年份'}
                  >
                    <Text className={['essential-data__picker-text', birthYear > 0 ? 'essential-data__picker-text--cta-selected' : 'essential-data__picker-text--cta'].filter(Boolean).join(' ')}>
                      {birthYear > 0 ? `${birthYear} 年` : '请选择出生年份'}
                    </Text>
                    {birthYear > 0 && (
                      <View className='essential-data__picker-check' style={accentColor ? { background: accentColor } : undefined}>
                        <Text className='essential-data__picker-check-icon'>✓</Text>
                      </View>
                    )}
                  </View>
                </Picker>
              </View>
            </Card>
          )}

          {/* Step 3: Education + Occupation + Relationship */}
          {currentStep === 2 && (
            <Card className='essential-data__card essential-data__stage essential-data__stage--2'>
              <View className='essential-data__field'>
                <Text className='essential-data__label'>学历</Text>
                <View className='essential-data__choice-row essential-data__choice-row--wrap'>
                  {EDUCATION_LEVEL_OPTIONS.map((option) => {
                    const selected = educationLevel === option
                    return (
                      <View
                        key={option}
                        className={['essential-data__choice-chip', 'essential-data__choice-chip--compact', selected ? 'essential-data__choice-chip--selected' : ''].filter(Boolean).join(' ')}
                        onClick={() => setEducationLevel(selected ? '' : option)}
                      >
                        <Text className='essential-data__choice-chip-text'>{option}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              <View className='essential-data__field'>
                <Text className='essential-data__label'>人生阶段</Text>
                <Picker
                  mode='selector'
                  range={WORK_MODES.map((m) => m.label)}
                  value={workMode ? WORK_MODES.findIndex((m) => m.value === workMode) : -1}
                  onChange={(e) => {
                    const mode = WORK_MODES[Number(e.detail.value)]
                    if (mode) setWorkMode(mode.value)
                  }}
                >
                  <View
                    className={['essential-data__picker', workMode !== '' ? 'essential-data__picker--cta-selected' : 'essential-data__picker--cta'].filter(Boolean).join(' ')}
                    style={workMode !== '' && accentColor ? { borderColor: accentColor, boxShadow: `0 2rpx 8rpx ${accentColor}20` } : undefined}
                    aria-label={workMode !== '' ? `人生阶段：${WORK_MODES.find((m) => m.value === workMode)?.label ?? ''}` : '请选择人生阶段'}
                  >
                    <Text className={['essential-data__picker-text', workMode !== '' ? 'essential-data__picker-text--cta-selected' : 'essential-data__picker-text--cta'].filter(Boolean).join(' ')}>
                      {workMode !== '' ? (WORK_MODES.find((m) => m.value === workMode)?.label ?? '选填（点击选择）') : '选填（点击选择）'}
                    </Text>
                    {workMode !== '' && (
                      <View className='essential-data__picker-check' style={accentColor ? { background: accentColor } : undefined}>
                        <Text className='essential-data__picker-check-icon'>✓</Text>
                      </View>
                    )}
                  </View>
                </Picker>
                <Text className='essential-data__hint'>帮助我们更了解你的状态，匹配更合拍的朋友</Text>
              </View>

              <View className='essential-data__field'>
                <Text className='essential-data__label'>{occupationGuidance.title}</Text>
                <View
                  className={[
                    'essential-data__picker',
                    professionText !== '' ? 'essential-data__picker--cta-selected' : 'essential-data__picker--cta',
                  ].filter(Boolean).join(' ')}
                  style={professionText !== '' && accentColor ? { borderColor: accentColor, boxShadow: `0 2rpx 8rpx ${accentColor}20` } : undefined}
                  onClick={() => setShowProfessionOverlay(true)}
                  aria-label={professionText !== '' ? `职业：${professionText}` : '选填（点击告诉悦仔你的职业）'}
                >
                  <Text
                    className={[
                      'essential-data__picker-text',
                      professionText !== '' ? 'essential-data__picker-text--cta-selected' : 'essential-data__picker-text--cta',
                    ].filter(Boolean).join(' ')}
                  >
                    {professionText !== '' ? professionText : '选填（点击告诉悦仔）'}
                  </Text>
                  {professionText !== '' && (
                    <View className='essential-data__picker-check' style={accentColor ? { background: accentColor } : undefined}>
                      <Text className='essential-data__picker-check-icon'>✓</Text>
                    </View>
                  )}
                </View>
                <Text className='essential-data__hint'>
                  {professionText !== '' ? '已记录，我会用它来优化匹配~' : occupationGuidance.matchPreview}
                </Text>
              </View>

              <View className='essential-data__field'>
                <Text className='essential-data__label'>关系状态</Text>
                <Picker
                  mode='selector'
                  range={relationshipOptions}
                  value={relationshipIndex >= 0 ? relationshipIndex : 0}
                  onChange={(e) => {
                    const status = relationshipOptions[Number(e.detail.value)] ?? ''
                    setRelationshipStatus(status)
                    const reactions: Record<string, string> = {
                      '单身': '单身贵族！悦仔记住了~ 💫',
                      '恋爱中': '甜甜蜜蜜！祝你们幸福~ 💕',
                      '已婚/伴侣': '稳定的幸福，很踏实~ 🏠',
                      '离异': '新的篇章，新的开始~ ✨',
                      '丧偶': '感谢你愿意信任我们~ 🤝',
                      '不透露': '保持神秘感也是一种魅力~ 😉',
                    }
                    triggerMascotReaction(reactions[status] || '了解！')
                  }}
                >
                  <View
                    className={['essential-data__picker', relationshipStatus !== '' ? 'essential-data__picker--cta-selected' : 'essential-data__picker--cta'].filter(Boolean).join(' ')}
                    style={relationshipStatus !== '' && accentColor ? { borderColor: accentColor, boxShadow: `0 2rpx 8rpx ${accentColor}20` } : undefined}
                    aria-label={relationshipStatus !== '' ? `关系状态：${relationshipStatus}` : '请选择关系状态'}
                  >
                    <Text className={['essential-data__picker-text', relationshipStatus !== '' ? 'essential-data__picker-text--cta-selected' : 'essential-data__picker-text--cta'].filter(Boolean).join(' ')}>
                      {relationshipStatus || '选填（点击选择）'}
                    </Text>
                    {relationshipStatus !== '' && (
                      <View className='essential-data__picker-check' style={accentColor ? { background: accentColor } : undefined}>
                        <Text className='essential-data__picker-check-icon'>✓</Text>
                      </View>
                    )}
                  </View>
                </Picker>
              </View>
            </Card>
          )}

          {/* Step 4: Location */}
          {currentStep === 3 && (
            <Card className='essential-data__card essential-data__stage essential-data__stage--2'>
              <View className='essential-data__field'>
                <Text className='essential-data__label'>
                  现居城市<Text className='essential-data__required'>*</Text>
                </Text>
                <Picker
                  mode='selector'
                  range={cityOptions}
                  value={currentCityIndex >= 0 ? currentCityIndex : 0}
                  onChange={(e) => setCurrentCity(cityOptions[Number(e.detail.value)] ?? '')}
                >
                  <View
                    className='essential-data__picker'
                    style={currentCity !== '' && accentColor ? { borderColor: accentColor, boxShadow: `0 2rpx 8rpx ${accentColor}20` } : undefined}
                    aria-label={currentCity !== '' ? `现居城市：${currentCity}` : '请选择现居城市'}
                  >
                    <Text className={['essential-data__picker-text', currentCity !== '' ? 'essential-data__picker-text--filled' : ''].filter(Boolean).join(' ')}>
                      {currentCity || '请选择'}
                    </Text>
                    {currentCity !== '' && (
                      <View className='essential-data__picker-check' style={accentColor ? { background: accentColor } : undefined}>
                        <Text className='essential-data__picker-check-icon'>✓</Text>
                      </View>
                    )}
                  </View>
                </Picker>
              </View>

              <View className='essential-data__field'>
                <Text className='essential-data__label'>家乡</Text>
                <Input
                  className='essential-data__input'
                  placeholder='如：广州 / 香港'
                  value={hometownRegionCity}
                  onInput={(e) => setHometownRegionCity(e.detail.value)}
                  maxlength={30}
                />
              </View>
            </Card>
          )}

          {/* Step 5: Intent */}
          {currentStep === 4 && (
            <Card className='essential-data__card essential-data__stage essential-data__stage--2'>
              <View className='essential-data__field'>
                <Text className='essential-data__label'>这次更想收获什么</Text>
                {intentGrid}
                <Text className='essential-data__hint'>最多可选 {MAX_INTENTS} 个，多选会影响后续活动推荐。</Text>
              </View>
            </Card>
          )}

          <ResponsiveSpacer heightRpx={48} collapseBelow={700} />
        </View>
      </ScrollView>

      {/* Fixed bottom CTA tray */}
      <View className='essential-data__tray'>
        {error ? <Text className='essential-data__error'>{error}</Text> : null}
        {user?.features?.onboardingForceSkip && (
          <Button
            variant='secondary'
            className='essential-data__skip-btn'
            onClick={handleForceSkip}
            disabled={isSubmitting}
          >
            跳过
          </Button>
        )}
        {currentStep < TOTAL_STEPS - 1 ? (
          <Button
            variant='brand'
            className='essential-data__submit'
            onClick={handleNext}
            disabled={!isStepValid}
          >
            下一步
          </Button>
        ) : (
          <Button
            variant='brand'
            className='essential-data__submit'
            onClick={handleSubmit}
            disabled={!isStepValid || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? '提交中…' : '继续完善兴趣'}
          </Button>
        )}
      </View>

      <ProfessionChatOverlay
        visible={showProfessionOverlay}
        isClosing={isProfessionOverlayClosing}
        initialValue={professionText}
        smartProfession={user?.features?.smartProfession ?? false}
        userArchetype={userArchetype}
        onSubmit={handleProfessionSubmit}
        onSkip={handleProfessionSkip}
      />
    </View>
  )
}
