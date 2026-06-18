import type { DiscoverShellResponse, EventPoolSummary } from '@shared/api'

interface LoadDiscoverPoolsOptions {
  fetchShell: () => Promise<DiscoverShellResponse>
  fetchLegacyPools: () => Promise<EventPoolSummary[]>
  onShellLoaded: (shell: DiscoverShellResponse) => void
}

/**
 * Prefer the composite shell, but verify an empty shell against the canonical
 * pool endpoint. Admin-created pools can otherwise remain hidden behind a
 * stale empty shell response.
 */
export async function loadDiscoverPools({
  fetchShell,
  fetchLegacyPools,
  onShellLoaded,
}: LoadDiscoverPoolsOptions): Promise<EventPoolSummary[]> {
  let shellLoaded = false

  try {
    const shell = await fetchShell()
    shellLoaded = true
    onShellLoaded(shell)

    if (shell.pools.items.length > 0) {
      return shell.pools.items as EventPoolSummary[]
    }
  } catch {
    // The canonical endpoint below is also the fallback for shell failures.
  }

  try {
    return await fetchLegacyPools()
  } catch (error) {
    if (shellLoaded) {
      return []
    }
    throw error
  }
}
