/**
 * Event Detail FAQ copy — 详情页常见问题手风琴文案（P0e · 对标平台 竞对反打 sprint）
 *
 * surface: 'event-detail'（信任敏感面）
 * toneMode: 'system-ui' — 暖中性、零语气词（信任面红线：不让悦仔闺蜜腔
 *   渗进钱与承诺的语境；答案零 `~` / `啦` / `哦`）。
 *
 * Sprint benchmark-full-implementation（AC-05 · copy 半区）。Owner：PM + eng lead
 * 双签（PM 侧已签认，eng lead 侧待 PR 复核）。
 *
 * 模块独立：本文件不进 copy/ barrel（index.ts 不动）。消费方直接
 *   import { EVENT_FAQ_ITEMS } from '@shared/copy/eventFaqCopy'
 *   （参照 poolTeaserCopy.ts 的独立模块先例）。
 *
 * 🔴 自检（grep 零命中）：本文件所有 question/answer 对 `REVIEW_BLOCKED_VOCAB`、
 *   `BANNED_WORDS`（terms.ts）及 🟠 扩列词（exceptions.ts）零命中；只使用
 *   canonical 排桌 / 桌友 / 合拍 / 悦仔 词汇，不派生任何越界担保或认证承诺
 *   （支付闭环 / 真人核销仅作事实陈述）。禁虚构数字：人数/金额均为定性说法
 *   （「几个人同桌」），不写静态人数、百分比、排名或金额。
 *
 * 🟡 长度 waiver 登记：FAQ 答案按「解释性内容」处理，豁免「描述 ≤25 字」
 *   指引（brand-copy-strategy §2 🟡），目标 ≤60 字/条。随设计规格
 *   docs/deliberations/2026-10-20-benchmark-design-strategy-confirmation.md P0e 节
 *   登记，有效期至 copy/ 双签完成。
 *
 * 依赖提示（非本模块职责）：第 5 条「排桌完成前取消，全额退款」为
 *   PRD §1.5 承诺，其 UI 渲染须待 P0a（preRevealRefundEnabled）行为生效
 *   证据（AC-03）后再上线；渲染 gating 由消费组件负责，本模块只提供 copy。
 */

export interface EventFaqItem {
  /** 稳定标识，供手风琴 aria-controls / 埋点使用。 */
  id: string;
  /** 问题行——手风琴收起态的标题。 */
  question: string;
  /** 答案文案——展开态正文（≤60 字，🟡 waiver 已登记）。 */
  answer: string;
}

export const EVENT_FAQ_ITEMS: readonly EventFaqItem[] = [
  {
    id: 'what_is_this',
    question: '这是什么局？',
    answer: '一场几个人同桌的小型线下聚会：一起吃顿饭、玩点破冰游戏，认识几位新朋友。',
  },
  {
    id: 'after_booking',
    question: '订座后会发生什么？',
    answer: '订座后，悦仔会帮你排桌；桌友到齐后进入集结房间等开席；开席当天到现场入座。',
  },
  {
    id: 'who_sits_together',
    question: '谁会和我同桌？',
    answer: '悦仔会参考你们的活动偏好、年龄、职业等来排桌，尽量让同桌的人更合拍。',
  },
  {
    id: 'location_reveal',
    question: '地点为什么排桌后才揭晓？',
    answer: '为了保留盲盒的惊喜感，地点会在排桌完成后揭晓，届时能看到详细地址。',
  },
  {
    id: 'cancel_refund',
    question: '订了能取消吗？退款怎么算？',
    answer: '排桌完成前可以取消，全额退款；场次未成行也会自动退款或恢复次数。',
  },
  {
    id: 'payment_checkin',
    question: '付款和到场，都安全吗？',
    answer: '支付在平台内完成、由平台闭环管理；到场时真人核销，确认是你本人再入座。',
  },
  {
    id: 'no_drinking',
    question: '不喝酒可以吗？',
    answer: '可以。喝不喝、喝多少都随你，也有无酒精饮品可选。',
  },
  {
    id: 'duo_together',
    question: '可以和朋友一起报名吗？',
    answer: '可以。和朋友一起订，双方会排进同一桌，同行还有奖励，规则见邀请页。',
  },
] as const;
