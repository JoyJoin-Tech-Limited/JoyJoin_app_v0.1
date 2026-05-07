import { View, Text, Input, Picker, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CURRENT_CITY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  INTENT_FLEXIBLE_OPTION,
  INTENT_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS,
} from '@shared/constants'
import {
  getHotOccupations,
  getIndustryDisplayLabel,
  getIndustryId,
  getOccupationById,
  getOccupationGuidance,
} from '@shared/occupations'
import { submitEssentialData } from '@shared/api'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../../lib/utils/uiConstants'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useOnboardingCheckpoint } from '../../../hooks/onboarding/useOnboardingCheckpoint'
import { navigateToMiniProgramNextStep } from '../../../lib/onboarding/onboardingNavigation'
import { getMascotDisplayName } from '../../../lib/mascot/mascotDisplay'
import { logError, logInfo } from '../../../lib/utils/logger'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import { ResponsiveSpacer } from '../../../components/ui/ResponsiveSpacer'
import FormStepper from '../../../components/ui/FormStepper'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import { getXiaoyueAsset } from '../personality-test/visuals'
import './index.scss'

const HOT_OCCUPATIONS = getHotOccupations(18)
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
  const [currentStep, setCurrentStep] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState('')
  const [birthYear, setBirthYear] = useState(0)
  const [currentCity, setCurrentCity] = useState('')
  const [hometownRegionCity, setHometownRegionCity] = useState('')
  const [relationshipStatus, setRelationshipStatus] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [occupationId, setOccupationId] = useState('')
  const [intent, setIntent] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [error, setError] = useState('')

  const { user, isLoading } = useAuthGuard({
    suspendOnboardingRedirect: isSubmitting || isPageExiting,
  })
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
    setOccupationId((c) => c || cached?.occupationId || (typeof source.occupationId === 'string' ? source.occupationId : '') || '')
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
      occupationId,
      intent,
      timestamp: Date.now(),
    })
  }, [currentStep, displayName, gender, birthYear, currentCity, hometownRegionCity, relationshipStatus, educationLevel, occupationId, intent])

  const cityOptions = useMemo(() => [...CURRENT_CITY_OPTIONS], [])
  const relationshipOptions = useMemo(() => [...RELATIONSHIP_STATUS_OPTIONS], [])
  const occupationOptions = useMemo(() => {
    const selected = occupationId ? getOccupationById(occupationId) : undefined
    if (selected && !HOT_OCCUPATIONS.some((item) => item.id === selected.id)) {
      return [selected, ...HOT_OCCUPATIONS]
    }
    return HOT_OCCUPATIONS
  }, [occupationId])
  const occupationLabels = useMemo(() => occupationOptions.map((item) => item.displayName), [occupationOptions])
  const selectedOccupation = occupationId ? getOccupationById(occupationId) : undefined
  const industryId = occupationId ? getIndustryId(occupationId) : null
  const industryLabel = occupationId ? getIndustryDisplayLabel(occupationId, '') : ''
  const occupationGuidance = useMemo(() => getOccupationGuidance(intent[0] ?? INTENT_OPTIONS[0].value), [intent])

  const birthYearIndex = birthYear > 0 ? BIRTH_YEAR_RANGE.indexOf(birthYear) : -1
  const currentCityIndex = currentCity ? cityOptions.findIndex((option) => option === currentCity) : -1
  const relationshipIndex = relationshipStatus ? relationshipOptions.findIndex((option) => option === relationshipStatus) : -1
  const occupationIndex = occupationId ? occupationOptions.findIndex((item) => item.id === occupationId) : -1
  const intentOptions = useMemo(() => [...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION], [])

  const stepConfig = STEP_CONFIG[currentStep]

  const isStepValid = useMemo(() => {
    switch (currentStep) {
      case 0:
        return displayName.trim().length >= 2
      case 1:
        return gender !== '' && birthYear > 0
      case 2:
        return true // all optional
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
      setCurrentStep((s) => s + 1)
    }
  }, [isStepValid, currentStep, analytics, stepConfig.id])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }, [currentStep])

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
        ...(occupationId ? { occupationId, ...(industryId ? { industryCategory: industryId } : {}), ...(industryLabel ? { industryCategoryLabel: industryLabel } : {}) } : {}),
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

      await navigateToMiniProgramNextStep(userState.nextStep, {
        mode: 'replace',
        transition: { beforeNavigate: () => setIsPageExiting(true) },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败，请重试'
      setError(message)
      analytics.errorOccurred('submit_failed', message)
      logError('[EssentialData] Submit failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_FATAL_MS })
    } finally {
      setIsSubmitting(false)
    }
  }, [analytics, birthYear, currentCity, displayName, educationLevel, gender, hometownRegionCity, industryId, industryLabel, intent, invalidateAuth, isSubmitting, occupationId, relationshipStatus, saveCheckpoint])

  const toggleIntent = useCallback(
    (value: string) => {
      if (value === INTENT_FLEXIBLE_OPTION.value) {
        setIntent(intent.includes(value) ? [] : [value])
        return
      }
      const next = intent.filter((item) => item !== INTENT_FLEXIBLE_OPTION.value)
      if (next.includes(value)) {
        setIntent(next.filter((item) => item !== value))
        return
      }
      if (next.length >= MAX_INTENTS) {
        analytics.validationFailed('intent', 'max-selection-reached')
        Taro.showToast({ title: `最多选择 ${MAX_INTENTS} 个意图`, icon: 'none', duration: TOAST_DEFAULT_MS })
        return
      }
      setIntent([...next, value])
    },
    [analytics, intent],
  )

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
              content={stepConfig.mascotMessage}
              pose={stepConfig.mascotPose}
              horizontal
              showGlow
            />
          </View>

          {/* Step 1: Display name */}
          {currentStep === 0 && (
            <Card className='essential-data__card essential-data__stage essential-data__stage--2'>
              <View className='essential-data__field'>
                <Text className='essential-data__label'>
                  昵称<Text className='essential-data__required'>*</Text>
                </Text>
                <Input
                  className='essential-data__input'
                  placeholder='大家在活动里会怎么称呼你'
                  value={displayName}
                  onInput={(e) => setDisplayName(e.detail.value)}
                  onBlur={(e) => {
                    const v = e.detail.value.trim()
                    if (v !== '' && v.length < 2) analytics.validationFailed('displayName', 'too-short')
                  }}
                  maxlength={20}
                />
                <Text className='essential-data__hint'>2-20 个字符，会显示在活动和匹配资料里。</Text>
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
                  出生年份<Text className='essential-data__required'>*</Text>
                </Text>
                <Picker
                  mode='selector'
                  range={BIRTH_YEAR_RANGE}
                  value={birthYearIndex >= 0 ? birthYearIndex : 0}
                  onChange={(e) => setBirthYear(BIRTH_YEAR_RANGE[Number(e.detail.value)] ?? 0)}
                >
                  <View className='essential-data__picker'>
                    <Text className={['essential-data__picker-text', birthYear > 0 ? 'essential-data__picker-text--filled' : ''].filter(Boolean).join(' ')}>
                      {birthYear > 0 ? `${birthYear} 年` : '请选择'}
                    </Text>
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
                <Text className='essential-data__label'>{occupationGuidance.title}</Text>
                <Picker
                  mode='selector'
                  range={occupationLabels}
                  value={occupationIndex >= 0 ? occupationIndex : 0}
                  onChange={(e) => {
                    const next = occupationOptions[Number(e.detail.value)]
                    if (next) setOccupationId(next.id)
                  }}
                >
                  <View className='essential-data__picker'>
                    <Text className={['essential-data__picker-text', occupationId !== '' ? 'essential-data__picker-text--filled' : ''].filter(Boolean).join(' ')}>
                      {selectedOccupation?.displayName || '从热门职业里选一个'}
                    </Text>
                  </View>
                </Picker>
                <Text className='essential-data__hint'>
                  {selectedOccupation ? (industryLabel ? `${selectedOccupation.displayName} · ${industryLabel}` : selectedOccupation.displayName) : occupationGuidance.matchPreview}
                </Text>
              </View>

              <View className='essential-data__field'>
                <Text className='essential-data__label'>关系状态</Text>
                <Picker
                  mode='selector'
                  range={relationshipOptions}
                  value={relationshipIndex >= 0 ? relationshipIndex : 0}
                  onChange={(e) => setRelationshipStatus(relationshipOptions[Number(e.detail.value)] ?? '')}
                >
                  <View className='essential-data__picker'>
                    <Text className={['essential-data__picker-text', relationshipStatus !== '' ? 'essential-data__picker-text--filled' : ''].filter(Boolean).join(' ')}>
                      {relationshipStatus || '选填'}
                    </Text>
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
                  <View className='essential-data__picker'>
                    <Text className={['essential-data__picker-text', currentCity !== '' ? 'essential-data__picker-text--filled' : ''].filter(Boolean).join(' ')}>
                      {currentCity || '请选择'}
                    </Text>
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
                <View className='essential-data__intent-grid'>
                  {intentOptions.map((option) => {
                    const selected = intent.includes(option.value)
                    return (
                      <View
                        key={option.value}
                        className={['essential-data__intent-card', selected ? 'essential-data__intent-card--selected' : ''].filter(Boolean).join(' ')}
                        onClick={() => toggleIntent(option.value)}
                      >
                        <Text className='essential-data__intent-label'>{option.label}</Text>
                        <Text className='essential-data__intent-subtitle'>{option.subtitle}</Text>
                        {selected && (
                          <View className='essential-data__intent-check'>
                            <Text className='essential-data__intent-check-icon'>✓</Text>
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
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
    </View>
  )
}
