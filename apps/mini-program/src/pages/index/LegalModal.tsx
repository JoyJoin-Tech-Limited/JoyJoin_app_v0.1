import { View, Text, ScrollView } from '@tarojs/components'
import {
  JOYJOIN_TERMS_SECTIONS_ZH,
  JOYJOIN_PRIVACY_SECTIONS_ZH,
  LEGAL_LAST_UPDATED_LABEL_ZH,
  type TermsSectionZh,
} from '@shared/legal/joyjoinTermsZh'
import './legal-modal.scss'

interface LegalModalProps {
  visible: boolean
  section: 'terms' | 'privacy'
  onAgree: () => void
}

export default function LegalModal({ visible, section, onAgree }: LegalModalProps) {
  if (!visible) return null

  const sections: TermsSectionZh[] =
    section === 'privacy' ? JOYJOIN_PRIVACY_SECTIONS_ZH : JOYJOIN_TERMS_SECTIONS_ZH
  const title = section === 'privacy' ? '隐私政策' : '用户协议'

  return (
    <View className='legal-modal__overlay' catchMove>
      <View className='legal-modal__sheet'>
        <View className='legal-modal__header'>
          <View className='legal-modal__handle' />
          <Text className='legal-modal__title'>{title}</Text>
          <Text className='legal-modal__date'>最后更新：{LEGAL_LAST_UPDATED_LABEL_ZH}</Text>
        </View>

        <ScrollView className='legal-modal__body' scrollY enhanced showScrollbar={false}>
          {sections.map((sec) => (
            <View key={sec.id} className='legal-modal__section'>
              <Text className='legal-modal__section-heading'>{sec.heading}</Text>
              {sec.paragraphs.map((para, idx) => (
                <Text key={idx} className='legal-modal__section-text'>{para}</Text>
              ))}
            </View>
          ))}
        </ScrollView>

        <View className='legal-modal__footer'>
          <View className='legal-modal__agree-btn' onClick={onAgree} hoverClass='legal-modal__agree-btn--hover'>
            <Text className='legal-modal__agree-btn-text'>我已阅读并同意</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
