import { useCallback, useState } from 'react'
import type { AlangCoordinate } from '@shared/alang/missionTypes'
import { getCurrentPosition } from './api'

/**
 * Strict non-production point configuration still needs one explicit GPS
 * sample. Formal Flash pages use `getOneShotFlashLocation` instead. Continuous
 * tracking was intentionally removed when the prototype search flow retired.
 */
export function useAlangGpsOnce() {
  const [position, setPosition] = useState<(AlangCoordinate & { accuracy: number }) | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  const request = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getCurrentPosition()
      const nextPosition = {
        latitude: res.latitude,
        longitude: res.longitude,
        accuracy: res.accuracy ?? 50,
      }
      setPosition(nextPosition)
      setLoading(false)
      return nextPosition
    } catch (requestError) {
      setError(requestError)
      setLoading(false)
      throw requestError
    }
  }, [])

  return { position, error, loading, request }
}
