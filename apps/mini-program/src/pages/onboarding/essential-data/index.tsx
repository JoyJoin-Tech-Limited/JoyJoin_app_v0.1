import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useAuthGuard, nextStepToRoute } from '../../../hooks/useAuthGuard'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest } from '../../../lib/api'
import { logInfo, logError } from '../../../lib/logger'
import { submitEssentialData } from '@shared/api'
import './index.scss'

const GENDER_OPTIONS = ['女性', '男性']

const CITY_OPTIONS = [
  '深圳', '香港', '广州', '东莞', '佛山', '其他城市',
]

// Dynamic birth year range: 18+ years old minimum
const currentYear = new Date().getFullYear()
const BIRTH_YEAR_RANGE: number[] = []
for (let y = currentYear - 18; y >= 1970; y--) {
  BIRTH_YEAR_RANGE.push(y)
}

export default function EssentialDataPage() {
  const { isLoading } = useAuthGuard()
  const invalidateAuth = useInvalidateAuth()

  const [displayName, setDisplayName] = useState('')
  const [genderIndex, setGenderIndex] = useState<number | null>(null)
  const [birthYearIndex, setBirthYearIndex] = useState<number | null>(null)
  const [cityIndex, setCityIndex] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit =
    displayName.trim().length >= 2 &&
    genderIndex !== null &&
    birthYearIndex !== null &&
    cityIndex !== null

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    setError('')
    try {
      const selectedGender = genderIndex === null ? undefined : GENDER_OPTIONS[genderIndex]
      const selectedBirthYear = birthYearIndex === null ? undefined : BIRTH_YEAR_RANGE[birthYearIndex]
      const selectedCity = cityIndex === null ? undefined : CITY_OPTIONS[cityIndex]

      if (!selectedGender || !selectedBirthYear || !selectedCity) {
        throw new Error('请完整填写资料后再继续')
      }

      const data = {
        displayName: displayName.trim(),
        gender: selectedGender,
        birthYear: selectedBirthYear,
        currentCity: selectedCity,
      }

      logInfo('[EssentialData] Submitting', data)
      await submitEssentialData(apiRequest, data)

      // Invalidate auth cache and navigate to next step
      await invalidateAuth()
      const userState = await apiRequest<{ nextStep?: string }>({ path: '/api/auth/user' })
      const nextStep = userState.nextStep ?? 'extended-data'
      Taro.redirectTo({ url: nextStepToRoute(nextStep as any) })
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败，请重试'
      setError(message)
      logError('[EssentialData] Submit failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: 3000 })
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, isSubmitting, displayName, genderIndex, birthYearIndex, cityIndex, invalidateAuth])

  if (isLoading) {
    return (
      <View className='essential-data'>
        <View className='essential-data__loading'>
          <Text className='essential-data__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='essential-data'>
      <View className='essential-data__header'>
        <Text className='essential-data__title'>基本资料</Text>
        <Text className='essential-data__subtitle'>帮助我们为你匹配更合适的活动伙伴</Text>
      </View>

      <View className='essential-data__form'>
        {/* Display Name */}
        <View className='essential-data__field'>
          <Text className='essential-data__label'>昵称</Text>
          <Input
            className='essential-data__input'
            placeholder='大家在活动中怎么称呼你'
            value={displayName}
            onInput={(e) => setDisplayName(e.detail.value)}
            maxlength={20}
          />
          <Text className='essential-data__hint'>2-20个字符</Text>
        </View>

        {/* Gender */}
        <View className='essential-data__field'>
          <Text className='essential-data__label'>性别</Text>
          <Picker
            mode='selector'
            range={GENDER_OPTIONS}
            onChange={(e) => setGenderIndex(Number(e.detail.value))}
          >
            <View className='essential-data__picker'>
              <Text className={genderIndex !== null ? 'essential-data__picker-value' : 'essential-data__picker-placeholder'}>
                {genderIndex !== null ? GENDER_OPTIONS[genderIndex] : '请选择'}
              </Text>
            </View>
          </Picker>
        </View>

        {/* Birth Year */}
        <View className='essential-data__field'>
          <Text className='essential-data__label'>出生年份</Text>
          <Picker
            mode='selector'
            range={BIRTH_YEAR_RANGE}
            onChange={(e) => setBirthYearIndex(Number(e.detail.value))}
          >
            <View className='essential-data__picker'>
              <Text className={birthYearIndex !== null ? 'essential-data__picker-value' : 'essential-data__picker-placeholder'}>
                {birthYearIndex !== null ? `${BIRTH_YEAR_RANGE[birthYearIndex]}年` : '请选择'}
              </Text>
            </View>
          </Picker>
        </View>

        {/* City */}
        <View className='essential-data__field'>
          <Text className='essential-data__label'>所在城市</Text>
          <Picker
            mode='selector'
            range={CITY_OPTIONS}
            onChange={(e) => setCityIndex(Number(e.detail.value))}
          >
            <View className='essential-data__picker'>
              <Text className={cityIndex !== null ? 'essential-data__picker-value' : 'essential-data__picker-placeholder'}>
                {cityIndex !== null ? CITY_OPTIONS[cityIndex] : '请选择'}
              </Text>
            </View>
          </Picker>
        </View>
      </View>

      {error ? <Text className='essential-data__error'>{error}</Text> : null}

      <View className='essential-data__footer'>
        <Button
          className='essential-data__submit'
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '提交中…' : '下一步'}
        </Button>
      </View>
    </View>
  )
}
