import Taro from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import { FlashButton, FlashPageState } from '../../../components/alang/FlashUi'
import { shouldShowStreetBlindBoxEntry } from '../../../lib/alang/alangAccess'
import { useFlashEncounter } from '../../../lib/alang/useFlash'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import '../flash.scss'

const DIMENSIONS = [
  ['trust', '相信'],
  ['attachment', '珍惜'],
  ['intervention', '行动'],
  ['truth', '追问'],
] as const

export default function FlashFinalePage() {
  const enabled = shouldShowStreetBlindBoxEntry()
  const encounterId = Taro.getCurrentInstance().router?.params?.encounterId ?? ''
  const { data, isLoading, isError } = useFlashEncounter(encounterId, enabled && !!encounterId)
  const story = data?.storyEpisode
  const ending = story?.ending

  if (!enabled) return <FlashPageState title='这条时间线暂时收好了' description='街头盲盒当前没有开放。' />
  if (isLoading) return <FlashPageState title='正在收拢十五次选择…' description='你的结局不会被重新生成。' />
  if (isError || !story || story.code !== 'season-finale' || !ending) {
    return <FlashPageState title='结局卡还没有出现' description='回到街头盲盒后，可以从已经完成的故事继续查看。' />
  }

  const maxMagnitude = Math.max(1, ...DIMENSIONS.map(([key]) => Math.abs(ending.vector[key])))
  return (
    <View className='flash-finale'>
      <View className='flash-finale__glow' aria-hidden='true' />
      <ScrollView className='flash-finale__scroll' scrollY>
        <View className='flash-finale__hero'>
          <Text className='flash-finale__eyebrow'>THE UNIVERSE YOU REACHED</Text>
          <Text className='flash-finale__season'>{story.seasonTitle}</Text>
          <Text className='flash-finale__title'>{story.title}</Text>
          <Text className='flash-finale__summary'>{story.response}</Text>
        </View>

        <View className='flash-finale__card'>
          <Text className='flash-finale__section-kicker'>三次关键转向</Text>
          {ending.highlights.map((item, index) => (
            <View key={`${item.episodeTitle}-${index}`} className='flash-finale__choice'>
              <Text className='flash-finale__choice-index'>{String(index + 1).padStart(2, '0')}</Text>
              <View className='flash-finale__choice-copy'>
                <Text className='flash-finale__choice-episode'>{item.episodeTitle}</Text>
                <Text className='flash-finale__choice-label'>{item.optionLabel}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className='flash-finale__card'>
          <Text className='flash-finale__section-kicker'>你的宇宙轨迹</Text>
          {DIMENSIONS.map(([key, label]) => {
            const value = ending.vector[key]
            const width = Math.max(8, Math.round(Math.abs(value) / maxMagnitude * 100))
            return (
              <View key={key} className='flash-finale__dimension'>
                <View className='flash-finale__dimension-meta'>
                  <Text>{label}</Text>
                  <Text>{value > 0 ? '+' : ''}{value}</Text>
                </View>
                <View className='flash-finale__dimension-track'>
                  <View className='flash-finale__dimension-fill' style={{ width: `${width}%` }} />
                </View>
              </View>
            )
          })}
        </View>

        {ending.gallery?.length ? (
          <View className='flash-finale__card' data-testid='flash-finale-gallery'>
            <Text className='flash-finale__section-kicker'>结局图鉴</Text>
            {ending.gallery.map((item) => (
              <View key={item.code} className={`flash-finale__gallery-item${item.reached ? ' flash-finale__gallery-item--reached' : ''}`}>
                <View className='flash-finale__gallery-meta'>
                  <Text className='flash-finale__gallery-title'>{item.title}</Text>
                  {item.reached ? (
                    <Text className='flash-finale__gallery-state flash-finale__gallery-state--reached'>已抵达</Text>
                  ) : (
                    <Text className='flash-finale__gallery-state'>
                      还差 {item.approxChoices} 次深挖
                    </Text>
                  )}
                </View>
                {!item.reached ? (
                  <Text className='flash-finale__gallery-summary'>{item.summary}</Text>
                ) : null}
              </View>
            ))}
            <Text className='flash-finale__gallery-note'>多追问几句旧物背后的故事，回声会把你带向更深的结局。</Text>
          </View>
        ) : null}

        <View className='flash-finale__alternate'>
          <Text className='flash-finale__alternate-title'>另一条时间线仍然存在</Text>
          <Text className='flash-finale__alternate-copy'>如果当时给出不同回答，旧物不会改变，但人与旧物之间的关系也许会走向别处。</Text>
        </View>

        <View className='flash-finale__actions'>
          <FlashButton onClick={() => { void Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }) }}>回到街头盲盒</FlashButton>
        </View>
      </ScrollView>
    </View>
  )
}
