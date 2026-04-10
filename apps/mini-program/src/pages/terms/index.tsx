import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

interface TermsSection {
  heading: string
  paragraphs: string[]
}

const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '一、服务说明',
    paragraphs: [
      '悦聚（JoyJoin）是一个面向都市青年的社交活动平台，致力于通过精心设计的线下活动帮助用户结识志趣相投的新朋友。',
      '平台提供活动报名、智能配对、破冰工具及活动回顾等服务，旨在以轻松自然的方式促进真实的人际连接。',
    ],
  },
  {
    heading: '二、用户资格',
    paragraphs: [
      '使用悦聚服务须年满 18 周岁，未成年人不得注册或参与活动。',
      '用户须使用真实身份注册，不得冒用他人信息。平台保留对注册信息进行核实的权利，如发现虚假信息将立即停止服务并取消活动资格。',
    ],
  },
  {
    heading: '三、用户行为准则',
    paragraphs: [
      '参与者须以尊重、友善的态度对待所有活动成员，严禁任何形式的骚扰、歧视或不当行为。',
      '如遭受不当对待，请立即通过 App 内举报功能或联系客服，悦聚将认真对待每一条举报并依据情节予以处理，情节严重者将永久封禁账号。',
    ],
  },
  {
    heading: '四、隐私保护',
    paragraphs: [
      '悦聚收集的个人信息（包括性格标签、兴趣偏好等）仅用于活动配对算法，不会出售或共享给第三方商业机构。',
      '活动中使用昵称，手机号码全程加密保护。您可随时在账户设置中申请删除个人数据。',
    ],
  },
  {
    heading: '五、活动参与规则',
    paragraphs: [
      '报名时须如实填写个人信息，虚假信息将影响匹配质量，情节严重者将限制未来报名资格。',
      '无故缺席活动（未提前取消）将影响个人匹配优先级评分。频繁缺席者，平台有权暂停其报名功能。退款政策详见「常见问题」页面。',
    ],
  },
  {
    heading: '六、免责声明',
    paragraphs: [
      '悦聚平台的职责是为用户创造高质量的相遇机会，活动结束后双方形成的任何关系（友谊、恋爱或其他）均属个人私事，平台不承担任何连带责任。',
      '平台不对活动中因个人行为引发的纠纷负责。如需法律援助，请通过正规法律途径解决。',
    ],
  },
  {
    heading: '七、联系我们',
    paragraphs: [
      '如您对以上条款有任何疑问，或需要行使数据权利（查阅、更正、删除），欢迎通过以下方式联系我们：',
      '📧 邮箱：hello@joyjoin.cn\n我们将在 3 个工作日内回复您的邮件。',
    ],
  },
]

export default function TermsPage() {
  return (
    <ScrollView className='terms-page' scrollY enhanced showScrollbar={false}>
      <View className='terms-page__banner'>
        <Text className='terms-page__banner-title'>服务条款</Text>
        <Text className='terms-page__banner-date'>最后更新：2024年12月1日</Text>
        <Text className='terms-page__banner-intro'>
          在使用悦聚服务前，请仔细阅读以下条款。继续使用即视为您已同意本协议全部内容。
        </Text>
      </View>

      {TERMS_SECTIONS.map((section) => (
        <View key={section.heading} className='terms-page__section'>
          <Text className='terms-page__section-heading'>{section.heading}</Text>
          {section.paragraphs.map((para, idx) => (
            <Text key={idx} className='terms-page__section-text'>{para}</Text>
          ))}
        </View>
      ))}

      <View className='terms-page__footer'>
        <Text className='terms-page__footer-text'>
          使用悦聚服务即代表您已阅读、理解并同意本服务条款。
        </Text>
        <Text className='terms-page__footer-text'>© 2025 JoyJoin. 保留所有权利。</Text>
      </View>
    </ScrollView>
  )
}
