import { View, Text, ScrollView, Image } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import XiaoyueInlineError from '../../../components/mascot/XiaoyueInlineError'
import { ResponsiveSpacer } from '../../../components/ui/ResponsiveSpacer'
import {
  getIntroStaticAsset,
  getIntroStaticFallbackAsset,
} from './visuals'

const INTRO_TRUST_POINTS = [
  {
    prefix: '1.',
    title: '约 3-5 分钟完成',
    description: '轻量做完，不会把你困在一串冗长题目里。',
  },
  {
    prefix: '2.',
    title: '题目会跟着你变',
    description: '越答越准，帮你找到最像自己的氛围命格。',
  },
  {
    prefix: '3.',
    title: '未登录也能先完成',
    description: '结果会先保存在这台设备里，准备好时再继续登录。',
  },
] as const

interface PersonalityTestIntroProps {
  isPageExiting: boolean
  isDegradation: boolean
  isSubmitting: boolean
  error: string
  hasStoredIncompleteSession: boolean
  introImgError: boolean
  introImgLoaded: boolean
  introReducedMotion: boolean
  onStart: () => void
  onIntroImgLoad: () => void
  onIntroImgError: () => void
}

export default function PersonalityTestIntro({
  isPageExiting,
  isDegradation,
  isSubmitting,
  error,
  hasStoredIncompleteSession,
  introImgError,
  introImgLoaded,
  introReducedMotion,
  onStart,
  onIntroImgLoad,
  onIntroImgError,
}: PersonalityTestIntroProps) {
  const pageClassName = [
    'personality-test',
    'personality-test--intro',
    isPageExiting ? 'personality-test--exiting' : '',
    isDegradation ? 'personality-test--low-end' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const introCoachLine = hasStoredIncompleteSession
    ? '进度还在，继续答几分钟就能完成。'
    : '没有标准答案，凭直觉选就好。我会帮你整理出最真实的氛围命格。'
  const introPrimaryLabel = isSubmitting
    ? '准备中…'
    : error
      ? '重试'
      : hasStoredIncompleteSession
        ? '继续测试'
        : '开始测试'

  return (
    <View className={pageClassName}>
      {/* Inner scroll port: the intro is designed to fit one viewport; the
          ScrollView stays as a safety port for shorter screens. */}
      <ScrollView
        className='personality-test__intro-shell'
        scrollY
        enhanced
        showScrollbar={false}
      >
        <View className='personality-test__intro-content'>
          <View className='personality-test__stage personality-test__stage--1'>
            <Text className='personality-test__eyebrow'>
              <Text className='personality-test__eyebrow-en'>JoyJoin</Text>
              <Text> · 氛围原型</Text>
            </Text>
            <Text className='personality-test__intro-title'>3 分钟，读懂你的</Text>
            <Text className='personality-test__intro-title personality-test__intro-title--accent'>聚会气场</Text>
            <Text className='personality-test__intro-subtitle'>
              找到你的氛围命格，让后面的遇见都更对味。
            </Text>
            {/* 装盒承接句（盲盒城市故事线，2026-07-26）：landing 的「拆开我的盲盒」
                落地到这里，把"答题"重新叙事为拆盒的第一拍——先装盒，再拆盒。 */}
            <Text className='personality-test__intro-bridge'>
              先装盒，再拆盒：几道小题，把你的样子装进去。
            </Text>
          </View>

          <ResponsiveSpacer heightRpx={16} collapseBelow={700} />

          <View className='personality-test__intro-hero personality-test__stage personality-test__stage--2'>
            <View className='personality-test__intro-hero-visual'>
              <View className='personality-test__intro-hero-halo' />
              <View className='personality-test__intro-mascot'>
                {!introImgLoaded && (
                  <View className='personality-test__intro-mascot-placeholder' />
                )}
                <Image
                  src={introReducedMotion || introImgError ? getIntroStaticFallbackAsset() : getIntroStaticAsset()}
                  mode='aspectFit'
                  className={`personality-test__intro-mascot-img${introImgLoaded ? ' personality-test__intro-mascot-img--loaded' : ''}`}
                  aria-hidden='true'
                  lazyLoad={false}
                  onLoad={onIntroImgLoad}
                  onError={onIntroImgError}
                />
              </View>
            </View>

            <View className='personality-test__intro-bubble'>
              <Text className='personality-test__intro-bubble-title'>这一步会带给你什么</Text>
              <Text className='personality-test__intro-bubble-text'>{introCoachLine}</Text>
            </View>
          </View>

          <ResponsiveSpacer heightRpx={16} collapseBelow={720} />

          <View className='personality-test__intro-trust personality-test__stage personality-test__stage--3'>
            <Text className='personality-test__intro-trust-title'>开始前，三件事</Text>
            <View className='personality-test__intro-trust-list'>
              {INTRO_TRUST_POINTS.map((item) => (
                <View key={item.title} className='personality-test__intro-trust-item'>
                  <View className='personality-test__intro-trust-icon'>
                    <Text>{item.prefix}</Text>
                  </View>
                  <View className='personality-test__intro-trust-copy'>
                    <Text className='personality-test__intro-trust-item-title'>{item.title}</Text>
                    <Text className='personality-test__intro-trust-item-description'>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <ResponsiveSpacer heightRpx={16} collapseBelow={780} />

          <View className='personality-test__intro-tease personality-test__stage personality-test__stage--4'>
            <Text className='personality-test__intro-tease-title'>完成后，你会看到自己的氛围命格</Text>
            <Text className='personality-test__intro-tease-subtitle'>
              不是贴标签，而是帮你找到最对味的人。
            </Text>
            <Text className='personality-test__intro-tease-line'>
              12 种氛围命格，答完就知道你是哪一种。
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className='personality-test__intro-footer'>
        {error ? <XiaoyueInlineError className='personality-test__error--footer' message={error} /> : null}
        <Button
          variant='brand'
          className='personality-test__start-btn'
          onClick={onStart}
          disabled={isSubmitting}
          loading={isSubmitting}
          hoverClass='personality-test__start-btn--hover'
        >
          {introPrimaryLabel}
        </Button>
      </View>
    </View>
  )
}
