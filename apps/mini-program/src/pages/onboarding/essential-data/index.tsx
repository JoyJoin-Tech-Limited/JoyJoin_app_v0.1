import { View, Text, Input, Picker, ScrollView, Image } from '@tarojs/components'
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
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api'
import { useOnboardingAnalytics } from '../../../hooks/useOnboardingAnalytics'
import { useOnboardingCheckpoint } from '../../../hooks/useOnboardingCheckpoint'
import { navigateToMiniProgramNextStep } from '../../../lib/onboardingNavigation'
import { logError, logInfo } from '../../../lib/logger'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import OnboardingLoadingShell from '../../../components/OnboardingLoadingShell'
import { ResponsiveSpacer } from '../../../components/ResponsiveSpacer'
import { getXiaoyueAsset } from '../personality-test/visuals'
import './index.scss'

const HOT_OCCUPATIONS = getHotOccupations(18)
const MAX_INTENTS = 3
const currentYear = new Date().getFullYear()
const BIRTH_YEAR_RANGE = Array.from(
  { length: currentYear - 1970 - 17 },
  (_, index) => currentYear - 18 - index,
)

function getBirthYear(user: Record<string, unknown> | undefined): number {
  if (!user) {
    return 0
  }

  const rawBirthYear = user.birthYear
  if (typeof rawBirthYear === 'number' && Number.isFinite(rawBirthYear)) {
    return rawBirthYear
  }

  if (typeof rawBirthYear === 'string' && rawBirthYear.trim() !== '') {
    const parsedBirthYear = Number(rawBirthYear)
    if (Number.isFinite(parsedBirthYear)) {
      return parsedBirthYear
    }
  }

  const birthdate = typeof user.birthdate === 'string' ? user.birthdate : ''
  if (birthdate !== '') {
    const parsedDate = new Date(birthdate)
    const year = parsedDate.getFullYear()
    if (Number.isFinite(year)) {
      return year
    }
  }

  return 0
}

export default function EssentialDataPage() {
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

  const cityOptions = useMemo(() => [...CURRENT_CITY_OPTIONS], [])
  const relationshipOptions = useMemo(() => [...RELATIONSHIP_STATUS_OPTIONS], [])

  useEffect(() => {
    if (!user) {
      return
    }

    const source = user as unknown as Record<string, unknown>
    const nextDisplayName =
      typeof source.displayName === 'string'
        ? source.displayName
        : typeof source.nickname === 'string'
          ? source.nickname
          : ''
    const nextGender = typeof source.gender === 'string' ? source.gender : ''
    const nextCurrentCity = typeof source.currentCity === 'string' ? source.currentCity : ''
    const nextHometown =
      typeof source.hometownRegionCity === 'string' ? source.hometownRegionCity : ''
    const nextRelationship =
      typeof source.relationshipStatus === 'string' ? source.relationshipStatus : ''
    const nextEducation =
      typeof source.educationLevel === 'string' ? source.educationLevel : ''
    const nextOccupationId = typeof source.occupationId === 'string' ? source.occupationId : ''
    const nextIntent = Array.isArray(source.intent)
      ? source.intent.filter((item): item is string => typeof item === 'string')
      : []

    setDisplayName((current) => current || nextDisplayName)
    setGender((current) => current || nextGender)
    setBirthYear((current) => current || getBirthYear(source))
    setCurrentCity((current) => current || nextCurrentCity)
    setHometownRegionCity((current) => current || nextHometown)
    setRelationshipStatus((current) => current || nextRelationship)
    setEducationLevel((current) => current || nextEducation)
    setOccupationId((current) => current || nextOccupationId)
    setIntent((current) => (current.length > 0 ? current : nextIntent))
  }, [user])

  const occupationOptions = useMemo(() => {
    const selectedOccupation = occupationId ? getOccupationById(occupationId) : undefined
    if (selectedOccupation && !HOT_OCCUPATIONS.some((item) => item.id === selectedOccupation.id)) {
      return [selectedOccupation, ...HOT_OCCUPATIONS]
    }

    return HOT_OCCUPATIONS
  }, [occupationId])

  const occupationLabels = useMemo(
    () => occupationOptions.map((item) => item.displayName),
    [occupationOptions],
  )
  const selectedOccupation = occupationId ? getOccupationById(occupationId) : undefined
  const industryId = occupationId ? getIndustryId(occupationId) : null
  const industryLabel = occupationId ? getIndustryDisplayLabel(occupationId, '') : ''
  const occupationGuidance = useMemo(
    () => getOccupationGuidance(intent[0] ?? INTENT_OPTIONS[0].value),
    [intent],
  )
  const birthYearIndex = birthYear > 0 ? BIRTH_YEAR_RANGE.indexOf(birthYear) : -1
  const currentCityIndex = currentCity
    ? cityOptions.findIndex((option) => option === currentCity)
    : -1
  const relationshipIndex = relationshipStatus
    ? relationshipOptions.findIndex((option) => option === relationshipStatus)
    : -1
  const occupationIndex = occupationId
    ? occupationOptions.findIndex((item) => item.id === occupationId)
    : -1
  const intentOptions = useMemo(() => [...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION], [])

  const requiredFieldStates = useMemo(
    () => [
      { label: '昵称', done: displayName.trim().length >= 2 },
      { label: '性别', done: gender !== '' },
      { label: '出生年份', done: birthYear > 0 },
      { label: '现居城市', done: currentCity !== '' },
    ],
    [birthYear, currentCity, displayName, gender],
  )
  const completedRequiredCount = requiredFieldStates.filter((item) => item.done).length
  const missingRequiredFields = requiredFieldStates.filter((item) => !item.done)
  const requiredComplete = missingRequiredFields.length === 0
  const pageClassName = ['essential-data', isPageExiting ? 'essential-data--exiting' : '']
    .filter(Boolean)
    .join(' ')

  const toggleIntent = useCallback(
    (value: string) => {
      if (value === INTENT_FLEXIBLE_OPTION.value) {
        setIntent(intent.includes(value) ? [] : [value])
        return
      }

      const nextIntent = intent.filter((item) => item !== INTENT_FLEXIBLE_OPTION.value)
      if (nextIntent.includes(value)) {
        setIntent(nextIntent.filter((item) => item !== value))
        return
      }

      if (nextIntent.length >= MAX_INTENTS) {
        analytics.validationFailed('intent', 'max-selection-reached')
        Taro.showToast({
          title: `最多选择 ${MAX_INTENTS} 个意图`,
          icon: 'none',
          duration: 2000,
        })
        return
      }

      setIntent([...nextIntent, value])
    },
    [analytics, intent],
  )

  const handleSubmit = useCallback(async () => {
    if (!requiredComplete || isSubmitting) {
      if (!requiredComplete) {
        analytics.validationFailed('form', 'incomplete-required-fields')
      }
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const payload = {
        displayName: displayName.trim(),
        gender,
        birthYear,
        currentCity,
        ...(hometownRegionCity.trim() !== ''
          ? { hometownRegionCity: hometownRegionCity.trim() }
          : {}),
        ...(relationshipStatus ? { relationshipStatus } : {}),
        ...(educationLevel ? { educationLevel } : {}),
        ...(occupationId
          ? {
              occupationId,
              ...(industryId ? { industryCategory: industryId } : {}),
              ...(industryLabel ? { industryCategoryLabel: industryLabel } : {}),
            }
          : {}),
        ...(intent.length > 0 ? { intent } : {}),
      }

      logInfo('[EssentialData] Submitting', {
        requiredComplete,
        hasEducationLevel: Boolean(educationLevel),
        hasOccupationId: Boolean(occupationId),
        intentCount: intent.length,
      })

      await submitEssentialData(apiRequest, payload)
      await saveCheckpoint('essential-data')
      await invalidateAuth()
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
      setIsPageExiting(false)
      const message = err instanceof Error ? err.message : '提交失败，请重试'
      setError(message)
      analytics.errorOccurred('submit_failed', message)
      logError('[EssentialData] Submit failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: 3000 })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    birthYear,
    currentCity,
    displayName,
    educationLevel,
    gender,
    hometownRegionCity,
    industryId,
    industryLabel,
    intent,
    invalidateAuth,
    isSubmitting,
    occupationId,
    relationshipStatus,
    requiredComplete,
    saveCheckpoint,
  ])

  if (isLoading) {
    return (
      <OnboardingLoadingShell
        stepLabel='Onboarding 2 / 4'
        title='小悦在整理你的入场名片'
        subtitle='把这一步铺好后，后面的兴趣热度和资料预览都会顺滑接上。'
      />
    )
  }

  return (
    <View className={pageClassName}>
      <ScrollView className='essential-data__scroll' scrollY enhanced showScrollbar={false}>
        <View className='essential-data__shell'>
          <View className='essential-data__hero essential-data__stage essential-data__stage--1'>
            <Text className='essential-data__eyebrow'>Onboarding 2 / 4</Text>
            <Text className='essential-data__title'>先把你的入场名片搭起来</Text>
            <Text className='essential-data__subtitle'>
              四个小信息先定下来，后面的兴趣热度和资料预览都会更像你。
            </Text>
          </View>

          <View className='essential-data__coach essential-data__stage essential-data__stage--2'>
            <Image
              className='essential-data__coach-avatar'
              src={getXiaoyueAsset(intent.length > 0 ? 'pointing' : 'normal')}
              mode='aspectFit'
            />
            <View className='essential-data__coach-copy'>
              <Text className='essential-data__coach-title'>小悦提示</Text>
              <Text className='essential-data__coach-text'>{occupationGuidance.subtitle}</Text>
            </View>
          </View>

          <Card className='essential-data__card essential-data__stage essential-data__stage--3'>
            <View className='essential-data__card-header'>
              <Text className='essential-data__card-title'>必要资料</Text>
              <Text className='essential-data__card-subtitle'>先把大家一眼会看到的几项资料补齐。</Text>
            </View>

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
                  const nextValue = e.detail.value.trim()
                  if (nextValue !== '' && nextValue.length < 2) {
                    analytics.validationFailed('displayName', 'too-short')
                  }
                }}
                maxlength={20}
              />
              <Text className='essential-data__hint'>2-20 个字符，会显示在活动和匹配资料里。</Text>
            </View>

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
                      className={[
                        'essential-data__choice-chip',
                        selected ? 'essential-data__choice-chip--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setGender(option)}
                    >
                      <Text className='essential-data__choice-chip-text'>{option}</Text>
                    </View>
                  )
                })}
              </View>
            </View>

            <View className='essential-data__field-grid'>
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
                    <Text
                      className={[
                        'essential-data__picker-text',
                        birthYear > 0 ? 'essential-data__picker-text--filled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {birthYear > 0 ? `${birthYear} 年` : '请选择'}
                    </Text>
                  </View>
                </Picker>
              </View>

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
                    <Text
                      className={[
                        'essential-data__picker-text',
                        currentCity !== '' ? 'essential-data__picker-text--filled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {currentCity || '请选择'}
                    </Text>
                  </View>
                </Picker>
              </View>
            </View>

            <View className='essential-data__field-grid'>
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

              <View className='essential-data__field'>
                <Text className='essential-data__label'>关系状态</Text>
                <Picker
                  mode='selector'
                  range={relationshipOptions}
                  value={relationshipIndex >= 0 ? relationshipIndex : 0}
                  onChange={(e) =>
                    setRelationshipStatus(relationshipOptions[Number(e.detail.value)] ?? '')
                  }
                >
                  <View className='essential-data__picker'>
                    <Text
                      className={[
                        'essential-data__picker-text',
                        relationshipStatus !== '' ? 'essential-data__picker-text--filled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {relationshipStatus || '选填'}
                    </Text>
                  </View>
                </Picker>
              </View>
            </View>
          </Card>

          <Card className='essential-data__card essential-data__stage essential-data__stage--4'>
            <View className='essential-data__card-header'>
              <Text className='essential-data__card-title'>让资料更像你</Text>
              <Text className='essential-data__card-subtitle'>这些细节会让你的预览更完整，也更容易遇见聊得来的同桌。</Text>
            </View>

            <View className='essential-data__field'>
              <Text className='essential-data__label'>学历</Text>
              <View className='essential-data__choice-row essential-data__choice-row--wrap'>
                {EDUCATION_LEVEL_OPTIONS.map((option) => {
                  const selected = educationLevel === option
                  return (
                    <View
                      key={option}
                      className={[
                        'essential-data__choice-chip',
                        'essential-data__choice-chip--compact',
                        selected ? 'essential-data__choice-chip--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
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
                  const nextOccupation = occupationOptions[Number(e.detail.value)]
                  if (nextOccupation) {
                    setOccupationId(nextOccupation.id)
                  }
                }}
              >
                <View className='essential-data__picker'>
                  <Text
                    className={[
                      'essential-data__picker-text',
                      occupationId !== '' ? 'essential-data__picker-text--filled' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {selectedOccupation?.displayName || '从热门职业里选一个'}
                  </Text>
                </View>
              </Picker>
              <Text className='essential-data__hint'>
                {selectedOccupation
                  ? industryLabel !== ''
                    ? `${selectedOccupation.displayName} · ${industryLabel}`
                    : selectedOccupation.displayName
                  : occupationGuidance.matchPreview}
              </Text>
            </View>

            <View className='essential-data__field'>
              <Text className='essential-data__label'>这次更想收获什么</Text>
              <View className='essential-data__intent-grid'>
                {intentOptions.map((option) => {
                  const selected = intent.includes(option.value)
                  return (
                    <View
                      key={option.value}
                      className={[
                        'essential-data__intent-card',
                        selected ? 'essential-data__intent-card--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => toggleIntent(option.value)}
                    >
                      <Text className='essential-data__intent-emoji'>{option.emoji}</Text>
                      <Text className='essential-data__intent-label'>{option.label}</Text>
                      <Text className='essential-data__intent-subtitle'>{option.subtitle}</Text>
                    </View>
                  )
                })}
              </View>
              <Text className='essential-data__hint'>最多可选 {MAX_INTENTS} 个，多选会影响后续活动推荐。</Text>
            </View>
          </Card>
          {/* Collapses on short windows so fixed tray + primary CTA stay reachable (viewport-zero-scroll) */}
          <ResponsiveSpacer heightRpx={48} collapseBelow={700} />
        </View>
      </ScrollView>

      <View className='essential-data__readiness-tray'>
        <View className='essential-data__readiness-top'>
          <View className='essential-data__readiness-copy'>
            <Text className='essential-data__readiness-title'>
              {requiredComplete ? '可以继续啦' : `还差 ${missingRequiredFields.length} 项就能继续`}
            </Text>
            <Text className='essential-data__readiness-subtitle'>
              {requiredComplete
                ? '小悦已经收好你的第一张入场名片，下一步去点亮兴趣热度。'
                : `先补齐${missingRequiredFields.map((item) => item.label).join('、')}，就能去做兴趣热度画像。`}
            </Text>
          </View>
          <Text className='essential-data__readiness-progress'>
            {completedRequiredCount}/{requiredFieldStates.length} 已就位
          </Text>
        </View>

        <View className='essential-data__readiness-chips'>
          {requiredFieldStates.map((item) => (
            <View
              key={item.label}
              className={[
                'essential-data__readiness-chip',
                item.done ? 'essential-data__readiness-chip--done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Text className='essential-data__readiness-chip-icon'>{item.done ? '✓' : '·'}</Text>
              <Text className='essential-data__readiness-chip-text'>{item.label}</Text>
            </View>
          ))}
        </View>

        {error ? <Text className='essential-data__error'>{error}</Text> : null}

        <Button
          variant='brand'
          className='essential-data__submit'
          onClick={handleSubmit}
          disabled={!requiredComplete || isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '提交中…' : '继续完善兴趣'}
        </Button>
      </View>
    </View>
  )
}
