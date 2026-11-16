import { Text, View } from '@tarojs/components'
import type { VenueDealSummary } from '@shared/api'
import {
  VENUE_DEAL_CARD_HEADER,
  VENUE_DEAL_CARD_UNLOCKED_STATUS,
  VENUE_DEAL_CARD_LOCKED_STATUS,
  VENUE_DEAL_CARD_ERROR_STATUS,
  VENUE_DEAL_CARD_LOCKED_TITLE,
  VENUE_DEAL_CARD_LOCKED_SCOPE,
  VENUE_DEAL_CARD_VIEW_CREDENTIAL,
  VENUE_DEAL_CARD_ERROR_TITLE,
  VENUE_DEAL_CARD_ERROR_SCOPE,
  VENUE_DEAL_CARD_RETRY,
  VENUE_DEAL_CARD_ADJUSTED_STATUS,
  VENUE_DEAL_CARD_ADJUSTED_TITLE,
  VENUE_DEAL_CARD_ADJUSTED_SCOPE,
  formatSetMenuPriceLabel,
  getVenueDealValueText,
  getVenueDealHowText,
  getVenueDealFootText,
  isCompactVenueDealValue,
} from '@shared/copy/venueDealCopy'

/**
 * 场地专属优惠票券卡（设计稿 docs/design/venue-deal/index.html v2，APPROVE）。
 *
 * 五态：locked（场地安排中）/ discount / set_menu / 长内容 / error。
 * 样式不在此 import —— 由消费页 SCSS `@use` 合编译，避免被拆进 sub-common.wxss。
 *
 * 出示页属于 S4：只有传入 onPress 时整卡才可点（pressed 态 + 箭头），
 * 否则只是一张信息卡，不出现没有真实动作的按钮。
 */
export interface VenueDealCardProps {
  deal?: VenueDealSummary | null
  locked?: boolean
  /** 真实 query/refetch 失败（仍有小组上下文）时才为 true；不得用 deal=null 推断 */
  error?: boolean
  /** 已承诺但权益失效/被撤销：中性「已调整」，转客服，不是读取失败 */
  adjusted?: boolean
  onRetry?: () => void
  onPress?: (deal: VenueDealSummary) => void
}

function DealValue({ deal }: { deal: VenueDealSummary }) {
  const valueText = getVenueDealValueText(deal)
  const compact = isCompactVenueDealValue(deal)
  const className = [
    'venue-deal-card__value-text',
    compact ? 'venue-deal-card__value-text--long' : '',
  ].filter(Boolean).join(' ')

  if (deal.kind === 'set_menu') {
    const original = formatSetMenuPriceLabel(deal.setMenuOriginalPriceCents ?? Number.NaN)
    return (
      <View className='venue-deal-card__value'>
        <View className={className} data-testid='venue-deal-card-value'>
          <Text className='venue-deal-card__value-unit'>¥</Text>
          <Text className='venue-deal-card__value-number'>{valueText.replace(/^¥/, '')}</Text>
        </View>
        {original ? <Text className='venue-deal-card__value-was'>{original}</Text> : null}
      </View>
    )
  }

  const [number, unit] = valueText.split(' ')
  return (
    <View className='venue-deal-card__value'>
      <View className={className} data-testid='venue-deal-card-value'>
        <Text className='venue-deal-card__value-number'>{number}</Text>
        <Text className='venue-deal-card__value-unit'>{unit}</Text>
      </View>
    </View>
  )
}

export default function VenueDealCard({ deal, locked = false, error = false, adjusted = false, onRetry, onPress }: VenueDealCardProps) {
  // 已承诺权益却装配不出合法面值 = 权益数据异常，走「已调整」，绝不静默消失、绝不编造面值。
  const valueMissing = Boolean(deal) && !getVenueDealValueText(deal as VenueDealSummary)
  const showError = error && !valueMissing
  const showAdjusted = adjusted || valueMissing

  if (!deal && !locked && !showError && !showAdjusted) return null

  const status = showError
    ? VENUE_DEAL_CARD_ERROR_STATUS
    : showAdjusted
      ? VENUE_DEAL_CARD_ADJUSTED_STATUS
      : locked
        ? VENUE_DEAL_CARD_LOCKED_STATUS
        : VENUE_DEAL_CARD_UNLOCKED_STATUS

  const rootClass = [
    'venue-deal-card',
    locked && !showError && !showAdjusted ? 'venue-deal-card--locked' : '',
    showError ? 'venue-deal-card--error' : '',
    showAdjusted && !showError ? 'venue-deal-card--adjusted' : '',
    deal && onPress && !showError && !showAdjusted ? 'venue-deal-card--pressable' : '',
  ].filter(Boolean).join(' ')

  const body = (
    <>
      <View className='venue-deal-card__head'>
        <Text className='venue-deal-card__head-label'>{VENUE_DEAL_CARD_HEADER}</Text>
        <Text className='venue-deal-card__head-status'>{status}</Text>
      </View>
      <View className='venue-deal-card__body'>
        <View className='venue-deal-card__perforation' aria-hidden='true' />
        {showError || showAdjusted ? (
          <View className='venue-deal-card__value venue-deal-card__value--muted'>
            <Text className={`venue-deal-card__value-mark${showError ? ' venue-deal-card__value-mark--error' : ''}`} aria-hidden='true'>!</Text>
          </View>
        ) : locked ? (
          <View className='venue-deal-card__value venue-deal-card__value--muted'>
            <Text className='venue-deal-card__value-mark' aria-hidden='true'>?</Text>
          </View>
        ) : (
          <DealValue deal={deal as VenueDealSummary} />
        )}
        <View className='venue-deal-card__main'>
          {showError ? (
            <>
              <Text className='venue-deal-card__title venue-deal-card__title--muted'>{VENUE_DEAL_CARD_ERROR_TITLE}</Text>
              <Text className='venue-deal-card__scope'>{VENUE_DEAL_CARD_ERROR_SCOPE}</Text>
              <View
                className='venue-deal-card__retry'
                role='button'
                aria-label={VENUE_DEAL_CARD_RETRY}
                data-testid='venue-deal-card-retry'
                onClick={onRetry}
              >
                <Text className='venue-deal-card__retry-text'>{VENUE_DEAL_CARD_RETRY}</Text>
              </View>
            </>
          ) : showAdjusted ? (
            <>
              <Text className='venue-deal-card__title venue-deal-card__title--muted'>{VENUE_DEAL_CARD_ADJUSTED_TITLE}</Text>
              <Text className='venue-deal-card__scope'>{VENUE_DEAL_CARD_ADJUSTED_SCOPE}</Text>
            </>
          ) : locked ? (
            <>
              <Text className='venue-deal-card__title venue-deal-card__title--muted'>{VENUE_DEAL_CARD_LOCKED_TITLE}</Text>
              <Text className='venue-deal-card__scope'>{VENUE_DEAL_CARD_LOCKED_SCOPE}</Text>
            </>
          ) : (
            <>
              <Text className='venue-deal-card__title'>{deal?.title}</Text>
              <Text className='venue-deal-card__scope' numberOfLines={1}>
                {deal?.kind === 'set_menu' ? deal.description ?? '' : deal?.venueName ?? ''}
              </Text>
              <View className='venue-deal-card__how'>
                <Text className='venue-deal-card__how-text'>{onPress ? VENUE_DEAL_CARD_VIEW_CREDENTIAL : getVenueDealHowText(deal?.kind ?? 'discount')}</Text>
                {onPress ? <Text className='venue-deal-card__how-arrow' aria-hidden='true'>›</Text> : null}
              </View>
            </>
          )}
        </View>
      </View>
      {!locked && !showError && !showAdjusted && deal ? (
        <View className='venue-deal-card__foot'>
          <Text className='venue-deal-card__foot-text'>{getVenueDealFootText(deal.kind)}</Text>
        </View>
      ) : null}
    </>
  )

  if (deal && onPress && !showError && !showAdjusted) {
    return (
      <View
        className={rootClass}
        role='button'
        aria-label={`${VENUE_DEAL_CARD_HEADER} ${deal.title}`}
        data-testid='venue-deal-card'
        hoverClass='venue-deal-card--pressed'
        hoverStayTime={70}
        onClick={() => onPress(deal)}
      >
        {body}
      </View>
    )
  }

  return (
    <View className={rootClass} data-testid='venue-deal-card'>
      {body}
    </View>
  )
}
