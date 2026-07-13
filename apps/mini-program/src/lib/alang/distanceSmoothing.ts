export interface AlangDistanceSmoothingState {
  emaMeters: number | null
  displayMeters: number | null
}

export const EMPTY_ALANG_DISTANCE_SMOOTHING_STATE: AlangDistanceSmoothingState = {
  emaMeters: null,
  displayMeters: null,
}

const EMA_ALPHA = 0.35
const DISPLAY_DEADBAND_METERS = 1

/**
 * Smooths noisy GPS distance for presentation only. Arrival remains entirely
 * server-authoritative; callers use `force` solely after the server confirms
 * arrival so the visible number cannot contradict that confirmed state.
 */
export function smoothAlangDistance(
  previous: AlangDistanceSmoothingState,
  sampleMeters: number,
  force = false,
): AlangDistanceSmoothingState {
  if (!Number.isFinite(sampleMeters) || sampleMeters < 0) return previous

  const emaMeters = force || previous.emaMeters === null
    ? sampleMeters
    : previous.emaMeters + EMA_ALPHA * (sampleMeters - previous.emaMeters)
  const shouldUpdateDisplay = force
    || previous.displayMeters === null
    || Math.abs(emaMeters - previous.displayMeters) >= DISPLAY_DEADBAND_METERS

  return {
    emaMeters,
    displayMeters: shouldUpdateDisplay ? emaMeters : previous.displayMeters,
  }
}
