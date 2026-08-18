import { View } from '@tarojs/components'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import type { PoolEventType } from '../flowConfig'
import PoolRegistrationHero from './PoolRegistrationHero'

interface PoolRegistrationHeroPersonaSectionProps {
  eventType: PoolEventType
  dateTimeLabel?: string
  area?: string
  price?: number | null
  registrationTotal: number
  /** Demoted new-registrant signal, rendered as one meta pill in the hero's
      meta band. Parent applies the delta/cooldown gating. */
  newRegistrantDelta?: number
  visible: boolean
}

/**
 * PoolRegistrationHeroPersonaSection — Step 0 三拍化
 * (registration-ceremony-spec-20260817 §1): this section is now the 封面 only —
 * hero art + meta pills. The persona snapshot / seat heads moved into
 * PoolRegistrationVibePeek, a collapsed expander under 悦仔的信, so data
 * modules no longer share equal billing with the story.
 */
export default function PoolRegistrationHeroPersonaSection({
  eventType,
  dateTimeLabel,
  area,
  price,
  registrationTotal,
  newRegistrantDelta,
  visible,
}: PoolRegistrationHeroPersonaSectionProps) {
  const deviceTier = useDeviceTier()

  const cardClasses = [
    'hero-persona-section__card',
    visible ? 'hero-persona-section__card--enter' : 'hero-persona-section__card--hidden',
    deviceTier.isDegradation ? 'hero-persona-section__card--low-end' : '',
  ].join(' ')

  return (
    <View className='hero-persona-section'>
      <View className={cardClasses}>
        <PoolRegistrationHero
          eventType={eventType}
          dateTimeLabel={dateTimeLabel}
          area={area}
          price={price}
          registrationTotal={registrationTotal}
          newRegistrantDelta={newRegistrantDelta}
          visible={visible}
        />
      </View>
    </View>
  )
}
