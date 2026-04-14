import { MINI_PROGRAM_ROUTES } from './onboardingRoutes'

export interface EventsTabRedirectNavigator {
  switchTab(options: { url: string }): Promise<unknown> | unknown
  reLaunch(options: { url: string }): Promise<unknown> | unknown
}

export async function redirectLegacyEventsEntryToTab(
  navigator: EventsTabRedirectNavigator,
): Promise<void> {
  try {
    await Promise.resolve(navigator.switchTab({ url: MINI_PROGRAM_ROUTES.events }))
  } catch {
    await Promise.resolve(navigator.reLaunch({ url: MINI_PROGRAM_ROUTES.events }))
  }
}
