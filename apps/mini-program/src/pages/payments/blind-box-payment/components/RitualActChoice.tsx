import { View, Text } from '@tarojs/components'
import { memo, useCallback, useMemo } from 'react'
import Card from '../../../../components/ui/Card'
import type { ArchetypeTheme, RitualPlan } from '../lib/paymentRitualState'
import { getActIIICopy, getSocialProofCopy, getStepAchievementCopy } from '../lib/paymentRitualCopy'
import { trackPlanSelect } from '../lib/paymentRitualAnalytics'
import { formatMiniProgramPaymentPrice } from '../../../../lib/payment/paymentPageModel'

interface Props {
  archetype: string | null
  theme: ArchetypeTheme
  plans: RitualPlan[]
  selectedPlanId: string | null
  totalMembers: number
  onSelectPlan: (planId: string) => void
}

function RitualActChoice({
  archetype,
  theme,
  plans,
  selectedPlanId,
  totalMembers,
  onSelectPlan,
}: Props) {
  const copy = useMemo(() => getActIIICopy(archetype), [archetype])

  const handleSelect = useCallback(
    (plan: RitualPlan) => {
      trackPlanSelect(plan.id, plan.socialProof.isRecommended)
      onSelectPlan(plan.id)
    },
    [onSelectPlan],
  )

  return (
    <View className='ritual-act-choice'>
      {/* Progress indicator (Achievement) */}
      <View className='ritual-act-choice__progress'>
        <View className='ritual-act-choice__progress-header'>
          <Text className='ritual-act-choice__progress-label'>{copy.progressLabel}</Text>
          <Text className='ritual-act-choice__progress-step'>
            {getStepAchievementCopy(2, 4)}
          </Text>
        </View>
        <View className='ritual-act-choice__progress-track'>
          <View className='ritual-act-choice__progress-fill' style={{ transform: 'scaleX(0.66)', transformOrigin: 'left center' }} />
        </View>
      </View>

      {/* Section Header */}
      <View className='ritual-act-choice__header'>
        <Text className='ritual-act-choice__title'>{copy.sectionTitle}</Text>
        <Text className='ritual-act-choice__subline'>{copy.sectionSubline}</Text>
      </View>

      {/* Plan Cards */}
      <View className='ritual-act-choice__plans'>
        {plans.length === 0 && (
          <View className='ritual-empty-state'>
            <Text className='ritual-empty-state__title'>暂时没有其他套餐可选</Text>
            <Text className='ritual-empty-state__sub'>稍后再来看看吧</Text>
          </View>
        )}
        {plans.map((plan) => (
          <PlanPathCard
            key={plan.id}
            plan={plan}
            theme={theme}
            isSelected={selectedPlanId === plan.id}
            copy={copy}
            totalMembers={totalMembers}
            onSelect={() => handleSelect(plan)}
          />
        ))}
      </View>

      {/* Xiaoyue reaction to selection (Delight) */}
      {selectedPlanId && (
        <View className='ritual-act-choice__xiaoyue-reaction'>
          <Text className='ritual-act-choice__xiaoyue-reaction-text'>
            {copy.xiaoyueReactions[selectedPlanId] || '好选择，悦仔为你开心。'}
          </Text>
        </View>
      )}
    </View>
  )
}

export default memo(RitualActChoice)

// ─── Plan Path Card ───

interface PlanCardProps {
  plan: RitualPlan
  theme: ArchetypeTheme
  isSelected: boolean
  copy: ReturnType<typeof getActIIICopy>
  totalMembers: number
  onSelect: () => void
}

function PlanPathCard({
  plan,
  theme,
  isSelected,
  copy,
  totalMembers,
  onSelect,
}: PlanCardProps) {
  const socialProofText = getSocialProofCopy(
    plan.socialProof.recentChoosers,
    null,
    plan.socialProof.isRecommended,
  )
  const description = copy.planDescriptions[plan.id] || plan.description
  const reason = copy.planReasons[plan.id]

  // Calculate "your position" (Achievement + Belonging)
  const position = totalMembers + 1

  return (
    <Card
      className={`plan-path-card ${isSelected ? 'plan-path-card--selected' : ''}`}
      hoverClass='plan-path-card--hover'
      onClick={onSelect}
    >
      <View className='plan-path-card__content'>
        {/* Left accent bar (visible when selected) */}
        {isSelected && (
          <View
            className='plan-path-card__accent-bar'
            style={{ backgroundColor: theme.accentBold }}
          />
        )}

        {/* Badge & Title Row */}
        <View className='plan-path-card__topline'>
          {plan.socialProof.isRecommended && (
            <View
              className='plan-path-card__badge plan-path-card__badge--recommended'
              style={{ backgroundColor: theme.accentSoft }}
            >
              <Text style={{ color: theme.accentText }}>大家最爱选</Text>
            </View>
          )}
          <Text className='plan-path-card__title'>{plan.displayName}</Text>
        </View>

        {/* Description */}
        <Text className='plan-path-card__description'>{description}</Text>

        {/* Archetype-specific reason (Understood + Identity) */}
        {reason && (
          <View
            className='plan-path-card__reason'
            style={{ backgroundColor: theme.accentSoft }}
          >
            <Text style={{ color: theme.accentText }}>{reason}</Text>
          </View>
        )}

        {/* Value Anchors (Achievement framing) */}
        <View className='plan-path-card__anchors'>
          {plan.valueAnchor.perSessionPrice && (
            <View
              className='plan-path-card__anchor-pill'
              style={{ backgroundColor: theme.accentSoft }}
            >
              <Text style={{ color: theme.accentText }}>
                {copy.valueAnchorLabels.perSession} {plan.valueAnchor.perSessionPrice}
              </Text>
            </View>
          )}
          {plan.valueAnchor.dailyPrice && (
            <View
              className='plan-path-card__anchor-pill'
              style={{ backgroundColor: theme.accentSoft }}
            >
              <Text style={{ color: theme.accentText }}>
                {copy.valueAnchorLabels.perDay} {plan.valueAnchor.dailyPrice}
              </Text>
            </View>
          )}
          {plan.valueAnchor.savingsAmount && Number(plan.valueAnchor.savingsAmount) > 0 && (
            <View className='plan-path-card__anchor-pill plan-path-card__anchor-pill--savings'>
              <Text className='plan-path-card__anchor-pill--savings-text'>
                {copy.valueAnchorLabels.savings} {plan.valueAnchor.savingsAmount}
              </Text>
            </View>
          )}
        </View>

        {/* Social Proof (Belonging) */}
        <Text className='plan-path-card__social-proof'>{socialProofText}</Text>

        {/* Position indicator (Achievement + Belonging) */}
        {isSelected && (
          <Text className='plan-path-card__position'>
            你将成为第 {position.toLocaleString()} 位探索者
          </Text>
        )}

        {/* Price */}
        <View className='plan-path-card__price-row'>
          {plan.originalPrice && plan.originalPrice > plan.price && (
            <Text className='plan-path-card__original-price'>
              {formatMiniProgramPaymentPrice(plan.originalPrice)}
            </Text>
          )}
          <Text className='plan-path-card__price' style={{ color: theme.accentBold }}>
            {formatMiniProgramPaymentPrice(plan.price)}
          </Text>
        </View>
      </View>
    </Card>
  )
}
