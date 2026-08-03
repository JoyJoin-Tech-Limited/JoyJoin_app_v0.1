/**
 * Payment Ritual V2 — Archetype Theme Hook
 *
 * Dynamically applies archetype family colors to the payment ritual.
 */

import { useMemo } from 'react'
import {
  ARCHETYPE_FAMILY_COLORS,
  getArchetypeFamily,
} from '@shared/archetypeColors'
import type { ArchetypeTheme, ArchetypeFamily } from '../lib/paymentRitualState'

function buildTheme(family: ArchetypeFamily): ArchetypeTheme {
  const primary = ARCHETYPE_FAMILY_COLORS[family] ?? '#8B5CF6'

  // Parse hex to rgba for soft accents
  const r = parseInt(primary.slice(1, 3), 16)
  const g = parseInt(primary.slice(3, 5), 16)
  const b = parseInt(primary.slice(5, 7), 16)

  return {
    family,
    primaryColor: primary,
    accentSoft: `rgba(${r}, ${g}, ${b}, 0.06)`,
    accentBold: primary,
    accentText: `rgba(${r}, ${g}, ${b}, 0.88)`,
  }
}

export function useArchetypeTheme(archetype: string | null): ArchetypeTheme {
  return useMemo(() => {
    const family = getArchetypeFamily(archetype)
    return buildTheme(family)
  }, [archetype])
}

export { type ArchetypeTheme }
