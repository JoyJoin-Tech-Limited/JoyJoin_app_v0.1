import { createContext, useContext, useState, useCallback, useRef, type PropsWithChildren } from 'react'
import {
  getArchetypeHSL,
  DEFAULT_ACCENT,
  MIN_CONFIDENCE_THRESHOLD,
  type ArchetypeHSL,
} from '@shared/archetypeColors'

interface DynamicAccentContextValue {
  /** Current accent HSL values. */
  currentAccent: ArchetypeHSL
  /** Set accent based on archetype name and confidence score. */
  setArchetype: (archetype: string | null, confidence: number) => void
  /** Reset to default accent. */
  reset: () => void
}

const DynamicAccentContext = createContext<DynamicAccentContextValue | null>(null)

export function useDynamicAccent(): DynamicAccentContextValue {
  const context = useContext(DynamicAccentContext)
  if (!context) {
    throw new Error('useDynamicAccent must be used within DynamicAccentProvider')
  }
  return context
}

/**
 * DynamicAccentProvider — drives personality-based accent theming in the
 * mini-program.
 *
 * Unlike the web client (which mutates CSS custom properties on
 * document.documentElement), the mini-program provider exposes the current
 * accent as React state.  Consumers obtain the colour via `useDynamicAccent()`
 * and apply it through inline styles or computed classNames.
 *
 * SCSS variables in `_variables.scss` cover the default static colours; this
 * provider only activates when the user has a confident archetype result.
 */
export function DynamicAccentProvider({ children }: PropsWithChildren) {
  const [currentAccent, setCurrentAccent] = useState<ArchetypeHSL>(DEFAULT_ACCENT)
  const lastArchetypeRef = useRef<string | null>(null)

  const setArchetype = useCallback((archetype: string | null, confidence: number) => {
    if (confidence < MIN_CONFIDENCE_THRESHOLD) return
    if (archetype === lastArchetypeRef.current) return

    lastArchetypeRef.current = archetype
    setCurrentAccent(getArchetypeHSL(archetype))
  }, [])

  const reset = useCallback(() => {
    lastArchetypeRef.current = null
    setCurrentAccent(DEFAULT_ACCENT)
  }, [])

  return (
    <DynamicAccentContext.Provider value={{ currentAccent, setArchetype, reset }}>
      {children}
    </DynamicAccentContext.Provider>
  )
}

export { formatHSL, type ArchetypeHSL } from '@shared/archetypeColors'
