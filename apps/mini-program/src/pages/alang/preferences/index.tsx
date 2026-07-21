import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ScrollView, Switch, Text, View } from '@tarojs/components'
import { FLASH_PERSONALIZATION_CONSENT_VERSION } from '@shared/alang/flashTypes'
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
  | 'useDistrict'
  | 'useTaskBehavior'

const sourceRows: Array<{
  key: ToggleField
  title: string
  description: string
}> = [
  { key: 'usePersonality', title: '性格类型', description: '使用你正式测试得到的角色类型，不读取答题原文。' },
  { key: 'useInterests', title: '兴趣选择', description: '参考你主动选过的兴趣，让任务更顺手。' },
  { key: 'useIndustry', title: '宽泛行业', description: '只使用行业大类，不使用具体职业、公司或单位。' },
  { key: 'useDistrict', title: '当前所在区', description: '只在你打开街头盲盒时参考当前区域。' },
  { key: 'useTaskBehavior', title: '任务经历', description: '参考完成次数和偏好，不会改写正式性格与职业资料。' },
]

function sourceLabel(source: string): string {
  switch (source) {
    case 'personality': return '性格类型'
    case 'interests': return '兴趣选择'
    case 'industry': return '宽泛行业'
    case 'district': return '所在区'
    case 'task_behavior': return '任务经历'
    default: return '任务偏好'
  }
}

export default function FlashPreferencesPage() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)
  const { data, isLoading, isError, refetch } = useFlashPreferences(enabled)
  const updateMutation = useUpdateFlashPreferences()
  const [draft, setDraft] = useState<FlashPreferencesView | null>(null)

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: '任务偏好' })
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
          ? { consentVersion: FLASH_PERSONALIZATION_CONSENT_VERSION }
          : {}),
      }
      const result = await updateMutation.mutateAsync(update)
      setDraft(result)
    } catch {
      setDraft(previous)
      Taro.showToast({ title: '偏好没有保存，请再试一次', icon: 'none' })
    }
  }

  const deleteTag = async (tagId: string) => {
    if (!enabled || !draft || updateMutation.isPending) return
    const previous = draft
    setDraft({ ...draft, tags: draft.tags.filter((tag) => tag.id !== tagId) })
    try {
      const result = await updateMutation.mutateAsync({ deleteTagIds: [tagId] })
      setDraft(result)
    } catch {
      setDraft(previous)
      Taro.showToast({ title: '标签没有删除，请再试一次', icon: 'none' })
    }
  }

  if (!enabled) return <FlashFeatureClosed />

  if (isError) {
    return (
      <View className='flash-page'>
        <FlashPageState tone='error' title='任务偏好暂时没打开' description='个性化设置仍以服务端保存的版本为准。' action={() => { void refetch() }} actionLabel='重新读取' />
      </View>
    )
  }

  if (isLoading || !draft) {
    return <View className='flash-page'><FlashPageState title='正在读取任务偏好…' /></View>
  }

  return (
    <View className='flash-page flash-preferences'>
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          <View className='flash-page__hero'>
            <Text className='flash-page__eyebrow'>YOUR CHOICE</Text>
            <Text className='flash-page__title'>你决定任务了解你多少</Text>
            <Text className='flash-page__lead'>全部关闭后仍然可以玩，只会收到通用任务。</Text>
          </View>

          <View className='flash-preferences__panel'>
            <View className='flash-preferences__master'>
              <View className='flash-preferences__row-copy'>
                <Text className='flash-preferences__row-title'>个性化任务</Text>
                <Text className='flash-preferences__row-description'>综合你允许的数据，挑选更可能喜欢的任务。</Text>
                <Text className='flash-preferences__consent'>开启代表你明确同意下列已勾选数据用于街头盲盒任务推荐，可随时关闭。</Text>
              </View>
              <Switch
                checked={draft.personalizationEnabled}
                color={COLOR_PRIMARY}
                disabled={updateMutation.isPending}
                onChange={(event) => { void updateToggle('personalizationEnabled', event.detail.value) }}
                aria-label='个性化任务开关'
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

          <View className='flash-page__section'>
            <View className='flash-page__section-head'>
              <Text className='flash-page__section-title'>当前任务标签</Text>
              <Text className='flash-page__section-meta'>{draft.tags.length} 个</Text>
            </View>
            {draft.tags.length ? (
              <View className='flash-preferences__tags'>
                {draft.tags.map((tag) => (
                  <View key={tag.id} className='flash-preferences__tag'>
                    <View className='flash-preferences__tag-copy'>
                      <Text className='flash-preferences__tag-label'>{tag.label}</Text>
                      <Text className='flash-preferences__tag-source'>{sourceLabel(tag.source)}</Text>
                    </View>
                    <View
                      className='flash-preferences__tag-delete'
                      onClick={() => { void deleteTag(tag.id) }}
                      role='button'
                      aria-label={`删除任务标签${tag.label}`}
                    >
                      <Text>删除</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className='flash-empty-card'>
                <Text className='flash-empty-card__title'>暂时没有任务标签</Text>
                <Text className='flash-empty-card__copy'>这不会影响参加街头盲盒，系统会从通用任务里随机挑选。</Text>
              </View>
            )}
          </View>

          <View className='flash-page__notice'>
            <JoyJoinIcon
              className='flash-page__notice-mark'
              emoji='✨'
              tier='reveal'
              size={32}
            />
            <Text className='flash-page__notice-text'>偏好只影响任务挑选，不修改正式性格测试、职业资料或其他功能。私密回信不会进入这里。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
