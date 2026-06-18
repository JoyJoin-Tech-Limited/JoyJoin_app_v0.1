import { View, Text, ScrollView } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { usePageTTI } from '../../../hooks/usePageTTI'
import {
  JOYJOIN_TERMS_SECTIONS_ZH,
  JOYJOIN_PRIVACY_SECTIONS_ZH,
  LEGAL_LAST_UPDATED_LABEL_ZH,
  JOYJOIN_COPYRIGHT_YEAR,
  TERMS_ENTRY_META,
  type TermsEntrySection,
} from '@shared/legal/joyjoinTermsZh'
import './index.scss'

export default function TermsPage() {
  usePageTTI({ pageName: 'terms' })
  const router = useRouter()
  const entrySection: TermsEntrySection =
    router.params.section === 'privacy' ? 'privacy' : 'terms'
  const entryMeta = TERMS_ENTRY_META[entrySection]
  const sections =
    entrySection === 'privacy'
      ? JOYJOIN_PRIVACY_SECTIONS_ZH
      : JOYJOIN_TERMS_SECTIONS_ZH

  return (
    <ScrollView
      className='terms-page'
      scrollY
      showScrollbar={false}
      scrollWithAnimation
    >
      <View className='terms-page__banner'>
        <View className='terms-page__banner-tag'>法律说明</View>
        <Text className='terms-page__banner-title'>{entryMeta.title}</Text>
        <Text className='terms-page__banner-date'>最后更新：{LEGAL_LAST_UPDATED_LABEL_ZH}</Text>
        <Text className='terms-page__banner-intro'>
          {entryMeta.intro}
        </Text>
      </View>

      {sections.map((section) => (
        <View
          id={section.id}
          key={section.id}
          className='terms-page__section'
        >
          <Text className='terms-page__section-heading'>{section.heading}</Text>
          {section.paragraphs.map((para, idx) => (
            <Text key={idx} className='terms-page__section-text'>{para}</Text>
          ))}
        </View>
      ))}

      <View className='terms-page__footer'>
        <Text className='terms-page__footer-text'>
          使用悦聚服务即代表您已阅读、理解并同意本页所示相关法律说明。
        </Text>
        <Text className='terms-page__footer-text'>© {JOYJOIN_COPYRIGHT_YEAR} JoyJoin. 保留所有权利。</Text>
      </View>
    </ScrollView>
  )
}
