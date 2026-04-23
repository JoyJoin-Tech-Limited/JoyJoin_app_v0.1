import { useState, useEffect, useCallback } from 'react'
import { View, Text, Input, ScrollView, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  getUserInterests,
  submitEssentialData,
  submitInterests,
  type InterestSelectionLevel,
} from '@shared/api'
import { getActiveInterests, MACRO_CATEGORY_LABELS, type MacroCategory } from '@shared/interests'
import { apiRequest } from '../../lib/api'
import { useAuth, useInvalidateAuth } from '../../hooks/useAuth'
import { useMiniPageGate } from '../../hooks/useMiniPageGate'
import { logInfo, logError } from '../../lib/logger'
import { TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../lib/uiConstants'
import Card from '../../components/Card'
import Button from '../../components/Button'
import XiaoyueChatBubble from '../../components/XiaoyueChatBubble'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: '男性', label: '男' },
  { value: '女性', label: '女' },
  { value: '不透露', label: '其他' },
] as const

const CURRENT_YEAR = new Date().getFullYear()
const BIRTH_YEAR_RANGE = Array.from(
  { length: CURRENT_YEAR - 1950 + 1 },
  (_, i) => String(1950 + i),
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
  const [isSaving, setIsSaving] = useState(false)

  // Initialize form from user data
  useEffect(() => {
    if (!user) return
    const u = user as Record<string, any>
    setDisplayName(u.displayName || u.nickname || '')
    setGender(normalizeGenderValue(u.gender))
    setBirthYear(u.birthYear || 0)
    setCurrentCity(u.currentCity || '')
    setHometownRegionCity(u.hometownRegionCity || '')

    // Interests may be an array of IDs or objects when the richer payload has not been loaded yet.
    const interests: string[] = Array.isArray(u.interests)
      ? u.interests.map((i: any) => (typeof i === 'string' ? i : i.id || i.interestId || ''))
      : []
    setSelectedInterests((current) => (current.length > 0 ? current : interests.filter(Boolean)))
    setInterestLevels((current) => {
      if (Object.keys(current).length > 0) {
        return current
      }

      return Object.fromEntries(
        interests.filter(Boolean).map((interestId) => [interestId, 1 as InterestSelectionLevel]),
      )
    })
  }, [user])

  useEffect(() => {
    let cancelled = false

    if (authLoading || !user?.hasCompletedInterestsCarousel) {
      return () => {
        cancelled = true
      }
    }

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

    return () => {
      cancelled = true
    }
  }, [authLoading, user?.hasCompletedInterestsCarousel])

  const toggleInterest = useCallback((interestId: string) => {
    if (selectedInterests.includes(interestId)) {
      setSelectedInterests(selectedInterests.filter((id) => id !== interestId))
      const nextLevels = { ...interestLevels }
      delete nextLevels[interestId]
      setInterestLevels(nextLevels)
      return
    }

    setSelectedInterests([...selectedInterests, interestId])
    setInterestLevels({
      ...interestLevels,
      [interestId]: interestLevels[interestId] ?? 1,
    })
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

      Taro.showToast({ title: '保存成功', icon: 'success', duration: TOAST_DEFAULT_MS })
      setTimeout(() => {
        Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/profile/index' }) })
      }, 1000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败'
      logError('[EditProfile] Save failed', { message: msg })
      Taro.showToast({ title: msg, icon: 'none', duration: TOAST_FATAL_MS })
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

  return renderGate(
    <ScrollView className='edit-profile' scrollY enhanced showScrollbar={false}>
      {/* Xiaoyue coaching bubble */}
      <View className='edit-profile__coach'>
        <XiaoyueChatBubble
          content='随时更新你的资料，匹配会更精准哦。'
          pose='pointing'
          horizontal
          showGlow
        />
      </View>

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
                <Text
                  key={opt.value}
                  className={`edit-profile__radio ${gender === opt.value ? 'edit-profile__radio--active' : ''}`}
                  onClick={() => setGender(opt.value)}
                >
                  {opt.label}
                </Text>
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

        {(Object.entries(interestsByCategory) as [MacroCategory, typeof activeInterests][]).map(
          ([category, interests]) => (
            <View key={category} className='edit-profile__interest-group'>
              <Text className='edit-profile__interest-category'>
                {MACRO_CATEGORY_LABELS[category] || category}
              </Text>
              <View className='edit-profile__interest-tags'>
                {interests.map((interest) => (
                  <Text
                    key={interest.id}
                    className={`edit-profile__interest-tag ${
                      selectedInterests.includes(interest.id)
                        ? 'edit-profile__interest-tag--selected'
                        : ''
                    }`}
                    onClick={() => toggleInterest(interest.id)}
                  >
                    {interest.label}
                  </Text>
                ))}
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
