/**
 * Canonical Chinese user agreement / privacy copy for JoyJoin web + mini-program.
 * Align disclosures with PIPL / CSL / DSL requirements (plain-language summaries, not statute text).
 * Official law texts: https://www.npc.gov.cn/ (中国人大网 法律全文).
 *
 * Two exports:
 *   JOYJOIN_TERMS_SECTIONS_ZH   — full user agreement (shown by default)
 *   JOYJOIN_PRIVACY_SECTIONS_ZH — standalone privacy policy (shown on ?section=privacy)
 *
 * TODO(AC-14): Legal review required before merge. The AIGC clauses below are
 * drafted for compliance review and must be signed off by legal before shipping.
 */

export interface TermsSectionZh {
  id: string;
  heading: string;
  paragraphs: string[];
}

/** ISO-like date for internal reference; shown in UI as LEGAL_LAST_UPDATED_LABEL_ZH */
export const LEGAL_DOCUMENT_VERSION = "2026-05-13";

export const LEGAL_LAST_UPDATED_LABEL_ZH = "2026年5月13日";

export const JOYJOIN_COPYRIGHT_YEAR = "2026";

export const JOYJOIN_TERMS_SECTIONS_ZH: TermsSectionZh[] = [
  {
    id: "ts-service",
    heading: "一、服务说明",
    paragraphs: [
      "悦聚（JoyJoin）是一个面向都市青年的社交活动平台，致力于通过精心设计的线下活动帮助用户结识志趣相投的新朋友。",
      "平台提供活动报名、兴趣分组、破冰工具及活动回顾等服务，旨在以轻松自然的方式促进真实的人际连接。",
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
      "我们重视您的个人信息安全。具体收集、使用与保护规则，请查阅我们的《隐私政策》（点击本页顶部切换至隐私政策页面）。",
      "我们依照《中华人民共和国个人信息保护法》《中华人民共和国网络安全法》《中华人民共和国数据安全法》等法律法规处理您的个人信息。",
      "在符合法律法规的前提下，您有权查阅、复制、更正、补充您的个人信息，有权撤回同意、限制或拒绝特定处理活动，以及请求删除。",
    ],
  },
  {
    id: "ts-events",
    heading: "五、活动参与规则",
    paragraphs: [
      "报名时须如实填写个人信息。虚假信息将影响匹配质量，情节严重者将限制未来报名资格。",
      "取消与退款：\n— 配池阶段取消（匹配尚未完成）：全额退款，活动次数自动返还，权益用户不受影响。\n— 匹配完成后取消：于活动开始24小时前取消，平台退还50%费用或保留本次参与机会；不足24小时取消，不予退款且正常扣除活动次数（如有）。\n— 平台因故取消活动：全额退款或恢复活动次数，不受上述时间限制。\n— 以上规则适用于单次票购买、活动次数包及权益方案用户。",
      "无故缺席：未在活动开始至少24小时前通过平台取消且未出席，记为缺席。缺席将降低个人匹配优先级评分：累计2次暂停报名资格30天，累计3次及以上长期降低匹配权重。缺席记录每6个月自动清零。「提前取消」指在活动开始至少24小时前通过平台完成取消操作。",
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
    id: "ts-aigc",
    heading: "七、人工智能生成内容（AIGC）说明",
    paragraphs: [
      "为提升活动氛围与破冰体验，平台部分文案、标签或建议由生成式人工智能技术辅助生成。",
      "若你发现某条内容由 AI 生成且存在不当、错误或不妥之处，可通过 App 内举报入口选择「AI 生成内容」进行反馈，平台将在收到举报后依规审核与处理。",
      "平台保留对 AI 生成或 AI 辅助生成内容进行人工复核、调整、下架或替换的权利，以确保符合法律法规及社区准则。",
    ],
  },
  {
    id: "ts-contact",
    heading: "八、联系我们",
    paragraphs: [
      "如您对本政策或用户协议有任何疑问，或需要行使个人信息相关权利（查阅、复制、更正、删除、撤回同意、投诉举报等），欢迎通过以下方式联系我们：",
      "邮箱：support@joyjoinapp.com\n我们将在 15 个工作日内答复您的请求（复杂情形可能依法适当延长并告知原因）。",
    ],
  },
  {
    id: "ts-legal-basis",
    heading: "九、法律依据与规则索引",
    paragraphs: [
      "下列法律、行政法规为我们在中华人民共和国境内提供网络服务与处理个人信息的主要依据（条文以国家立法机关及主管部门公布的正式文本为准）：",
      "《中华人民共和国个人信息保护法》（2021年11月1日起施行）",
      "《中华人民共和国网络安全法》（2017年6月1日起施行）",
      "《中华人民共和国数据安全法》（2021年9月1日起施行）",
      "如涉及具体国家标准或部门规章（例如与个人信息安全、数据出境安全评估相关），以届时有效且公开发布的版本为准。",
    ],
  },
];

/**
 * Standalone privacy policy — detailed, mini-program-specific.
 * Modelled on the clear itemised style of peer mini-program privacy policies.
 */
export const JOYJOIN_PRIVACY_SECTIONS_ZH: TermsSectionZh[] = [
  {
    id: "ps-collect",
    heading: "一、我们收集的信息",
    paragraphs: [
      "为了向你提供悦聚（JoyJoin）服务，我们将在获取你的明示同意后，收集以下信息：",
      "· 为了登录识别你的身份，我们将通过微信登录功能获取你的微信OpenID（唯一标识符）。",
      "· 为了给用户提供保存图片的功能，我们将在获取你的明示同意后，使用你的相册（仅写入）权限。你可通过该功能保存性格测试结果海报和破冰瞬间卡片。",
      "· 为了组织线下活动，我们将收集你的活动报名、参与及分组信息。",
    ],
  },
  {
    id: "ps-minor",
    heading: "二、未成年人保护",
    paragraphs: [
      "根据相关法律法规的规定，使用悦聚服务须年满18周岁，未成年人不得注册或参与活动。",
    ],
  },
  {
    id: "ps-rights",
    heading: "三、你的权益",
    paragraphs: [
      "关于使用你的相册（仅写入）权限，你可以通过以下路径撤回：小程序主页右上角「…」→「设置」→点击「相册（仅写入）」→点击「不允许」。",
      "关于你的个人信息，你可以通过以下路径要求删除：小程序主页右上角「…」→「设置」→「小程序已获取的信息」→点击特定信息→点击「通知开发者删除」，开发者承诺收到通知后将删除信息。法律法规另有规定的，开发者承诺将停止除存储和采取必要的安全保护措施之外的处理。",
      "关于你的个人信息，你可以通过以下方式与开发者联系，行使查阅、复制、更正、删除等法定权利。",
      "若你在小程序中注册了账号，你可以通过以下方式与开发者联系，申请注销你在小程序中使用的账号。在受理你的申请后，开发者承诺在十五个工作日内完成核查和处理，并按照法律法规要求处理你的相关信息。",
      "邮箱：support@joyjoinapp.com",
    ],
  },
  {
    id: "ps-storage",
    heading: "四、信息的存储",
    paragraphs: [
      "开发者承诺，除法律法规另有规定外，开发者对你的信息的保存期限应当为实现处理目的所必要的最短时间。",
    ],
  },
  {
    id: "ps-usage",
    heading: "五、信息的使用规则",
    paragraphs: [
      "开发者将会在本指引所明示的用途内使用收集的信息。",
      "如开发者使用你的信息超出本指引目的或合理范围，开发者必须在变更使用目的或范围前，再次以通知方式告知并征得你的明示同意。",
    ],
  },
  {
    id: "ps-sharing",
    heading: "六、信息的对外提供",
    paragraphs: [
      "开发者承诺，不会主动共享或转让你的信息至任何第三方，如存在确需共享或转让时，开发者应当直接征得或确认第三方征得你的单独同意。",
      "开发者承诺，不会对外公开披露你的信息，如必须公开披露时，开发者应当向你告知公开披露的目的、披露信息的类型及可能涉及的信息，并征得你的单独同意。",
      "为实现服务，我们可能在必要范围内向受托技术服务提供方（如云基础设施、消息与登录服务）提供经去标识化或合同约定保护的信息。",
    ],
  },
  {
    id: "ps-security",
    heading: "七、信息安全",
    paragraphs: [
      "我们采取符合业界实践的技术与管理措施保护个人信息安全，防止未经授权的访问、泄露、篡改或丢失。",
    ],
  },
  {
    id: "ps-contact",
    heading: "八、联系我们",
    paragraphs: [
      "若你认为开发者未遵守上述约定，或有其他的投诉建议、或未成年人个人信息保护相关问题，可通过以下方式与开发者联系：",
      "邮箱：support@joyjoinapp.com",
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
      "以下为悦聚关于个人信息收集、使用与保护的详细说明。",
  },
};
