import { useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'

/**
 * Runs a cleanup function when the mini-program page is unloaded
 * (user swipes back, navigates away, or the page is destroyed).
 *
 * Mirrors `componentWillUnmount` / `useEffect` cleanup for Taro page lifecycle.
 */
export function useUnload(cleanup: () => void): void {
  const cleanupRef = useRef(cleanup)
  cleanupRef.current = cleanup

  useEffect(() => {
    const handler = (): void => {
      cleanupRef.current()
    }
    // Taro page unload event
    Taro.eventCenter.on('__taroRouterChange', handler)
    return () => {
      Taro.eventCenter.off('__taroRouterChange', handler)
    }
  }, [])
}
