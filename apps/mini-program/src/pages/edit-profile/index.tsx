import { useState, useEffect, useCallback } from 'react'
import { View, Text, Input, ScrollView, Picker, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  getUserInterests,
  submitEssentialData,
  submitInterests,
  type InterestSelectionLevel,
} from '@shared/api'

const INTEREST_LEVEL_META: Array<{
  level: InterestSelectionLevel
  label: string
  shortLabel: string
}> = [
  { level: 1, label: '想试试', shortLabel: '已加入' },
  { level: 2, label: '很喜欢', shortLabel: '偏爱' },
  { level: 3, label: '本命', shortLabel: '重点' },
]

function getInterestLevelMeta(level: InterestSelectionLevel | undefined) {
  return INTEREST_LEVEL_META.find((item) => item.level === level)
}
import { getActiveInterests, MACRO_CATEGORY_LABELS, type MacroCategory } from '@shared/interests'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { apiRequest } from '../../lib/api/api'
import { useAuth, useInvalidateAuth } from '../../hooks/useAuth'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { logInfo, logError } from '../../lib/utils/logger'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
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

// ─── Interest helpers ─────────────────────────────────────────────

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
  const { authLoading, renderGate } = useMiniPageGate()
  const { user } = useAuth()
  const invalidateAuth = useInvalidateAuth()

  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState('')
  const [birthYear, setBirthYear] = useState(0)
  const [currentCity, setCurrentCity] = useState('')
  const [hometownRegionCity, setHometownRegionCity] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [interestLevels, setInterestLevels] = useState<Record<string, InterestSelectionLevel>>({})
  const [isLoadingInterests, setIsLoadingInterests] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Initialize form from user data
  useEffect(() => {
    if (!user) return
    const u = user as Record<string, any>
    setDisplayName(u.displayName || u.nickname || '')
    setGender(normalizeGenderValue(u.gender))

    // birthYear may come directly or be derived from birthdate
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

    // Interests may be an array of IDs or objects when the richer payload has not been loaded yet.
    const interests: string[] = Array.isArray(u.interests)
      ? u.interests.map((i: any) => (typeof i === 'string' ? i : i.id || i.interestId || ''))
      : []
    setSelectedInterests((current) => (current.length > 0 ? current : interests.filter(Boolean)))
    // Do NOT initialize interestLevels from flat user.interests — wait for getUserInterests
    // to return the real structured levels. This prevents overwriting saved levels with 1.
  }, [user])

  useEffect(() => {
    let cancelled = false

    if (authLoading || !user?.hasCompletedInterestsCarousel) {
      return () => {
        cancelled = true
      }
    }

    setIsLoadingInterests(true)
    void getUserInterests(apiRequest)
      .then((interestProfile) => {
        if (cancelled || !Array.isArray(interestProfile?.selections)) {
          return
        }

        const levels = interestProfile.selections.reduce<Record<string, InterestSelectionLevel>>(
          (acc, selection) => {
            if (typeof selection?.topicId !== 'string' || selection.topicId.trim() === '') {
              return acc
            }

            acc[selection.topicId] =
              selection.level === 2 || selection.level === 3 ? selection.level : 1
            return acc
          },
          {},
        )

        setSelectedInterests(Object.keys(levels))
        setInterestLevels(levels)
      })
      .catch((error) => {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : undefined

        if (statusCode !== 404) {
          logError('[EditProfile] Failed to load structured interests', {
            statusCode,
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInterests(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, user?.hasCompletedInterestsCarousel])

  const toggleInterest = useCallback((interestId: string) => {
    const currentLevel = interestLevels[interestId]

    if (!currentLevel) {
      // Not selected → select at level 1
      setSelectedInterests([...selectedInterests, interestId])
      setInterestLevels({ ...interestLevels, [interestId]: 1 })
      return
    }

    if (currentLevel === 1) {
      // Level 1 → Level 2
      setInterestLevels({ ...interestLevels, [interestId]: 2 })
      return
    }

    if (currentLevel === 2) {
      // Level 2 → Level 3
      setInterestLevels({ ...interestLevels, [interestId]: 3 })
      return
    }

    // Level 3 → deselect
    setSelectedInterests(selectedInterests.filter((id) => id !== interestId))
    const nextLevels = { ...interestLevels }
    delete nextLevels[interestId]
    setInterestLevels(nextLevels)
  }, [interestLevels, selectedInterests])

  const handleBirthYearChange = useCallback((e: any) => {
    const idx = e.detail.value as number
    const year = parseInt(BIRTH_YEAR_RANGE[idx], 10)
    if (!isNaN(year)) setBirthYear(year)
  }, [])

  const handleSave = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)

    try {
      logInfo('[EditProfile] Saving profile changes')

      // Submit essential data
      await submitEssentialData(apiRequest, {
        displayName: displayName || undefined,
        gender: gender || undefined,
        birthYear: birthYear || undefined,
        currentCity: currentCity || undefined,
        hometownRegionCity: hometownRegionCity || undefined,
      })

      // Submit interests if changed
      if (selectedInterests.length > 0) {
        await submitInterests(apiRequest, {
          interests: selectedInterests.map((topicId) => ({
            topicId,
            level: interestLevels[topicId] ?? 1,
          })),
        })
      }

      // Invalidate auth cache so profile page refreshes
      invalidateAuth()

      Taro.showToast({ title: '保存成功', icon: 'success', duration: 2000 })
      setTimeout(() => {
        Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/profile/index' }) })
      }, 1000)
    } catch (err) {
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
    selectedInterests,
    interestLevels,
    invalidateAuth,
  ])

  const birthYearIndex = birthYear ? BIRTH_YEAR_RANGE.indexOf(String(birthYear)) : -1

  const previewName = displayName || user?.nickname || user?.displayName || '悦聚用户'
  const previewArchetype = user?.archetype

  return renderGate(
    <ScrollView className='edit-profile' scrollY enhanced showScrollbar={false}>
      {/* ── Xiaoyue Coach ── */}
      <View className='edit-profile__coach'>
        <Image
          className='edit-profile__coach-mascot'
          src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
          mode='aspectFit'
          lazyLoad
        />
        <View className='edit-profile__coach-bubble'>
          <Text className='edit-profile__coach-text'>完善资料可以让匹配更精准哦～</Text>
        </View>
      </View>

      {/* ── Live Preview ── */}
      <Card className='edit-profile__preview'>
        <View className='edit-profile__preview-inner'>
          <ArchetypeHead archetype={previewArchetype} size={80} fallbackText={previewName} />
          <View className='edit-profile__preview-text'>
            <Text className='edit-profile__preview-name'>{previewName}</Text>
            {previewArchetype && (
              <Text className='edit-profile__preview-archetype'>
                {ARCHETYPE_BY_ID[previewArchetype]?.nameCn || previewArchetype}
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* ── 基本信息 ── */}
      <View className='edit-profile__section'>
        <Text className='edit-profile__section-title'>基本信息</Text>
        <Card className='edit-profile__card'>
          {/* Display name */}
          <View className='edit-profile__field'>
            <Text className='edit-profile__label'>昵称</Text>
            <Input
              className='edit-profile__input'
              value={displayName}
              onInput={(e) => setDisplayName(e.detail.value)}
              placeholder='输入你的昵称'
              maxlength={20}
            />
          </View>

          {/* Gender */}
          <View className='edit-profile__field'>
            <Text className='edit-profile__label'>性别</Text>
            <View className='edit-profile__radio-group'>
              {GENDER_OPTIONS.map((opt) => (
                <View
                  key={opt.value}
                  className={`edit-profile__radio ${gender === opt.value ? 'edit-profile__radio--active' : ''}`}
                  onClick={() => setGender(opt.value)}
                >
                  <Text>{opt.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Birth year */}
          <View className='edit-profile__field'>
            <Text className='edit-profile__label'>出生年份</Text>
            <Picker
              mode='selector'
              range={BIRTH_YEAR_RANGE}
              value={birthYearIndex >= 0 ? birthYearIndex : 0}
              onChange={handleBirthYearChange}
            >
              <Text className='edit-profile__picker-value'>
                {birthYear ? `${birthYear} 年` : '选择年份'}
              </Text>
            </Picker>
          </View>

          {/* Current city */}
          <View className='edit-profile__field'>
            <Text className='edit-profile__label'>所在城市</Text>
            <Input
              className='edit-profile__input'
              value={currentCity}
              onInput={(e) => setCurrentCity(e.detail.value)}
              placeholder='如：深圳'
              maxlength={30}
            />
          </View>

          {/* Hometown */}
          <View className='edit-profile__field'>
            <Text className='edit-profile__label'>家乡</Text>
            <Input
              className='edit-profile__input'
              value={hometownRegionCity}
              onInput={(e) => setHometownRegionCity(e.detail.value)}
              placeholder='如：广州'
              maxlength={30}
            />
          </View>
        </Card>
      </View>

      {/* ── 兴趣爱好 ── */}
      <View className='edit-profile__section'>
        <Text className='edit-profile__section-title'>
          兴趣爱好
          <Text className='edit-profile__interest-count'>
            {' '}({selectedInterests.length} 已选)
          </Text>
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
                    <View
                      key={interest.id}
                      className={[
                        'edit-profile__interest-tag',
                        isSelected ? 'edit-profile__interest-tag--selected' : '',
                        isSelected && level ? `edit-profile__interest-tag--level-${level}` : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        if (!isLoadingInterests) toggleInterest(interest.id)
                      }}
                    >
                      <Text className='edit-profile__interest-tag-label'>{interest.label}</Text>
                      {isSelected && meta && (
                        <Text className='edit-profile__interest-tag-meta'>{meta.shortLabel}</Text>
                      )}
                    </View>
                  )
                })}
              </View>
            </View>
          ),
        )}
      </View>

      {/* ── Save button ── */}
      <View className='edit-profile__footer'>
        <Button
          variant='primary'
          className='edit-profile__save-btn'
          onClick={handleSave}
          disabled={isSaving}
          loading={isSaving}
        >
          {isSaving ? '保存中…' : '保存修改'}
        </Button>
      </View>

      <View className='edit-profile__spacer' />
    </ScrollView>
  )
}
