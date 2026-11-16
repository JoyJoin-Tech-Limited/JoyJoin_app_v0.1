import { View, Text } from '@tarojs/components'
import {
  COST_BUDGET_ATTRIBUTION,
  COST_BLOCK_TITLE,
  COST_INCLUDED_IN_PLAN,
  COST_ONSITE_MENU_NOTE,
  COST_ONSITE_UNKNOWN,
  COST_ROW_ONSITE,
  COST_ROW_ONSITE_UNKNOWN,
  COST_ROW_PURCHASE,
  COST_ROW_TICKET,
  COST_ROW_TICKET_HINT,
  COST_TOTAL_LABEL,
  COST_TOTAL_SUFFIX,
  COST_TOTAL_SUFFIX_PLAN,
} from '@shared/copy/eventCostCopy'

export interface CostBreakdownProps {
  /** Discounted payable order amount in integer cents. */
  paidCents: number
  /** formatOnSiteBudget() output; null means no trustworthy budget. */
  onSiteBudgetLabel: string | null
  /** formatTonightTotal() output; always null for multi-event purchases. */
  tonightTotalLabel: string | null
  /** Centralised dining/drinks hint selected by the page's eventType. */
  onSiteHint: string
  /** Derived exclusively from the existing selectedPlan product branch. */
  isMultiEventPurchase?: boolean
  /** Existing order product/session description; omit when unavailable. */
  purchaseHint?: string | null
}

function formatPaidCents(paidCents: number): string {
  const normalized = Math.max(0, Math.trunc(paidCents))
  const yuan = Math.floor(normalized / 100)
  const cents = normalized % 100
  return cents === 0 ? `¥${yuan}` : `¥${yuan}.${String(cents).padStart(2, '0')}`
}

function splitPerPersonLabel(label: string): { amount: string; unit: string } {
  const suffix = ' / 人'
  return label.endsWith(suffix)
    ? { amount: label.slice(0, -suffix.length), unit: '/ 人' }
    : { amount: label, unit: '' }
}

export default function CostBreakdown({
  paidCents,
  onSiteBudgetLabel,
  tonightTotalLabel,
  onSiteHint,
  isMultiEventPurchase = false,
  purchaseHint = null,
}: CostBreakdownProps) {
  const isIncludedInPlan = !isMultiEventPurchase && paidCents === 0
  const onSiteAmount = onSiteBudgetLabel ? splitPerPersonLabel(onSiteBudgetLabel) : null
  const totalAmount = tonightTotalLabel ? splitPerPersonLabel(tonightTotalLabel) : null
  const showTotal = !isMultiEventPurchase && Boolean(onSiteAmount && totalAmount)

  return (
    <View className='cost-breakdown' aria-label={COST_BLOCK_TITLE}>
      <Text className='cost-breakdown__label'>{COST_BLOCK_TITLE}</Text>

      <View className='cost-breakdown__group'>
        <View className='cost-breakdown__row'>
          <Text className='cost-breakdown__name'>
            {isMultiEventPurchase ? COST_ROW_PURCHASE : COST_ROW_TICKET}
          </Text>
          {isIncludedInPlan ? (
            <Text className='cost-breakdown__amount cost-breakdown__amount--text'>
              {COST_INCLUDED_IN_PLAN}
            </Text>
          ) : (
            <Text className='cost-breakdown__amount'>{formatPaidCents(paidCents)}</Text>
          )}
        </View>
        {isMultiEventPurchase ? (
          purchaseHint ? (
            <Text className='cost-breakdown__hint cost-breakdown__hint--purchase'>{purchaseHint}</Text>
          ) : null
        ) : (
          <Text className='cost-breakdown__hint'>{COST_ROW_TICKET_HINT}</Text>
        )}
      </View>

      <View className='cost-breakdown__group cost-breakdown__group--onsite'>
        <View className='cost-breakdown__row'>
          {onSiteAmount ? (
            <Text className='cost-breakdown__name'>
              <Text className='cost-breakdown__label-full'>{COST_ROW_ONSITE}</Text>
              <Text className='cost-breakdown__label-compact'>{COST_ROW_ONSITE_UNKNOWN}</Text>
            </Text>
          ) : (
            <Text className='cost-breakdown__name'>{COST_ROW_ONSITE_UNKNOWN}</Text>
          )}
          {onSiteAmount ? (
            <View className='cost-breakdown__amount'>
              <Text className='cost-breakdown__amount-value'>{onSiteAmount.amount}</Text>
              {onSiteAmount.unit ? (
                <Text className='cost-breakdown__amount-unit'>{onSiteAmount.unit}</Text>
              ) : null}
            </View>
          ) : (
            <Text className='cost-breakdown__amount cost-breakdown__amount--text'>
              {COST_ONSITE_UNKNOWN}
            </Text>
          )}
        </View>
        {onSiteAmount ? (
          <Text className='cost-breakdown__hint cost-breakdown__budget-attribution'>
            {COST_BUDGET_ATTRIBUTION}
          </Text>
        ) : null}
        <Text className='cost-breakdown__hint'>{onSiteHint}</Text>
        {!onSiteAmount ? (
          <Text className='cost-breakdown__hint cost-breakdown__hint--menu'>{COST_ONSITE_MENU_NOTE}</Text>
        ) : null}
      </View>

      {showTotal && totalAmount ? (
        <>
          <View className='cost-breakdown__divider' aria-hidden='true' />
          <View className='cost-breakdown__total'>
            <View className='cost-breakdown__total-copy'>
              <Text className='cost-breakdown__total-label'>{COST_TOTAL_LABEL}</Text>
              <Text className='cost-breakdown__total-note'>
                {isIncludedInPlan ? COST_TOTAL_SUFFIX_PLAN : COST_TOTAL_SUFFIX}
              </Text>
            </View>
            <View className='cost-breakdown__total-amount'>
              <Text className='cost-breakdown__total-amount-value'>{totalAmount.amount}</Text>
              {totalAmount.unit ? (
                <Text className='cost-breakdown__amount-unit'>{totalAmount.unit}</Text>
              ) : null}
            </View>
          </View>
        </>
      ) : null}
    </View>
  )
}
