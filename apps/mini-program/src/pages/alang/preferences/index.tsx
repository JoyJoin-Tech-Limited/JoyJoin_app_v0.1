import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ScrollView, Switch, Text, View } from '@tarojs/components'
import { FLASH_STORY_PERSONALIZATION_CONSENT_VERSION } from '@shared/alang/flashTypes'
import { FlashFeatureClosed, FlashPageState } from '../../../components/alang/FlashUi'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import { useFlashPreferences, useUpdateFlashPreferences } from '../../../lib/alang/useFlash'
import type { FlashPreferencesView, FlashPreferenceUpdate } from '../../../lib/alang/flashTypes'
import { COLOR_PRIMARY } from '../../../lib/utils/uiConstants'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import './index.scss'

type ToggleField =
  | 'personalizationEnabled'
  | 'usePersonality'
  | 'useInterests'
  | 'useIndustry'

const sourceRows: Array<{
  key: ToggleField
  title: string
  description: string
}> = [
  { key: 'usePersonality', title: '性格类型', description: '使用你正式测试得到的角色类型，不读取答题原文。' },
  { key: 'useInterests', title: '兴趣选择', description: '参考你主动选过的兴趣，让关键对白更贴近你。' },
  { key: 'useIndustry', title: '宽泛行业', description: '只使用行业大类，不使用具体职业、公司或单位。' },
]

export default function FlashPreferencesPage() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)
  const { data, isLoading, isError, refetch } = useFlashPreferences(enabled)
  const updateMutation = useUpdateFlashPreferences()
  const [draft, setDraft] = useState<FlashPreferencesView | null>(null)

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: '剧情偏好' })
  }, [])

  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  const updateToggle = async (key: ToggleField, value: boolean) => {
    if (!enabled || !draft || updateMutation.isPending) return
    const previous = draft
    setDraft({ ...draft, [key]: value })
    try {
      const update: FlashPreferenceUpdate = {
        [key]: value,
        ...(key === 'personalizationEnabled' && value
          ? { consentVersion: FLASH_STORY_PERSONALIZATION_CONSENT_VERSION }
          : {}),
      }
      const result = await updateMutation.mutateAsync(update)
      setDraft(result)
    } catch {
      setDraft(previous)
      Taro.showToast({ title: '偏好没有保存，请再试一次', icon: 'none' })
    }
  }

  if (!enabled) return <FlashFeatureClosed />

  if (isError) {
    return (
      <View className='flash-page'>
        <FlashPageState tone='error' title='剧情偏好暂时没打开' description='个性化设置仍以服务端保存的版本为准。' action={() => { void refetch() }} actionLabel='重新读取' />
      </View>
    )
  }

  if (isLoading || !draft) {
    return <View className='flash-page'><FlashPageState title='正在读取剧情偏好…' /></View>
  }

  return (
    <View className='flash-page flash-preferences'>
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          <View className='flash-page__hero'>
            <Text className='flash-page__eyebrow'>YOUR CHOICE</Text>
            <Text className='flash-page__title'>你决定故事了解你多少</Text>
            <Text className='flash-page__lead'>全部关闭后仍然拥有完整剧情、选择后果和个人结局。</Text>
          </View>

          <View className='flash-preferences__panel'>
            <View className='flash-preferences__master'>
              <View className='flash-preferences__row-copy'>
                <Text className='flash-preferences__row-title'>更专属的剧情</Text>
                <Text className='flash-preferences__row-description'>在关键对话中参考你允许的信息；AI 暂时不可用时，会使用经过审核的剧情回应。</Text>
                <Text className='flash-preferences__consent'>开启代表你明确同意下列已勾选数据用于街头盲盒专属剧情；可随时关闭，关闭后仍可体验完整标准剧情。</Text>
                <Text className='flash-preferences__consent'>切换只影响接下来的剧情，不会重置已经发生的故事、事实碎片和结局走向。</Text>
              </View>
              <Switch
                checked={draft.personalizationEnabled}
                color={COLOR_PRIMARY}
                disabled={updateMutation.isPending}
                onChange={(event) => { void updateToggle('personalizationEnabled', event.detail.value) }}
                aria-label='专属剧情开关'
              />
            </View>

            <View className={`flash-preferences__sources${draft.personalizationEnabled ? '' : ' flash-preferences__sources--disabled'}`}>
              {sourceRows.map((row) => (
                <View key={row.key} className='flash-preferences__row'>
                  <View className='flash-preferences__row-copy'>
                    <Text className='flash-preferences__row-title'>{row.title}</Text>
                    <Text className='flash-preferences__row-description'>{row.description}</Text>
                  </View>
                  <Switch
                    checked={Boolean(draft[row.key])}
                    color={COLOR_PRIMARY}
                    disabled={!draft.personalizationEnabled || updateMutation.isPending}
                    onChange={(event) => { void updateToggle(row.key, event.detail.value) }}
                    aria-label={`${row.title}个性化开关`}
                  />
                </View>
              ))}
            </View>
          </View>

          <View className='flash-page__notice'>
            <JoyJoinIcon
              className='flash-page__notice-mark'
              emoji='✨'
              tier='reveal'
              size={32}
            />
            <Text className='flash-page__notice-text'>这些偏好只影响街头盲盒接下来的对白表达，不修改正式性格测试、职业资料、事实碎片或结局判定。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
