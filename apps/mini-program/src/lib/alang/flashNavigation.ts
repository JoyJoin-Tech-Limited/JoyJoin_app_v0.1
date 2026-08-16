import Taro from '@tarojs/taro'
import { MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'
import type { FlashCanonicalSnapshot } from './flashTypes'

export interface FlashCanonicalRouteContext {
  replay?: boolean
  replaySession?: string
}

export function decodeFlashRouteParam(value: string | undefined, fallback = ''): string {
  if (!value) return fallback

  let decoded = value
  while (true) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      return /%[0-9a-f]{2}/i.test(decoded) ? fallback : decoded
    }
  }
  return decoded
}

function query(path: string, params: Record<string, string | undefined>): string {
  const search = Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return search ? `${path}?${search}` : path
}

export function getFlashCanonicalRoute(
  snapshot: FlashCanonicalSnapshot,
  context: FlashCanonicalRouteContext = {},
): string | null {
  const screen = snapshot.canonicalScreen?.trim().toLowerCase().replace(/^flash[_-]/, '')
  switch (screen) {
    case 'map':
      return snapshot.appearanceId
        ? query(MINI_PROGRAM_ROUTES.alangSearch, { appearanceId: snapshot.appearanceId })
        : MINI_PROGRAM_ROUTES.alangEvent
    // Compatibility for cached snapshots from versions that called this page radar.
    case 'radar':
    case 'search':
      return snapshot.appearanceId
        ? query(MINI_PROGRAM_ROUTES.alangSearch, { appearanceId: snapshot.appearanceId })
        : MINI_PROGRAM_ROUTES.alangEvent
    case 'dialogue':
    case 'encounter':
    case 'delivery':
      return snapshot.encounterId
        ? query(
            MINI_PROGRAM_ROUTES.alangLaterDialogue,
            {
              encounterId: snapshot.encounterId,
              replay: context.replay ? '1' : undefined,
              replaySession: context.replay ? context.replaySession : undefined,
            },
          )
        : MINI_PROGRAM_ROUTES.alangEvent
    case 'task':
    case 'assignment':
    case 'arrived':
      return snapshot.assignmentId
        ? query(MINI_PROGRAM_ROUTES.alangCompanion, { assignmentId: snapshot.assignmentId })
        : MINI_PROGRAM_ROUTES.alangEvent
    case 'feedback':
      return snapshot.assignmentId
        ? query(MINI_PROGRAM_ROUTES.alangResult, { assignmentId: snapshot.assignmentId })
        : MINI_PROGRAM_ROUTES.alangEvent
    case 'home':
    case 'completed':
    case 'expired':
    case 'unavailable':
      return MINI_PROGRAM_ROUTES.alangEvent
    default:
      return null
  }
}

export async function redirectToFlashCanonical(
  snapshot: FlashCanonicalSnapshot,
  currentPath: string,
  context: FlashCanonicalRouteContext = {},
): Promise<boolean> {
  const route = getFlashCanonicalRoute(snapshot, context)
  if (!route) return false
  const routePath = route.split('?')[0]
  const normalizedCurrentPath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`
  let topPagePath = ''
  try {
    const pages = Taro.getCurrentPages()
    const topRoute = pages[pages.length - 1]?.route?.split('?')[0] ?? ''
    topPagePath = topRoute ? (topRoute.startsWith('/') ? topRoute : `/${topRoute}`) : ''
  } catch {
    // The explicit caller path remains the fallback in non-WeChat runtimes.
  }
  if (routePath === normalizedCurrentPath || routePath === topPagePath) return false
  await Taro.redirectTo({ url: route })
  return true
}
