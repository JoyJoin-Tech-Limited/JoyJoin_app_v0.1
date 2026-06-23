import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { View, Text, Input, ScrollView, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  getUserInterests,
  submitEssentialData,
  submitInterests,
  type InterestSelectionLevel,
} from '@shared/api'
import {
  EDUCATION_LEVEL_OPTIONS,
  INTENT_OPTIONS,
  INTENT_FLEXIBLE_OPTION,
  toggleIntentValue,
} from '@shared/constants'
import {
  getActiveInterests,
  MACRO_CATEGORY_LABELS,
  type MacroCategory,
} from '@shared/interests'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { apiRequest } from '../../../lib/api/api'
import { useAuth, useInvalidateAuth } from '../../../hooks/useAuth'
import { useMiniPageGate } from '../../../hooks/navigation/useMiniPageGate'
import { logInfo, logError } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { usePageTTI } from '../../../hooks/usePageTTI'
import { profileAnalytics } from '../../../lib/analytics/profileAnalytics'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'

import ProfileArchetypeHero from '../../../components/profile/ProfileArchetypeHero'
import ProfessionDisplayField from '../../../components/profile/ProfessionDisplayField'
import ProfessionChatOverlay from '../../../components/ProfessionChatOverlay'
import XiaoyueChatBubble from '../../../components/mascot/XiaoyueChatBubble'
import Chip from '../../../components/ui/Chip'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import ContentBlockedError from '../../../components/ContentBlockedError'
import { isEditProfileSaveDisabled } from './saveButtonLogic'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: '男性', label: '男' },
  { value: '女性', label: '女' },
  { value: '不透露', label: '其他' },
] as const

const CURRENT_YEAR = new Date().getFullYear()
const BIRTH_YEAR_RANGE = Array.from(
  { length: CURRENT_YEAR - 1950 - 17 },
  (_, i) => String(CURRENT_YEAR - 18 - i),
)

const MAX_INTENTS = 3
const INTEREST_LEVEL_META: Array<{
  level: InterestSelectionLevel
  label: string
  shortLabel: string
}> = [
  { level: 1, label: '想试试', shortLabel: '已加入' },
  { level: 2, label: '很喜欢', shortLabel: '偏爱' },
  { level: 3, label: '本命', shortLabel: '重点' },
]

const activeInterests = getActiveInterests()

function getInterestsByCategory(): Record<MacroCategory, typeof activeInterests> {
  const grouped: Partial<Record<MacroCategory, typeof activeInterests>> = {}
  for (const interest of activeInterests) {
    const cat = interest.macroCategory as MacroCategory
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat]!.push(interest)
  }
  return grouped as Record<MacroCategory, typeof activeInterests>
}

const interestsByCategory = getInterestsByCategory()

function getInterestLevelMeta(level: InterestSelectionLevel | undefined) {
  return INTEREST_LEVEL_META.find((item) => item.level === level)
}

function normalizeGenderValue(value: unknown): string {
  switch (value) {
    case '男性':
    case 'male':
      return '男性'
    case '女性':
    case 'female':
      return '女性'
    case '不透露':
    case 'other':
      return '不透露'
    default:
      return typeof value === 'string' ? value : ''
  }
}

// ─── Component ────────────────────────────────────────────────────

export default function EditProfilePage() {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const { authLoading, renderGate } = useMiniPageGate()
  const { user } = useAuth()
  const invalidateAuth = useInvalidateAuth()
  const redesignEnabled = user?.features?.profileRedesignEnabled ?? true
  const didSaveRef = useRef(false)
  const enterTimeRef = useRef(Date.now())

  // Basic info
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState('')
  const [birthYear, setBirthYear] = useState(0)
  const [currentCity, setCurrentCity] = useState('')
  const [hometownRegionCity, setHometownRegionCity] = useState('')
  const [educationLevel, setEducationLevel] = useState('')

  // Social profile
  const [professionText, setProfessionText] = useState('')
  const [bio, setBio] = useState('')
  const [originalBio, setOriginalBio] = useState('')
  const [professionClassification, setProfessionClassification] = useState<import('../../../components/ProfessionChatOverlay').ProfessionClassificationData | null>(null)
  const [showProfessionOverlay, setShowProfessionOverlay] = useState(false)
  const [isProfessionOverlayClosing, setIsProfessionOverlayClosing] = useState(false)
  const [intent, setIntent] = useState<string[]>([])

  // Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [interestLevels, setInterestLevels] = useState<Record<string, InterestSelectionLevel>>({})

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [, setIsPageExiting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [contentViolations, setContentViolations] = useState<Record<string, string>>({})
  const [changedFields, setChangedFields] = useState<Record<string, boolean>>({})
  const hasChanges = Object.values(changedFields).some(Boolean)
  const [isInitializing, setIsInitializing] = useState(true)
  const [scrollIntoViewId, setScrollIntoViewId] = useState('')

  useResetOnShow(setIsPageExiting, setIsSaving)

  // Mark initializing complete once user data is hydrated
  useEffect(() => {
    if (user && !authLoading) {
      const timer = setTimeout(() => setIsInitializing(false), 200)
      return () => clearTimeout(timer)
    }
  }, [user, authLoading])

  usePageTTI({ pageName: 'edit-profile', ready: !authLoading && !isInitializing })

  // Analytics: enter
  useEffect(() => {
    enterTimeRef.current = Date.now()
    logInfo('[EditProfile] Enter', { userId: user?.id })
  }, [user?.id])

  // Analytics: abandon
  useEffect(() => {
    return () => {
      if (!didSaveRef.current) {
        const secondsOnPage = Math.round((Date.now() - enterTimeRef.current) / 1000)
        logInfo('[EditProfile] Abandon', { secondsOnPage })
      }
    }
  }, [])

  // Unsaved changes guard
  useEffect(() => {
    if (!hasChanges) return
    Taro.enableAlertBeforeUnload({ message: '资料尚未保存，确定要退出吗？' })
    return () => {
      Taro.disableAlertBeforeUnload()
    }
  }, [hasChanges])

  // Initialize form from user data
  useEffect(() => {
    if (!user) return
    const u = user as Record<string, any>
    setDisplayName(u.displayName || u.nickname || '')
    setGender(normalizeGenderValue(u.gender))

    let resolvedBirthYear = 0
    if (typeof u.birthYear === 'number' && u.birthYear > 0) {
      resolvedBirthYear = u.birthYear
    } else if (typeof u.birthdate === 'string' && u.birthdate.trim() !== '') {
      const parsed = new Date(u.birthdate).getFullYear()
      if (Number.isFinite(parsed)) resolvedBirthYear = parsed
    }
    setBirthYear(resolvedBirthYear)

    setCurrentCity(u.currentCity || '')
    setHometownRegionCity(u.hometownRegionCity || '')
    setEducationLevel(typeof u.educationLevel === 'string' ? u.educationLevel : '')
    setProfessionText(typeof u.occupationId === 'string' ? u.occupationId : '')
    const initialBio = typeof u.bio === 'string' ? u.bio : ''
    setBio(initialBio)
    setOriginalBio(initialBio)
    setProfessionClassification({
      occupationId: typeof u.occupationId === 'string' ? u.occupationId : '',
      standardizedOccupationId: typeof u.standardizedOccupationId === 'string' ? u.standardizedOccupationId : null,
      industryCategoryLabel: typeof u.industryCategoryLabel === 'string' ? u.industryCategoryLabel : null,
      industrySegmentLabel: typeof u.industrySegmentLabel === 'string' ? u.industrySegmentLabel : null,
      industryNicheLabel: typeof u.industryNicheLabel === 'string' ? u.industryNicheLabel : null,
      industryCategory: typeof u.industryCategory === 'string' ? u.industryCategory : null,
      industrySegmentNew: typeof u.industrySegmentNew === 'string' ? u.industrySegmentNew : null,
      industryNiche: typeof u.industryNiche === 'string' ? u.industryNiche : null,
      industrySource: typeof u.industrySource === 'string' ? u.industrySource : 'user',
      industryConfidence: typeof u.industryConfidence === 'number' ? u.industryConfidence : 0,
    })
    setIntent(Array.isArray(u.intent) ? u.intent.filter((item: unknown): item is string => typeof item === 'string') : [])

    const interests: string[] = Array.isArray(u.interests)
      ? u.interests.map((i: any) => (typeof i === 'string' ? i : i.id || i.interestId || ''))
      : []
    setSelectedInterests((current) => (current.length > 0 ? current : interests.filter(Boolean)))
  }, [user])

  // Load structured interests with retry and offline resilience.
  const {
    isLoading: isLoadingInterests,
    error: interestsError,
  } = useQuery({
    queryKey: ['mini-program', 'user-interests', user?.id],
    queryFn: async () => {
      const interestProfile = await getUserInterests(apiRequest)
      if (!Array.isArray(interestProfile?.selections)) return null
      const levels = interestProfile.selections.reduce<Record<string, InterestSelectionLevel>>(
        (acc, selection) => {
          if (typeof selection?.topicId !== 'string' || selection.topicId.trim() === '') return acc
          acc[selection.topicId] = selection.level === 2 || selection.level === 3 ? selection.level : 1
          return acc
        },
        {},
      )
      setSelectedInterests(Object.keys(levels))
      setInterestLevels(levels)
      return interestProfile
    },
    enabled: !authLoading && !!user?.hasCompletedInterestsCarousel,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : undefined
      // 404 means the user hasn't saved interests yet; don't retry.
      if (statusCode === 404) return false
      return failureCount < 3
    },
    networkMode: 'offlineFirst',
  })

  useEffect(() => {
    if (!interestsError) return
    const statusCode = typeof interestsError === 'object' && interestsError !== null && 'statusCode' in interestsError
      ? Number((interestsError as { statusCode?: unknown }).statusCode)
      : undefined
    if (statusCode !== 404) {
      logError('[EditProfile] Failed to load structured interests', {
        statusCode,
        message: interestsError instanceof Error ? interestsError.message : 'Unknown',
      })
    }
  }, [interestsError])

  // ─── Handlers ─────────────────────────────────────────────────────

  const toggleInterest = useCallback((interestId: string) => {
    haptics('light')
    const currentLevel = interestLevels[interestId]
    if (!currentLevel) {
      setSelectedInterests([...selectedInterests, interestId])
      setInterestLevels({ ...interestLevels, [interestId]: 1 })
      setChangedFields((prev) => ({ ...prev, interests: true }))
      return
    }
    if (currentLevel === 1) {
      setInterestLevels({ ...interestLevels, [interestId]: 2 })
      setChangedFields((prev) => ({ ...prev, interests: true }))
      return
    }
    if (currentLevel === 2) {
      setInterestLevels({ ...interestLevels, [interestId]: 3 })
      setChangedFields((prev) => ({ ...prev, interests: true }))
      return
    }
    setSelectedInterests(selectedInterests.filter((id) => id !== interestId))
    const nextLevels = { ...interestLevels }
    delete nextLevels[interestId]
    setInterestLevels(nextLevels)
    setChangedFields((prev) => ({ ...prev, interests: true }))
  }, [interestLevels, selectedInterests])

  const toggleIntent = useCallback((value: string) => {
    let didChange = false
    setIntent((current) => {
      const next = toggleIntentValue(current, value, { maxExplicit: MAX_INTENTS })
      if (next === null) {
        haptics('warning')
        Taro.showToast({ title: `最多选择 ${MAX_INTENTS} 个期待`, icon: 'none', duration: 2000 })
        return current
      }
      haptics('light')
      didChange = true
      return next
    })
    if (didChange) {
      setChangedFields((prev) => ({ ...prev, intent: true }))
    }
  }, [])

  const handleBirthYearChange = useCallback((e: any) => {
    const idx = e.detail.value as number
    const year = parseInt(BIRTH_YEAR_RANGE[idx], 10)
    if (!Number.isNaN(year)) {
      setBirthYear(year)
      setChangedFields((prev) => ({ ...prev, birthYear: true }))
      setFieldErrors((prev) => ({ ...prev, birthYear: '' }))
    }
  }, [])

  const handleProfessionSubmit = useCallback((value: string, classification?: import('../../../components/ProfessionChatOverlay').ProfessionClassificationData) => {
    haptics('success')
    setProfessionText(value)
    if (classification) setProfessionClassification(classification)
    setIsProfessionOverlayClosing(true)
    setChangedFields((prev) => ({ ...prev, profession: true }))
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

  const handleSave = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    setIsPageExiting(true)

    try {
      logInfo('[EditProfile] Saving profile changes')

      // Validation with field errors + scroll-to-error
      const errors: Record<string, string> = {}
      if (!displayName.trim() || displayName.trim().length < 1) {
        errors.displayName = '昵称至少需要 1 个字符'
      }
      if (!gender) {
        errors.gender = '请选择性别'
      }
      if (!birthYear) {
        errors.birthYear = '请选择出生年份'
      }
      if (!currentCity.trim()) {
        errors.currentCity = '请填写所在城市'
      }
      const trimmedBio = redesignEnabled ? bio.trim() : ''
      if (redesignEnabled && trimmedBio.length > 100) {
        errors.bio = '一句话介绍不能超过 100 个字符'
      }

      if (Object.keys(errors).length > 0) {
        haptics('warning')
        setFieldErrors(errors)
        setIsPageExiting(false)
        setIsSaving(false)
        // Scroll to first error via scrollIntoView
        const firstErrorField = Object.keys(errors)[0]
        setScrollIntoViewId(`field-${firstErrorField}`)
        setTimeout(() => setScrollIntoViewId(''), 500)
        return
      }

      setFieldErrors({})

      const payload: Record<string, unknown> = {
        displayName: displayName.trim(),
        gender,
        birthYear,
        currentCity: currentCity.trim(),
        ...(redesignEnabled ? { bio: trimmedBio } : {}),
        ...(hometownRegionCity.trim() ? { hometownRegionCity: hometownRegionCity.trim() } : {}),
        ...(educationLevel ? { educationLevel } : {}),
        ...(intent.length > 0 ? { intent } : {}),
      }

      if (professionText.trim() !== '') {
        payload.occupationId = professionText.trim()
        payload.industryRawInput = professionText.trim()
        if (professionClassification?.standardizedOccupationId) {
          payload.standardizedOccupationId = professionClassification.standardizedOccupationId
        }
        if (professionClassification?.industryCategoryLabel) {
          payload.industryCategoryLabel = professionClassification.industryCategoryLabel
        }
        if (professionClassification?.industrySegmentLabel) {
          payload.industrySegmentLabel = professionClassification.industrySegmentLabel
        }
        if (professionClassification?.industryNicheLabel) {
          payload.industryNicheLabel = professionClassification.industryNicheLabel
        }
        if (professionClassification?.industryCategory) {
          payload.industryCategory = professionClassification.industryCategory
        }
        if (professionClassification?.industrySegmentNew) {
          payload.industrySegmentNew = professionClassification.industrySegmentNew
        }
        if (professionClassification?.industryNiche) {
          payload.industryNiche = professionClassification.industryNiche
        }
        if (professionClassification?.industrySource) {
          payload.industrySource = professionClassification.industrySource
        }
        if (professionClassification?.industryConfidence !== undefined) {
          payload.industryConfidence = professionClassification.industryConfidence
        }
      }

      const fieldsChanged = Object.entries(payload).filter(([, v]) => v !== undefined && v !== '').length
      await submitEssentialData(apiRequest, payload as Parameters<typeof submitEssentialData>[1])

      if (selectedInterests.length > 0) {
        await submitInterests(apiRequest, {
          interests: selectedInterests.map((topicId) => ({
            topicId,
            level: interestLevels[topicId] ?? 1,
          })),
        })
      }

      invalidateAuth()
      didSaveRef.current = true
      setChangedFields({})
      haptics('success')
      logInfo('[EditProfile] Save success', { fieldsChanged })

      Taro.showToast({ title: '保存成功', icon: 'success', duration: 2000 })
      setTimeout(() => {
        Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/profile/index' }) })
      }, 1000)
    } catch (err) {
      setIsPageExiting(false)

      // Check for content violation (server 敏感词过滤)
      const errorData = (err as Record<string, unknown>)?.data as Record<string, unknown> | undefined
      if (errorData?.code === 'CONTENT_VIOLATION') {
        const violation = errorData?.violation as Record<string, unknown> | undefined
        const field = (violation?.field as string) || ''
        const fieldMessage = (violation?.message as string) || (err instanceof Error ? err.message : getErrorMessage('save-failed'))

        if (field) {
          setContentViolations((prev) => ({ ...prev, [field]: fieldMessage }))
          setScrollIntoViewId(`field-${field}`)
          setTimeout(() => setScrollIntoViewId(''), 500)
        } else {
          Taro.showToast({ title: fieldMessage, icon: 'none', duration: 3000 })
        }
        logError('[EditProfile] Content violation', { field, message: fieldMessage })
        return
      }

      const msg = err instanceof Error ? err.message : getErrorMessage('save-failed')
      logError('[EditProfile] Save failed', { message: msg })
      Taro.showToast({ title: msg, icon: 'none', duration: 3000 })
    } finally {
      setIsSaving(false)
    }
  }, [
    isSaving,
    displayName,
    gender,
    birthYear,
    currentCity,
    hometownRegionCity,
    educationLevel,
    professionText,
    professionClassification,
    intent,
    selectedInterests,
    interestLevels,
    invalidateAuth,
    bio,
    redesignEnabled,
  ])

  const birthYearIndex = birthYear ? BIRTH_YEAR_RANGE.indexOf(String(birthYear)) : -1
  const previewName = displayName || user?.nickname || user?.displayName || '悦聚用户'
  const previewArchetype = user?.archetype
  const previewAge =
    user?.age != null && !Number.isNaN(Number(user.age)) && Number(user.age) > 0
      ? Number(user.age)
      : birthYear
        ? CURRENT_YEAR - birthYear
        : null
  const previewBio = redesignEnabled ? bio.trim() || null : null

  const intentOptions = useMemo(() => [...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION], [])

  const isSaveDisabled = isEditProfileSaveDisabled({
    isSaving,
    displayName,
    gender,
    birthYear,
    currentCity,
    bio,
    originalBio,
    hasChanges,
    redesignEnabled,
  })

  // ─── Render ───────────────────────────────────────────────────────

  return renderGate(
    <View className='edit-profile'>
      {isInitializing ? (
        <View className='edit-profile__skeleton'>
          <View className='edit-profile__skeleton-block edit-profile__skeleton-block--hero' />
          <View className='edit-profile__skeleton-block edit-profile__skeleton-block--title' />
          <View className='edit-profile__skeleton-block edit-profile__skeleton-block--card' />
          <View className='edit-profile__skeleton-block edit-profile__skeleton-block--card' />
          <View className='edit-profile__skeleton-block edit-profile__skeleton-block--card' />
        </View>
      ) : (
        <>
      <ScrollView className='edit-profile__scroll' scrollY enhanced showScrollbar={false} scrollIntoView={scrollIntoViewId || undefined}>
        {/* Xiaoyue Coach */}
        <XiaoyueChatBubble
          content='来看看你的资料吧，随时更新让匹配更准哦～'
          pose='casual'
          horizontal
          showGlow
          tail
          className='edit-profile__coach'
        />

        {/* Live Preview */}
        <ProfileArchetypeHero
          archetype={previewArchetype}
          displayName={previewName}
          age={previewAge}
          city={currentCity.trim() || null}
          bio={previewBio}
          size='sm'
          className='edit-profile__preview'
        />

        {/* ── Step 1: 基础档案 ── */}
        <View className='edit-profile__section'>
          <View className='edit-profile__section-header'>
            <Text className='edit-profile__section-title'>基础档案</Text>
            <Text className='edit-profile__section-subtitle'>确认你的基本信息</Text>
          </View>

          <Card className='edit-profile__card'>
            {/* Display name */}
            <View className='edit-profile__field' id='field-displayName' data-field='displayName'>
              <Text className='edit-profile__label'>昵称</Text>
              <Input
                className={`edit-profile__input ${fieldErrors.displayName ? 'edit-profile__input--error' : ''}`}
                value={displayName}
                onInput={(e) => {
                  setDisplayName(e.detail.value)
                  setChangedFields((prev) => ({ ...prev, displayName: true }))
                  setFieldErrors((prev) => ({ ...prev, displayName: '' }))
                  setContentViolations((prev) => ({ ...prev, displayName: '' }))
                }}
                placeholder='输入你的昵称'
                maxlength={20}
              />
              {fieldErrors.displayName && (
                <Text className='edit-profile__field-error'>{fieldErrors.displayName}</Text>
              )}
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

            {/* Gender */}
            <View className='edit-profile__field' id='field-gender' data-field='gender'>
              <Text className='edit-profile__label'>性别</Text>
              <View className='edit-profile__radio-group'>
                {GENDER_OPTIONS.map((opt) => (
                  <View
                    key={opt.value}
                    className={`edit-profile__radio ${gender === opt.value ? 'edit-profile__radio--active' : ''}`}
                    onClick={() => {
                      setGender(opt.value)
                      setChangedFields((prev) => ({ ...prev, gender: true }))
                      setFieldErrors((prev) => ({ ...prev, gender: '' }))
                    }}
                  >
                    <Text>{opt.label}</Text>
                  </View>
                ))}
              </View>
              {fieldErrors.gender && (
                <Text className='edit-profile__field-error'>{fieldErrors.gender}</Text>
              )}
            </View>

            {/* Birth year */}
            <View className='edit-profile__field' id='field-birthYear' data-field='birthYear'>
              <Text className='edit-profile__label'>出生年份</Text>
              <Picker
                mode='selector'
                range={BIRTH_YEAR_RANGE}
                value={birthYearIndex >= 0 ? birthYearIndex : 0}
                onChange={handleBirthYearChange}
              >
                <Text className={`edit-profile__picker-value ${fieldErrors.birthYear ? 'edit-profile__picker-value--error' : ''}`}>
                  {birthYear ? `${birthYear} 年` : '选择年份'}
                </Text>
              </Picker>
              {fieldErrors.birthYear && (
                <Text className='edit-profile__field-error'>{fieldErrors.birthYear}</Text>
              )}
            </View>

            {/* Current city */}
            <View className='edit-profile__field' id='field-currentCity' data-field='currentCity'>
              <Text className='edit-profile__label'>所在城市</Text>
              <Input
                className={`edit-profile__input ${fieldErrors.currentCity ? 'edit-profile__input--error' : ''}`}
                value={currentCity}
                onInput={(e) => {
                  setCurrentCity(e.detail.value)
                  setChangedFields((prev) => ({ ...prev, currentCity: true }))
                  setFieldErrors((prev) => ({ ...prev, currentCity: '' }))
                  setContentViolations((prev) => ({ ...prev, currentCity: '' }))
                }}
                placeholder='如：深圳'
                maxlength={30}
              />
              {fieldErrors.currentCity && (
                <Text className='edit-profile__field-error'>{fieldErrors.currentCity}</Text>
              )}
              <ContentBlockedError
                message={contentViolations.currentCity || ''}
                visible={!!contentViolations.currentCity}
                fieldName='currentCity'
                onDismiss={() => setContentViolations((prev) => {
                  const next = { ...prev }
                  delete next.currentCity
                  return next
                })}
              />
            </View>

            {redesignEnabled && (
              <View className='edit-profile__field' id='field-bio' data-field='bio'>
                <Text className='edit-profile__label'>
                  一句话介绍
                  <Text className='edit-profile__bio-counter'>{bio.length}/100</Text>
                </Text>
                <Input
                  className={`edit-profile__input ${fieldErrors.bio ? 'edit-profile__input--error' : ''}`}
                  value={bio}
                  onInput={(e) => {
                    const newBio = e.detail.value
                    setBio(newBio)
                    setChangedFields((prev) => ({ ...prev, bio: newBio.trim() !== originalBio.trim() }))
                    setFieldErrors((prev) => ({ ...prev, bio: '' }))
                    setContentViolations((prev) => ({ ...prev, bio: '' }))
                  }}
                  onFocus={() => {
                    profileAnalytics.track('profile_edit_tap', { field: 'bio' })
                  }}
                  placeholder='输入你的社交签名'
                  maxlength={100}
                />
                {fieldErrors.bio && (
                  <Text className='edit-profile__field-error'>{fieldErrors.bio}</Text>
                )}
                <ContentBlockedError
                  message={contentViolations.bio || ''}
                  visible={!!contentViolations.bio}
                  fieldName='bio'
                  onDismiss={() => setContentViolations((prev) => {
                    const next = { ...prev }
                    delete next.bio
                    return next
                  })}
                />
              </View>
            )}

            {/* Hometown }}
            <View className='edit-profile__field'>
              <Text className='edit-profile__label'>家乡</Text>
              <Input
                className='edit-profile__input'
                value={hometownRegionCity}
                onInput={(e) => {
                  setHometownRegionCity(e.detail.value)
                  setChangedFields((prev) => ({ ...prev, hometown: true }))
                }}
                placeholder='如：广州'
                maxlength={30}
              />
            </View>

            {/* Education */}
            <View className='edit-profile__field'>
              <Text className='edit-profile__label'>学历</Text>
              <View className='edit-profile__choice-row edit-profile__choice-row--wrap'>
                {EDUCATION_LEVEL_OPTIONS.map((option) => {
                  const selected = educationLevel === option
                  return (
                    <View
                      key={option}
                      className={[
                        'edit-profile__choice-chip',
                        selected ? 'edit-profile__choice-chip--selected' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        setEducationLevel(selected ? '' : option)
                        setChangedFields((prev) => ({ ...prev, education: true }))
                      }}
                    >
                      <Text className='edit-profile__choice-chip-text'>{option}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          </Card>
        </View>

        {/* ── Step 2: 社交画像 ── */}
        <View className='edit-profile__section'>
          <View className='edit-profile__section-header'>
            <Text className='edit-profile__section-title'>社交画像</Text>
            <Text className='edit-profile__section-subtitle'>定义你的社交身份</Text>
          </View>

          <Card className='edit-profile__card'>
            {/* Profession */}
            <View className='edit-profile__field'>
              <Text className='edit-profile__label'>职业身份</Text>
              <ProfessionDisplayField
                rawValue={professionText}
                classification={professionClassification}
                onEdit={() => setShowProfessionOverlay(true)}
              />
            </View>

            {/* Intent */}
            <View className='edit-profile__field'>
              <Text className='edit-profile__label'>
                社交期待
                <Text className='edit-profile__intent-count'>（{intent.length} 已选，最多 {MAX_INTENTS}）</Text>
              </Text>
              <View className='edit-profile__intent-grid'>
                {(() => {
                  const isFlexibleActive = intent.includes(INTENT_FLEXIBLE_OPTION.value)
                  const explicitCount = intent.filter((item) => item !== INTENT_FLEXIBLE_OPTION.value).length
                  const isCapReached = explicitCount >= MAX_INTENTS
                  return intentOptions.map((option: typeof intentOptions[number]) => {
                    const isSelected = intent.includes(option.value)
                    const isFlexibleOption = option.value === INTENT_FLEXIBLE_OPTION.value
                    const isDimmed = isFlexibleActive && !isFlexibleOption && !isSelected
                    const isDisabled = isCapReached && !isSelected && !isFlexibleOption
                    return (
                      <View
                        key={option.value}
                        className={[
                          'edit-profile__intent-card',
                          isSelected ? 'edit-profile__intent-card--selected' : '',
                          isDimmed ? 'edit-profile__intent-card--dimmed' : '',
                          isDisabled ? 'edit-profile__intent-card--disabled' : '',
                        ].filter(Boolean).join(' ')}
                        hoverClass={isDisabled ? '' : 'edit-profile__intent-card--hover'}
                        onClick={() => !isDisabled && toggleIntent(option.value)}
                        role='button'
                        aria-pressed={isSelected}
                        aria-disabled={isDisabled}
                        aria-label={`${option.label}${option.subtitle ? `：${option.subtitle}` : ''}${isDisabled ? '（已达上限）' : ''}`}
                      >
                        {option.emoji != null ? (
                          <JoyJoinIcon emoji={option.emoji} tier='intent' size={36} className='edit-profile__intent-icon' />
                        ) : null}
                        <View className='edit-profile__intent-text'>
                          <Text className='edit-profile__intent-label'>{option.label}</Text>
                          <Text className='edit-profile__intent-subtitle'>{option.subtitle}</Text>
                        </View>
                        {isSelected && (
                          <View className='edit-profile__intent-check'>
                            <View className='edit-profile__intent-check-icon' />
                          </View>
                        )}
                      </View>
                    )
                  })
                })()}
              </View>
            </View>
          </Card>

          {/* Interests */}
          <View className='edit-profile__interest-section'>
            <Text className='edit-profile__section-title'>
              兴趣爱好
              <Text className='edit-profile__interest-count'>（{selectedInterests.length} 已选）</Text>
            </Text>

            {isLoadingInterests ? (
              <Text className='edit-profile__interest-hint'>加载兴趣数据中…</Text>
            ) : (
              <Text className='edit-profile__interest-hint'>轻点标签选择，再点一次提升热度</Text>
            )}

            {(Object.entries(interestsByCategory) as [MacroCategory, typeof activeInterests][]).map(
              ([category, interests]) => (
                <View key={category} className='edit-profile__interest-group'>
                  <Text className='edit-profile__interest-category'>
                    {MACRO_CATEGORY_LABELS[category] || category}
                  </Text>
                  <View className={`edit-profile__interest-tags ${isLoadingInterests ? 'edit-profile__interest-tags--loading' : ''}`}>
                    {interests.map((interest) => {
                      const level = interestLevels[interest.id]
                      const isSelected = selectedInterests.includes(interest.id)
                      const meta = getInterestLevelMeta(level)
                      return (
                        <Chip
                          key={interest.id}
                          label={interest.label}
                          meta={isSelected ? meta?.shortLabel : undefined}
                          selected={isSelected}
                          level={level}
                          disabled={isLoadingInterests}
                          onClick={() => toggleInterest(interest.id)}
                        />
                      )
                    })}
                  </View>
                </View>
              ),
            )}
          </View>
        </View>

        {/* Spacer for floating action bar */}
        <View className='edit-profile__spacer' />
      </ScrollView>

      {/* Floating bottom action bar */}
      <View className='edit-profile__action-bar'>
        <Button
          variant='primary'
          className='edit-profile__save-btn'
          onClick={handleSave}
          disabled={isSaveDisabled}
          loading={isSaving}
        >
          {isSaving ? '保存中…' : '保存修改'}
        </Button>
      </View>

      {/* Profession overlay */}
      {showProfessionOverlay && (
        <ProfessionChatOverlay
          visible={showProfessionOverlay}
          isClosing={isProfessionOverlayClosing}
          initialValue={professionText}
          userArchetype={(user?.primaryArchetype ?? user?.archetype) || undefined}
          onSubmit={handleProfessionSubmit}
          onSkip={handleProfessionSkip}
        />
      )}
        </>
      )}
    </View>,
  )
}
