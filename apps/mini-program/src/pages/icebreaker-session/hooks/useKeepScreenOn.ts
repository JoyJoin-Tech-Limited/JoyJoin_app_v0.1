import { useEffect } from 'react'
import Taro from '@tarojs/taro'

/**
 * Holds the screen awake while `enabled` — the POCKET posture of playbook §10
 * ruling 4 (screen-on, face-down, app foreground) so haptics and the ambient
 * mood field keep reaching the table. Releases on disable and on unmount.
 * Silently no-ops where the API is missing: screen-on must never block the
 * session page. Caller composes the gate (flag ∧ page visibility).
 */
export function useKeepScreenOn(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    try {
      Taro.setKeepScreenOn({ keepScreenOn: true })
    } catch {
      // optional effect — never throw into the page
    }

    return () => {
      try {
        Taro.setKeepScreenOn({ keepScreenOn: false })
      } catch {
        // silently ignore
      }
    }
  }, [enabled])
}
