import { View, Text, Image } from '@tarojs/components'
import { memo, useEffect, useState } from 'react'
import type { ArchetypeTheme } from '../lib/paymentRitualState'
import { getActIICopy, getArchetypeValueProposition } from '../lib/paymentRitualCopy'
import { trackAct2Reveal, trackArchetypeShown } from '../lib/paymentRitualAnalytics'
import { CEREMONY_HEROES } from '../../../../lib/ceremonyHeroes'

interface Props {
  archetype: string | null
  archetypeDisplayName: string | null
  theme: ArchetypeTheme
  contextActivity: string | null
  onComplete: () => void
}

function RitualActRevelation({
  archetype,
  archetypeDisplayName,
  theme,
  contextActivity,
  onComplete,
}: Props) {
  const [visible, setVisible] = useState(false)
  const [showReveal, setShowReveal] = useState(false)
  const [showInvitation, setShowInvitation] = useState(false)

  const copy = getActIICopy(archetype, theme.family, contextActivity)
  const valueProp = getArchetypeValueProposition(archetype)

  useEffect(() => {
    const t1 = setTimeout(() => {
      setVisible(true)
      trackAct2Reveal(theme.family)
      trackArchetypeShown(archetype)
    }, 100)

    const t2 = setTimeout(() => {
      setShowReveal(true)
    }, 600)

    const t3 = setTimeout(() => {
      setShowInvitation(true)
      onComplete()
    }, 1100)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [archetype, theme.family, contextActivity, onComplete])

  return (
    <View
      className={`ritual-act-revelation ${visible ? 'ritual-act-revelation--visible' : ''}`}
      style={{ background: theme.accentSoft }}
    >
      <Image
        className='ritual-act-revelation__backdrop'
        src={CEREMONY_HEROES.blindBoxReveal}
        mode='aspectFill'
        ariaLabel='盲盒揭晓'
      />
      {/* Archetype Hero Banner */}
      <View className='ritual-act-revelation__hero'>
        {/* Ritual: "The Reveal" */}
        {showReveal && (
          <View
            className={`ritual-act-revelation__reveal-badge ${
              showReveal ? 'ritual-act-revelation__reveal-badge--visible' : ''
            }`}
          >
            <Text className='ritual-act-revelation__reveal-text'>{copy.revealLine}</Text>
          </View>
        )}

        {archetypeDisplayName && (
          <View
            className='ritual-act-revelation__badge'
            style={{ backgroundColor: theme.accentSoft, borderColor: theme.accentText }}
          >
            <Text style={{ color: theme.accentText }}>{archetypeDisplayName}</Text>
          </View>
        )}

        <Text className='ritual-act-revelation__title'>{copy.heroTitle}</Text>
        <Text className='ritual-act-revelation__subline'>{copy.heroSubline}</Text>

        {/* Value proposition (Understood + Identity) */}
        {valueProp && (
          <View
            className='ritual-act-revelation__value-prop'
            style={{ backgroundColor: theme.accentSoft }}
          >
            <Text style={{ color: theme.accentText }}>{valueProp}</Text>
          </View>
        )}

        {copy.contextLine && (
          <Text className='ritual-act-revelation__context'>{copy.contextLine}</Text>
        )}

        {/* Invitation (Belonging + Ritual) */}
        {showInvitation && (
          <Text
            className={`ritual-act-revelation__invitation ${
              showInvitation ? 'ritual-act-revelation__invitation--visible' : ''
            }`}
          >
            {copy.invitationLine}
          </Text>
        )}
      </View>
    </View>
  )
}

export default memo(RitualActRevelation)
