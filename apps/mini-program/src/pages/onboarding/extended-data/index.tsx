import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useAuthGuard, nextStepToRoute } from '../../hooks/useAuthGuard'
import { useInvalidateAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api'
import { logInfo, logError } from '../../lib/logger'
import { submitInterests } from '@shared/api'
import { INTEREST_TAXONOMY, type InterestDefinition } from '@shared/interests'
import './index.scss'

const MIN_INTERESTS = 3
const MAX_INTERESTS = 10

const activeInterests = INTEREST_TAXONOMY.filter((i) => i.active)

// Group by macroCategory for sectioned display
const CATEGORY_LABELS: Record<string, string> = {
  food: '🍜 美食',
  entertainment: '🎮 娱乐',
  lifestyle: '🌿 生活方式',
  culture: '🎭 文化',
  social: '👥 社交',
}

const grouped = activeInterests.reduce<Record<string, InterestDefinition[]>>((acc, item) => {
  const cat = item.macroCategory
  if (!acc[cat]) acc[cat] = []
  acc[cat].push(item)
  return acc
}, {})

export default function ExtendedDataPage() {
  const { isLoading } = useAuthGuard()
  const invalidateAuth = useInvalidateAuth()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < MAX_INTERESTS) {
        next.add(id)
      }
      return next
    })
  }, [])

  const canSubmit = selected.size >= MIN_INTERESTS

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    setError('')
    try {
      logInfo('[ExtendedData] Submitting interests', { count: selected.size })
      await submitInterests(apiRequest, { interests: Array.from(selected) })

      await invalidateAuth()
      const userState = await apiRequest<{ nextStep?: string }>({ path: '/api/auth/user' })
      const nextStep = userState.nextStep ?? 'profile-review'
      Taro.redirectTo({ url: nextStepToRoute(nextStep as any) })
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败，请重试'
      setError(message)
      logError('[ExtendedData] Submit failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: 3000 })
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, isSubmitting, selected, invalidateAuth])

  if (isLoading) {
    return (
      <View className='extended-data'>
        <View className='extended-data__loading'>
          <Text className='extended-data__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='extended-data'>
      <View className='extended-data__header'>
        <Text className='extended-data__title'>兴趣偏好</Text>
        <Text className='extended-data__subtitle'>
          选择 {MIN_INTERESTS}-{MAX_INTERESTS} 个你感兴趣的标签，帮助我们更好地匹配
        </Text>
        <Text className='extended-data__counter'>
          已选 {selected.size} / {MAX_INTERESTS}
        </Text>
      </View>

      <ScrollView className='extended-data__scroll' scrollY enhanced showScrollbar={false}>
        {Object.entries(grouped).map(([category, items]) => (
          <View key={category} className='extended-data__category'>
            <Text className='extended-data__category-title'>
              {CATEGORY_LABELS[category] ?? category}
            </Text>
            <View className='extended-data__tags'>
              {items.map((item) => {
                const isSelected = selected.has(item.id)
                return (
                  <View
                    key={item.id}
                    className={`extended-data__tag ${isSelected ? 'extended-data__tag--selected' : ''}`}
                    onClick={() => toggle(item.id)}
                  >
                    <Text className='extended-data__tag-text'>{item.label}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        ))}
        <View className='extended-data__spacer' />
      </ScrollView>

      {error ? <Text className='extended-data__error'>{error}</Text> : null}

      <View className='extended-data__footer'>
        <Button
          className='extended-data__submit'
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '提交中…' : `下一步（已选 ${selected.size}）`}
        </Button>
      </View>
    </View>
  )
}
