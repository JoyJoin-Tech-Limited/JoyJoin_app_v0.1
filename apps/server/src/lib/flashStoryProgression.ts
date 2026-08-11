export function selectNextNpcStoryEpisode<T extends { id: string; phase: number }>(
  episodes: readonly T[],
  completedEpisodeIds: ReadonlySet<string>,
): T | null {
  return episodes.reduce<T | null>((next, episode) => {
    if (completedEpisodeIds.has(episode.id)) return next
    if (!next || episode.phase < next.phase) return episode
    return next
  }, null)
}

export function hasCompletedPriorNpcPhases(
  candidatePhase: number,
  completedPhases: readonly number[],
): boolean {
  const completed = new Set(completedPhases)
  for (let phase = 1; phase < candidatePhase; phase += 1) {
    if (!completed.has(phase)) return false
  }
  return true
}

export function isFlashStorySeasonComplete(completedTotal: number, seasonTotal = 15): boolean {
  return completedTotal >= seasonTotal
}
