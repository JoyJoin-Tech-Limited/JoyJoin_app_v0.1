import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { FlashFeatureClosed } from '../../../components/alang/FlashUi'
import { shouldShowStreetBlindBoxEntry } from '../../../lib/alang/alangAccess'
import './index.scss'

const STORY_PROMISES = [
  { title: '不读取个人画像', description: '人格、兴趣、职业、关系和任务行为都不会进入这一季的剧情。' },
  { title: '不由 AI 临场续写', description: '角色开场、两条回应和事实碎片均来自逐单元审核的固定内容。' },
  { title: '选择仍然算数', description: '你选中的原句会在弱网重试时保持不变，成功后只结算一次。' },
] as const

export default function FlashPreferencesPage() {
  const enabled = shouldShowStreetBlindBoxEntry()

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: '故事说明' })
  }, [])

  if (!enabled) return <FlashFeatureClosed />

  return (
    <View className='flash-page flash-preferences'>
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          <View className='flash-page__hero'>
            <Text className='flash-page__eyebrow'>REVIEWED, NOT GENERATED</Text>
            <Text className='flash-page__title'>这一季，不需要交出你的资料</Text>
            <Text className='flash-page__lead'>《没有名字的旧物》使用人工审核的固定剧情。角色会记住本季进度，但不会读取你的个人画像来改写对白。</Text>
          </View>

          <View className='flash-preferences__panel'>
            <View className='flash-preferences__sources'>
              {STORY_PROMISES.map((promise) => (
                <View key={promise.title} className='flash-preferences__row'>
                  <View className='flash-preferences__row-copy'>
                    <Text className='flash-preferences__row-title'>{promise.title}</Text>
                    <Text className='flash-preferences__row-description'>{promise.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className='flash-page__notice'>
            <Text className='flash-page__notice-text'>旧版中保存过的专属剧情偏好不会用于本季运行时生成，也不会改变十五块固定事实碎片。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
