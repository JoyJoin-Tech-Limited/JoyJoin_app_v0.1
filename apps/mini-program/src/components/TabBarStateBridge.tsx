import { useTabBarStateBridge } from '../hooks/navigation/useTabBarStateBridge'

/**
 * App-level bridge that feeds the native custom tab bar.
 *
 * Mounted once inside AuthProvider. Keeps badge counts, center button label,
 * and action in a singleton so tab pages do not each fetch the same data.
 */
export default function TabBarStateBridge() {
  useTabBarStateBridge()
  return null
}
