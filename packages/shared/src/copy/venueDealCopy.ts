/**
 * 场地专属优惠 · 共享文案与格式化（小程序 + 后台预览共用，禁止另写第二套）
 *
 * 设计依据：docs/design/venue-deal/index.html（v2 主体，APPROVE）、
 *          docs/design/venue-deal/redeem-ceremony.html（同桌凭证 v2.3，APPROVE）。
 *
 * 用户约束：
 * - 只有两种形态：统一折扣 / 定制套餐；
 * - 只有一条规则：VENUE_DEAL_RULE_LINE；
 * - 不使用「会员 / VIP / 独家」；不出现 emoji；订座语汇。
 * - 状态只描述真实发生的动作：复制就是复制，永远没有「已出示 / 已使用 / 已核销」。
 */

/** 唯一规则行：客户端固定输出，门店规则不再逐条展示 */
export const VENUE_DEAL_RULE_LINE = '仅限本场活动 · 本桌使用';

/** 费用边界：订座费不等于餐饮结算，避免「88 元含餐」误读 */
export const VENUE_DEAL_FEE_BOUNDARY_LINE = '订座费不含餐费，餐费到店与门店另结';

/** 统一折扣的默认权益名（后台可改，≤20 字） */
export const VENUE_DEAL_DEFAULT_DISCOUNT_TITLE = '本场专属折扣';

/** 定制套餐的默认权益名与两种形态的默认说明（后台预览与空表单占位共用） */
export const VENUE_DEAL_DEFAULT_SET_MENU_TITLE = '定制套餐';
export const VENUE_DEAL_DEFAULT_DISCOUNT_DESCRIPTION = '无门槛全单通用';
export const VENUE_DEAL_DEFAULT_SET_MENU_DESCRIPTION = '套餐内容一句话';

/** 套餐划线原价旁的一口价标注 */
export const VENUE_DEAL_SET_MENU_PRICE_NOTE = '一口价';
/** 后台实时预览的占位与校验提示（与用户侧共用同一 copy 源，避免两处漂移） */
export const VENUE_DEAL_PREVIEW_VENUE_PLACEHOLDER = '门店名称';
export const VENUE_DEAL_CODE_PLACEHOLDER = '到店暗号';
export const VENUE_DEAL_DISCOUNT_VALUE_ERROR = '折扣需为 1–90 的整数（20 表示 8 折）';

/** 锁定态（场地安排中） */
export const VENUE_DEAL_LOCKED_TITLE = '本场专属优惠';
export const VENUE_DEAL_LOCKED_HINT = '成局后到店可用';

/** 报名页 A1：只有池级真实保底时才渲染，不得用于“可能有权益”的池 */
export const VENUE_DEAL_PROMISE_TITLE = '专属优惠';
export const VENUE_DEAL_PROMISE_TEASER = '场地确定后揭晓专属折扣或套餐，到店出示即可用';

/** 出示页 */
export const VENUE_DEAL_CREDENTIAL_TITLE = '同桌凭证';
export const VENUE_DEAL_SHOW_PAGE_HINT = '把这一页递给店员';
export const VENUE_DEAL_SHOW_PAGE_SUBTITLE = '无需点按 · 门店按套餐出餐';
export const VENUE_DEAL_SHOW_PAGE_DISCOUNT_SUBTITLE = '无需点按 · 门店按本页权益结算';
export const VENUE_DEAL_CODE_HINT = '点单时报出暗号，店员确认后结账直接打折';
export const VENUE_DEAL_COPY_FAILURE_HINT = '复制失败时请直接念给店员';

/** 印章：只表达真实状态 */
export const VENUE_DEAL_SEAL_TEXT = '本场专属';
export const VENUE_DEAL_SEAL_COPIED_TEXT = '暗号已复制';

/** 票券卡（pool-group-detail）：头部与状态 */
export const VENUE_DEAL_CARD_HEADER = '本场专属';
export const VENUE_DEAL_CARD_UNLOCKED_STATUS = '已解锁';
export const VENUE_DEAL_CARD_LOCKED_STATUS = '待解锁';
export const VENUE_DEAL_CARD_ERROR_STATUS = '读取失败';

/** 锁定态：只承诺「成局后解锁」，不指代任何具体门店 */
export const VENUE_DEAL_CARD_LOCKED_TITLE = '场地确定后解锁本场专属优惠';
export const VENUE_DEAL_CARD_LOCKED_SCOPE = '折扣或套餐，二选一';

/** 使用方式行（deal-how）：两种形态各一句，无门槛、无有效期、无规则列表 */
export const VENUE_DEAL_CARD_DISCOUNT_HOW = '无门槛 · 全单通用 · 到店出示';
export const VENUE_DEAL_CARD_VIEW_CREDENTIAL = '查看同桌凭证';
export const VENUE_DEAL_CARD_SET_MENU_HOW = '整桌一口价 · 到店出示';

/** 套餐底部在唯一规则行后追加的费用边界（餐费仍需到店结算） */
export const VENUE_DEAL_CARD_SET_MENU_FOOT_NOTE = '餐费到店支付';

/** 读取失败：与「无优惠」严格区分，已承诺的权益不许静默消失 */
export const VENUE_DEAL_CARD_ERROR_TITLE = '优惠暂时没加载出来';
export const VENUE_DEAL_CARD_ERROR_SCOPE = '网络恢复后再试，权益不会消失';
export const VENUE_DEAL_CARD_RETRY = '重新加载';

/**
 * 权益已调整（S3 评审新增第六态）：assigned + 保底 + 正常响应但 venueDeal=null
 * 的真实语义是「权益失效/被撤销/跨店」，不是网络错误；按父方案风险表转客服，
 * 不暗示仍在加载，也不承诺补偿。
 */
export const VENUE_DEAL_CARD_ADJUSTED_STATUS = '已调整';
export const VENUE_DEAL_CARD_ADJUSTED_TITLE = '本场优惠有调整';
export const VENUE_DEAL_CARD_ADJUSTED_SCOPE = '原权益暂不可用，请联系悦聚客服';

/**
 * 折扣值 → 中文折扣。discountValue = (10 − 折) × 10，整数 1–90。
 * 20 → '8 折'；25 → '7.5 折'；90 → '1 折'；1 → '9.9 折'。
 * 非法输入返回空串，由调用方决定不渲染，绝不编造面值。
 */
export function formatDiscountLabel(valueOffPercent: number): string {
  if (!Number.isInteger(valueOffPercent) || valueOffPercent < 1 || valueOffPercent > 90) {
    return '';
  }
  const zhe = (100 - valueOffPercent) / 10;
  return `${Number.isInteger(zhe) ? String(zhe) : zhe.toFixed(1)} 折`;
}

/** 分 → 元，去尾零：59800 → '598'；59850 → '598.5'；59855 → '598.55' */
export function formatCentsAsYuan(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    return '';
  }
  return (cents / 100).toFixed(2).replace(/\.?0+$/, '');
}

/** 套餐一口价展示：59800 → '¥598' */
export function formatSetMenuPriceLabel(cents: number): string {
  const yuan = formatCentsAsYuan(cents);
  return yuan ? `¥${yuan}` : '';
}

export interface VenueDealValueInput {
  kind: 'discount' | 'set_menu';
  valueOffPercent?: number;
  setMenuPriceCents?: number;
}

/** 票券 / 凭证左侧面值：折扣 = '8 折'，套餐 = '¥598'；数据缺失返回空串 */
export function getVenueDealValueText(deal: VenueDealValueInput): string {
  if (deal.kind === 'discount') {
    return formatDiscountLabel(deal.valueOffPercent ?? Number.NaN);
  }
  return formatSetMenuPriceLabel(deal.setMenuPriceCents ?? Number.NaN);
}

/** 使用方式行 */
export function getVenueDealHowText(kind: VenueDealValueInput['kind']): string {
  return kind === 'set_menu' ? VENUE_DEAL_CARD_SET_MENU_HOW : VENUE_DEAL_CARD_DISCOUNT_HOW;
}

/** 底部规则行：套餐追加餐费边界，其余只有唯一规则行 */
export function getVenueDealFootText(kind: VenueDealValueInput['kind']): string {
  return kind === 'set_menu'
    ? `${VENUE_DEAL_RULE_LINE} · ${VENUE_DEAL_CARD_SET_MENU_FOOT_NOTE}`
    : VENUE_DEAL_RULE_LINE;
}

/**
 * 长面值降级（设计 E1）：套餐金额整数部分 ≥4 位（如 ¥1288）时面值用 64rpx，
 * 不换行、不挤压右侧文案；折扣（8 折 / 7.5 折 / 9.9 折）始终 76rpx。
 */
export function isCompactVenueDealValue(deal: VenueDealValueInput): boolean {
  if (deal.kind !== 'set_menu') return false;
  const yuan = formatCentsAsYuan(deal.setMenuPriceCents ?? Number.NaN);
  if (!yuan) return false;
  return yuan.split('.')[0].length >= 4;
}

/** 同桌凭证出示页（S4，设计 redeem-ceremony v2.3）。 */
export const VENUE_DEAL_CREDENTIAL_WORDMARK = 'JOYJOIN';
export const VENUE_DEAL_CODE_PLAQUE_LABEL = '到店暗号';
export const VENUE_DEAL_SET_MENU_PLAQUE_LABEL = '为这桌备好的';
export const VENUE_DEAL_SHOW_PAGE_PLAQUE_LABEL = '本场优惠';
export const VENUE_DEAL_SET_MENU_CREDENTIAL_PRICE_NOTE = '整桌一口价';
export const VENUE_DEAL_COPY_CODE = '复制暗号';
export const VENUE_DEAL_COPIED_ACTION = '已复制 · 可再次复制';
export const VENUE_DEAL_SCREEN_STATUS = '出示时已自动提亮 · 屏幕常亮';
export const VENUE_DEAL_SCREEN_KEEP_ON_ONLY = '屏幕常亮';
export const VENUE_DEAL_SCREEN_BRIGHTNESS_ONLY = '出示时已自动提亮';
export const VENUE_DEAL_UNAVAILABLE_TITLE = '本场暂时没有可出示的优惠';
export const VENUE_DEAL_UNAVAILABLE_HINT = '返回小队详情查看最新状态';
export const VENUE_DEAL_LOAD_ERROR_TITLE = '凭证读取失败';
export const VENUE_DEAL_LOAD_ERROR_HINT = '请检查网络后重试';
export const VENUE_DEAL_BACK = '返回';

export function formatVenueDealCopyFailure(code: string): string {
  return `复制失败，请直接念给店员：${code}`;
}

export function getVenueDealTableText(memberCount: number): string {
  return `${memberCount} 人桌`;
}

export function getVenueDealSetMenuOriginalText(cents: number): string {
  return `原价 ${formatSetMenuPriceLabel(cents)} · 餐费到店支付`;
}
