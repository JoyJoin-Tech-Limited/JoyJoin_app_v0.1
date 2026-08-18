import { View, Text, Input, Picker, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CURRENT_CITY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  INTENT_FLEXIBLE_OPTION,
  INTENT_OPTIONS,
  LIFE_STAGE_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS,
  toggleIntentValue,
} from '@shared/constants'
import { getOccupationGuidance } from '@shared/occupations'
import { submitEssentialData, type AuthUserResponse } from '@shared/api'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../../lib/utils/uiConstants'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useStepAbandonGuard } from '../../../hooks/onboarding/useStepAbandonGuard'
import { useOnboardingCheckpoint } from '../../../hooks/onboarding/useOnboardingCheckpoint'
import { navigateToMiniProgramNextStep } from '../../../lib/onboarding/onboardingNavigation'
import { ONBOARDING_MASCOT_SIZE } from '../../../lib/onboarding/onboardingRoutes'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { usePreloadIntentIcons } from '../../../hooks/usePreloadIntentIcons'
import { getMascotDisplayName } from '../../../lib/mascot/mascotDisplay'
import { logError, logInfo } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { evaluateProfessionInputQuality, isMeaningfulProfessionInput } from '../../../lib/onboarding/professionInputQuality'
import { sanitizeIndustrySource } from '../../../lib/onboarding/professionSubmissionGuard'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import IntentCard from '../../../components/intent/IntentCard'
import type { IntentCardOption } from '../../../components/intent/IntentCard'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import { ResponsiveSpacer } from '../../../components/ui/ResponsiveSpacer'
import FormStepper from '../../../components/ui/FormStepper'
import BoxJourneySpine from '../../../components/onboarding/BoxJourneySpine'
import { getOnboardingVoiceLine, type OnboardingVoiceStepId } from '@shared/copy/onboardingVoice'
import { ESSENTIAL_DATA_STEP_IDS, type EssentialDataStepId } from './stepIds'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import ProfessionChatOverlay from '../../../components/ProfessionChatOverlay'
import ContentBlockedError from '../../../components/ContentBlockedError'
import type { ProfessionClassificationData } from '../../../components/ProfessionChatOverlay'
import { getArchetypeVisual } from '../personality-test/visuals'
import './index.scss'

// Convert a 6-digit hex accent color to rgba for inline shadows.
// Avoids 8-digit hex alpha, which older WeChat base libraries may not parse.
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const bigint = parseInt(full, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const MAX_INTENTS = 3
const currentYear = new Date().getFullYear()
const BIRTH_YEAR_RANGE = Array.from(
  { length: currentYear - 1970 - 17 },
  (_, index) => currentYear - 18 - index,
)
// Picker wheel opens at ~28 years old instead of the 18-year-old top of the
// range, so the median user scrolls a few rows rather than seventeen.
const DEFAULT_BIRTH_YEAR_INDEX = Math.max(0, BIRTH_YEAR_RANGE.indexOf(currentYear - 28))
// Optional pickers open on a neutral entry so an unscrolled wheel + 确定 can
// never silently record a wrong fact (单身 / 香港) about the user.
const DEFAULT_RELATIONSHIP_INDEX = Math.max(0, RELATIONSHIP_STATUS_OPTIONS.indexOf('不透露'))
const DEFAULT_CITY_INDEX = Math.max(0, CURRENT_CITY_OPTIONS.indexOf('深圳'))

interface StepConfig {
  id: EssentialDataStepId
  title: string
  mascotPose: 'thinking' | 'casual' | 'pointing'
}

// Coach-bubble copy lives in the archetype voice matrix
// (packages/shared/src/copy/onboardingVoice.ts) — Tier A per-archetype
// lines with Tier B step defaults. STEP_CONFIG ids map 1:1 onto
// `essential-${id}` voice step keys (guarded by essentialDataVoiceMap.test).
const STEP_CONFIG: StepConfig[] = [
  {
    id: 'displayName',
    title: '大家怎么称呼你？',
    mascotPose: 'casual',
  },
  {
    id: 'intent',
    title: '这次聚会，你最想……',
    mascotPose: 'casual',
  },
  {
    id: 'aboutYou',
    title: '聊聊你的基本情况',
    mascotPose: 'pointing',
  },
  {
    id: 'professionalProfile',
    title: '你的职业身份',
    mascotPose: 'pointing',
  },
  {
    id: 'location',
    title: '你从哪来，在哪混？',
    mascotPose: 'casual',
  },
]

/**
 * Content-violation field → owning step. Used to jump the wizard back to the
 * step containing the offending field when the server rejects the submit.
 */
const FIELD_TO_STEP_ID: Record<string, EssentialDataStepId> = {
  displayName: 'displayName',
  intent: 'intent',
  gender: 'aboutYou',
  birthYear: 'aboutYou',
  lifeStage: 'aboutYou',
  educationLevel: 'professionalProfile',
  occupationId: 'professionalProfile',
  industryRawInput: 'professionalProfile',
  relationshipStatus: 'professionalProfile',
  currentCity: 'location',
  hometownRegionCity: 'location',
}

const TOTAL_STEPS = STEP_CONFIG.length

const ESSENTIAL_DATA_CACHE_KEY = 'joyjoin_essential_data_progress'

interface CachedProgress {
  // Step is persisted by id (not index) so a mid-onboarding deploy that
  // reorders steps never resumes a user on the wrong screen.
  currentStepId?: EssentialDataStepId
  displayName: string
  gender: string
  birthYear: number
  currentCity: string
  hometownRegionCity: string
  relationshipStatus: string
  educationLevel: string
  occupationId: string
  lifeStage: string
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

const WORK_MODE_TO_LIFE_STAGE: Record<string, string> = {
  founder: '创业中',
  self_employed: '自由职业',
  employed: '职场老手',
  student: '学生党',
}

function getLifeStage(user: Record<string, unknown> | undefined): string {
  if (!user) return ''
  if (typeof user.lifeStage === 'string' && user.lifeStage !== '') {
    return user.lifeStage
  }
  // One-release fallback: existing users with workMode but no lifeStage
  const legacy = typeof user.workMode === 'string' ? user.workMode : ''
  return WORK_MODE_TO_LIFE_STAGE[legacy] || ''
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
  // True only when the displayName value was prefilled from the user's stored
  // WeChat nickname (no typed value, no cache, no server displayName). Drives
  // the "已带入你的微信昵称" hint; cleared the moment the user edits the field.
  const [namePrefilledFromWeChat, setNamePrefilledFromWeChat] = useState(false)
  const hasEditedDisplayNameRef = useRef(false)
  const [gender, setGender] = useState('')
  const [birthYear, setBirthYear] = useState(0)
  const [currentCity, setCurrentCity] = useState('')
  const [hometownRegionCity, setHometownRegionCity] = useState('')
  const [relationshipStatus, setRelationshipStatus] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [professionText, setProfessionText] = useState('')
  const [isProfessionOverlayClosing, setIsProfessionOverlayClosing] = useState(false)
  const [lifeStage, setLifeStage] = useState('')
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

  // Pre-warm bundled intent icons so the onboarding intent grid renders
  // instantly and does not fall back to native emoji in the subpackage.
  usePreloadIntentIcons([...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION], !isLoading)

  const userArchetype = (user?.primaryArchetype as string | undefined) || (user?.archetype as string | undefined) || ''
  const archetypeVisual = userArchetype ? getArchetypeVisual(userArchetype) : null
  const accentColor = archetypeVisual?.accent || ''
  const invalidateAuth = useInvalidateAuth()
  const analytics = useOnboardingAnalytics('essential-data', { enabled: !isLoading })
  const { saveCheckpoint } = useOnboardingCheckpoint()

  // R1-3 funnel: mid-wizard exit (swipe-back / forward nav / app background /
  // unload) without completing fires step_abandoned once per visit; the guard
  // suppresses the post-submit navigation so it never false-positives.
  const { markCompleted: markWizardCompleted } = useStepAbandonGuard(() => {
    if (isLoading) return
    analytics.stepAbandoned('exit', {
      stepId: STEP_CONFIG[currentStep]?.id,
      stepIndex: currentStep,
    })
  })

  // Per-substep enter signal — stepId + stepIndex pair with the per-substep
  // step_completed fired in handleNext.
  useEffect(() => {
    if (isLoading) return
    const stepId = STEP_CONFIG[currentStep]?.id
    if (!stepId) return
    analytics.stepEnter({ stepId, stepIndex: currentStep })
  }, [analytics, currentStep, isLoading])

  // Restore from cache or user data on mount
  useEffect(() => {
    if (isLoading || !user) return

    const cached = readCachedProgress()
    const source = user as unknown as Record<string, unknown>

    // WeChat nickname prefill (R3-8): slots in below the existing priority
    // (typed value → cache → server displayName) as the last default, so the
    // first screen feels half-answered for users whose nickname was captured.
    const cachedDisplayName = cached?.displayName || ''
    const serverDisplayName = typeof source.displayName === 'string' ? source.displayName : ''
    const wechatNickname = typeof source.wechatNickname === 'string' ? source.wechatNickname.trim() : ''
    setDisplayName((c) => c || cachedDisplayName || serverDisplayName || wechatNickname)
    if (wechatNickname !== '' && cachedDisplayName === '' && serverDisplayName === '' && !hasEditedDisplayNameRef.current) {
      setNamePrefilledFromWeChat(true)
    }
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
    setLifeStage((c) => c || cached?.lifeStage || getLifeStage(source))
    setIntent((c) => (c.length > 0 ? c : cached?.intent || (Array.isArray(source.intent) ? source.intent.filter((item): item is string => typeof item === 'string') : [])))
    // Legacy caches stored a numeric step index; those are ignored (fields
    // still restore) so a stale index can never land on the wrong step.
    const cachedStepIndex = cached?.currentStepId ? ESSENTIAL_DATA_STEP_IDS.indexOf(cached.currentStepId) : -1
    setCurrentStep((c) => (c === 0 && cachedStepIndex > 0 ? cachedStepIndex : c))
  }, [user, isLoading])

  // Auto-save to cache on field changes
  useEffect(() => {
    saveCachedProgress({
      currentStepId: STEP_CONFIG[currentStep]?.id,
      displayName,
      gender,
      birthYear,
      currentCity,
      hometownRegionCity,
      relationshipStatus,
      educationLevel,
      occupationId: professionText,
      lifeStage,
      intent,
      timestamp: Date.now(),
    })
  }, [currentStep, displayName, gender, birthYear, currentCity, hometownRegionCity, relationshipStatus, educationLevel, professionText, lifeStage, intent])

  const cityOptions = useMemo(() => [...CURRENT_CITY_OPTIONS], [])
  const relationshipOptions = useMemo(() => [...RELATIONSHIP_STATUS_OPTIONS], [])
  const occupationGuidance = useMemo(() => getOccupationGuidance(intent[0] ?? INTENT_OPTIONS[0].value), [intent])

  const birthYearIndex = birthYear > 0 ? BIRTH_YEAR_RANGE.indexOf(birthYear) : -1
  const currentCityIndex = currentCity ? cityOptions.findIndex((option) => option === currentCity) : -1
  const relationshipIndex = relationshipStatus ? relationshipOptions.findIndex((option) => option === relationshipStatus) : -1
  const intentOptions = useMemo(
    () =>
      [...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION].map((option) => ({
        ...option,
        subtitle: option.subtitle ?? (option as { description?: string }).description,
      })),
    [],
  )

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
        return displayName.trim().length >= 1
      case 1:
        return intent.length > 0
      case 2:
        return gender !== '' && birthYear > 0 && lifeStage !== ''
      case 3:
        return true
      case 4:
        return currentCity !== ''
      default:
        return false
    }
  }, [currentStep, displayName, gender, birthYear, lifeStage, currentCity, intent.length])

  const handleNext = useCallback(() => {
    if (!isStepValid) return
    if (currentStep < TOTAL_STEPS - 1) {
      analytics.stepCompleted({ stepId: stepConfig.id, stepIndex: currentStep, stepNumber: currentStep + 1 })
      haptics('medium')
      setCurrentStep((s) => s + 1)
      setMascotReaction('')
    }
  }, [currentStep, analytics, stepConfig.id, isStepValid])

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
      // Force-skip is a deliberate mid-wizard exit: count it as an abandonment
      // of the current sub-step, then complete the guard so the navigation
      // away doesn't double-fire.
      analytics.stepAbandoned('force_skip', {
        stepId: STEP_CONFIG[currentStep]?.id,
        stepIndex: currentStep,
      })
      markWizardCompleted()
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
  }, [analytics, currentStep, invalidateAuth, markWizardCompleted])

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError('')

    try {
      const professionForSubmit = professionText.trim()
      const shouldSubmitProfession = professionForSubmit !== '' && isMeaningfulProfessionInput(professionForSubmit)
      const payload = {
        displayName: displayName.trim(),
        gender,
        birthYear,
        currentCity,
        ...(hometownRegionCity.trim() !== '' ? { hometownRegionCity: hometownRegionCity.trim() } : {}),
        ...(relationshipStatus ? { relationshipStatus } : {}),
        ...(educationLevel ? { educationLevel } : {}),
        ...(shouldSubmitProfession ? {
          occupationId: professionForSubmit,
          industryRawInput: professionForSubmit,
          ...(professionClassification?.standardizedOccupationId ? { standardizedOccupationId: professionClassification.standardizedOccupationId } : {}),
          ...(professionClassification?.industryCategoryLabel ? { industryCategoryLabel: professionClassification.industryCategoryLabel } : {}),
          ...(professionClassification?.industrySegmentLabel ? { industrySegmentLabel: professionClassification.industrySegmentLabel } : {}),
          ...(professionClassification?.industryNicheLabel ? { industryNicheLabel: professionClassification.industryNicheLabel } : {}),
          ...(professionClassification?.industryCategory ? { industryCategory: professionClassification.industryCategory } : {}),
          ...(professionClassification?.industrySegmentNew ? { industrySegmentNew: professionClassification.industrySegmentNew } : {}),
          ...(professionClassification?.industryNiche ? { industryNiche: professionClassification.industryNiche } : {}),
          ...(professionClassification?.industrySource ? { industrySource: sanitizeIndustrySource(professionClassification.industrySource) } : {}),
          ...(professionClassification?.industryConfidence !== undefined ? { industryConfidence: professionClassification.industryConfidence } : {}),
        } : {}),
        ...(lifeStage ? { lifeStage } : {}),
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
      // Submit succeeded — the onward navigation must not count as abandonment.
      markWizardCompleted()

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
          const targetStepId = FIELD_TO_STEP_ID[field]
          const targetStep = targetStepId ? STEP_CONFIG.findIndex((s) => s.id === targetStepId) : -1
          if (targetStep >= 0 && currentStep !== targetStep) {
            setCurrentStep(targetStep)
          }
          setError('')
        } else {
          setError(fieldMessage)
        }

        analytics.errorOccurred('content_violation', fieldMessage)
        logError('[EssentialData] Content violation', { field, message: fieldMessage })
        return
      }

      const message = err instanceof Error ? err.message : getErrorMessage('submit-failed')
      setError(message)
      analytics.errorOccurred('submit_failed', message)
      logError('[EssentialData] Submit failed', { message })
    } finally {
      setIsSubmitting(false)
    }
  }, [analytics, birthYear, currentCity, displayName, educationLevel, gender, hometownRegionCity, intent, invalidateAuth, isSubmitting, markWizardCompleted, professionText, professionClassification, relationshipStatus, saveCheckpoint, lifeStage, currentStep])

  const handleProfessionSubmit = useCallback((value: string, classification?: ProfessionClassificationData) => {
    const quality = evaluateProfessionInputQuality(value)
    if (!quality.valid) {
      Taro.showToast({ title: '职业身份可以跳过，或写具体一点', icon: 'none', duration: TOAST_DEFAULT_MS })
      setProfessionText('')
      setProfessionClassification(null)
      return
    }
    setProfessionText(quality.normalized)
    if (classification) {
      setProfessionClassification(classification)
    } else {
      setProfessionClassification(null)
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

  const INTENT_REACTIONS: Record<string, string> = useMemo(
    () => ({
      friends: '新朋友 +1，这一局会很有趣。',
      networking: '拓展人脉，悦仔会帮你找能互相增值的圈子。',
      discussion: '想深聊？我会帮你匹配也愿意倾听的人。',
      fun: '开心优先，别想太多。',
      explore: '尝鲜体验，悦仔会帮你挑一个有趣的方向。',
      romance: '这份期待，悦仔会悄悄记在心里。',
      flexible: '交给悦仔安排，放心。',
    }),
    [],
  )

  const toggleIntent = useCallback(
    (value: string) => {
      setIntent((current) => {
        const next = toggleIntentValue(current, value, { maxExplicit: MAX_INTENTS })
        if (next === null) {
          haptics('warning')
          analytics.validationFailed('intent', 'max-selection-reached')
          Taro.showToast({ title: `最多选择 ${MAX_INTENTS} 个期待`, icon: 'none', duration: TOAST_DEFAULT_MS })
          return current
        }

        haptics('light')
        if (next.length < current.length) {
          triggerMascotReaction('好，再调整一下。')
        } else {
          triggerMascotReaction(INTENT_REACTIONS[value] ?? '收到！')
        }
        return next
      })
    },
    [analytics, INTENT_REACTIONS, triggerMascotReaction],
  )

  // Memoize intent grid to prevent re-render on unrelated state changes
  const intentGrid = useMemo(() => {
    const isFlexibleActive = intent.includes(INTENT_FLEXIBLE_OPTION.value)
    const explicitCount = intent.filter((item) => item !== INTENT_FLEXIBLE_OPTION.value).length
    const isCapReached = explicitCount >= MAX_INTENTS
    return (
      <View className='essential-data__intent-grid'>
        {intentOptions.map((option: IntentCardOption) => {
          const isExplicitlySelected = intent.includes(option.value)
          const isFlexibleOption = option.value === INTENT_FLEXIBLE_OPTION.value
          const isDimmed = isFlexibleActive && !isFlexibleOption && !isExplicitlySelected
          const isDisabled = isCapReached && !isExplicitlySelected && !isFlexibleOption

          return (
            <IntentCard
              key={option.value}
              option={option}
              selected={isExplicitlySelected}
              dimmed={isDimmed}
              disabled={isDisabled}
              onClick={() => toggleIntent(option.value)}
              iconSize={144}
              testId={`essential-intent-${option.value}`}
            />
          )
        })}
      </View>
    )
  }, [intentOptions, intent, toggleIntent])

  if (isLoading) {
    return (
      <OnboardingLoadingShell
        stepLabel='装盒中 · 第 1 格'
        title={`${getMascotDisplayName(user)}在整理你的入场名片`}
        subtitle='把这一步铺好后，后面的兴趣热度和资料预览都会顺滑接上。'
      />
    )
  }

  const pageClass = ['essential-data', isPageExiting ? 'essential-data--exiting' : ''].filter(Boolean).join(' ')

  return (
    <View className={pageClass}>
      {/* 装盒进度 spine: the macro journey (Bet 3) — FormStepper below it
          owns the micro steps inside this page. */}
      <BoxJourneySpine
        step={1}
        accentColor={accentColor || undefined}
        className='essential-data__spine'
      />
      <FormStepper
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        stepLabels={STEP_CONFIG.map((s) => s.title)}
        onBack={handleBack}
        showBack={currentStep > 0}
        accentColor={accentColor || undefined}
      />

      <ScrollView className='essential-data__scroll' scrollY enhanced showScrollbar={false}>
        <View className='essential-data__shell'>
          {/* Xiaoyue coaching bubble — narrates as the user's archetype
              (Bet 1 人格在场, Tier A voice matrix with Tier B fallback) */}
          <View className='essential-data__stage essential-data__stage--1'>
            <XiaoyueChatBubble
              content={
                mascotReaction ||
                getOnboardingVoiceLine(
                  `essential-${stepConfig.id}` as OnboardingVoiceStepId,
                  userArchetype,
                )
              }
              pose={stepConfig.mascotPose}
              horizontal
              showGlow
              avatarSize={ONBOARDING_MASCOT_SIZE}
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
                  type='nickname'
                  value={displayName}
                  onInput={(e) => {
                    hasEditedDisplayNameRef.current = true
                    setNamePrefilledFromWeChat(false)
                    setDisplayName(e.detail.value)
                    setContentViolations((prev) => ({ ...prev, displayName: '' }))
                  }}
                  onBlur={(e) => {
                    const v = e.detail.value.trim()
                    if (v !== '' && v.length < 1) analytics.validationFailed('displayName', 'too-short')
                  }}
                  maxlength={20}
                />
                {namePrefilledFromWeChat && (
                  <Text className='essential-data__hint essential-data__hint--prefill'>已带入你的微信昵称，可以改</Text>
                )}
                <Text className='essential-data__hint'>1-20 个字符，会显示在活动和匹配资料里。</Text>
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

          {/* Step 1: Intent */}
          {currentStep === 1 && (
            <Card className='essential-data__card essential-data__stage essential-data__stage--2'>
              <View className='essential-data__field'>
                <Text className='essential-data__label'>这次更想收获什么</Text>
                {intentGrid}
                <Text className='essential-data__hint'>最多可选 {MAX_INTENTS} 个，多选会影响后续活动推荐。</Text>
              </View>
            </Card>
          )}

          {/* Step 2: About you — gender + birth year + life stage */}
          {currentStep === 2 && (
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
                  value={birthYearIndex >= 0 ? birthYearIndex : DEFAULT_BIRTH_YEAR_INDEX}
                  onChange={(e) => {
                    const selectedIndex = Number(e.detail.value)
                    const year = BIRTH_YEAR_RANGE[selectedIndex] ?? 0
                    setBirthYear(year)
                    // P1 polish validation: picker confirmed on the resting
                    // wheel position (opened at the default, never scrolled).
                    if (birthYear === 0 && selectedIndex === DEFAULT_BIRTH_YEAR_INDEX) {
                      analytics.interaction('picker_default_adopted', { field: 'birthYear', value: year })
                    }
                    triggerMascotReaction(`${year}年，正是好年纪！`)
                  }}
                >
                  <View
                    className={['essential-data__picker', birthYear > 0 ? 'essential-data__picker--cta-selected' : 'essential-data__picker--cta'].filter(Boolean).join(' ')}
                    style={birthYear > 0 && accentColor ? { borderColor: accentColor, boxShadow: `0 2rpx 8rpx ${hexToRgba(accentColor, 0.12)}` } : undefined}
                    aria-label={birthYear > 0 ? `出生年份：${birthYear} 年` : '请选择出生年份'}
                  >
                    <Text className={['essential-data__picker-text', birthYear > 0 ? 'essential-data__picker-text--cta-selected' : 'essential-data__picker-text--cta'].filter(Boolean).join(' ')}>
                      {birthYear > 0 ? `${birthYear} 年` : '请选择出生年份'}
                    </Text>
                    {birthYear > 0 && (
                      <View className='essential-data__picker-check' style={accentColor ? { background: accentColor } : undefined}>
                        <JoyJoinIcon emoji='✓' tier='status' size={20} className='essential-data__picker-check-icon' />
                      </View>
                    )}
                  </View>
                </Picker>
              </View>

              <View className='essential-data__field'>
                <Text className='essential-data__label'>
                  人生阶段<Text className='essential-data__required'>*</Text>
                </Text>
                <View className='essential-data__choice-row essential-data__choice-row--life-stage'>
                  {LIFE_STAGE_OPTIONS.map((option) => {
                    const selected = lifeStage === option
                    return (
                      <View
                        key={option}
                        className={['essential-data__choice-chip', selected ? 'essential-data__choice-chip--selected' : ''].filter(Boolean).join(' ')}
                        onClick={() => {
                          setLifeStage(option)
                          const reactions: Record<string, string> = {
                            '学生党': '校园生活多精彩，来认识新朋友吧~',
                            '职场新人': '刚起步的旅程，有很多故事可以分享~',
                            '职场老手': '经验丰富，适合带带新伙伴~',
                            '创业中': '创业路上不孤单，一起碰撞灵感~',
                            '自由职业': '自由节奏，也能有高质量社交~',
                          }
                          triggerMascotReaction(reactions[option] || '了解！')
                        }}
                      >
                        <Text className='essential-data__choice-chip-text'>{option}</Text>
                      </View>
                    )
                  })}
                </View>
                <Text className='essential-data__hint'>相同人生阶段的人更容易聊到一起</Text>
              </View>
            </Card>
          )}

          {/* Step 3: Education + Occupation + Relationship */}
          {currentStep === 3 && (
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
                <Text className='essential-data__label'>{occupationGuidance.title}</Text>
                <View
                  className={[
                    'essential-data__picker',
                    professionText !== '' ? 'essential-data__picker--cta-selected' : 'essential-data__picker--cta',
                  ].filter(Boolean).join(' ')}
                  style={professionText !== '' && accentColor ? { borderColor: accentColor, boxShadow: `0 2rpx 8rpx ${hexToRgba(accentColor, 0.12)}` } : undefined}
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
                      <JoyJoinIcon emoji='✓' tier='status' size={20} className='essential-data__picker-check-icon' />
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
                  value={relationshipIndex >= 0 ? relationshipIndex : DEFAULT_RELATIONSHIP_INDEX}
                  onChange={(e) => {
                    const selectedIndex = Number(e.detail.value)
                    const status = relationshipOptions[selectedIndex] ?? ''
                    setRelationshipStatus(status)
                    if (relationshipStatus === '' && selectedIndex === DEFAULT_RELATIONSHIP_INDEX) {
                      analytics.interaction('picker_default_adopted', { field: 'relationshipStatus', value: status })
                    }
                    const reactions: Record<string, string> = {
                      '单身': '单身贵族！悦仔记住了~',
                      '恋爱中': '甜甜蜜蜜！祝你们幸福~',
                      '已婚/伴侣': '稳定的幸福，很踏实~',
                      '离异': '新的篇章，新的开始~',
                      '丧偶': '感谢你愿意信任我们~',
                      '不透露': '保持神秘感也是一种魅力~',
                    }
                    triggerMascotReaction(reactions[status] || '了解！')
                  }}
                >
                  <View
                    className={['essential-data__picker', relationshipStatus !== '' ? 'essential-data__picker--cta-selected' : 'essential-data__picker--cta'].filter(Boolean).join(' ')}
                    style={relationshipStatus !== '' && accentColor ? { borderColor: accentColor, boxShadow: `0 2rpx 8rpx ${hexToRgba(accentColor, 0.12)}` } : undefined}
                    aria-label={relationshipStatus !== '' ? `关系状态：${relationshipStatus}` : '请选择关系状态'}
                  >
                    <Text className={['essential-data__picker-text', relationshipStatus !== '' ? 'essential-data__picker-text--cta-selected' : 'essential-data__picker-text--cta'].filter(Boolean).join(' ')}>
                      {relationshipStatus || '选填（点击选择）'}
                    </Text>
                    {relationshipStatus !== '' && (
                      <View className='essential-data__picker-check' style={accentColor ? { background: accentColor } : undefined}>
                        <JoyJoinIcon emoji='✓' tier='status' size={20} className='essential-data__picker-check-icon' />
                      </View>
                    )}
                  </View>
                </Picker>
              </View>
            </Card>
          )}

          {/* Step 4: Location */}
          {currentStep === 4 && (
            <Card className='essential-data__card essential-data__stage essential-data__stage--2'>
              <View className='essential-data__field'>
                <Text className='essential-data__label'>
                  现居城市<Text className='essential-data__required'>*</Text>
                </Text>
                <Picker
                  mode='selector'
                  range={cityOptions}
                  value={currentCityIndex >= 0 ? currentCityIndex : DEFAULT_CITY_INDEX}
                  onChange={(e) => {
                    const selectedIndex = Number(e.detail.value)
                    const nextCity = cityOptions[selectedIndex] ?? ''
                    setCurrentCity(nextCity)
                    if (currentCity === '' && selectedIndex === DEFAULT_CITY_INDEX) {
                      analytics.interaction('picker_default_adopted', { field: 'currentCity', value: nextCity })
                    }
                  }}
                >
                  <View
                    className='essential-data__picker'
                    style={currentCity !== '' && accentColor ? { borderColor: accentColor, boxShadow: `0 2rpx 8rpx ${hexToRgba(accentColor, 0.12)}` } : undefined}
                    aria-label={currentCity !== '' ? `现居城市：${currentCity}` : '请选择现居城市'}
                  >
                    <Text className={['essential-data__picker-text', currentCity !== '' ? 'essential-data__picker-text--filled' : ''].filter(Boolean).join(' ')}>
                      {currentCity || '请选择'}
                    </Text>
                    {currentCity !== '' && (
                      <View className='essential-data__picker-check' style={accentColor ? { background: accentColor } : undefined}>
                        <JoyJoinIcon emoji='✓' tier='status' size={20} className='essential-data__picker-check-icon' />
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
