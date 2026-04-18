/**
 * Canonical Chinese user agreement / privacy copy for JoyJoin web + mini-program.
 * Align disclosures with PIPL / CSL / DSL requirements (plain-language summaries, not statute text).
 * Official law texts: https://www.npc.gov.cn/ (中国人大网 法律全文).
 */

export interface TermsSectionZh {
  id: string;
  heading: string;
  paragraphs: string[];
}

/** ISO-like date for internal reference; shown in UI as LEGAL_LAST_UPDATED_LABEL_ZH */
export const LEGAL_DOCUMENT_VERSION = "2026-04-18";

export const LEGAL_LAST_UPDATED_LABEL_ZH = "2026年4月18日";

export const JOYJOIN_COPYRIGHT_YEAR = "2026";

export const JOYJOIN_TERMS_SECTIONS_ZH: TermsSectionZh[] = [
  {
    id: "ts-service",
    heading: "一、服务说明",
    paragraphs: [
      "悦聚（JoyJoin）是一个面向都市青年的社交活动平台，致力于通过精心设计的线下活动帮助用户结识志趣相投的新朋友。",
      "平台提供活动报名、智能配对、破冰工具及活动回顾等服务，旨在以轻松自然的方式促进真实的人际连接。",
    ],
  },
  {
    id: "ts-eligibility",
    heading: "二、用户资格",
    paragraphs: [
      "使用悦聚服务须年满 18 周岁，未成年人不得注册或参与活动。",
      "用户须使用真实身份注册，不得冒用他人信息。平台保留对注册信息进行核实的权利，如发现虚假信息将立即停止服务并取消活动资格。",
    ],
  },
  {
    id: "ts-conduct",
    heading: "三、用户行为准则",
    paragraphs: [
      "参与者须以尊重、友善的态度对待所有活动成员，严禁任何形式的骚扰、歧视或不当行为。",
      "如遭受不当对待，请立即通过 App 内举报功能或联系客服，悦聚将认真对待每一条举报并依据情节予以处理，情节严重者将永久封禁账号。",
    ],
  },
  {
    id: "ts-privacy",
    heading: "四、隐私与个人信息保护",
    paragraphs: [
      "我们依照《中华人民共和国个人信息保护法》《中华人民共和国网络安全法》《中华人民共和国数据安全法》等法律法规处理您的个人信息，遵循合法、正当、必要和诚信原则。",
      "我们可能处理的个人信息类型包括：账户与身份相关信息（如手机号码、微信授权标识）、个人资料与偏好（如性格标签、兴趣）、活动报名与参与信息、为提供服务所必需的位置或设备相关信息（以您授权及实际收集为准）。处理目的包括：账户注册与登录、活动匹配与组织、客服与安全保障、履行法定义务。",
      "我们仅在实现处理目的所必需的范围内保存个人信息，并在目的达成、或法律法规规定的保存期限届满后，依法删除或匿名化处理，除非法律要求或经您另行同意需要更长保存期限。",
      "未经您同意，我们不会向无关第三方出售个人信息。为实现服务，我们可能在必要范围内向受托技术服务提供方（如云基础设施、消息与登录服务）提供经去标识化或合同约定保护的信息；如涉及对外提供或跨境传输，我们将依法履行告知、安全评估、标准合同等义务（如适用）。",
      "我们采取符合业界实践的技术与管理措施保护个人信息安全，防止未经授权的访问、泄露、篡改或丢失。",
      "在符合法律法规的前提下，您有权查阅、复制、更正、补充您的个人信息，有权撤回同意、限制或拒绝特定处理活动，以及请求删除（法律另有规定除外）。您可通过本政策「联系我们」所列渠道行使权利；我们将在法定期限内答复。",
    ],
  },
  {
    id: "ts-events",
    heading: "五、活动参与规则",
    paragraphs: [
      "报名时须如实填写个人信息，虚假信息将影响匹配质量，情节严重者将限制未来报名资格。",
      "无故缺席活动（未提前取消）将影响个人匹配优先级评分。频繁缺席者，平台有权暂停其报名功能。退款政策详见「常见问题」页面。",
    ],
  },
  {
    id: "ts-disclaimer",
    heading: "六、免责声明",
    paragraphs: [
      "悦聚平台的职责是为用户创造高质量的相遇机会，活动结束后双方形成的任何关系（友谊、恋爱或其他）均属个人私事，平台不承担任何连带责任。",
      "平台不对活动中因个人行为引发的纠纷负责。如需法律援助，请通过正规法律途径解决。",
    ],
  },
  {
    id: "ts-contact",
    heading: "七、联系我们",
    paragraphs: [
      "如您对本政策或用户协议有任何疑问，或需要行使个人信息相关权利（查阅、复制、更正、删除、撤回同意、投诉举报等），欢迎通过以下方式联系我们：",
      "📧 邮箱：hello@joyjoin.cn\n我们将在 15 个工作日内答复您的请求（复杂情形可能依法适当延长并告知原因）。",
    ],
  },
  {
    id: "ts-legal-basis",
    heading: "八、法律依据与规则索引",
    paragraphs: [
      "下列法律、行政法规为我们在中华人民共和国境内提供网络服务与处理个人信息的主要依据（条文以国家立法机关及主管部门公布的正式文本为准）：",
      "《中华人民共和国个人信息保护法》（2021年11月1日起施行）",
      "《中华人民共和国网络安全法》（2017年6月1日起施行）",
      "《中华人民共和国数据安全法》（2021年9月1日起施行）",
      "如涉及具体国家标准或部门规章（例如与个人信息安全、数据出境安全评估相关），以届时有效且公开发布的版本为准。",
    ],
  },
];

export type TermsEntrySection = "terms" | "privacy";

export const TERMS_ENTRY_META: Record<
  TermsEntrySection,
  { title: string; intro: string; focusId?: string }
> = {
  terms: {
    title: "用户协议",
    intro: "在使用悦聚服务前，请仔细阅读以下条款。继续使用即视为您已同意本协议全部内容。",
  },
  privacy: {
    title: "隐私政策",
    intro:
      "以下为悦聚关于个人信息收集、使用与保护的说明。我们已为你定位到隐私与个人信息保护相关条款，便于快速查看。",
    focusId: "ts-privacy",
  },
};
